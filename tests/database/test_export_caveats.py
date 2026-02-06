#!/usr/bin/env python3
# pytest tests/database/test_export_caveats.py -s
#
# Tests for GEDCOM export edge cases (caveats).
# Uses golden file pattern: input.ged -> API update -> export -> compare to expected.ged
#
# Test data: tests/database/test_export_caveats/*.ged  (golden files, NOT auto-cleaned)
# Temp data: tests/database/test_export_caveats/temp/  (auto-cleaned via conftest.py)
#

import pytest
from fastapi.testclient import TestClient

import database.db
from database.gedcom_import import import_gedcom
from database.gedcom_export import export_gedcom
from tests.gedcom_utils import compare_gedcom_files
from tests.backend.db_utils import DatabaseUtils


class TestExportCaveats:
    """Test suite for GEDCOM export edge cases."""

    def test_date_format_mutual_exclusivity(self, test_data_dir, test_user, log_test_step):
        """
        Test that updating birth_date clears birth_date_approx (and vice versa).

        Bug: When setting birth_date via API, birth_date_approx was not cleared.
        On export, birth_date_approx was preferred, showing stale data.

        Input:  Individual with ABT 1950 birth, 1990-12-25 death
        Update: Set birth_date=1952-03-19, death_date_approx=ABT 1990
        Expect: Export shows 19 MAR 1952 birth, ABT 1990 death
        """
        log_test_step("Setting up test database")

        # Paths for test data (golden files in test_data_dir, outputs in test_user dir)
        input_ged    = test_data_dir / "date.inp.ged"
        expected_ged = test_data_dir / "date.out.ged"
        actual_ged   = test_user.user_dir / "date.out.test"

        assert input_ged.exists(), f"Input file not found: {input_ged}"
        assert expected_ged.exists(), f"Expected file not found: {expected_ged}"

        database.db.reset_engine()
        database.db.init_db_once(test_user)

        # Step 1: Import input GEDCOM
        log_test_step("Importing input GEDCOM")
        success = import_gedcom(input_ged, test_user.db_file)
        assert success, "Import failed"

        # Step 2: Find individual by GEDCOM ID
        log_test_step("Finding individual I1")
        db_utils = DatabaseUtils(test_user.db_file)
        row = db_utils.execute_query_single(
            "SELECT id FROM main_individuals WHERE gedcom_id = ?", ("I1",)
        )
        assert row is not None, "Individual I1 not found after import"
        individual_id = row["id"]
        log_test_step(f"Found individual with DB id={individual_id}")

        # Step 3: Update via API
        log_test_step("Updating individual via API")

        # Import app after DB init
        from backend.main import app

        with TestClient(app) as client:
            response = client.put(
                f"/individuals/{individual_id}",
                json={
                    "birth_date": "1952-03-19",      # Should clear birth_date_approx
                    "death_date_approx": "ABT 1990"  # Should clear death_date
                }
            )
            assert response.status_code == 200, f"API update failed: {response.json()}"

        log_test_step("API update successful")

        # Step 4: Export to actual file
        log_test_step("Exporting database to GEDCOM")
        success = export_gedcom(test_user.db_file, actual_ged)
        assert success, "Export failed"

        # Step 5: Compare actual to expected
        log_test_step("Comparing actual output to expected")
        match, diffs = compare_gedcom_files(expected_ged, actual_ged)

        # Cleanup engine
        database.db.reset_engine()

        # Assert match (temp folder cleanup handled by conftest.py)
        if not match:
            pytest.fail(
                f"Export output differs from expected!\n\n"
                f"Input:    {input_ged}\n"
                f"Expected: {expected_ged}\n"
                f"Actual:   {actual_ged} (kept for inspection)\n\n"
                f"Differences:\n{diffs}"
            )
        log_test_step("Output matches expected - test passed")
