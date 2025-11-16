# tests/backend/test_individuals.py - CORRECTED VERSION

import pytest

from tests.backend.db_utils import DatabaseUtils, IndividualVerifier


class TestIndividualsCRUD:
    """Test suite for Individual CRUD operations."""

    def test_create_individual(self, client, sample_individual_data):
        """Test creating a new individual."""
        response = client.post("/individuals/", json=sample_individual_data)

        assert response.status_code == 200
        data = response.json()

        # Verify response data
        assert data["gedcom_id"] == sample_individual_data["gedcom_id"]
        assert data["sex_code"] == sample_individual_data["sex_code"]
        assert data["names"][0]["given_name"] == sample_individual_data["names"][0]["given_name"]
        assert data["names"][0]["family_name"] == sample_individual_data["names"][0]["family_name"]
        assert "id" in data

        # VERIFY: Check that individual was persisted
        individual_id = data["id"]
        individuals = DatabaseUtils.execute_query(
            "SELECT * FROM main_individuals WHERE id = ?",
            (individual_id,)
        )

        assert len(individuals) == 1, "Individual not found in database"
        assert individuals[0]["gedcom_id"] == sample_individual_data["gedcom_id"]

        # VERIFY: Check that names were persisted
        names = IndividualVerifier.individual_names(individual_id)
        assert len(names) == 1, "Individual name record not found"
        assert names[0]["given_name"] == sample_individual_data["names"][0]["given_name"]
        assert names[0]["family_name"] == sample_individual_data["names"][0]["family_name"]

    def test_create_individual_duplicate_gedcom_id(self, client, sample_individual_data):
        """Test that creating an individual with duplicate GEDCOM ID fails."""
        # Create first individual
        client.post("/individuals/", json=sample_individual_data)

        # Try to create duplicate
        response = client.post("/individuals/", json=sample_individual_data)

        assert response.status_code == 400
        assert "GEDCOM ID already exists" in response.json()["detail"]

        # VERIFY: Only one record with this GEDCOM ID exists
        individuals = IndividualVerifier.individual_by_gedcom_id(
            sample_individual_data["gedcom_id"]
        )
        assert len(individuals) == 1, (
            f"Expected 1 individual with GEDCOM ID, found {len(individuals)}"
        )

    def test_read_individuals(self, client, sample_individual_data):
        """Test reading list of individuals."""
        # Create first individual
        client.post("/individuals/", json=sample_individual_data)

        # Create second individual with different data
        sample_individual_data_2 = {
            "gedcom_id": "I002",
            "sex_code": "F",
            "birth_date": "1982-05-20",
            "birth_place": "New York, USA",
            "death_date": None,
            "death_place": None,
            "notes": "Second test individual",
            "names": [
                {
                    "given_name": "Jane",
                    "family_name": "Smith"
                }
            ]
        }
        client.post("/individuals/", json=sample_individual_data_2)

        # Read individuals
        response = client.get("/individuals/")

        assert response.status_code == 200
        data = response.json()

        assert len(data) >= 2
        assert any(ind["gedcom_id"] == "I001" for ind in data)
        assert any(ind["gedcom_id"] == "I002" for ind in data)

        # VERIFY: Database has at least 2 individuals
        all_individuals = IndividualVerifier.all_individuals()
        assert len(all_individuals) >= 2, f"Expected at least 2 individuals in DB"

    def test_read_individuals_with_pagination(self, client, sample_individual_data):
        """Test reading individuals with skip and limit parameters."""
        # Create multiple individuals
        for i in range(5):
            data = {
                "gedcom_id": f"I{1000+i}",
                "sex_code": "M" if i % 2 == 0 else "F",
                "birth_date": f"198{i}-01-15",
                "birth_place": f"City {i}",
                "death_date": None,
                "death_place": None,
                "notes": f"Test individual {i}",
                "names": [
                    {
                        "given_name": f"Person{i}",
                        "family_name": f"Surname{i}"
                    }
                ]
            }
            client.post("/individuals/", json=data)

        # Test pagination
        response = client.get("/individuals/?skip=1&limit=2")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2

        # VERIFY: Database has 5 individuals
        all_individuals = IndividualVerifier.all_individuals()
        assert len(all_individuals) == 5, f"Expected 5 individuals in DB"

    def test_read_individual_by_id(self, client, sample_individual_data):
        """Test reading a single individual by ID."""
        # Create individual
        create_response = client.post("/individuals/", json=sample_individual_data)
        individual_id = create_response.json()["id"]

        # Read individual by ID
        response = client.get(f"/individuals/{individual_id}")

        assert response.status_code == 200
        data = response.json()

        assert data["id"] == individual_id
        assert data["gedcom_id"] == sample_individual_data["gedcom_id"]
        assert len(data["names"]) == 1

        # VERIFY: Individual exists in DB
        assert IndividualVerifier.individual_exists(individual_id)

    def test_read_individual_not_found(self, client):
        """Test reading a non-existent individual returns 404."""
        response = client.get("/individuals/99999")

        assert response.status_code == 404
        assert "Individual not found" in response.json()["detail"]

        # VERIFY: Individual does not exist in DB
        assert not IndividualVerifier.individual_exists(99999)

    def test_update_individual(self, client, sample_individual_data):
        """Test updating an individual."""
        # Create individual
        create_response = client.post("/individuals/", json=sample_individual_data)
        individual_id = create_response.json()["id"]

        # Update individual
        update_data = {
            "birth_place": "Boston, USA",
            "notes": "Updated notes",
            "names": [
                {
                    "given_name": "Johnny",
                    "family_name": "Doe"
                }
            ]
        }

        response = client.put(f"/individuals/{individual_id}", json=update_data)

        assert response.status_code == 200
        data = response.json()

        assert data["birth_place"] == "Boston, USA"
        assert data["notes"] == "Updated notes"
        assert data["names"][0]["given_name"] == "Johnny"
        assert data["names"][0]["family_name"] == "Doe"

        # VERIFY: Database has the updated values
        individuals = DatabaseUtils.execute_query(
            "SELECT * FROM main_individuals WHERE id = ?",
            (individual_id,)
        )

        assert len(individuals) == 1
        assert individuals[0]["birth_place"] == "Boston, USA"
        assert individuals[0]["notes"] == "Updated notes"

        # Verify names were updated
        names = IndividualVerifier.individual_names(individual_id)
        assert len(names) == 1
        assert names[0]["given_name"] == "Johnny"
        assert names[0]["family_name"] == "Doe"

    def test_update_individual_not_found(self, client):
        """Test updating a non-existent individual returns 404."""
        update_data = {"notes": "Will fail"}

        response = client.put("/individuals/99999", json=update_data)

        assert response.status_code == 404
        assert "Individual not found" in response.json()["detail"]

    def test_delete_individual(self, client, sample_individual_data):
        """Test deleting an individual."""
        # Create individual
        create_response = client.post("/individuals/", json=sample_individual_data)
        individual_id = create_response.json()["id"]

        # Verify it exists first
        assert IndividualVerifier.individual_exists(individual_id)

        # Delete individual
        response = client.delete(f"/individuals/{individual_id}")

        assert response.status_code == 200
        assert "Individual deleted" in response.json()["detail"]

        # Verify deletion via GET returns 404
        get_response = client.get(f"/individuals/{individual_id}")
        assert get_response.status_code == 404

        # VERIFY: Individual removed from database
        assert not IndividualVerifier.individual_exists(individual_id)

    def test_delete_individual_not_found(self, client):
        """Test deleting a non-existent individual returns 404."""
        response = client.delete("/individuals/99999")

        assert response.status_code == 404
        assert "Individual not found" in response.json()["detail"]


# Reusable helper functions for complex tests

def create_test_individual(client, gedcom_id="I001", given_name="John", family_name="Doe"):
    """
    Helper function to create a test individual.

    Args:
        client: FastAPI TestClient
        gedcom_id: GEDCOM ID for the individual
        given_name: Given name
        family_name: Family/surname

    Returns:
        Response JSON data for the created individual
    """
    data = {
        "gedcom_id": gedcom_id,
        "sex_code": "M",
        "birth_date": "1980-01-15",
        "birth_place": "Test City",
        "death_date": None,
        "death_place": None,
        "notes": "Test individual",
        "names": [
            {
                "given_name": given_name,
                "family_name": family_name
            }
        ]
    }

    response = client.post("/individuals/", json=data)
    return response.json()