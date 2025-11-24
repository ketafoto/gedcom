# This file provides reusable test fixtures including a test database and test client

import os

import pytest

from sqlalchemy import create_engine

from sqlalchemy.orm import sessionmaker

from fastapi.testclient import TestClient

from database import db

TEST_DB_FILE = "./test_gedcom.db"

@pytest.fixture(scope="function")
def client():
    """Create a test client with test database session injected."""
    db.init_db_once(TEST_DB_FILE) # Initialize DB engine and underling file
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

def pytest_sessionstart(session):
    """
    Called before the whole test session starts.
    Remove the test DB file if it exists to ensure a clean slate.
    """
    if os.path.exists(TEST_DB_FILE):
        os.remove(TEST_DB_FILE)
        print(f"Removed existing test DB file at start: {TEST_DB_FILE}")

def pytest_sessionfinish(session, exitstatus):
    """
    Called after the whole test session finishes.
    If all tests passed (exitstatus == 0), remove the test DB file.
    """
    test_paths = session.config.option.file_or_dir

    if exitstatus == 0:
        if not test_paths:
            if os.path.exists(TEST_DB_FILE):
                os.remove(TEST_DB_FILE)
                print(f"Removed test database file: {TEST_DB_FILE}")
        else:
            print(f"Test DB file retained because running subset of tests: {test_paths}")
