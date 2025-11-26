# Root conftest.py - Shared fixtures for all tests
# Includes log_test_step and database configuration for tests

import os
import pytest

from pathlib import Path


# ==================== Test Database Configuration ====================

TEST_DB_FILE     = Path("test_gedcom.sqlite")
TEST_GEDCOM_FILE = Path(__file__).parent / "database" / "test_novoseltsev.ged"


@pytest.fixture
def log_test_step(request):
    """
    Fixture for logging test steps with automatic test name printing on first call.

    Usage:
        def test_example(log_test_step):
            log_test_step("First step")  # Prints test class/function name + step
            log_test_step("Second step")  # Prints only the step
    """
    test_name_printed = False

    def _log_step(message: str):
        nonlocal test_name_printed

        # Print test name on first call only
        if not test_name_printed:
            # Get test class and function names
            test_class = request.cls.__name__ if request.cls else None
            test_function = request.function.__name__

            if test_class:
                test_header = f"\n{'='*70}\n{test_class}::{test_function}\n{'='*70}"
            else:
                test_header = f"\n{'='*70}\n{test_function}\n{'='*70}"

            print(test_header)
            test_name_printed = True

        # Print the step message
        print(f"  {message}")

    return _log_step

@pytest.fixture
def test_db(request):
    """
    Fixture for database setup/teardown (*.sqlite file).

    - Creates test database if it doesn't exist (using database.init_db_once())
    - Tracks whether the file existed before the test
    - Deletes the database only on success AND only if it was created by this fixture
    - Leaves pre-existing database files untouched
    """
    from database.db import init_db_once

    db_existed_before = TEST_DB_FILE.exists()

    # Create the database if it doesn't exist
    if not db_existed_before:
        TEST_DB_FILE.parent.mkdir(parents=True, exist_ok=True)
        init_db_once(str(TEST_DB_FILE))

    yield TEST_DB_FILE

    # Cleanup: only delete if we created it AND test passed
    if not db_existed_before and request.node.rep_call.passed:
        if TEST_DB_FILE.exists():
            TEST_DB_FILE.unlink()

@pytest.hookimpl(tryfirst=True, hookwrapper=True)
def pytest_runtest_makereport(item, call):
    """Hook to capture test result status."""
    outcome = yield
    rep = outcome.get_result()   # Get report
    item.rep_call = rep          # Store report of test run into internal object available from within fixtures

# ==================== Test Session Hooks ====================

def pytest_sessionstart(session):
    """
    Called before the whole test session starts.
    Remove test DB file if it exists to ensure a clean slate.
    """
    if TEST_DB_FILE.exists():
        TEST_DB_FILE.unlink()
        print(f"Removed existing test DB file at start: {TEST_DB_FILE}")


def pytest_sessionfinish(session, exitstatus):
    """
    Called after the whole test session finishes.
    If all tests passed (exitstatus == 0), remove the test DB file.
    """
    test_paths = session.config.option.file_or_dir
    if exitstatus == 0:
        if not test_paths:
            if TEST_DB_FILE.exists():
                TEST_DB_FILE.unlink()
                print(f"Removed test database file: {TEST_DB_FILE}")
        else:
            print(f"Test DB file retained because running subset of tests: {test_paths}")
