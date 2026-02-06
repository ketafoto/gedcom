#!/usr/bin/env python3
# pytest tests/database/test_database.py::TestImportExportGedcom -s
#
# This test validates the GEDCOM import/export roundtrip.
# It uses test data copied from users/inovoseltsev/ folder.
#

import pytest
import sqlite3

from tests.conftest import SOURCE_GEDCOM
from tests.gedcom_utils import normalize_gedcom_text

import database.db
from database.gedcom_import import import_gedcom
from database.gedcom_export import export_gedcom


class TestImportExportGedcom:
    """Test suite for GEDCOM 5.5.1 import/export roundtrip validation."""

    def test_roundtrip_import_export_consistency(self, test_db, log_test_step, log_debug):
        """Test that import->export->import->export produces consistent results."""
        log_test_step("Starting roundtrip consistency test")

        # test_db fixture returns UserInfo for test user
        test_user = test_db

        # Reset engine to ensure clean state
        database.db.reset_engine()

        # Check if source GEDCOM exists (from users/inovoseltsev/)
        if not SOURCE_GEDCOM.exists():
            pytest.skip(f"Source GEDCOM file not found: {SOURCE_GEDCOM}")

        if not test_user.gedcom_file.exists():
            pytest.skip(f"Test GEDCOM file not found: {test_user.gedcom_file}")

        # Step 1: Import
        log_test_step("Step 1: Importing GEDCOM")
        success1 = import_gedcom(test_user.gedcom_file, test_user.db_file)

        # Check for unsupported tags (they print WARNING to stdout)
        log_debug("Import completed, checking for warnings...")

        assert success1, "Import failed"
        log_test_step("Import 1 successful")

        # Get counts after first import
        conn = sqlite3.connect(str(test_user.db_file))
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM main_individuals")
        count1_individuals = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM main_families")
        count1_families = cursor.fetchone()[0]
        conn.close()
        log_test_step(f"After import 1: {count1_individuals} individuals, {count1_families} families")

        assert count1_individuals > 0, "No individuals after import!"
        assert count1_families > 0, "No families after import!"

        # Test DB backup after the first import
        # Note: backup files are named data.sqlite.TIMESTAMP in the test user directory
        log_test_step("Verifying database backup was created after the first import")
        backup_files = list(test_user.user_dir.glob("data.sqlite.*"))
        assert len(backup_files) == 1, f"Expected exactly one backup file after the first import, found {len(backup_files)}"
        log_test_step(f"Backup file created: {backup_files[0].name}")

        # Step 2: Export
        log_test_step("Step 2: Exporting to GEDCOM")
        export_file1 = test_user.user_dir / "test_gedcom_export1.txt"
        success2 = export_gedcom(test_user.db_file, export_file1)
        assert success2, "Export failed"
        log_test_step("Export 1 successful")

        # Step 3: Delete database, recreate it and re-import from exported file
        log_test_step("Step 3: Deleting database and re-importing from exported file")
        database.db.reset_engine()  # Reset engine to release file lock before deletion
        test_user.db_file.unlink()

        success3 = import_gedcom(export_file1, test_user.db_file)
        assert success3, "Second import failed"
        log_test_step("Import 2 successful")

        # Note: No backup expected for second import because we deleted the database
        # The backup_database() function correctly skips backup when file doesn't exist
        log_test_step("Verified second import completed (no backup expected since DB was deleted)")

        # Step 4: Export again
        log_test_step("Step 4: Exporting again")
        export_file2 = test_user.user_dir / "test_gedcom_export2.txt"
        success4 = export_gedcom(test_user.db_file, export_file2)
        assert success4, "Second export failed"
        log_test_step("Export 2 successful")

        # Step 5: Verify counts remain consistent
        log_test_step("Step 5: Verifying consistency")
        conn = sqlite3.connect(str(test_user.db_file))
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM main_individuals")
        count2_individuals = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM main_families")
        count2_families = cursor.fetchone()[0]
        conn.close()
        log_test_step(f"After import 2: {count2_individuals} individuals, {count2_families} families")

        assert count1_individuals == count2_individuals, f"Individual count mismatch: {count1_individuals} vs {count2_individuals}"
        assert count1_families == count2_families, f"Family count mismatch: {count1_families} vs {count2_families}"
        log_test_step("Counts are consistent after roundtrip")

        # Step 6: Verify exported GEDCOM files are consistent with each other
        log_test_step("Step 6: Verifying exported GEDCOM files are consistent")

        with open(export_file1, 'r', encoding='utf-8') as f:
            export1_text = normalize_gedcom_text(f.read(), skip_dynamic_fields=True)
        with open(export_file2, 'r', encoding='utf-8') as f:
            export2_text = normalize_gedcom_text(f.read(), skip_dynamic_fields=True)

        assert export1_text == export2_text, "Export1 and export2 GEDCOM files differ!"
        log_test_step("Exported GEDCOM files are identical (roundtrip is lossless)")

        # Step 7: Verify original GEDCOM matches exported GEDCOM
        # This ensures no data is lost or reordered during import/export
        log_test_step("Step 7: Verifying original GEDCOM matches exported GEDCOM")

        with open(test_user.gedcom_file, 'r', encoding='utf-8') as f:
            original_text = normalize_gedcom_text(f.read(), skip_dynamic_fields=True)
        export1_normalized = normalize_gedcom_text(export1_text, skip_dynamic_fields=True)

        if original_text != export1_normalized:
            # Find and report differences for debugging
            original_lines = original_text.splitlines()
            export_lines = export1_normalized.splitlines()

            differences = []
            max_lines = max(len(original_lines), len(export_lines))

            for i in range(max_lines):
                orig_line = original_lines[i] if i < len(original_lines) else "<missing>"
                exp_line = export_lines[i] if i < len(export_lines) else "<missing>"
                if orig_line != exp_line:
                    differences.append(f"Line {i+1}:\n  Original: {orig_line}\n  Exported: {exp_line}")
                    if len(differences) >= 20:
                        differences.append("... (truncated, more differences exist)")
                        break

            diff_report = "\n".join(differences)
            pytest.fail(
                f"Original GEDCOM and exported GEDCOM differ!\n"
                f"Original file: {test_user.gedcom_file}\n"
                f"Exported file: {export_file1}\n"
                f"First differences:\n{diff_report}"
            )

        log_test_step("Original and exported GEDCOM files are identical")

        # Cleanup export files
        export_file1.unlink()
        export_file2.unlink()
