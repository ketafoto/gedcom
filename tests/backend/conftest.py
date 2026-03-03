# tests/backend/conftest.py - Backend-specific test fixtures
#
# Test Configuration:
# - Uses tests/backend/<test_module>/temp/ as "datasets" folder
# - Database is reset between tests
#

import pytest
from pathlib import Path
from fastapi.testclient import TestClient
from database import db
from tests.conftest import get_test_owner
from tests.backend.db_utils import DatabaseUtils, IndividualVerifier, FamilyVerifier


@pytest.fixture(scope="function")
def test_owner(request):
    """Provide OwnerInfo for the test module."""
    test_module_path = Path(request.fspath)
    return get_test_owner(test_module_path)


@pytest.fixture(scope="function")
def client(test_owner):
    """
    Create a test client with test database session injected.

    The database is initialized fresh for each test function,
    using the test-specific directory.
    """
    # Reset any existing engine state
    db.reset_engine()

    # Initialize DB engine for test owner
    db.init_db_once(test_owner)

    # IMPORTANT: import 'app' after engine initialization!
    # Otherwise it will try to use the default owner's database
    from backend.main import app

    with TestClient(app) as test_client:
        yield test_client

    # Reset engine after test
    db.reset_engine()


@pytest.fixture(scope="function")
def db_utils(test_owner, client):
    """Provide DatabaseUtils instance for database verification."""
    return DatabaseUtils(test_owner.db_file)


@pytest.fixture(scope="function")
def individual_verifier(db_utils):
    """Provide IndividualVerifier instance."""
    return IndividualVerifier(db_utils)


@pytest.fixture(scope="function")
def family_verifier(db_utils):
    """Provide FamilyVerifier instance."""
    return FamilyVerifier(db_utils)


@pytest.fixture
def sample_individual_data():
    """Reusable sample individual data for creating records."""
    return {
        "sex_code": "M",
        "birth_date": "1980-01-15",
        "birth_place": "Jasnaya Polyana, USSR",
        "death_date": None,
        "death_place": None,
        "notes": "Test individual",
        "names": [
            {
                "given_name": "Vasya",
                "family_name": "Pryanik"
            }
        ]
    }
