#!/usr/bin/env python3

"""
GEDCOM 5.5.1 Import Script

Imports GEDCOM 5.5.1 format file into genealogy database using backend models.

Usage:
    python -m database.gedcom_import [--user USERNAME] [input_file]

    --user USERNAME : Import for specific user (default: inovoseltsev)
    input_file      : Path to GEDCOM file (default: user's data.ged)

Examples:
    python -m database.gedcom_import --user inovoseltsev
    python -m database.gedcom_import --user john path/to/family.ged
"""

import sys
import re
import shutil
import argparse
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import database.db
from backend import schemas
from database.models import (
    Individual, IndividualName, Family, FamilyMember, FamilyChild,
    Event, Media, Header
)
from database.user_info import UserInfo
from sqlalchemy.orm import Session
from sqlalchemy import text
from backend.api.api_utils import generate_family_note

# GEDCOM event tags for individuals
INDI_EVENT_TAGS = {
    "BIRT", "DEAT", "BURI", "CREM",  # Birth, death, burial, cremation
    "BAPM", "BARM", "BASM", "BLES",  # Baptism, bar/bat mitzvah, blessing
    "CHR", "CHRA", "CONF", "FCOM",   # Christening, confirmation, first communion
    "ORDN", "NATU", "EMIG", "IMMI",  # Ordination, naturalization, emigration, immigration
    "CENS", "PROB", "WILL",          # Census, probate, will
    "GRAD", "RETI", "EVEN",          # Graduation, retirement, generic event
    "OCCU", "EDUC", "RESI",          # Occupation, education, residence
}
# GEDCOM event tags for families
FAM_EVENT_TAGS = {
    "MARR", "MARB", "MARC", "MARL", "MARS",  # Marriage types
    "DIV", "DIVF", "ANUL", "ENGA",            # Divorce, annulment, engagement
    "CENS", "EVEN",                           # Census, generic event
}
SUPPORTED_INDI_TAGS = INDI_EVENT_TAGS | {"NAME", "SEX", "NOTE", "FAMC", "FAMS", "TYPE", "OBJE"}
SUPPORTED_FAM_TAGS = FAM_EVENT_TAGS | {"HUSB", "WIFE", "CHIL", "NOTE", "OBJE"}
SUPPORTED_L2_TAGS = {"DATE", "PLAC", "TYPE", "FILE", "FORM", "TITL"}


# ==================== ORM Helper Functions ====================

def _create_individual(individual_data, db: Session) -> Individual:
    """Create an individual with associated names."""
    db_individual = Individual(
        gedcom_id=individual_data.gedcom_id,
        sex_code=individual_data.sex_code,
        birth_date=individual_data.birth_date,
        birth_date_approx=individual_data.birth_date_approx,
        birth_place=individual_data.birth_place,
        death_date=individual_data.death_date,
        death_date_approx=individual_data.death_date_approx,
        death_place=individual_data.death_place,
        notes=individual_data.notes,
    )

    for name_in in individual_data.names:
        db_name = IndividualName(
            given_name=name_in.given_name,
            family_name=name_in.family_name,
            name_type=name_in.name_type,
            name_order=name_in.name_order,
            individual=db_individual,
        )
        db.add(db_name)

    db.add(db_individual)
    db.flush()
    return db_individual


def _create_family(family_data, db: Session) -> Family:
    """Create a family with associated members and children."""
    db_family = Family(
        gedcom_id=family_data.gedcom_id,
        marriage_date=family_data.marriage_date,
        marriage_date_approx=family_data.marriage_date_approx,
        marriage_place=family_data.marriage_place,
        divorce_date=family_data.divorce_date,
        divorce_date_approx=family_data.divorce_date_approx,
        family_type=family_data.family_type or "marriage",
        notes=family_data.notes,
    )

    for member_in in family_data.members:
        db_member = FamilyMember(
            individual_id=member_in.individual_id,
            role=member_in.role,
            family=db_family,
        )
        db.add(db_member)

    for child_in in family_data.children:
        db_child = FamilyChild(
            child_id=child_in.child_id,
            family=db_family,
        )
        db.add(db_child)

    db.add(db_family)
    db.flush()
    return db_family


# ==================== File Operations ====================

def backup_database(db_file: Path) -> Optional[Path]:
    """Create timestamped backup of existing database."""
    if not db_file.exists():
        print(f"[WARN] Database {db_file} does not exist, skipping backup")
        return None

    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    backup_path = db_file.with_suffix(f".sqlite.{timestamp}")
    shutil.copy2(db_file, backup_path)
    print(f"[OK] Backed up {db_file} -> {backup_path}")
    return backup_path

def is_exact_gedcom_date(gedcom_date: str) -> bool:
    """Check if GEDCOM date is exact (DD MON YYYY with no modifiers).

    Returns True only for exact dates that can be losslessly converted to/from ISO.
    """
    if not gedcom_date:
        return False

    months = {"JAN", "FEB", "MAR", "APR", "MAY", "JUN",
              "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"}
    modifiers = {"ABT", "BEF", "AFT", "EST", "CAL", "FROM", "TO", "BET", "AND", "INT"}

    parts = gedcom_date.upper().split()

    # Check for modifiers - if present, not exact
    if parts and parts[0] in modifiers:
        return False

    # Must be exactly 3 parts: DD MON YYYY
    if len(parts) != 3:
        return False

    try:
        day = int(parts[0])
        if parts[1] not in months:
            return False
        year = int(parts[2])
        # Validate day is reasonable
        if day < 1 or day > 31:
            return False
        return True
    except:
        return False


def parse_gedcom_date(gedcom_date: str) -> Optional[str]:
    """Convert exact GEDCOM date to ISO format (YYYY-MM-DD).

    Only parses exact dates (DD MON YYYY). Returns None for partial or modified dates.
    For non-exact dates, store the raw GEDCOM string in X_date_approx instead.
    """
    if not gedcom_date or not is_exact_gedcom_date(gedcom_date):
        return None

    months = {
        "JAN": 1, "FEB": 2, "MAR": 3, "APR": 4, "MAY": 5, "JUN": 6,
        "JUL": 7, "AUG": 8, "SEP": 9, "OCT": 10, "NOV": 11, "DEC": 12
    }

    parts = gedcom_date.upper().split()

    try:
        day = int(parts[0])
        month = months.get(parts[1], 1)
        year = int(parts[2])
        return f"{year:04d}-{month:02d}-{day:02d}"
    except:
        return None

def parse_gedcom_file(gedcom_file: Path) -> Tuple[Dict, Dict, Dict, List[str]]:
    """Parse GEDCOM file, return header, individuals, families, and unsupported tags."""
    header: Dict = {
        "source_system_id": None,
        "source_system_name": None,
        "source_version": None,
        "source_corporation": None,
        "file_name": None,
        "creation_date": None,
        "creation_time": None,
        "gedcom_version": "5.5.1",
        "gedcom_form": "LINEAGE-LINKED",
        "charset": "UTF-8",
        "language": None,
        "copyright": None,
        "destination": None,
        "note": None,
        "submitter_id": None,
        "submitter_name": None,
        "submitter_address": None,
        "submitter_city": None,
        "submitter_state": None,
        "submitter_postal": None,
        "submitter_country": None,
        "submitter_phone": None,
        "submitter_email": None,
        "submitter_fax": None,
        "submitter_www": None,
    }
    individuals: Dict[str, Dict] = {}
    families: Dict[str, Dict] = {}
    current_record = None
    current_type: Optional[str] = None
    current_event: Optional[Dict] = None  # Track current event being parsed
    current_media: Optional[Dict] = None  # Track current media being parsed
    current_subrecord: Optional[str] = None  # Track nested structures (SOUR, GEDC, ADDR)
    unsupported_tags = []

    with open(gedcom_file, 'r', encoding='utf-8') as f:
        for line_num, line in enumerate(f, 1):
            line = line.rstrip('\n\r')
            if not line.strip():
                continue

            parts = line.split(None, 2)
            if not parts:
                continue

            level = int(parts[0])
            tag = parts[1] if len(parts) > 1 else ""
            value = parts[2] if len(parts) > 2 else ""

            # New record - GEDCOM format is: "0 @ID@ TYPE" (e.g., "0 @I0001@ INDI")
            if level == 0:
                current_event = None
                current_media = None
                current_subrecord = None
                # Check if tag contains @ID@ pattern (standard GEDCOM format)
                id_match = re.search(r'@([^@]+)@', tag)
                if id_match:
                    gedcom_id = id_match.group(1)
                    record_type = value  # The type (INDI, FAM, etc.) is in the value position

                    if record_type == "INDI":
                        current_record = {
                            "gedcom_id": gedcom_id,
                            "names": [],
                            "sex": None,
                            "birth": {"date": None, "date_approx": None, "place": None},
                            "death": {"date": None, "date_approx": None, "place": None},
                            "events": [],   # Additional events
                            "media": [],    # Media objects
                            "notes": None,
                            "famc": None,
                            "fams": None
                        }
                        current_type = "INDI"
                        individuals[gedcom_id] = current_record
                    elif record_type == "FAM":
                        current_record = {
                            "gedcom_id": gedcom_id,
                            "husb": None,
                            "wife": None,
                            "children": [],
                            "marr": {"date": None, "date_approx": None, "place": None},
                            "div": {"date": None, "date_approx": None, "place": None},
                            "events": [],   # Additional events
                            "media": [],    # Media objects
                            "notes": None
                        }
                        current_type = "FAM"
                        families[gedcom_id] = current_record
                    elif record_type == "SUBM":
                        # Submitter record
                        header["submitter_id"] = gedcom_id
                        current_record = header
                        current_type = "SUBM"
                    else:
                        current_record = None
                        current_type = None
                elif tag == "HEAD":
                    current_record = header
                    current_type = "HEAD"
                else:
                    # Other level 0 records (TRLR, etc.)
                    current_record = None
                    current_type = None
                continue

            if not current_record or not current_type:
                continue

            # Parse HEAD record
            if current_type == "HEAD":
                if level == 1:
                    current_subrecord = None
                    if tag == "SOUR":
                        header["source_system_id"] = value
                        current_subrecord = "SOUR"
                    elif tag == "DATE":
                        header["creation_date"] = value
                    elif tag == "FILE":
                        header["file_name"] = value
                    elif tag == "CHAR":
                        header["charset"] = value
                    elif tag == "LANG":
                        header["language"] = value
                    elif tag == "COPR":
                        header["copyright"] = value
                    elif tag == "DEST":
                        header["destination"] = value
                    elif tag == "NOTE":
                        header["note"] = value
                    elif tag == "GEDC":
                        current_subrecord = "GEDC"
                    elif tag == "SUBM":
                        # Reference to submitter - extract ID
                        subm_match = re.search(r'@([^@]+)@', value)
                        if subm_match:
                            header["submitter_id"] = subm_match.group(1)
                elif level == 2:
                    if current_subrecord == "SOUR":
                        if tag == "NAME":
                            header["source_system_name"] = value
                        elif tag == "VERS":
                            header["source_version"] = value
                        elif tag == "CORP":
                            header["source_corporation"] = value
                    elif current_subrecord == "GEDC":
                        if tag == "VERS":
                            header["gedcom_version"] = value
                        elif tag == "FORM":
                            header["gedcom_form"] = value
                    elif tag == "TIME":
                        header["creation_time"] = value
                continue

            # Parse SUBM record
            if current_type == "SUBM":
                if level == 1:
                    current_subrecord = None
                    if tag == "NAME":
                        header["submitter_name"] = value
                    elif tag == "ADDR":
                        header["submitter_address"] = value
                        current_subrecord = "ADDR"
                    elif tag == "PHON":
                        header["submitter_phone"] = value
                    elif tag == "EMAIL":
                        header["submitter_email"] = value
                    elif tag == "FAX":
                        header["submitter_fax"] = value
                    elif tag == "WWW":
                        header["submitter_www"] = value
                elif level == 2 and current_subrecord == "ADDR":
                    if tag == "CITY":
                        header["submitter_city"] = value
                    elif tag == "STAE":
                        header["submitter_state"] = value
                    elif tag == "POST":
                        header["submitter_postal"] = value
                    elif tag == "CTRY":
                        header["submitter_country"] = value
                continue

            # Individual details
            if current_type == "INDI":
                if level == 1:
                    current_event = None
                    current_media = None
                    if tag == "NAME":
                        # GEDCOM NAME format: "Given /Family/" - family name is between slashes
                        # Use greedy match for family name to capture full name
                        name_match = re.match(r'(.+?)\s*/([^/]*)/?\s*$', value)
                        name_data = {
                            "given": name_match.group(1).strip() if name_match else value,
                            "family": name_match.group(2).strip() if name_match else "",
                            "type": None
                        }
                        current_record["names"].append(name_data)
                    elif tag == "SEX":
                        current_record["sex"] = value
                    elif tag == "BIRT":
                        current_record["birth"] = {"date": None, "date_approx": None, "place": None}
                        current_event = current_record["birth"]
                        current_event["_tag"] = "BIRT"
                    elif tag == "DEAT":
                        current_record["death"] = {"date": None, "date_approx": None, "place": None}
                        current_event = current_record["death"]
                        current_event["_tag"] = "DEAT"
                    elif tag in INDI_EVENT_TAGS and tag not in ("BIRT", "DEAT"):
                        # Other events go to events list
                        current_event = {"type": tag, "date": None, "date_approx": None, "place": None, "description": value or None}
                        current_record["events"].append(current_event)
                    elif tag == "OBJE":
                        current_media = {"file": None, "type": None, "title": value or None}
                        current_record["media"].append(current_media)
                    elif tag == "NOTE":
                        current_record["notes"] = value
                    elif tag in ("FAMC", "FAMS"):
                        current_record[tag.lower()] = value
                    elif tag not in SUPPORTED_INDI_TAGS:
                        unsupported_tags.append(f"{line} (line {line_num})")
                elif level == 2:
                    if current_event:
                        if tag == "DATE":
                            # Mutual exclusivity: exact dates go to date, others to date_approx
                            if is_exact_gedcom_date(value):
                                current_event["date"] = parse_gedcom_date(value)
                                current_event["date_approx"] = None
                            else:
                                current_event["date"] = None
                                current_event["date_approx"] = value
                        elif tag == "PLAC":
                            current_event["place"] = value
                        elif tag == "TYPE":
                            current_event["description"] = value
                    elif current_media:
                        if tag == "FILE":
                            current_media["file"] = value
                        elif tag == "FORM":
                            current_media["type"] = value
                        elif tag == "TITL":
                            current_media["title"] = value
                    elif current_record.get("names") and tag == "TYPE":
                        current_record["names"][-1]["type"] = value

            # Family details
            elif current_type == "FAM":
                if level == 1:
                    current_event = None
                    current_media = None
                    if tag == "HUSB":
                        match = re.search(r'@([^@]+)@', value)
                        if match:
                            current_record["husb"] = match.group(1)
                    elif tag == "WIFE":
                        match = re.search(r'@([^@]+)@', value)
                        if match:
                            current_record["wife"] = match.group(1)
                    elif tag == "CHIL":
                        match = re.search(r'@([^@]+)@', value)
                        if match:
                            current_record["children"].append(match.group(1))
                    elif tag == "MARR":
                        current_record["marr"] = {"date": None, "date_approx": None, "place": None}
                        current_event = current_record["marr"]
                        current_event["_tag"] = "MARR"
                    elif tag == "DIV":
                        current_record["div"] = {"date": None, "date_approx": None, "place": None}
                        current_event = current_record["div"]
                        current_event["_tag"] = "DIV"
                    elif tag in FAM_EVENT_TAGS and tag not in ("MARR", "DIV"):
                        # Other events go to events list
                        current_event = {"type": tag, "date": None, "date_approx": None, "place": None, "description": value or None}
                        current_record["events"].append(current_event)
                    elif tag == "OBJE":
                        current_media = {"file": None, "type": None, "title": value or None}
                        current_record["media"].append(current_media)
                    elif tag == "NOTE":
                        current_record["notes"] = value
                    elif tag not in SUPPORTED_FAM_TAGS:
                        unsupported_tags.append(f"{line} (line {line_num})")
                elif level == 2:
                    if current_event:
                        if tag == "DATE":
                            # Mutual exclusivity: exact dates go to date, others to date_approx
                            if is_exact_gedcom_date(value):
                                current_event["date"] = parse_gedcom_date(value)
                                current_event["date_approx"] = None
                            else:
                                current_event["date"] = None
                                current_event["date_approx"] = value
                        elif tag == "PLAC":
                            current_event["place"] = value
                        elif tag == "TYPE":
                            current_event["description"] = value
                    elif current_media:
                        if tag == "FILE":
                            current_media["file"] = value
                        elif tag == "FORM":
                            current_media["type"] = value
                        elif tag == "TITL":
                            current_media["title"] = value

    return header, individuals, families, unsupported_tags

def import_gedcom(gedcom_file: Path, db_file: Path) -> bool:
    """Import GEDCOM file into database using backend models."""

    # Validation
    if not gedcom_file.exists() or gedcom_file.stat().st_size == 0:
        print(f"[ERROR] Empty or missing GEDCOM file: {gedcom_file}")
        return False

    # Backup database
    backup_database(db_file)

    # Parse GEDCOM
    print(f"Parsing {gedcom_file}...")
    header, individuals, families, unsupported_tags = parse_gedcom_file(gedcom_file)
    print(f"  Found {len(individuals)} individuals, {len(families)} families")

    if len(individuals) + len(families) == 0:
        print(f"[ERROR] No GEDCOM records (INDI/FAM) found in {gedcom_file}")
        return False

    # Warn about unsupported tags
    if unsupported_tags:
        print(f"[WARN] Found {len(unsupported_tags)} unsupported GEDCOM tags:")
        for tag in unsupported_tags[:5]:  # Show first 5
            print(f"  - {tag}")
        if len(unsupported_tags) > 5:
            print(f"  ... and {len(unsupported_tags) - 5} more")
        print()

    try:
        db_engine = database.db.engine_from_url(f"sqlite:///{db_file}")
        with Session(bind=db_engine) as db:
            # Clear existing data (order matters due to foreign key constraints)
            print("Clearing existing data...")
            for table in ["main_family_children", "main_family_members",
                         "main_events", "main_media",
                         "main_families", "main_individual_names", "main_individuals",
                         "meta_header"]:
                db.execute(text(f"DELETE FROM {table}"))
            db.commit()

            # Import header metadata
            header["imported_at"] = datetime.now().isoformat()
            db_header = Header(
                id=1,
                source_system_id=header.get("source_system_id"),
                source_system_name=header.get("source_system_name"),
                source_version=header.get("source_version"),
                source_corporation=header.get("source_corporation"),
                file_name=header.get("file_name"),
                creation_date=header.get("creation_date"),
                creation_time=header.get("creation_time"),
                gedcom_version=header.get("gedcom_version", "5.5.1"),
                gedcom_form=header.get("gedcom_form", "LINEAGE-LINKED"),
                charset=header.get("charset", "UTF-8"),
                language=header.get("language"),
                copyright=header.get("copyright"),
                destination=header.get("destination"),
                note=header.get("note"),
                submitter_id=header.get("submitter_id"),
                submitter_name=header.get("submitter_name"),
                submitter_address=header.get("submitter_address"),
                submitter_city=header.get("submitter_city"),
                submitter_state=header.get("submitter_state"),
                submitter_postal=header.get("submitter_postal"),
                submitter_country=header.get("submitter_country"),
                submitter_phone=header.get("submitter_phone"),
                submitter_email=header.get("submitter_email"),
                submitter_fax=header.get("submitter_fax"),
                submitter_www=header.get("submitter_www"),
                imported_at=header.get("imported_at"),
            )
            db.add(db_header)

            gedcom_to_db_id = {}

            # Import individuals first
            print("Importing individuals...")
            event_count = 0
            media_count = 0
            for gedcom_id, ind_data in individuals.items():
                # Create individual with raw GEDCOM dates
                ind_create = schemas.IndividualCreate(
                    gedcom_id=gedcom_id,
                    sex_code=ind_data.get("sex", "U"),
                    birth_date=ind_data["birth"]["date"],
                    birth_date_approx=ind_data["birth"].get("date_approx"),
                    birth_place=ind_data["birth"]["place"],
                    death_date=ind_data["death"]["date"],
                    death_date_approx=ind_data["death"].get("date_approx"),
                    death_place=ind_data["death"]["place"],
                    notes=ind_data.get("notes"),
                    names=[]
                )

                # Add names (preserve original order)
                for idx, name_data in enumerate(ind_data["names"]):
                    ind_create.names.append(schemas.IndividualNameCreate(
                        given_name=name_data["given"],
                        family_name=name_data["family"],
                        name_type=name_data.get("type"),
                        name_order=idx
                    ))

                db_ind = _create_individual(ind_create, db)
                gedcom_to_db_id[gedcom_id] = db_ind.id

                # Add events for this individual (with raw GEDCOM dates)
                for event_data in ind_data.get("events", []):
                    db_event = Event(
                        individual_id=db_ind.id,
                        event_type_code=event_data["type"],
                        event_date=event_data.get("date"),
                        event_date_approx=event_data.get("date_approx"),
                        event_place=event_data.get("place"),
                        description=event_data.get("description")
                    )
                    db.add(db_event)
                    event_count += 1

                # Add media for this individual
                for media_data in ind_data.get("media", []):
                    if media_data.get("file"):  # Only add if file path exists
                        db_media = Media(
                            individual_id=db_ind.id,
                            file_path=media_data["file"],
                            media_type_code=media_data.get("type"),
                            description=media_data.get("title")
                        )
                        db.add(db_media)
                        media_count += 1

            # Import families
            print("Importing families...")
            family_to_db_id = {}
            for gedcom_id, fam_data in families.items():
                fam_create = schemas.FamilyCreate(
                    gedcom_id=gedcom_id,
                    marriage_date=fam_data["marr"]["date"],
                    marriage_date_approx=fam_data["marr"].get("date_approx"),
                    marriage_place=fam_data["marr"]["place"],
                    divorce_date=fam_data["div"]["date"] if "div" in fam_data else None,
                    divorce_date_approx=fam_data["div"].get("date_approx") if "div" in fam_data else None,
                    notes=fam_data.get("notes"),
                    members=[],
                    children=[]
                )

                # Add members
                if fam_data.get("husb") and fam_data["husb"] in gedcom_to_db_id:
                    fam_create.members.append(schemas.FamilyMemberCreate(
                        individual_id=gedcom_to_db_id[fam_data["husb"]],
                        role="husband"
                    ))
                if fam_data.get("wife") and fam_data["wife"] in gedcom_to_db_id:
                    fam_create.members.append(schemas.FamilyMemberCreate(
                        individual_id=gedcom_to_db_id[fam_data["wife"]],
                        role="wife"
                    ))

                # Add children
                for child_id in fam_data.get("children", []):
                    if child_id in gedcom_to_db_id:
                        fam_create.children.append(schemas.FamilyChildCreate(
                            child_id=gedcom_to_db_id[child_id]
                        ))

                # Generate note if not provided
                if not fam_create.notes:
                    members_list = [{"individual_id": m.individual_id, "role": m.role} for m in fam_create.members]
                    children_list = [{"child_id": c.child_id} for c in fam_create.children]
                    generated_note = generate_family_note(db, members_list, children_list, fam_create.family_type)
                    if generated_note:
                        fam_create.notes = generated_note

                db_fam = _create_family(fam_create, db)
                family_to_db_id[gedcom_id] = db_fam.id

                # Add events for this family (with raw GEDCOM dates)
                for event_data in fam_data.get("events", []):
                    db_event = Event(
                        family_id=db_fam.id,
                        event_type_code=event_data["type"],
                        event_date=event_data.get("date"),
                        event_date_approx=event_data.get("date_approx"),
                        event_place=event_data.get("place"),
                        description=event_data.get("description")
                    )
                    db.add(db_event)
                    event_count += 1

                # Add media for this family
                for media_data in fam_data.get("media", []):
                    if media_data.get("file"):  # Only add if file path exists
                        db_media = Media(
                            family_id=db_fam.id,
                            file_path=media_data["file"],
                            media_type_code=media_data.get("type"),
                            description=media_data.get("title")
                        )
                        db.add(db_media)
                        media_count += 1

            db.commit()
            print(f"[OK] Successfully imported {gedcom_file}")
            print(f"  - {len(gedcom_to_db_id)} individuals")
            print(f"  - {len(families)} families")
            if event_count > 0:
                print(f"  - {event_count} events")
            if media_count > 0:
                print(f"  - {media_count} media objects")

            # Dispose engine to release file locks (important on Windows)
            db_engine.dispose()
            return True

    except Exception as e:
        print(f"[ERROR] Import failed: {e}")
        if 'db_engine' in locals():
            db_engine.dispose()
        return False

def import_for_user(username: Optional[str] = None, gedcom_file: Optional[str] = None) -> bool:
    """
    Import GEDCOM file for a specific user.

    Args:
        username: Username to import for. Uses default user if None.
        gedcom_file: Path to GEDCOM file. Uses user's data.ged if None.

    Returns:
        True if import succeeded, False otherwise.
    """
    user_info = UserInfo(username=username, gedcom_file=gedcom_file)

    print(f"Importing for user: {user_info.username}")
    print(f"   GEDCOM file: {user_info.gedcom_file}")
    print(f"   Database: {user_info.db_file}")

    # user_info.gedcom_file and db_file are always Path after __post_init__
    return import_gedcom(Path(user_info.gedcom_file), Path(user_info.db_file))  # type: ignore[arg-type]


if __name__ == "__main__":
    # Get default username for help text
    default_user = UserInfo()

    parser = argparse.ArgumentParser(
        description="Import GEDCOM 5.5.1 file into user's genealogy database"
    )
    parser.add_argument(
        "--user", "-u", default=None,
        help=f"Username to import for (default: {default_user.username})"
    )
    parser.add_argument(
        "input_file", nargs="?", default=None,
        help="Path to GEDCOM file (default: user's data.ged)"
    )

    args = parser.parse_args()

    if not import_for_user(args.user, args.input_file):
        sys.exit(1)
