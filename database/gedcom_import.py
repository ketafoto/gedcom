#!/usr/bin/env python3
"""
GEDCOM 5.5.1 Import Script
Imports GEDCOM 5.5.1 format file into genealogy database.
Backs up existing database before import.

Usage:
    python import_gedcom.py [input_file] [db_file]
    python import_gedcom.py novosetlsev_merged.ged gedcom.db
"""

import sqlite3
import os
import sys
import shutil
import re
from datetime import datetime

def backup_database(db_file):
    """Create timestamped backup of existing database"""
    if not os.path.exists(db_file):
        print(f"⚠️  Database {db_file} does not exist, skipping backup")
        return None

    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    backup_path = db_file.replace(".sqlite", f".sqlite.{timestamp}")
    shutil.copy2(db_file, backup_path)
    print(f"✅ Backed up {db_file} → {backup_path}")
    return backup_path

def parse_gedcom_date(gedcom_date):
    """Convert GEDCOM date (DD MON YYYY) to ISO format (YYYY-MM-DD)"""
    if not gedcom_date:
        return None

    months = {
        "JAN": 1, "FEB": 2, "MAR": 3, "APR": 4, "MAY": 5, "JUN": 6,
        "JUL": 7, "AUG": 8, "SEP": 9, "OCT": 10, "NOV": 11, "DEC": 12
    }

    # Match pattern: DD MON YYYY or MON YYYY or YYYY
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

def parse_gedcom_file(gedcom_file):
    """Parse GEDCOM file into structured data"""
    individuals = {}
    families = {}
    current_record = None
    current_type = None

    with open(gedcom_file, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.rstrip('\n\r')
            if not line.strip():
                continue

            parts = line.split(None, 2)
            if not parts:
                continue

            level = int(parts[0])
            tag = parts[1] if len(parts) > 1 else ""
            value = parts[2] if len(parts) > 2 else ""

            # New individual record
            if level == 0 and tag == "INDI":
                match = re.search(r'@([^@]+)@', value)
                if match:
                    gedcom_id = match.group(1)
                    current_record = {"gedcom_id": gedcom_id, "names": [], "events": {}}
                    current_type = "INDI"
                    individuals[gedcom_id] = current_record

            # New family record
            elif level == 0 and tag == "FAM":
                match = re.search(r'@([^@]+)@', value)
                if match:
                    gedcom_id = match.group(1)
                    current_record = {"gedcom_id": gedcom_id, "members": [], "children": []}
                    current_type = "FAM"
                    families[gedcom_id] = current_record

            # Parse individual details
            elif current_type == "INDI" and current_record:
                if level == 1:
                    if tag == "NAME":
                        # Parse NAME: Given /Family/
                        name_match = re.match(r'(.+?)\s*/(.+?)/?', value)
                        if name_match:
                            current_record["names"].append({
                                "given": name_match.group(1).strip(),
                                "family": name_match.group(2).strip()
                            })
                        else:
                            current_record["names"].append({"given": value, "family": ""})
                    elif tag == "SEX":
                        current_record["sex"] = value
                    elif tag == "BIRT":
                        current_record["events"]["BIRT"] = {}
                    elif tag == "DEAT":
                        current_record["events"]["DEAT"] = {}
                    elif tag == "OCCU":
                        current_record["occupation"] = value
                    elif tag == "NOTE":
                        current_record["notes"] = value
                    elif tag == "FAMC":
                        match = re.search(r'@([^@]+)@', value)
                        if match:
                            current_record["famc"] = match.group(1)
                    elif tag == "FAMS":
                        match = re.search(r'@([^@]+)@', value)
                        if match:
                            current_record["fams"] = match.group(1)

                elif level == 2 and current_record.get("events"):
                    last_event = list(current_record["events"].keys())[-1] if current_record["events"] else None
                    if last_event:
                        if tag == "DATE":
                            current_record["events"][last_event]["date"] = parse_gedcom_date(value)
                        elif tag == "PLAC":
                            current_record["events"][last_event]["place"] = value

            # Parse family details
            elif current_type == "FAM" and current_record:
                if level == 1:
                    if tag == "HUSB":
                        match = re.search(r'@([^@]+)@', value)
                        if match:
                            current_record["members"].append({"id": match.group(1), "role": "husband"})
                    elif tag == "WIFE":
                        match = re.search(r'@([^@]+)@', value)
                        if match:
                            current_record["members"].append({"id": match.group(1), "role": "wife"})
                    elif tag == "CHIL":
                        match = re.search(r'@([^@]+)@', value)
                        if match:
                            current_record["children"].append({"id": match.group(1)})
                    elif tag == "MARR":
                        current_record["marriage"] = {}
                    elif tag == "DIV":
                        current_record["divorce"] = {}
                    elif tag == "NOTE":
                        current_record["notes"] = value

                elif level == 2:
                    if tag == "DATE":
                        if "marriage" in current_record:
                            current_record["marriage"]["date"] = parse_gedcom_date(value)
                        elif "divorce" in current_record:
                            current_record["divorce"]["date"] = parse_gedcom_date(value)
                    elif tag == "PLAC":
                        if "marriage" in current_record:
                            current_record["marriage"]["place"] = value
                        elif "divorce" in current_record:
                            current_record["divorce"]["place"] = value

    return individuals, families

def import_gedcom(gedcom_file, db_file="gedcom.sqlite"):
    """Import GEDCOM file into database"""

    # Backup existing database
    backup_database(db_file)

    # Parse GEDCOM file
    print(f"📖 Parsing {gedcom_file}...")
    individuals, families = parse_gedcom_file(gedcom_file)
    print(f"   Found {len(individuals)} individuals, {len(families)} families")

    # Connect to database
    try:
        conn = sqlite3.connect(db_file)
        cursor = conn.cursor()
    except Exception as e:
        print(f"ERROR: Could not connect to {db_file}: {e}")
        return False

    try:
        # Clear existing data
        print("🗑️  Clearing existing data...")
        cursor.execute("DELETE FROM main_family_children")
        cursor.execute("DELETE FROM main_family_members")
        cursor.execute("DELETE FROM main_families")
        cursor.execute("DELETE FROM main_individual_names")
        cursor.execute("DELETE FROM main_individuals")

        # Map GEDCOM IDs to database IDs
        gedcom_to_db_id = {}

        # Insert individuals
        print("👤 Importing individuals...")
        for gedcom_id, ind_data in individuals.items():
            sex_code = ind_data.get("sex", "U")
            birth_date = ind_data.get("events", {}).get("BIRT", {}).get("date")
            birth_place = ind_data.get("events", {}).get("BIRT", {}).get("place")
            death_date = ind_data.get("events", {}).get("DEAT", {}).get("date")
            death_place = ind_data.get("events", {}).get("DEAT", {}).get("place")
            notes = ind_data.get("notes", "")

            cursor.execute("""
                INSERT INTO main_individuals
                (gedcom_id, sex_code, birth_date, birth_place, death_date, death_place, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (gedcom_id, sex_code, birth_date, birth_place, death_date, death_place, notes))

            db_id = cursor.lastrowid
            gedcom_to_db_id[gedcom_id] = db_id

            # Insert names
            for i, name in enumerate(ind_data.get("names", [])):
                cursor.execute("""
                    INSERT INTO main_individual_names
                    (individual_id, given_name, family_name, name_order)
                    VALUES (?, ?, ?, ?)
                """, (db_id, name.get("given", ""), name.get("family", ""), i))

        # Insert families
        print("👨‍👩‍👧‍👦 Importing families...")
        for gedcom_fam_id, fam_data in families.items():
            marriage_date = fam_data.get("marriage", {}).get("date")
            marriage_place = fam_data.get("marriage", {}).get("place")
            divorce_date = fam_data.get("divorce", {}).get("date") if fam_data.get("divorce") else None
            notes = fam_data.get("notes", "")

            cursor.execute("""
                INSERT INTO main_families
                (gedcom_id, marriage_date, marriage_place, divorce_date, family_type, notes)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (gedcom_fam_id, marriage_date, marriage_place, divorce_date, "marriage", notes))

            fam_db_id = cursor.lastrowid

            # Insert family members
            for member in fam_data.get("members", []):
                member_gedcom_id = member["id"]
                if member_gedcom_id in gedcom_to_db_id:
                    cursor.execute("""
                        INSERT INTO main_family_members
                        (family_id, individual_id, role)
                        VALUES (?, ?, ?)
                    """, (fam_db_id, gedcom_to_db_id[member_gedcom_id], member["role"]))

            # Insert children
            for child in fam_data.get("children", []):
                child_gedcom_id = child["id"]
                if child_gedcom_id in gedcom_to_db_id:
                    cursor.execute("""
                        INSERT INTO main_family_children
                        (family_id, child_id)
                        VALUES (?, ?)
                    """, (fam_db_id, gedcom_to_db_id[child_gedcom_id]))

        conn.commit()
        print(f"✅ Successfully imported {gedcom_file}")
        print(f"   - {len(gedcom_to_db_id)} individuals")
        print(f"   - {len(families)} families")
        return True

    except Exception as e:
        print(f"ERROR: Import failed: {e}")
        conn.rollback()
        return False
    finally:
        conn.close()

if __name__ == "__main__":
    input_file = sys.argv[1] if len(sys.argv) > 1 else "novosetlsev.ged"
    db_file = sys.argv[2] if len(sys.argv) > 2 else "gedcom.sqlite"

    if import_gedcom(input_file, db_file):
        sys.exit(0)
    else:
        sys.exit(1)
