# tests/backend/conftest.py - Backend-specific test fixtures

import pytest
from fastapi.testclient import TestClient
from database import db
from tests.conftest import TEST_DB_FILE

@pytest.fixture(scope="function")
def client():
    """Create a test client with test database session injected."""
    db.init_db_once(str(TEST_DB_FILE)) # Initialize DB engine and underling file
    from backend.main import app # IMPORTANT: import 'app' after engine initialization! Otherwise it will use default *.db file!

    with TestClient(app) as test_client:
        yield test_client


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
