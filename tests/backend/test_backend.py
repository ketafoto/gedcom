# pytest -s
# pytest tests/backend/test_backend.py::TestFamiliesCRUD -s

import pytest
from tests.backend.db_utils import DatabaseUtils, IndividualVerifier

class TestIndividualsCRUD:
    """Test suite for Individual CRUD operations - merged into single test."""

    def test_crud_individuals_workflow(self, client, sample_individual_data, log_test_step):

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

class TestFamiliesCRUD:
    """Test suite for Family CRUD operations."""

    def test_families_crud_workflow(self, client, log_test_step):
        """Test complete CRUD workflows for families including children management."""

        log_test_step("Creating four individuals: 2 parents + 2 children")
        
        # Create parent 1 (father)
        ind1_data = {
            "sex_code": "M",
            "birth_date": "1980-01-15",
            "birth_place": "Moscow, USSR",
            "names": [{"given_name": "Ivan", "family_name": "Petrov"}]
        }
        response = client.post("/individuals/", json=ind1_data)
        assert response.status_code == 200
        ind1_id = response.json()["id"]
        log_test_step(f"Individual 1 (father) created with id={ind1_id}")

        # Create parent 2 (mother)
        ind2_data = {
            "sex_code": "F",
            "birth_date": "1985-06-20",
            "birth_place": "Saint Petersburg, USSR",
            "names": [{"given_name": "Maria", "family_name": "Petrova"}]
        }
        response = client.post("/individuals/", json=ind2_data)
        assert response.status_code == 200
        ind2_id = response.json()["id"]
        log_test_step(f"Individual 2 (mother) created with id={ind2_id}")

        # Create child 1
        ind3_data = {
            "sex_code": "M",
            "birth_date": "2010-03-15",
            "birth_place": "Moscow, Russia",
            "names": [{"given_name": "Alexei", "family_name": "Petrov"}]
        }
        response = client.post("/individuals/", json=ind3_data)
        assert response.status_code == 200
        ind3_id = response.json()["id"]
        log_test_step(f"Individual 3 (child 1) created with id={ind3_id}")

        # Create child 2
        ind4_data = {
            "sex_code": "F",
            "birth_date": "2012-07-22",
            "birth_place": "Moscow, Russia",
            "names": [{"given_name": "Natasha", "family_name": "Petrova"}]
        }
        response = client.post("/individuals/", json=ind4_data)
        assert response.status_code == 200
        ind4_id = response.json()["id"]
        log_test_step(f"Individual 4 (child 2) created with id={ind4_id}")

        log_test_step("Creating family with 2 parents and 2 children")
        family_data = {
            "marriage_date": "2008-07-10",
            "marriage_place": "Moscow, Russia",
            "family_type": "marriage",
            "notes": "Test family with children",
            "members": [
                {"individual_id": ind1_id, "role": "husband"},
                {"individual_id": ind2_id, "role": "wife"}
            ],
            "children": [
                {"child_id": ind3_id},
                {"child_id": ind4_id}
            ]
        }
        response = client.post("/families/", json=family_data)
        assert response.status_code == 200
        family = response.json()
        family_id = family["id"]
        gedcom_id = family["gedcom_id"]
        
        assert family["gedcom_id"] is not None
        assert family["gedcom_id"].startswith("F")
        log_test_step(f"Family created with id={family_id}, gedcom_id={gedcom_id}")

        log_test_step(f"Verifying family has 2 members in API response")
        assert len(family["members"]) == 2
        roles = [m["role"] for m in family["members"]]
        assert "husband" in roles
        assert "wife" in roles

        log_test_step(f"Verifying family has 2 children in API response")
        assert len(family["children"]) == 2
        child_ids = [c["child_id"] for c in family["children"]]
        assert ind3_id in child_ids
        assert ind4_id in child_ids

        log_test_step(f"Verifying family persisted in database with id={family_id}")
        families = DatabaseUtils.execute_query(
            "SELECT * FROM main_families WHERE id = ?",
            (family_id,)
        )
        assert len(families) == 1
        assert families[0]["gedcom_id"] == gedcom_id
        assert families[0]["family_type"] == "marriage"

        log_test_step(f"Verifying 2 family members persisted in database for family_id={family_id}")
        members = DatabaseUtils.execute_query(
            "SELECT * FROM main_family_members WHERE family_id = ?",
            (family_id,)
        )
        assert len(members) == 2
        member_individual_ids = [m["individual_id"] for m in members]
        assert ind1_id in member_individual_ids
        assert ind2_id in member_individual_ids

        log_test_step(f"Verifying 2 children persisted in database for family_id={family_id}")
        children = DatabaseUtils.execute_query(
            "SELECT * FROM main_family_children WHERE family_id = ?",
            (family_id,)
        )
        assert len(children) == 2
        child_individual_ids = [c["child_id"] for c in children]
        assert ind3_id in child_individual_ids
        assert ind4_id in child_individual_ids

        log_test_step(f"Fetching family by id={family_id}")
        response = client.get(f"/families/{family_id}")
        assert response.status_code == 200
        fetched_family = response.json()
        assert fetched_family["id"] == family_id
        assert fetched_family["family_type"] == "marriage"
        assert len(fetched_family["children"]) == 2

        # ============ TEST ADDING A CHILD ============
        log_test_step("Creating additional child to add to family")
        ind5_data = {
            "sex_code": "M",
            "birth_date": "2015-11-30",
            "birth_place": "Moscow, Russia",
            "names": [{"given_name": "Dmitri", "family_name": "Petrov"}]
        }
        response = client.post("/individuals/", json=ind5_data)
        assert response.status_code == 200
        ind5_id = response.json()["id"]
        log_test_step(f"Individual 5 (new child) created with id={ind5_id}")

        log_test_step(f"Adding child id={ind5_id} to family id={family_id}")
        family_update = {
            "children": [
                {"child_id": ind3_id},
                {"child_id": ind4_id},
                {"child_id": ind5_id}
            ]
        }
        response = client.put(f"/families/{family_id}", json=family_update)
        assert response.status_code == 200
        updated_family = response.json()
        assert len(updated_family["children"]) == 3
        log_test_step(f"Successfully added child to family (now has 3 children)")

        log_test_step(f"Verifying new child persisted in database for family_id={family_id}")
        children = DatabaseUtils.execute_query(
            "SELECT * FROM main_family_children WHERE family_id = ? ORDER BY child_id",
            (family_id,)
        )
        assert len(children) == 3, f"Expected 3 children in DB, found {len(children)}"
        child_ids_in_db = [c["child_id"] for c in children]
        assert ind5_id in child_ids_in_db, f"New child {ind5_id} not found in DB"
        log_test_step(f"Confirmed 3 children in database for family_id={family_id}")

        log_test_step(f"Fetching family after adding child")
        response = client.get(f"/families/{family_id}")
        assert response.status_code == 200
        fetched_family = response.json()
        assert len(fetched_family["children"]) == 3

        # ============ TEST MODIFYING CHILDREN (REPLACE) ============
        log_test_step(f"Modifying family to have only 2 children (removing child id={ind3_id})")
        family_update = {
            "children": [
                {"child_id": ind4_id},
                {"child_id": ind5_id}
            ]
        }
        response = client.put(f"/families/{family_id}", json=family_update)
        assert response.status_code == 200
        updated_family = response.json()
        assert len(updated_family["children"]) == 2
        log_test_step(f"Successfully modified family children list (now has 2 children)")

        log_test_step(f"Verifying modification persisted in database")
        children = DatabaseUtils.execute_query(
            "SELECT * FROM main_family_children WHERE family_id = ?",
            (family_id,)
        )
        assert len(children) == 2, f"Expected 2 children in DB after modification, found {len(children)}"
        child_ids_in_db = [c["child_id"] for c in children]
        assert ind4_id in child_ids_in_db
        assert ind5_id in child_ids_in_db
        assert ind3_id not in child_ids_in_db, f"Child {ind3_id} should have been removed"
        log_test_step(f"Confirmed modification: family now has only children {ind4_id} and {ind5_id}")

        log_test_step(f"Fetching family after modification")
        response = client.get(f"/families/{family_id}")
        assert response.status_code == 200
        fetched_family = response.json()
        assert len(fetched_family["children"]) == 2
        fetched_child_ids = [c["child_id"] for c in fetched_family["children"]]
        assert ind3_id not in fetched_child_ids

        # ============ TEST REMOVING ALL CHILDREN ============
        log_test_step(f"Removing all children from family")
        family_update = {
            "children": []
        }
        response = client.put(f"/families/{family_id}", json=family_update)
        assert response.status_code == 200
        updated_family = response.json()
        assert len(updated_family["children"]) == 0
        log_test_step(f"Successfully removed all children from family")

        log_test_step(f"Verifying all children removed from database")
        children = DatabaseUtils.execute_query(
            "SELECT * FROM main_family_children WHERE family_id = ?",
            (family_id,)
        )
        assert len(children) == 0, f"Expected 0 children in DB, found {len(children)}"
        log_test_step(f"Confirmed: no children remain in family")

        log_test_step(f"Fetching family after removing all children")
        response = client.get(f"/families/{family_id}")
        assert response.status_code == 200
        fetched_family = response.json()
        assert len(fetched_family["children"]) == 0

        # ============ TEST ADDING CHILDREN BACK ============
        log_test_step(f"Adding children back to family")
        family_update = {
            "children": [
                {"child_id": ind3_id},
                {"child_id": ind4_id},
                {"child_id": ind5_id}
            ]
        }
        response = client.put(f"/families/{family_id}", json=family_update)
        assert response.status_code == 200
        updated_family = response.json()
        assert len(updated_family["children"]) == 3
        log_test_step(f"Successfully added all children back (3 children)")

        log_test_step(f"Verifying children re-added in database")
        children = DatabaseUtils.execute_query(
            "SELECT * FROM main_family_children WHERE family_id = ?",
            (family_id,)
        )
        assert len(children) == 3, f"Expected 3 children in DB, found {len(children)}"
        log_test_step(f"Confirmed: 3 children restored to family")

        log_test_step(f"Updating other family fields while keeping children")
        family_update = {
            "divorce_date": "2020-12-15",
            "notes": "Updated family with children restored"
        }
        response = client.put(f"/families/{family_id}", json=family_update)
        assert response.status_code == 200
        updated_family = response.json()
        assert updated_family["divorce_date"] is not None
        assert updated_family["notes"] == "Updated family with children restored"
        assert len(updated_family["children"]) == 3, "Children should be preserved"
        log_test_step(f"Verified: other fields updated while children preserved")

        log_test_step(f"Verifying all data persisted correctly in database")
        families = DatabaseUtils.execute_query(
            "SELECT * FROM main_families WHERE id = ?",
            (family_id,)
        )
        assert len(families) == 1
        assert families[0]["notes"] == "Updated family with children restored"
        
        children = DatabaseUtils.execute_query(
            "SELECT * FROM main_family_children WHERE family_id = ?",
            (family_id,)
        )
        assert len(children) == 3
        log_test_step(f"All data confirmed in database")

        log_test_step(f"Deleting family id={family_id}")
        response = client.delete(f"/families/{family_id}")
        assert response.status_code == 200

        log_test_step("Verifying deleted family returns 404")
        response = client.get(f"/families/{family_id}")
        assert response.status_code == 404

        log_test_step(f"Verifying family deleted from database")
        families = DatabaseUtils.execute_query(
            "SELECT * FROM main_families WHERE id = ?",
            (family_id,)
        )
        assert len(families) == 0, "Family should be deleted from database"

        log_test_step(f"Verifying cascade delete: family members removed from database")
        members = DatabaseUtils.execute_query(
            "SELECT * FROM main_family_members WHERE family_id = ?",
            (family_id,)
        )
        assert len(members) == 0, "All family members should be cascade deleted"

        log_test_step(f"Verifying cascade delete: children removed from database")
        children = DatabaseUtils.execute_query(
            "SELECT * FROM main_family_children WHERE family_id = ?",
            (family_id,)
        )
        assert len(children) == 0, "All children should be cascade deleted"

        log_test_step("Families CRUD tests with children management completed successfully!")

class TestEventsCRUD:
    """Test suite for Event CRUD operations."""

    def test_events_crud_workflow(self, client, log_test_step):
        """Test complete CRUD workflows for events."""

        log_test_step("Creating individual for event testing")
        ind_data = {
            "sex_code": "M",
            "birth_date": "1975-03-10",
            "birth_place": "Moscow, USSR",
            "names": [{"given_name": "Boris", "family_name": "Ivanov"}]
        }
        response = client.post("/individuals/", json=ind_data)
        assert response.status_code == 200
        ind_id = response.json()["id"]
        log_test_step(f"Individual created with id={ind_id}")

        log_test_step("Creating birth event")
        event_data = {
            "individual_id": ind_id,
            "event_type_code": "BIRT",
            "event_date": "1975-03-10",
            "event_place": "Moscow, USSR"
        }
        response = client.post("/events/", json=event_data)
        assert response.status_code == 200
        event1 = response.json()
        event1_id = event1["id"]
        log_test_step(f"Birth event created with id={event1_id}")

        log_test_step("Creating baptism event")
        event_data_2 = {
            "individual_id": ind_id,
            "event_type_code": "BAPM",
            "event_date": "1975-04-15",
            "event_place": "Church of Christ, Moscow",
            "description": "Baptism ceremony"
        }
        response = client.post("/events/", json=event_data_2)
        assert response.status_code == 200
        event2 = response.json()
        event2_id = event2["id"]
        log_test_step(f"Baptism event created with id={event2_id}")

        log_test_step(f"Fetching event by id={event1_id}")
        response = client.get(f"/events/{event1_id}")
        assert response.status_code == 200
        fetched_event = response.json()
        assert fetched_event["event_type_code"] == "BIRT"
        assert fetched_event["individual_id"] == ind_id

        log_test_step(f"Fetching events for individual id={ind_id}")
        response = client.get(f"/events/?individual_id={ind_id}")
        assert response.status_code == 200
        events_list = response.json()
        assert len(events_list) >= 2

        log_test_step("Listing all events")
        response = client.get("/events/")
        assert response.status_code == 200
        all_events = response.json()
        assert len(all_events) >= 2

        log_test_step(f"Updating event with description")
        event_update = {"description": "Birth in Moscow, Russia"}
        response = client.put(f"/events/{event1_id}", json=event_update)
        assert response.status_code == 200
        updated_event = response.json()
        assert updated_event["description"] == "Birth in Moscow, Russia"

        log_test_step(f"Deleting event id={event2_id}")
        response = client.delete(f"/events/{event2_id}")
        assert response.status_code == 200

        log_test_step("Verifying deleted event returns 404")
        response = client.get(f"/events/{event2_id}")
        assert response.status_code == 404

        log_test_step("Events CRUD tests completed successfully!")

class TestMediaCRUD:
    """Test suite for Media CRUD operations."""

    def test_media_crud_workflow(self, client, log_test_step):
        """Test complete CRUD workflows for media."""

        log_test_step("Creating individual for media testing")
        ind_data = {
            "sex_code": "F",
            "birth_date": "1988-07-22",
            "birth_place": "Saint Petersburg, Russia",
            "names": [{"given_name": "Olga", "family_name": "Smirnova"}]
        }
        response = client.post("/individuals/", json=ind_data)
        assert response.status_code == 200
        ind_id = response.json()["id"]
        log_test_step(f"Individual created with id={ind_id}")

        log_test_step("Creating first media record")
        media_data = {
            "individual_id": ind_id,
            "file_path": "/media/photos/portrait_001.jpg",
            "media_type_code": "PHOTO",
            "media_date": "1990-05-10",
            "description": "Black and white portrait"
        }
        response = client.post("/media/", json=media_data)
        assert response.status_code == 200
        media1 = response.json()
        media1_id = media1["id"]
        log_test_step(f"Media 1 created with id={media1_id}")

        log_test_step("Creating second media record")
        media_data_2 = {
            "individual_id": ind_id,
            "file_path": "/media/photos/wedding_001.jpg",
            "media_type_code": "PHOTO",
            "description": "Wedding photo"
        }
        response = client.post("/media/", json=media_data_2)
        assert response.status_code == 200
        media2 = response.json()
        media2_id = media2["id"]
        log_test_step(f"Media 2 created with id={media2_id}")

        log_test_step(f"Fetching media by id={media1_id}")
        response = client.get(f"/media/{media1_id}")
        assert response.status_code == 200
        fetched_media = response.json()
        assert fetched_media["individual_id"] == ind_id
        assert fetched_media["description"] == "Black and white portrait"

        log_test_step(f"Fetching media for individual id={ind_id}")
        response = client.get(f"/media/?individual_id={ind_id}")
        assert response.status_code == 200
        media_list = response.json()
        assert len(media_list) >= 2

        log_test_step("Listing all media records")
        response = client.get("/media/")
        assert response.status_code == 200
        all_media = response.json()
        assert len(all_media) >= 2

        log_test_step("Updating media with new description")
        media_update = {"description": "Portrait in good condition"}
        response = client.put(f"/media/{media1_id}", json=media_update)
        assert response.status_code == 200
        updated_media = response.json()
        assert updated_media["description"] == "Portrait in good condition"

        log_test_step(f"Deleting media id={media2_id}")
        response = client.delete(f"/media/{media2_id}")
        assert response.status_code == 200

        log_test_step("Verifying deleted media returns 404")
        response = client.get(f"/media/{media2_id}")
        assert response.status_code == 404

        log_test_step("Media CRUD tests completed successfully!")
