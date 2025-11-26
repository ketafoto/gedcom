#!/usr/bin/env python3

"""
GEDCOM 5.5.1 Export Script

Exports genealogy database to GEDCOM 5.5.1 format using backend models.

Usage:
    python gedcom_export.py [output_file] [db_file]
"""

import sys
from datetime import datetime
from pathlib import Path

import database.db
from database.models import Individual, Family
from sqlalchemy.orm import Session, joinedload

def gedcom_date(date_str):
    """Convert ISO date to GEDCOM format (DD MON YYYY)."""
    if not date_str:
        return None
    try:
        dt = datetime.strptime(str(date_str), "%Y-%m-%d")
        months = ["", "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
                  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]
        return f"{dt.day:02d} {months[dt.month]} {dt.year}"
    except:
        return None

def export_gedcom(db_file: str, output_file: str) -> bool:
    """Export database to GEDCOM 5.5.1 format."""
    db_path = Path(db_file)
    if not db_path.exists():
        print(f"❌ ERROR: Database not found: {db_file}")
        return False

    try:
        db_engine = database.db.engine_from_url(f"sqlite:///{db_file}")
        with Session(bind=db_engine) as db:
            with open(output_file, "w", encoding="utf-8") as out:
                # Header
                out.write("0 HEAD\n")
                out.write("1 SOUR GEDCOM-Export-System\n")
                out.write("2 NAME Genealogy Database GEDCOM Export\n")
                out.write("2 VERS 5.5.1\n")
                out.write(f"1 DATE {datetime.now().strftime('%d %b %Y').upper()}\n")
                out.write("1 GEDC\n")
                out.write("2 VERS 5.5.1\n")
                out.write("2 FORM LINEAGE-LINKED\n")
                out.write("1 CHAR UTF-8\n")
                out.write("1 LANG English\n")
                out.write("1 SUBM @U0001@\n")
                out.write("0 @U0001@ SUBM\n")
                out.write("1 NAME Genealogy Database\n")

                # Individuals (sorted by gedcom_id)
                individuals = db.query(Individual).options(
                    joinedload(Individual.names)
                ).order_by(Individual.gedcom_id).all()

                ind_map = {ind.gedcom_id: ind.id for ind in individuals}

                for ind in individuals:
                    out.write(f"0 @{ind.gedcom_id}@ INDI\n")

                    # Names
                    for name in sorted(ind.names, key=lambda n: n.name_order or 0):
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
                    if ind.birth_date or ind.birth_place:
                        out.write("1 BIRT\n")
                        if ind.birth_date:
                            date_str = gedcom_date(ind.birth_date)
                            if date_str:
                                out.write(f"2 DATE {date_str}\n")
                        if ind.birth_place:
                            out.write(f"2 PLAC {ind.birth_place}\n")

                    # Death
                    if ind.death_date or ind.death_place:
                        out.write("1 DEAT\n")
                        if ind.death_date:
                            date_str = gedcom_date(ind.death_date)
                            if date_str:
                                out.write(f"2 DATE {date_str}\n")
                        if ind.death_place:
                            out.write(f"2 PLAC {ind.death_place}\n")

                    # Notes
                    if ind.notes:
                        out.write(f"1 NOTE {ind.notes}\n")

                # Families (sorted by gedcom_id)
                families = db.query(Family).options(
                    joinedload(Family.members),
                    joinedload(Family.children)
                ).order_by(Family.gedcom_id).all()

                for fam in families:
                    out.write(f"0 @{fam.gedcom_id}@ FAM\n")

                    # Members
                    husb_id = None
                    wife_id = None
                    for member in fam.members:
                        ind_gedcom = next((gid for gid, iid in ind_map.items()
                                         if iid == member.individual_id), None)
                        if member.role == "husband":
                            husb_id = ind_gedcom
                            out.write(f"1 HUSB @{ind_gedcom}@\n")
                        elif member.role == "wife":
                            wife_id = ind_gedcom
                            out.write(f"1 WIFE @{ind_gedcom}@\n")

                    # Children
                    for child_link in fam.children:
                        ind_gedcom = next((gid for gid, iid in ind_map.items()
                                         if iid == child_link.child_id), None)
                        if ind_gedcom:
                            out.write(f"1 CHIL @{ind_gedcom}@\n")

                    # Marriage
                    if fam.marriage_date or fam.marriage_place:
                        out.write("1 MARR\n")
                        if fam.marriage_date:
                            date_str = gedcom_date(fam.marriage_date)
                            if date_str:
                                out.write(f"2 DATE {date_str}\n")
                        if fam.marriage_place:
                            out.write(f"2 PLAC {fam.marriage_place}\n")

                    # Divorce
                    if fam.divorce_date:
                        out.write("1 DIV\n")
                        date_str = gedcom_date(fam.divorce_date)
                        if date_str:
                            out.write(f"2 DATE {date_str}\n")

                    # Notes
                    if fam.notes:
                        out.write(f"1 NOTE {fam.notes}\n")

                out.write("0 TRLR\n")

        print(f"✅ Successfully exported {len(individuals)} individuals, {len(families)} families to {output_file}")
        return True

    except Exception as e:
        print(f"❌ ERROR: Export failed: {e}")
        return False

if __name__ == "__main__":
    output_file = sys.argv[1] if len(sys.argv) > 1 else "gedcom.txt"
    db_file = sys.argv[2] if len(sys.argv) > 2 else "gedcom.sqlite"

    if export_gedcom(db_file, output_file):
        sys.exit(0)
    else:
        sys.exit(1)
