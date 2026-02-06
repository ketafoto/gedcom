#!/usr/bin/env python3

"""
GEDCOM 5.5.1 Export Script

Exports genealogy database to GEDCOM 5.5.1 format using backend models.

Usage:
    python -m database.gedcom_export [--user USERNAME] [output_file]

    --user USERNAME : Export for specific user (default: inovoseltsev)
    output_file     : Path to output GEDCOM file (default: user's data.ged)

Examples:
    python -m database.gedcom_export --user inovoseltsev
    python -m database.gedcom_export --user john path/to/output.ged
"""

import sys
import argparse
from datetime import datetime
from pathlib import Path
from typing import Optional

import database.db
from database.models import Individual, Family, Event, Media, Header
from database.user_info import UserInfo, PROJECT_ROOT
from sqlalchemy.orm import Session, joinedload


def get_relative_path(file_path: Path) -> str:
    """Get file path relative to project root, or just filename if outside project."""
    try:
        return str(file_path.resolve().relative_to(PROJECT_ROOT.resolve()))
    except ValueError:
        return file_path.name


def iso_to_gedcom_date(iso_date: Optional[str]) -> Optional[str]:
    """Convert ISO date (YYYY-MM-DD) back to GEDCOM format (DD MON YYYY).

    Only used for exact dates stored in X_date field.
    Non-exact dates are stored in X_date_approx and used directly.
    """
    if not iso_date:
        return None

    months = ["", "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
              "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]

    try:
        parts = str(iso_date).split('-')
        if len(parts) == 3:
            year = int(parts[0])
            month = int(parts[1])
            day = int(parts[2])
            return f"{day:02d} {months[month]} {year}"
    except:
        pass
    return None


def get_gedcom_date(iso_date: Optional[str], gedcom_date: Optional[str]) -> Optional[str]:
    """Get GEDCOM date string from either source (mutual exclusivity).

    With mutual exclusivity, only one should be populated:
    - gedcom_date: for non-exact dates (modifiers, partial dates)
    - iso_date: for exact dates (DD MON YYYY)

    Returns the appropriate GEDCOM format string.
    """
    if gedcom_date:
        return gedcom_date
    if iso_date:
        return iso_to_gedcom_date(iso_date)
    return None


def export_gedcom(db_file: Path, output_file: Path) -> bool:
    """Export database to GEDCOM 5.5.1 format."""
    if not db_file.exists():
        print(f"[ERROR] Database not found: {db_file}")
        return False

    try:
        db_engine = database.db.engine_from_url(f"sqlite:///{db_file}")
        with Session(bind=db_engine) as db:
            # Get header metadata (if exists)
            header = db.query(Header).filter(Header.id == 1).first()

            with open(output_file, "w", encoding="utf-8") as out:
                # Header - use stored metadata or defaults
                out.write("0 HEAD\n")

                # Source system
                source_id = header.source_system_id if header and header.source_system_id else "GEDCOM-Export-System"
                out.write(f"1 SOUR {source_id}\n")
                source_name = header.source_system_name if header and header.source_system_name else "Genealogy Database GEDCOM Export"
                out.write(f"2 NAME {source_name}\n")
                source_vers = header.source_version if header and header.source_version else "5.5.1"
                out.write(f"2 VERS {source_vers}\n")
                if header and header.source_corporation:
                    out.write(f"2 CORP {header.source_corporation}\n")

                # Destination
                if header and header.destination:
                    out.write(f"1 DEST {header.destination}\n")

                # Date - use current date for export
                out.write(f"1 DATE {datetime.now().strftime('%d %b %Y').upper()}\n")
                out.write(f"2 TIME {datetime.now().strftime('%H:%M:%S')}\n")

                # File name (relative to project root)
                out.write(f"1 FILE {get_relative_path(output_file)}\n")

                # GEDCOM version
                out.write("1 GEDC\n")
                gedcom_vers = header.gedcom_version if header and header.gedcom_version else "5.5.1"
                out.write(f"2 VERS {gedcom_vers}\n")
                gedcom_form = header.gedcom_form if header and header.gedcom_form else "LINEAGE-LINKED"
                out.write(f"2 FORM {gedcom_form}\n")

                # Character encoding
                charset = header.charset if header and header.charset else "UTF-8"
                out.write(f"1 CHAR {charset}\n")

                # Language
                if header and header.language:
                    out.write(f"1 LANG {header.language}\n")

                # Copyright
                if header and header.copyright:
                    out.write(f"1 COPR {header.copyright}\n")

                # Note
                if header and header.note:
                    out.write(f"1 NOTE {header.note}\n")

                # Submitter reference
                subm_id = header.submitter_id if header and header.submitter_id else "U00001"
                out.write(f"1 SUBM @{subm_id}@\n")

                # Submitter record
                out.write(f"0 @{subm_id}@ SUBM\n")
                subm_name = header.submitter_name if header and header.submitter_name else "Genealogy Database"
                out.write(f"1 NAME {subm_name}\n")
                if header and header.submitter_address:
                    out.write(f"1 ADDR {header.submitter_address}\n")
                    if header.submitter_city:
                        out.write(f"2 CITY {header.submitter_city}\n")
                    if header.submitter_state:
                        out.write(f"2 STAE {header.submitter_state}\n")
                    if header.submitter_postal:
                        out.write(f"2 POST {header.submitter_postal}\n")
                    if header.submitter_country:
                        out.write(f"2 CTRY {header.submitter_country}\n")
                if header and header.submitter_phone:
                    out.write(f"1 PHON {header.submitter_phone}\n")
                if header and header.submitter_email:
                    out.write(f"1 EMAIL {header.submitter_email}\n")
                if header and header.submitter_fax:
                    out.write(f"1 FAX {header.submitter_fax}\n")
                if header and header.submitter_www:
                    out.write(f"1 WWW {header.submitter_www}\n")

                # Query families first to build FAMC/FAMS lookup maps
                families = db.query(Family).options(
                    joinedload(Family.members),
                    joinedload(Family.children),
                    joinedload(Family.events),
                    joinedload(Family.media)
                ).order_by(Family.gedcom_id).all()

                # Build maps: individual_id -> list of family GEDCOM IDs
                # FAMC = families where individual is a child
                # FAMS = families where individual is a spouse (member)
                famc_map = {}  # individual_id -> [family_gedcom_ids]
                fams_map = {}  # individual_id -> [family_gedcom_ids]

                for fam in families:
                    for child in fam.children:
                        if child.child_id not in famc_map:
                            famc_map[child.child_id] = []
                        famc_map[child.child_id].append(fam.gedcom_id)
                    for member in fam.members:
                        if member.individual_id not in fams_map:
                            fams_map[member.individual_id] = []
                        fams_map[member.individual_id].append(fam.gedcom_id)

                # Individuals (sorted by gedcom_id)
                individuals = db.query(Individual).options(
                    joinedload(Individual.names),
                    joinedload(Individual.events),
                    joinedload(Individual.media)
                ).order_by(Individual.gedcom_id).all()

                ind_map = {ind.gedcom_id: ind.id for ind in individuals}
                event_count = 0
                media_count = 0

                for ind in individuals:
                    out.write(f"0 @{ind.gedcom_id}@ INDI\n")

                    # Names (sorted by name_order to preserve original order)
                    for name in sorted(ind.names, key=lambda n: n.name_order if n.name_order is not None else 999):
                        given = name.given_name or ""
                        family = name.family_name or ""
                        name_type = name.name_type or ""
                        out.write(f"1 NAME {given} /{family}/\n")
                        if name_type:
                            out.write(f"2 TYPE {name_type}\n")

                    # Sex
                    if ind.sex_code:
                        out.write(f"1 SEX {ind.sex_code}\n")

                    # Birth
                    if ind.birth_date_approx or ind.birth_date or ind.birth_place:
                        out.write("1 BIRT\n")
                        date_str = get_gedcom_date(ind.birth_date, ind.birth_date_approx)
                        if date_str:
                            out.write(f"2 DATE {date_str}\n")
                        if ind.birth_place:
                            out.write(f"2 PLAC {ind.birth_place}\n")

                    # Family links (FAMC - child of family, FAMS - spouse in family)
                    # These come before OCCU and DEAT in standard GEDCOM order
                    for fam_gedcom_id in famc_map.get(ind.id, []):
                        out.write(f"1 FAMC @{fam_gedcom_id}@\n")
                    for fam_gedcom_id in fams_map.get(ind.id, []):
                        out.write(f"1 FAMS @{fam_gedcom_id}@\n")

                    # Other events (OCCU with value on same line)
                    for event in ind.events:
                        if event.description:
                            out.write(f"1 {event.event_type_code} {event.description}\n")
                        else:
                            out.write(f"1 {event.event_type_code}\n")
                        date_str = get_gedcom_date(event.event_date, event.event_date_approx)
                        if date_str:
                            out.write(f"2 DATE {date_str}\n")
                        if event.event_place:
                            out.write(f"2 PLAC {event.event_place}\n")
                        event_count += 1

                    # Death (comes after FAMC/FAMS/events in standard order)
                    if ind.death_date_approx or ind.death_date or ind.death_place:
                        out.write("1 DEAT\n")
                        date_str = get_gedcom_date(ind.death_date, ind.death_date_approx)
                        if date_str:
                            out.write(f"2 DATE {date_str}\n")
                        if ind.death_place:
                            out.write(f"2 PLAC {ind.death_place}\n")

                    # Media
                    for media in ind.media:
                        out.write("1 OBJE\n")
                        if media.file_path:
                            out.write(f"2 FILE {media.file_path}\n")
                        if media.media_type_code:
                            out.write(f"2 FORM {media.media_type_code}\n")
                        if media.description:
                            out.write(f"2 TITL {media.description}\n")
                        media_count += 1

                    # Notes
                    if ind.notes:
                        out.write(f"1 NOTE {ind.notes}\n")

                # Families (already queried above, just export them)
                for fam in families:
                    out.write(f"0 @{fam.gedcom_id}@ FAM\n")

                    # Members (HUSB first, then WIFE - standard GEDCOM order)
                    husb_gedcom = None
                    wife_gedcom = None
                    for member in fam.members:
                        ind_gedcom = next((gid for gid, iid in ind_map.items()
                                         if iid == member.individual_id), None)
                        if member.role == "husband":
                            husb_gedcom = ind_gedcom
                        elif member.role == "wife":
                            wife_gedcom = ind_gedcom
                    if husb_gedcom:
                        out.write(f"1 HUSB @{husb_gedcom}@\n")
                    if wife_gedcom:
                        out.write(f"1 WIFE @{wife_gedcom}@\n")

                    # Marriage (comes before CHIL in standard GEDCOM order)
                    if fam.marriage_date_approx or fam.marriage_date or fam.marriage_place:
                        out.write("1 MARR\n")
                        date_str = get_gedcom_date(fam.marriage_date, fam.marriage_date_approx)
                        if date_str:
                            out.write(f"2 DATE {date_str}\n")
                        if fam.marriage_place:
                            out.write(f"2 PLAC {fam.marriage_place}\n")

                    # Children
                    for child_link in fam.children:
                        ind_gedcom = next((gid for gid, iid in ind_map.items()
                                         if iid == child_link.child_id), None)
                        if ind_gedcom:
                            out.write(f"1 CHIL @{ind_gedcom}@\n")

                    # Divorce (after children)
                    if fam.divorce_date_approx or fam.divorce_date:
                        out.write("1 DIV\n")
                        date_str = get_gedcom_date(fam.divorce_date, fam.divorce_date_approx)
                        if date_str:
                            out.write(f"2 DATE {date_str}\n")

                    # Other events
                    for event in fam.events:
                        out.write(f"1 {event.event_type_code}\n")
                        date_str = get_gedcom_date(event.event_date, event.event_date_approx)
                        if date_str:
                            out.write(f"2 DATE {date_str}\n")
                        if event.event_place:
                            out.write(f"2 PLAC {event.event_place}\n")
                        if event.description:
                            out.write(f"2 TYPE {event.description}\n")
                        event_count += 1

                    # Media
                    for media in fam.media:
                        out.write("1 OBJE\n")
                        if media.file_path:
                            out.write(f"2 FILE {media.file_path}\n")
                        if media.media_type_code:
                            out.write(f"2 FORM {media.media_type_code}\n")
                        if media.description:
                            out.write(f"2 TITL {media.description}\n")
                        media_count += 1

                    # Notes
                    if fam.notes:
                        out.write(f"1 NOTE {fam.notes}\n")

                out.write("0 TRLR\n")

        msg = f"[OK] Successfully exported {len(individuals)} individuals, {len(families)} families"
        if event_count > 0:
            msg += f", {event_count} events"
        if media_count > 0:
            msg += f", {media_count} media"
        print(f"{msg} to {output_file}")

        # Dispose engine to release file locks (important on Windows)
        db_engine.dispose()
        return True

    except Exception as e:
        print(f"[ERROR] Export failed: {e}")
        if 'db_engine' in locals():
            db_engine.dispose()
        return False

def export_for_user(username: Optional[str] = None, output_file: Optional[str] = None) -> bool:
    """
    Export GEDCOM file for a specific user.

    Args:
        username: Username to export for. Uses default user if None.
        output_file: Path to output GEDCOM file. Uses user's data.ged if None.

    Returns:
        True if export succeeded, False otherwise.
    """
    user_info = UserInfo(username=username, gedcom_file=output_file)

    print(f"📁 Exporting for user: {user_info.username}")
    print(f"   Database: {user_info.db_file}")
    print(f"   GEDCOM file: {user_info.gedcom_file}")

    return export_gedcom(user_info.db_file, user_info.gedcom_file)


if __name__ == "__main__":
    # Get default username for help text
    default_user = UserInfo()

    parser = argparse.ArgumentParser(
        description="Export user's genealogy database to GEDCOM 5.5.1 file"
    )
    parser.add_argument(
        "--user", "-u", default=None,
        help=f"Username to export for (default: {default_user.username})"
    )
    parser.add_argument(
        "output_file", nargs="?", default=None,
        help="Path to output GEDCOM file (default: user's data.ged)"
    )

    args = parser.parse_args()

    if not export_for_user(args.user, args.output_file):
        sys.exit(1)
