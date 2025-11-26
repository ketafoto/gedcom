#!/usr/bin/env python3

"""
GEDCOM 5.5.1 Import Script

Imports GEDCOM 5.5.1 format file into genealogy database using backend models.

Usage:
    python gedcom_import.py [input_file] [db_file]
"""

import sys
import re
import os
import shutil
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import database.db
from database import schemas
from database.models import (
    Individual, IndividualName, Family, FamilyMember, FamilyChild,
    Event, Media
)
from sqlalchemy.orm import Session

SUPPORTED_INDI_TAGS = {
    "NAME", "SEX", "BIRT", "DEAT", "OCCU", "NOTE", "FAMC", "FAMS", "TYPE"
}
SUPPORTED_FAM_TAGS = {
    "HUSB", "WIFE", "CHIL", "MARR", "DIV", "NOTE"
}
SUPPORTED_L2_TAGS = {"DATE", "PLAC", "TYPE"}

def backup_database(db_file: str) -> Optional[str]:
    """Create timestamped backup of existing database."""
    if not os.path.exists(db_file):
        print(f"⚠️  Database {db_file} does not exist, skipping backup")
        return None

    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    backup_path = db_file.replace(".sqlite", f".sqlite.{timestamp}")
    shutil.copy2(db_file, backup_path)
    print(f"✅ Backed up {db_file} → {backup_path}")
    return backup_path

def parse_gedcom_date(gedcom_date: str) -> Optional[str]:
    """Convert GEDCOM date (DD MON YYYY) to ISO format (YYYY-MM-DD)."""
    if not gedcom_date:
        return None

    months = {
        "JAN": 1, "FEB": 2, "MAR": 3, "APR": 4, "MAY": 5, "JUN": 6,
        "JUL": 7, "AUG": 8, "SEP": 9, "OCT": 10, "NOV": 11, "DEC": 12
    }

    parts = gedcom_date.upper().split()
    try:
        if len(parts) == 3:  # DD MON YYYY
            day = int(parts[0])
            month = months.get(parts[1], 1)
            year = int(parts[2])
        elif len(parts) == 2:  # MON YYYY
            day = 15
            month = months.get(parts[0], 1)
            year = int(parts[1])
        elif len(parts) == 1:  # YYYY
            day = 15
            month = 6
            year = int(parts[0])
        else:
            return None
        return f"{year:04d}-{month:02d}-{day:02d}"
    except:
        return None

def parse_gedcom_file(gedcom_file: str) -> Tuple[Dict, Dict, List[str]]:
    """Parse GEDCOM file, return individuals, families, and unsupported tags."""
    individuals: Dict[str, Dict] = {}
    families: Dict[str, Dict] = {}
    current_record = None
    current_type: Optional[str] = None
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

            # New record
            if level == 0:
                if tag == "INDI":
                    match = re.search(r'@([^@]+)@', value)
                    if match:
                        gedcom_id = match.group(1)
                        current_record = {
                            "gedcom_id": gedcom_id,
                            "names": [],
                            "sex": None,
                            "birth": {"date": None, "place": None},
                            "death": {"date": None, "place": None},
                            "occupation": None,
                            "notes": None,
                            "famc": None,
                            "fams": None
                        }
                        current_type = "INDI"
                        individuals[gedcom_id] = current_record
                elif tag == "FAM":
                    match = re.search(r'@([^@]+)@', value)
                    if match:
                        gedcom_id = match.group(1)
                        current_record = {
                            "gedcom_id": gedcom_id,
                            "husb": None,
                            "wife": None,
                            "children": [],
                            "marr": {"date": None, "place": None},
                            "div": {"date": None, "place": None},
                            "notes": None
                        }
                        current_type = "FAM"
                        families[gedcom_id] = current_record
                else:
                    current_record = None
                    current_type = None
                continue

            if not current_record or not current_type:
                continue

            # Individual details
            if current_type == "INDI":
                if level == 1:
                    if tag == "NAME":
                        name_match = re.match(r'(.+?)\s*/(.+?)/?', value)
                        name_data = {
                            "given": name_match.group(1).strip() if name_match else value,
                            "family": name_match.group(2).strip() if name_match else "",
                            "type": None
                        }
                        current_record["names"].append(name_data)
                    elif tag == "SEX":
                        current_record["sex"] = value
                    elif tag == "BIRT":
                        current_record["birth"] = {"date": None, "place": None}
                    elif tag == "DEAT":
                        current_record["death"] = {"date": None, "place": None}
                    elif tag in ("OCCU", "NOTE", "FAMC", "FAMS"):
                        current_record[tag.lower()] = value
                    elif tag not in SUPPORTED_INDI_TAGS:
                        unsupported_tags.append(f"{line} (line {line_num})")
                elif level == 2:
                    if tag in SUPPORTED_L2_TAGS:
                        if current_record.get("names") and current_record["names"][-1]:
                            if tag == "TYPE":
                                current_record["names"][-1]["type"] = value
                        elif tag == "DATE" and ("birth" in current_record or "death" in current_record):
                            last_event = None
                            if current_record["birth"] and not current_record["death"]:
                                last_event = "birth"
                            elif current_record["death"]:
                                last_event = "death"
                            if last_event:
                                current_record[last_event]["date"] = parse_gedcom_date(value)
                        elif tag == "PLAC":
                            if current_record["birth"]:
                                current_record["birth"]["place"] = value
                            elif current_record["death"]:
                                current_record["death"]["place"] = value

            # Family details
            elif current_type == "FAM":
                if level == 1:
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
                        current_record["marr"] = {"date": None, "place": None}
                    elif tag == "DIV":
                        current_record["div"] = {"date": None, "place": None}
                    elif tag == "NOTE":
                        current_record["notes"] = value
                    elif tag not in SUPPORTED_FAM_TAGS:
                        unsupported_tags.append(f"{line} (line {line_num})")
                elif level == 2:
                    if tag == "DATE":
                        if "marr" in current_record:
                            current_record["marr"]["date"] = parse_gedcom_date(value)
                        elif "div" in current_record:
                            current_record["div"]["date"] = parse_gedcom_date(value)
                    elif tag == "PLAC":
                        if "marr" in current_record:
                            current_record["marr"]["place"] = value
                        elif "div" in current_record:
                            current_record["div"]["place"] = value

    return individuals, families, unsupported_tags

def import_gedcom(gedcom_file: str, db_file: str = "gedcom.sqlite") -> bool:
    """Import GEDCOM file into database using backend models."""

    # Validation
    if not os.path.exists(gedcom_file) or os.path.getsize(gedcom_file) == 0:
        print(f"❌ ERROR: Empty or missing GEDCOM file: {gedcom_file}")
        return False

    # Backup database
    backup_database(db_file)

    # Parse GEDCOM
    print(f"📖 Parsing {gedcom_file}...")
    individuals, families, unsupported_tags = parse_gedcom_file(gedcom_file)
    print(f"  Found {len(individuals)} individuals, {len(families)} families")

    if len(individuals) + len(families) == 0:
        print(f"❌ ERROR: No GEDCOM records (INDI/FAM) found in {gedcom_file}")
        return False

    # Warn about unsupported tags
    if unsupported_tags:
        print(f"⚠️  WARNING: Found {len(unsupported_tags)} unsupported GEDCOM tags:")
        for tag in unsupported_tags[:5]:  # Show first 5
            print(f"  - {tag}")
        if len(unsupported_tags) > 5:
            print(f"  ... and {len(unsupported_tags) - 5} more")
        print()

    try:
        db_engine = database.db.engine_from_url(f"sqlite:///{db_file}")
        with Session(bind=db_engine) as db:
            # Clear existing data
            print("🗑️  Clearing existing data...")
            for table in ["main_family_children", "main_family_members",
                         "main_family_events", "main_family_media",
                         "main_individual_events", "main_individual_media",
                         "main_families", "main_individual_names", "main_individuals"]:
                db.execute(f"DELETE FROM {table}")
            db.commit()

            gedcom_to_db_id = {}

            # Import individuals first
            print("👤 Importing individuals...")
            for gedcom_id, ind_data in individuals.items():
                # Create individual
                ind_create = schemas.IndividualCreate(
                    gedcom_id=gedcom_id,
                    sex_code=ind_data.get("sex", "U"),
                    birth_date=ind_data["birth"]["date"],
                    birth_place=ind_data["birth"]["place"],
                    death_date=ind_data["death"]["date"],
                    death_place=ind_data["death"]["place"],
                    notes=ind_data.get("notes"),
                    names=[]
                )

                # Add names
                for name_data in ind_data["names"]:
                    ind_create.names.append(schemas.IndividualNameCreate(
                        given_name=name_data["given"],
                        family_name=name_data["family"],
                        name_type=name_data.get("type")
                    ))

                db_ind = database.db.create_individual(ind_create, db)
                gedcom_to_db_id[gedcom_id] = db_ind.id

            # Import families
            print("👨‍👩‍👧‍👦 Importing families...")
            for gedcom_id, fam_data in families.items():
                fam_create = schemas.FamilyCreate(
                    gedcom_id=gedcom_id,
                    marriage_date=fam_data["marr"]["date"],
                    marriage_place=fam_data["marr"]["place"],
                    divorce_date=fam_data["div"]["date"] if "div" in fam_data else None,
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

                db_fam = database.db.create_family(fam_create, db)

            db.commit()
            print(f"✅ Successfully imported {gedcom_file}")
            print(f"  - {len(gedcom_to_db_id)} individuals")
            print(f"  - {len(families)} families")
            return True

    except Exception as e:
        print(f"❌ ERROR: Import failed: {e}")
        return False

if __name__ == "__main__":
    input_file = sys.argv[1] if len(sys.argv) > 1 else "novoseltsev.ged"
    db_file = sys.argv[2] if len(sys.argv) > 2 else "gedcom.sqlite"

    if import_gedcom(input_file, db_file):
        sys.exit(0)
    else:
        sys.exit(1)
