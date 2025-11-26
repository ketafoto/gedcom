# Root conftest.py - Shared fixtures for all tests
# Includes log_test_step and database configuration for tests
#
# Test Configuration:
# - Each test module gets its own temp folder: tests/<module_path>/temp/
#   e.g., tests/backend/test_backend.py → tests/backend/test_backend/temp/
# - The default user (inovoseltsev) is used, mirroring the real users/ structure
# - The test GEDCOM data is copied from users/inovoseltsev/data.ged
# - All test data is cleaned up after successful test runs
#

import shutil
import pytest
import subprocess

from pathlib import Path
from database.user_info import UserInfo


# ==================== Test Configuration ====================

PROJECT_ROOT_DIR = Path(__file__).parent.parent
TESTS_DIR = Path(__file__).parent

# Source data: use inovoseltsev's GEDCOM file as test data
SOURCE_GEDCOM = PROJECT_ROOT_DIR / "users" / "inovoseltsev" / "data.ged"


def get_test_user(test_module_path: Path) -> UserInfo:
    """
    Create UserInfo for a specific test module.

    Each test module gets its own temp folder based on the module name:
    - tests/backend/test_backend.py → tests/backend/test_backend/temp/
    - tests/database/test_database.py → tests/database/test_database/temp/

    Args:
        test_module_path: Path to the test module file (e.g., Path(__file__))

    Returns:
        UserInfo with base_dir pointing to the module's temp folder
    """
    # Get the module name without .py extension
    module_name = test_module_path.stem  # e.g., "test_backend"
    # Create temp folder next to the test module
    temp_dir = test_module_path.parent / module_name / "temp"
    return UserInfo(base_dir=temp_dir)

# Shared state for logging (module-level so it's accessible from all fixtures)
_test_state = {"header_printed": False}


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

@pytest.fixture
def log_test_step(request):
    """Provides log_test_step function for test logging with headers."""

    def _log_test_step(message: str):
        if not _test_state["header_printed"]:
            test_class = request.cls.__name__ if request.cls else None
            test_function = request.node.name
            if test_class:
                test_header = f"\n{'='*70}\n{test_class}::{test_function}\n{'='*70}"
            else:
                test_header = f"\n{'='*70}\n{test_function}\n{'='*70}"
            print(test_header)
            _test_state["header_printed"] = True
        print(f" {message}")

    return _log_test_step

@pytest.fixture
def log_debug(request):
    """Provides log_debug function for debug output."""

    def _log_debug(message: str):
        if request.config.getoption("--my-debug"):
            print(f"🔍 DEBUG: {message}")

    return _log_debug

@pytest.fixture(autouse=True)
def reset_logging():
    """Reset logging state between tests."""
    _test_state["header_printed"] = False
    yield

@pytest.fixture
def test_db(request, is_debug):
    """
    Fixture for database setup/teardown.

    - Creates test user directory based on test module path
      e.g., tests/database/test_database/temp/inovoseltsev/
    - Copies GEDCOM file from users/inovoseltsev/data.ged
    - Creates test database using init_db_once()
    - Does NOT clean up here - cleanup only happens in pytest_sessionfinish
      when ALL tests pass (to preserve files for debugging failed tests)
    """
    from database.db import init_db_once, reset_engine

    # Reset any existing engine state
    reset_engine()

    # Create test UserInfo with module-specific temp directory
    test_module_path = Path(request.fspath)
    test_user = get_test_user(test_module_path)

    # Copy source GEDCOM file if it exists and test file doesn't
    if SOURCE_GEDCOM.exists() and not test_user.gedcom_file.exists():
        shutil.copy2(SOURCE_GEDCOM, test_user.gedcom_file)

    # Initialize the database
    init_db_once(test_user)

    yield test_user

    # Reset engine after test (but don't delete files - that's done in session finish)
    reset_engine()

@pytest.hookimpl(tryfirst=True, hookwrapper=True)
def pytest_runtest_makereport(item, call):
    """Hook to capture test result status."""
    outcome = yield
    rep = outcome.get_result()   # Get report
    item.rep_call = rep          # Store report of test run into internal object available from within fixtures

# ==================== Test Session Hooks ====================

def _find_test_temp_dirs() -> list[Path]:
    """Find all test temp directories (tests/**/test_*/temp/)."""
    temp_dirs = []
    for test_file in TESTS_DIR.rglob("test_*.py"):
        temp_dir = test_file.parent / test_file.stem / "temp"
        if temp_dir.exists():
            temp_dirs.append(temp_dir.parent)  # Return the test_* folder, not temp/
    return temp_dirs


def _cleanup_test_data() -> list[str]:
    """Remove all test data directories."""
    cleaned = []
    for temp_dir in _find_test_temp_dirs():
        shutil.rmtree(temp_dir)
        cleaned.append(str(temp_dir.relative_to(TESTS_DIR)))
    return cleaned


def _cleanup_legacy_test_files():
    """Remove legacy test files from old locations."""
    files_removed = []

    # Remove old test_user_data directory
    old_test_dir = TESTS_DIR / "test_user_data"
    if old_test_dir.exists():
        shutil.rmtree(old_test_dir)
        files_removed.append("test_user_data/")

    # Remove old tests/temp directory (from previous refactoring)
    old_temp_dir = TESTS_DIR / "temp"
    if old_temp_dir.exists():
        shutil.rmtree(old_temp_dir)
        files_removed.append("temp/")

    # Remove legacy test DB file from project root
    legacy_db = PROJECT_ROOT_DIR / "test_gedcom.sqlite"
    if legacy_db.exists():
        legacy_db.unlink()
        files_removed.append(legacy_db.name)

    # Remove legacy backup files
    for backup_file in PROJECT_ROOT_DIR.glob("test_gedcom.sqlite.*"):
        backup_file.unlink()
        files_removed.append(backup_file.name)

    # Remove legacy export files
    for export_file in PROJECT_ROOT_DIR.glob("test_gedcom_export*.txt"):
        export_file.unlink()
        files_removed.append(export_file.name)

    return files_removed


def pytest_sessionstart(session):
    """
    Called before the whole test session starts.
    Clean up test data to ensure a clean slate.
    """
    # Clean up test data
    cleaned = _cleanup_test_data()
    if cleaned:
        print(f"Cleaned up test directories at start: {', '.join(cleaned)}")

    # Clean up legacy files from old test location
    legacy_files = _cleanup_legacy_test_files()
    if legacy_files:
        print(f"Cleaned up legacy test files: {', '.join(legacy_files)}")


def pytest_sessionfinish(session, exitstatus):
    """
    Called after the whole test session finishes.
    Only removes test data if ALL tests passed (exitstatus == 0).
    If any test failed, files are retained for debugging.
    """
    is_debug = session.config.getoption("--my-debug", default=False)
    temp_dirs = _find_test_temp_dirs()

    if is_debug:
        if temp_dirs:
            print(f"\n📁 Debug mode: Test files retained for inspection:")
            for d in temp_dirs:
                print(f"   - {d.relative_to(TESTS_DIR)}")
        return

    if exitstatus == 0:
        # All tests passed - clean up
        cleaned = _cleanup_test_data()
        if cleaned:
            print(f"\n✅ All tests passed. Cleaned up: {', '.join(cleaned)}")

        legacy_files = _cleanup_legacy_test_files()
        if legacy_files:
            print(f"   Also cleaned up legacy files: {', '.join(legacy_files)}")
    else:
        # Some tests failed - keep files for debugging
        if temp_dirs:
            print(f"\n⚠️  Some tests failed. Test files retained for debugging:")
            for d in temp_dirs:
                print(f"   - {d.relative_to(TESTS_DIR)}")

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