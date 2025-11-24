# Test suite for Individual CRUD operations
# All CRUD operations are merged into a single test function to minimize
# database initializations and cleaning. The database is initialized once
# at the start and cleaned only on success.

import pytest
from tests.backend.db_utils import DatabaseUtils, IndividualVerifier

def create_test_individual(client, gedcom_id=None, given_name="John", family_name="Doe"):
    """
    Helper function to create a test individual.

    Args:
        client: FastAPI TestClient
        gedcom_id: GEDCOM ID for the individual (optional - backend will generate)
        given_name: Given name
        family_name: Family/surname

    Returns:
        Response JSON data for the created individual
    """
    data = {
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
    if gedcom_id:
        data["gedcom_id"] = gedcom_id
    response = client.post("/individuals/", json=data)
    return response.json()

class TestIndividualsCRUD:
    """Test suite for Individual CRUD operations - merged into single test."""

    def test_crud_operations_workflow(self, client, sample_individual_data, log_test_step):
        """Comprehensive test covering all CRUD operations."""
        
        log_test_step("Creating first individual with auto-generated GEDCOM ID")
        response = client.post("/individuals/", json=sample_individual_data)
        assert response.status_code == 200, f"Failed to create individual: {response.json()}"
        data = response.json()
        assert "gedcom_id" in data
        assert data["gedcom_id"] is not None
        auto_gedcom_id_1 = data["gedcom_id"]
        assert data["sex_code"] == sample_individual_data["sex_code"]
        assert data["names"][0]["given_name"] == sample_individual_data["names"][0]["given_name"]
        assert data["names"][0]["family_name"] == sample_individual_data["names"][0]["family_name"]
        assert "id" in data

        individual_id_1 = data["id"]

        log_test_step(f"Verifying persistence of individual with id={individual_id_1}")
        individuals = DatabaseUtils.execute_query(
            "SELECT * FROM main_individuals WHERE id = ?",
            (individual_id_1,)
        )
        assert len(individuals) == 1, "Individual not found in database"
        assert individuals[0]["gedcom_id"] == auto_gedcom_id_1

        log_test_step(f"Verifying names persisted for individual id={individual_id_1}")
        names = IndividualVerifier.individual_names(individual_id_1)
        assert len(names) == 1, "Individual name record not found"
        assert names[0]["given_name"] == sample_individual_data["names"][0]["given_name"]
        assert names[0]["family_name"] == sample_individual_data["names"][0]["family_name"]

        log_test_step("Creating second individual with different sample data")
        sample_individual_data_2 = {
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
        response = client.post("/individuals/", json=sample_individual_data_2)
        assert response.status_code == 200, f"Failed to create second individual: {response.json()}"
        data = response.json()

        individual_id_2 = data["id"]
        auto_gedcom_id_2 = data["gedcom_id"]

        log_test_step("Creating third individual with explicit GEDCOM ID")
        response = client.post("/individuals/", json={
            "gedcom_id": "I999",
            "sex_code": "M",
            "birth_date": "1975-03-10",
            "birth_place": "Boston, USA",
            "death_date": None,
            "death_place": None,
            "notes": "Third test individual",
            "names": [
                {
                    "given_name": "Bob",
                    "family_name": "Johnson"
                }
            ]
        })
        assert response.status_code == 200, f"Failed to create third individual: {response.json()}"
        data = response.json()
        individual_id_3 = data["id"]
        assert data["gedcom_id"] == "I999"

        log_test_step("Testing duplicate GEDCOM ID rejection")
        response = client.post("/individuals/", json={
            "gedcom_id": "I999",
            "sex_code": "F",
            "birth_date": "1990-01-01",
            "birth_place": "Some Place",
            "death_date": None,
            "death_place": None,
            "notes": "Duplicate attempt",
            "names": [
                {
                    "given_name": "Alice",
                    "family_name": "Duplicate"
                }
            ]
        })
        assert response.status_code == 400
        assert "GEDCOM ID already exists" in response.json()["detail"]

        log_test_step("Verifying only one record with GEDCOM ID I999 exists")
        individuals = IndividualVerifier.individual_by_gedcom_id("I999")
        assert len(individuals) == 1, f"Expected 1 individual with GEDCOM ID I999, found {len(individuals)}"

        log_test_step("Fetching list of all individuals")
        response = client.get("/individuals/")
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 3, "Should have at least 3 individuals"
        assert any(ind["id"] == individual_id_1 for ind in data)
        assert any(ind["id"] == individual_id_2 for ind in data)
        assert any(ind["id"] == individual_id_3 for ind in data)

        log_test_step("Checking database count of individuals")
        all_individuals = IndividualVerifier.all_individuals()
        assert len(all_individuals) >= 3, f"Expected at least 3 individuals in DB, got {len(all_individuals)}"

        log_test_step("Testing pagination (skip=1, limit=2)")
        response = client.get("/individuals/?skip=1&limit=2")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2, f"Expected exactly 2 individuals with skip=1&limit=2, got {len(data)}"

        log_test_step(f"Fetching individual by id={individual_id_1}")
        response = client.get(f"/individuals/{individual_id_1}")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == individual_id_1
        assert data["gedcom_id"] == auto_gedcom_id_1
        assert len(data["names"]) == 1

        log_test_step("Verifying individual exists in database")
        assert IndividualVerifier.individual_exists(individual_id_1)

        log_test_step("Testing fetch of non-existent individual id=99999")
        response = client.get("/individuals/99999")
        assert response.status_code == 404
        assert "Individual not found" in response.json()["detail"]

        log_test_step("Verifying non-existent individual does not exist in DB")
        assert not IndividualVerifier.individual_exists(99999)

        log_test_step(f"Updating individual id={individual_id_1}")
        update_data = {
            "birth_place": "Boston, USA",
            "notes": "Updated notes for first individual",
            "names": [
                {
                    "given_name": "Johnny",
                    "family_name": "Doe"
                }
            ]
        }
        response = client.put(f"/individuals/{individual_id_1}", json=update_data)
        assert response.status_code == 200, f"Failed to update individual: {response.json()}"
        data = response.json()
        assert data["birth_place"] == "Boston, USA"
        assert data["notes"] == "Updated notes for first individual"
        assert data["names"][0]["given_name"] == "Johnny"
        assert data["names"][0]["family_name"] == "Doe"

        log_test_step(f"Verifying updates persisted in DB for individual id={individual_id_1}")
        individuals = DatabaseUtils.execute_query(
            "SELECT * FROM main_individuals WHERE id = ?",
            (individual_id_1,)
        )
        assert len(individuals) == 1
        assert individuals[0]["birth_place"] == "Boston, USA"
        assert individuals[0]["notes"] == "Updated notes for first individual"

        log_test_step(f"Verifying names were updated for individual id={individual_id_1}")
        names = IndividualVerifier.individual_names(individual_id_1)
        assert len(names) == 1
        assert names[0]["given_name"] == "Johnny"
        assert names[0]["family_name"] == "Doe"

        log_test_step("Testing update of non-existent individual id=99999")
        response = client.put("/individuals/99999", json={"notes": "Will fail"})
        assert response.status_code == 404
        assert "Individual not found" in response.json()["detail"]

        log_test_step(f"Deleting individual id={individual_id_2}")
        response = client.delete(f"/individuals/{individual_id_2}")
        assert response.status_code == 200
        assert "Individual deleted" in response.json()["detail"]

        log_test_step("Verifying deleted individual returns 404")
        get_response = client.get(f"/individuals/{individual_id_2}")
        assert get_response.status_code == 404

        log_test_step("Verifying individual removed from database")
        assert not IndividualVerifier.individual_exists(individual_id_2)

        log_test_step("Testing delete of non-existent individual id=99999")
        response = client.delete("/individuals/99999")
        assert response.status_code == 404
        assert "Individual not found" in response.json()["detail"]

        log_test_step("Final verification of remaining individuals")
        all_individuals = IndividualVerifier.all_individuals()
        all_ids = [ind["id"] for ind in all_individuals]
        assert individual_id_1 in all_ids, "Individual 1 should still exist"
        assert individual_id_3 in all_ids, "Individual 3 should still exist"
        assert individual_id_2 not in all_ids, "Individual 2 should be deleted"

        log_test_step("Testing create and validate multiple names on individual")
        create_data = {
            "sex_code": "F",
            "birth_date": "1990-05-10",
            "birth_place": "Testville",
            "notes": "Has multiple names",
            "names": [
                {"given_name": "Anna", "family_name": "Smith"},
                {"given_name": "Anya", "family_name": "S."},
            ]
        }
        response = client.post("/individuals/", json=create_data)
        assert response.status_code == 200
        ind = response.json()
        assert len(ind["names"]) == 2
        assert any(name["given_name"] == "Anna" for name in ind["names"])
        assert any(name["given_name"] == "Anya" for name in ind["names"])

        log_test_step(f"Updating names list for individual id={ind['id']}")
        update_names = {"names": [
            {"given_name": "Annabelle", "family_name": "Smithers"}
        ]}
        response = client.put(f"/individuals/{ind['id']}", json=update_names)
        assert response.status_code == 200
        updated = response.json()
        assert len(updated["names"]) == 1
        assert updated["names"][0]["given_name"] == "Annabelle"
        assert updated["names"][0]["family_name"] == "Smithers"

        log_test_step(f"Deleting individual id={ind['id']} and confirming cascade delete of names")
        response = client.delete(f"/individuals/{ind['id']}")
        assert response.status_code == 200
        response_get = client.get(f"/individuals/{ind['id']}")
        assert response_get.status_code == 404
