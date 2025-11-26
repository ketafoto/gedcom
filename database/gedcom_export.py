#!/usr/bin/env python3
"""
GEDCOM 5.5.1 Export Script
Exports genealogy database to GEDCOM 5.5.1 format text file.

Usage:
    python export_gedcom.py [output_file] [db_file]
    python export_gedcom.py gedcom.txt gedcom.db
"""

import sqlite3
import sys
from datetime import datetime

def parse_date_for_gedcom(date_str):
    """Convert ISO date (YYYY-MM-DD) to GEDCOM format (DD MON YYYY)"""
    if not date_str:
        return None
    try:
        dt = datetime.strptime(date_str, "%Y-%m-%d")
        months = ["", "JAN", "FEB", "MAR", "APR", "MAY", "JUN", 
                  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]
        return f"{dt.day:02d} {months[dt.month]} {dt.year}"
    except:
        return None

def export_gedcom(db_file="gedcom.sqlite", output_file="gedcom.txt"):
    """Export database to GEDCOM 5.5.1 format"""
    try:
        conn = sqlite3.connect(db_file)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
    except Exception as e:
        print(f"ERROR: Could not connect to {db_file}: {e}")
        return False

    try:
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

            # Submitter
            out.write("0 @U0001@ SUBM\n")
            out.write("1 NAME Genealogy Database\n")

            # Export individuals
            cursor.execute("SELECT id, gedcom_id, sex_code, birth_date, birth_place, "
                          "death_date, death_place, notes FROM main_individuals ORDER BY id")
            individuals = {}
            for row in cursor.fetchall():
                ind_id = row["id"]
                gedcom_id = row["gedcom_id"]
                individuals[ind_id] = gedcom_id

                out.write(f"0 @{gedcom_id}@ INDI\n")

                # Names
                cursor.execute("SELECT given_name, family_name FROM main_individual_names "
                              "WHERE individual_id = ? ORDER BY name_order", (ind_id,))
                names = cursor.fetchall()
                for name_row in names:
                    given = name_row["given_name"] or ""
                    family = name_row["family_name"] or ""
                    out.write(f"1 NAME {given} /{family}/\n")

                # Sex
                if row["sex_code"]:
                    out.write(f"1 SEX {row['sex_code']}\n")

                # Birth
                if row["birth_date"] or row["birth_place"]:
                    out.write("1 BIRT\n")
                    if row["birth_date"]:
                        birt_date = parse_date_for_gedcom(row["birth_date"])
                        if birt_date:
                            out.write(f"2 DATE {birt_date}\n")
                    if row["birth_place"]:
                        out.write(f"2 PLAC {row['birth_place']}\n")

                # Death
                if row["death_date"] or row["death_place"]:
                    out.write("1 DEAT\n")
                    if row["death_date"]:
                        deat_date = parse_date_for_gedcom(row["death_date"])
                        if deat_date:
                            out.write(f"2 DATE {deat_date}\n")
                    if row["death_place"]:
                        out.write(f"2 PLAC {row['death_place']}\n")

                # Notes
                if row["notes"]:
                    out.write(f"1 NOTE {row['notes']}\n")

            # Export families
            cursor.execute("SELECT id, gedcom_id, marriage_date, marriage_place, "
                          "divorce_date, family_type, notes FROM main_families ORDER BY id")
            for fam_row in cursor.fetchall():
                fam_id = fam_row["id"]
                fam_gedcom_id = fam_row["gedcom_id"]

                out.write(f"0 @{fam_gedcom_id}@ FAM\n")

                # Family members
                cursor.execute("SELECT individual_id, role FROM main_family_members "
                              "WHERE family_id = ?", (fam_id,))
                for mem in cursor.fetchall():
                    mem_ind_id = mem["individual_id"]
                    mem_gedcom_id = individuals.get(mem_ind_id, f"I{mem_ind_id}")
                    role = (mem["role"] or "").upper()
                    if role in ["HUSBAND", "WIFE"]:
                        out.write(f"1 {role[:4]} @{mem_gedcom_id}@\n")

                # Children
                cursor.execute("SELECT child_id FROM main_family_children WHERE family_id = ?", 
                              (fam_id,))
                for child in cursor.fetchall():
                    child_ind_id = child["child_id"]
                    child_gedcom_id = individuals.get(child_ind_id, f"I{child_ind_id}")
                    out.write(f"1 CHIL @{child_gedcom_id}@\n")

                # Marriage
                if fam_row["marriage_date"] or fam_row["marriage_place"]:
                    out.write("1 MARR\n")
                    if fam_row["marriage_date"]:
                        marr_date = parse_date_for_gedcom(fam_row["marriage_date"])
                        if marr_date:
                            out.write(f"2 DATE {marr_date}\n")
                    if fam_row["marriage_place"]:
                        out.write(f"2 PLAC {fam_row['marriage_place']}\n")

                # Divorce
                if fam_row["divorce_date"]:
                    out.write("1 DIV\n")
                    div_date = parse_date_for_gedcom(fam_row["divorce_date"])
                    if div_date:
                        out.write(f"2 DATE {div_date}\n")

                # Notes
                if fam_row["notes"]:
                    out.write(f"1 NOTE {fam_row['notes']}\n")

            # Trailer
            out.write("0 TRLR\n")

        print(f"✅ Successfully exported to {output_file}")
        return True

    except Exception as e:
        print(f"ERROR: Failed to export GEDCOM: {e}")
        return False
    finally:
        conn.close()

if __name__ == "__main__":
    output_file = sys.argv[1] if len(sys.argv) > 1 else "gedcom.txt"
    db_file = sys.argv[2] if len(sys.argv) > 2 else "gedcom.sqlite"

    if export_gedcom(db_file, output_file):
        sys.exit(0)
    else:
        sys.exit(1)
