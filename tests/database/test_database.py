#!/usr/bin/env python3
# pytest tests/database/test_database.py::TestImportExportGedcom -s

import pytest
import sys
import sqlite3
from pathlib import Path
from datetime import datetime

from tests.conftest import TEST_DB_FILE, TEST_GEDCOM_FILE

import database.db
from database.gedcom_import import import_gedcom
from database.gedcom_export import export_gedcom

class TestImportExportGedcom:
    """Test suite for GEDCOM 5.5.1 import/export roundtrip validation."""

    def test_roundtrip_import_export_consistency(self, test_db):
        """Test that import->export->import->export produces consistent results."""
        log_test_step("Starting roundtrip consistency test")

        if not TEST_GEDCOM_FILE.exists():
            pytest.skip(f"Test GEDCOM file not found: {TEST_GEDCOM_FILE}")

        # Step 1: Import
        log_test_step("Step 1️⃣: Importing GEDCOM")
        success1 = import_gedcom(str(TEST_GEDCOM_FILE), str(TEST_DB_FILE))

        # Check for unsupported tags (they print WARNING to stdout)
        log_debug("Import completed, checking for warnings...")

        assert success1, "Import failed"
        log_test_step("✅ Import 1 successful")

        # Get counts after first import
        conn = sqlite3.connect(str(TEST_DB_FILE))
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM main_individuals")
        count1_individuals = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM main_families")
        count1_families = cursor.fetchone()[0]
        conn.close()
        log_test_step(f"✅ After import 1: {count1_individuals} individuals, {count1_families} families")

        assert count1_individuals > 0, f"No individuals after import!"
        assert count1_families > 0, f"No families after import!"

        # Test DB backup after the first import
        log_test_step("Verifying database backup was created after the first import")
        backup_files = list(TEST_DB_FILE.parent.glob(f"{TEST_DB_FILE.stem}.sqlite.*"))
        assert len(backup_files) == 1, "Expected exactly one backup file after the first import"
        log_test_step(f"✅ Backup file created: {backup_files[0].name}")

        # Step 2: Export
        log_test_step("Step 2️⃣: Exporting to GEDCOM")
        export_file1 = TEST_DB_FILE.parent / "test_gedcom_export1.txt"
        success2 = export_gedcom(str(TEST_DB_FILE), str(export_file1))
        assert success2, "Export failed"
        log_test_step("✅ Export 1 successful")

        # Step 3: Delete database, recreate it and re-import from exported file
        log_test_step("Step 3️⃣: Deleting database and re-importing from exported file")
        TEST_DB_FILE.unlink()
        database.db.init_db_once(str(TEST_DB_FILE))

        success3 = import_gedcom(str(export_file1), str(TEST_DB_FILE))
        assert success3, "Second import failed"
        log_test_step("✅ Import 2 successful")

        # Test DB backup after the second import
        log_test_step("Verifying database backup was created after the second import")
        backup_files = list(TEST_DB_FILE.parent.glob(f"{TEST_DB_FILE.stem}.sqlite.*"))
        assert len(backup_files) == 2, "Expected exactly two backup files after the second import"
        log_test_step(f"✅ Backup file created: {backup_files[1].name}")

        # Step 4: Export again
        log_test_step("Step 4️⃣: Exporting again")
        export_file2 = TEST_DB_FILE.parent / "test_gedcom_export2.txt"
        success4 = export_gedcom(str(TEST_DB_FILE), str(export_file2))
        assert success4, "Second export failed"
        log_test_step("✅ Export 2 successful")

        # Step 5: Verify counts remain consistent
        log_test_step("Step 5️⃣: Verifying consistency")
        conn = sqlite3.connect(str(TEST_DB_FILE))
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM main_individuals")
        count2_individuals = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM main_families")
        count2_families = cursor.fetchone()[0]
        conn.close()
        log_test_step(f"✅ After import 2: {count2_individuals} individuals, {count2_families} families")

        assert count1_individuals == count2_individuals, f"Individual count mismatch: {count1_individuals} vs {count2_individuals}"
        assert count1_families == count2_families, f"Family count mismatch: {count1_families} vs {count2_families}"
        log_test_step("✅ Counts are consistent after roundtrip")

        # Step 6: Verify original and exported GEDCOM file contents are identical
        log_test_step("Step 6️⃣: Verifying GEDCOM file contents match")

        def normalize_text(text):
            return '\n'.join(line.rstrip() for line in text.strip().splitlines())

        with open(TEST_GEDCOM_FILE, 'r', encoding='utf-8') as f:
            original_text = normalize_text(f.read())
        with open(export_file1, 'r', encoding='utf-8') as f:
            export1_text = normalize_text(f.read())
        with open(export_file2, 'r', encoding='utf-8') as f:
            export2_text = normalize_text(f.read())

        assert original_text == export1_text, "Original GEDCOM and export1 differ!"
        assert export1_text == export2_text, "Export1 and export2 GEDCOM files differ!"
        log_test_step("✅ GEDCOM content is identical through entire roundtrip")

        # Cleanup export files
        export_file1.unlink()
        export_file2.unlink()
