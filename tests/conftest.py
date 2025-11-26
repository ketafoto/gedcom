# Root conftest.py - Shared fixtures for all tests
# Includes log_test_step and database configuration for tests

import os
import pytest
import subprocess

from pathlib import Path


# ==================== Test Database Configuration ====================

TEST_DB_FILE     = Path("test_gedcom.sqlite")
TEST_GEDCOM_FILE = Path(__file__).parent / "database" / "test_novoseltsev.ged"
PROJECT_ROOT_DIR = Path(__file__).parent.parent


def pytest_addoption(parser):
    parser.addoption(
        "--my-debug",
        action="store_true",
        default=False,
        help="Run tests in debug mode, showing script output and preserving files",
    )

@pytest.fixture
def is_debug(request):
    return request.config.getoption("--my-debug")

@pytest.fixture(scope="session", autouse=True)
def logging_functions(request):
    """Autouse: Makes log_test_step() and log_debug() globally available."""

    test_state = {"header_printed": False}

    def log_test_step(message: str):
        if not test_state["header_printed"]:
            test_class = request.cls.__name__ if request.cls else None
            test_function = request.function.__name__
            if test_class:
                test_header = f"\n{'='*70}\n{test_class}::{test_function}\n{'='*70}"
            else:
                test_header = f"\n{'='*70}\n{test_function}\n{'='*70}"
            print(test_header)
            test_state["header_printed"] = True
        print(f" {message}")

    def log_debug(message: str):
        if request.config.getoption("--test-debug"):
            print(f"🔍 DEBUG: {message}")

    globals()["log_test_step"] = log_test_step
    globals()["log_debug"] = log_debug

    yield

@pytest.fixture(autouse=True)
def reset_logging():
    """Reset logging state between tests."""
    test_state["header_printed"] = False
    yield

@pytest.fixture
def test_db(request, is_debug):
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
    if not db_existed_before and request.node.rep_call.passed and not is_debug:
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

# ==============================================================================

def run_script_with_debug(cmd, debug=False, cwd=None, timeout=None):
    """
    Run subprocess command with optional debug output.

    Args:
        cmd: List of command arguments (e.g., [sys.executable, "script.py", "arg1"])
        debug: If True, print stdout/stderr even if successful
        cwd: Working directory
        timeout: Timeout in seconds

    Returns:
        subprocess.CompletedProcess result
    """
    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        cwd=cwd,
        timeout=timeout
    )
    if debug:
        # if result.stderr:
        print(f"🔍 Running: {' '.join(cmd)}")
        print(f"📤 STDOUT:\n{result.stdout}")
        print(f"❌ STDERR:\n{result.stderr}")
        print("-" * 80)
    return result