# pytest -s
# pytest tests/backend/test_backend.py::TestFamiliesCRUD -s

import pytest


class TestIndividualsCRUD:
    """Test suite for Individual CRUD operations - merged into single test."""

    def test_crud_individuals_workflow(self, client, db_utils, individual_verifier, sample_individual_data, log_test_step):

        log_test_step("Creating first individual with auto-generated GEDCOM ID")
        response = client.post("/individuals", json=sample_individual_data)
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
        individuals = db_utils.execute_query(
            "SELECT * FROM main_individuals WHERE id = ?",
            (individual_id_1,)
        )
        assert len(individuals) == 1, "Individual not found in database"
        assert individuals[0]["gedcom_id"] == auto_gedcom_id_1

        log_test_step(f"Verifying names persisted for individual id={individual_id_1}")
        names = individual_verifier.individual_names(individual_id_1)
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
        response = client.post("/individuals", json=sample_individual_data_2)
        assert response.status_code == 200, f"Failed to create second individual: {response.json()}"
        data = response.json()

        individual_id_2 = data["id"]
        auto_gedcom_id_2 = data["gedcom_id"]

        log_test_step("Creating third individual with explicit GEDCOM ID")
        response = client.post("/individuals", json={
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
        response = client.post("/individuals", json={
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
        individuals = individual_verifier.individual_by_gedcom_id("I999")
        assert len(individuals) == 1, f"Expected 1 individual with GEDCOM ID I999, found {len(individuals)}"

        log_test_step("Fetching list of all individuals")
        response = client.get("/individuals")
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 3, "Should have at least 3 individuals"
        assert any(ind["id"] == individual_id_1 for ind in data)
        assert any(ind["id"] == individual_id_2 for ind in data)
        assert any(ind["id"] == individual_id_3 for ind in data)

        log_test_step("Checking database count of individuals")
        all_individuals = individual_verifier.all_individuals()
        assert len(all_individuals) >= 3, f"Expected at least 3 individuals in DB, got {len(all_individuals)}"

        log_test_step("Testing pagination (skip=1, limit=2)")
        response = client.get("/individuals?skip=1&limit=2")
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
        assert individual_verifier.individual_exists(individual_id_1)

        log_test_step("Testing fetch of non-existent individual id=99999")
        response = client.get("/individuals/99999")
        assert response.status_code == 404
        assert "Individual not found" in response.json()["detail"]

        log_test_step("Verifying non-existent individual does not exist in DB")
        assert not individual_verifier.individual_exists(99999)

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
        individuals = db_utils.execute_query(
            "SELECT * FROM main_individuals WHERE id = ?",
            (individual_id_1,)
        )
        assert len(individuals) == 1
        assert individuals[0]["birth_place"] == "Boston, USA"
        assert individuals[0]["notes"] == "Updated notes for first individual"

        log_test_step(f"Verifying names were updated for individual id={individual_id_1}")
        names = individual_verifier.individual_names(individual_id_1)
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
        assert not individual_verifier.individual_exists(individual_id_2)

        log_test_step("Testing delete of non-existent individual id=99999")
        response = client.delete("/individuals/99999")
        assert response.status_code == 404
        assert "Individual not found" in response.json()["detail"]

        log_test_step("Final verification of remaining individuals")
        all_individuals = individual_verifier.all_individuals()
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
        response = client.post("/individuals", json=create_data)
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

    def test_families_crud_workflow(self, client, db_utils, log_test_step):
        """Test complete CRUD workflows for families including children management."""

        log_test_step("Creating four individuals: 2 parents + 2 children")

        # Create parent 1 (father)
        ind1_data = {
            "sex_code": "M",
            "birth_date": "1980-01-15",
            "birth_place": "Moscow, USSR",
            "names": [{"given_name": "Ivan", "family_name": "Petrov"}]
        }
        response = client.post("/individuals", json=ind1_data)
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
        response = client.post("/individuals", json=ind2_data)
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
        response = client.post("/individuals", json=ind3_data)
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
        response = client.post("/individuals", json=ind4_data)
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
        response = client.post("/families", json=family_data)
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
        families = db_utils.execute_query(
            "SELECT * FROM main_families WHERE id = ?",
            (family_id,)
        )
        assert len(families) == 1
        assert families[0]["gedcom_id"] == gedcom_id
        assert families[0]["family_type"] == "marriage"

        log_test_step(f"Verifying 2 family members persisted in database for family_id={family_id}")
        members = db_utils.execute_query(
            "SELECT * FROM main_family_members WHERE family_id = ?",
            (family_id,)
        )
        assert len(members) == 2
        member_individual_ids = [m["individual_id"] for m in members]
        assert ind1_id in member_individual_ids
        assert ind2_id in member_individual_ids

        log_test_step(f"Verifying 2 children persisted in database for family_id={family_id}")
        children = db_utils.execute_query(
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
        response = client.post("/individuals", json=ind5_data)
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
        children = db_utils.execute_query(
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
        children = db_utils.execute_query(
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
        children = db_utils.execute_query(
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
        children = db_utils.execute_query(
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
        families = db_utils.execute_query(
            "SELECT * FROM main_families WHERE id = ?",
            (family_id,)
        )
        assert len(families) == 1
        assert families[0]["notes"] == "Updated family with children restored"

        children = db_utils.execute_query(
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
        families = db_utils.execute_query(
            "SELECT * FROM main_families WHERE id = ?",
            (family_id,)
        )
        assert len(families) == 0, "Family should be deleted from database"

        log_test_step(f"Verifying cascade delete: family members removed from database")
        members = db_utils.execute_query(
            "SELECT * FROM main_family_members WHERE family_id = ?",
            (family_id,)
        )
        assert len(members) == 0, "All family members should be cascade deleted"

        log_test_step(f"Verifying cascade delete: children removed from database")
        children = db_utils.execute_query(
            "SELECT * FROM main_family_children WHERE family_id = ?",
            (family_id,)
        )
        assert len(children) == 0, "All children should be cascade deleted"

        log_test_step("Families CRUD tests with children management completed successfully!")

class TestEventsCRUD:
    """Test suite for Event CRUD operations."""

    def test_events_crud_workflow(self, client, db_utils, log_test_step):
        """Test complete CRUD workflows for events."""

        log_test_step("Creating individual for event testing")
        ind_data = {
            "sex_code": "M",
            "birth_date": "1975-03-10",
            "birth_place": "Moscow, USSR",
            "names": [{"given_name": "Boris", "family_name": "Ivanov"}]
        }
        response = client.post("/individuals", json=ind_data)
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
        response = client.post("/events", json=event_data)
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
        response = client.post("/events", json=event_data_2)
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
        response = client.get(f"/events?individual_id={ind_id}")
        assert response.status_code == 200
        events_list = response.json()
        assert len(events_list) >= 2

        log_test_step("Listing all events")
        response = client.get("/events")
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

    def test_events_error_handling(self, client, db_utils, log_test_step):
        """Test event API error handling."""

        log_test_step("Testing fetch of non-existent event id=99999")
        response = client.get("/events/99999")
        assert response.status_code == 404
        assert "Event not found" in response.json()["detail"]

        log_test_step("Testing update of non-existent event id=99999")
        response = client.put("/events/99999", json={"description": "Will fail"})
        assert response.status_code == 404
        assert "Event not found" in response.json()["detail"]

        log_test_step("Testing delete of non-existent event id=99999")
        response = client.delete("/events/99999")
        assert response.status_code == 404
        assert "Event not found" in response.json()["detail"]

        log_test_step("Event error handling tests completed!")

    def test_events_with_family(self, client, db_utils, log_test_step):
        """Test events associated with families."""

        log_test_step("Creating two individuals for family")
        ind1_data = {
            "sex_code": "M",
            "birth_date": "1980-05-15",
            "names": [{"given_name": "Peter", "family_name": "Smith"}]
        }
        response = client.post("/individuals", json=ind1_data)
        assert response.status_code == 200
        ind1_id = response.json()["id"]

        ind2_data = {
            "sex_code": "F",
            "birth_date": "1982-08-20",
            "names": [{"given_name": "Mary", "family_name": "Jones"}]
        }
        response = client.post("/individuals", json=ind2_data)
        assert response.status_code == 200
        ind2_id = response.json()["id"]
        log_test_step(f"Created individuals: husband={ind1_id}, wife={ind2_id}")

        log_test_step("Creating family")
        family_data = {
            "marriage_date": "2010-06-15",
            "marriage_place": "City Hall",
            "members": [
                {"individual_id": ind1_id, "role": "husband"},
                {"individual_id": ind2_id, "role": "wife"}
            ]
        }
        response = client.post("/families", json=family_data)
        assert response.status_code == 200
        family_id = response.json()["id"]
        log_test_step(f"Family created with id={family_id}")

        log_test_step("Creating marriage event for family")
        event_data = {
            "family_id": family_id,
            "event_type_code": "MARR",
            "event_date": "2010-06-15",
            "event_place": "City Hall, Boston",
            "description": "Wedding ceremony"
        }
        response = client.post("/events", json=event_data)
        assert response.status_code == 200
        event = response.json()
        assert event["family_id"] == family_id
        assert event["individual_id"] is None
        event_id = event["id"]
        log_test_step(f"Family event created with id={event_id}")

        log_test_step(f"Fetching events for family id={family_id}")
        response = client.get(f"/events?family_id={family_id}")
        assert response.status_code == 200
        events_list = response.json()
        assert len(events_list) >= 1
        assert any(e["id"] == event_id for e in events_list)

        log_test_step("Testing combined individual and family event filtering")
        # Create an event for individual to test mixed filtering
        ind_event = {
            "individual_id": ind1_id,
            "event_type_code": "OCCU",
            "description": "Started new job"
        }
        response = client.post("/events", json=ind_event)
        assert response.status_code == 200

        log_test_step("Verifying individual filter excludes family events")
        response = client.get(f"/events?individual_id={ind1_id}")
        assert response.status_code == 200
        ind_events = response.json()
        for e in ind_events:
            assert e["individual_id"] == ind1_id

        log_test_step("Family events test completed!")

    def test_events_all_gedcom_types(self, client, db_utils, log_test_step):
        """Test creating events with all GEDCOM 5.5.1 event types."""

        log_test_step("Creating individual for event type testing")
        ind_data = {
            "sex_code": "F",
            "birth_date": "1990-01-01",
            "names": [{"given_name": "Test", "family_name": "Person"}]
        }
        response = client.post("/individuals", json=ind_data)
        assert response.status_code == 200
        ind_id = response.json()["id"]

        # Test all standard GEDCOM event types
        event_types = [
            ("BIRT", "Birth event"),
            ("DEAT", "Death event"),
            ("BAPM", "Baptism event"),
            ("CHR", "Christening event"),
            ("ADOP", "Adoption event"),
            ("EVEN", "Generic event"),
        ]

        created_events = []
        for event_type, description in event_types:
            log_test_step(f"Creating {event_type} event")
            event_data = {
                "individual_id": ind_id,
                "event_type_code": event_type,
                "description": description
            }
            response = client.post("/events", json=event_data)
            assert response.status_code == 200, f"Failed to create {event_type} event"
            created_events.append(response.json())

        log_test_step(f"Created {len(created_events)} events with different types")
        assert len(created_events) == len(event_types)

        log_test_step("Verifying all events for individual")
        response = client.get(f"/events?individual_id={ind_id}")
        assert response.status_code == 200
        events = response.json()
        assert len(events) >= len(event_types)

        log_test_step("All GEDCOM event types test completed!")

    def test_events_database_persistence(self, client, db_utils, log_test_step):
        """Test that events are properly persisted in database."""

        log_test_step("Creating individual for persistence test")
        ind_data = {
            "sex_code": "M",
            "birth_date": "1965-12-25",
            "names": [{"given_name": "Nick", "family_name": "Holiday"}]
        }
        response = client.post("/individuals", json=ind_data)
        assert response.status_code == 200
        ind_id = response.json()["id"]

        log_test_step("Creating event with all fields populated")
        event_data = {
            "individual_id": ind_id,
            "event_type_code": "BIRT",
            "event_date": "1965-12-25",
            "event_place": "North Pole",
            "description": "A special birthday"
        }
        response = client.post("/events", json=event_data)
        assert response.status_code == 200
        event_id = response.json()["id"]

        log_test_step("Verifying event persistence via database query")
        events = db_utils.execute_query(
            "SELECT * FROM main_events WHERE id = ?",
            (event_id,)
        )
        assert len(events) == 1
        event_row = events[0]
        assert event_row["individual_id"] == ind_id
        assert event_row["event_type_code"] == "BIRT"
        assert event_row["event_place"] == "North Pole"
        assert event_row["description"] == "A special birthday"

        log_test_step("Testing update persistence")
        response = client.put(f"/events/{event_id}", json={
            "event_place": "Santa's Workshop",
            "description": "Updated description"
        })
        assert response.status_code == 200

        events = db_utils.execute_query(
            "SELECT * FROM main_events WHERE id = ?",
            (event_id,)
        )
        assert events[0]["event_place"] == "Santa's Workshop"
        assert events[0]["description"] == "Updated description"

        log_test_step("Testing delete persistence")
        response = client.delete(f"/events/{event_id}")
        assert response.status_code == 200

        events = db_utils.execute_query(
            "SELECT * FROM main_events WHERE id = ?",
            (event_id,)
        )
        assert len(events) == 0

        log_test_step("Event persistence tests completed!")

    def test_events_pagination(self, client, db_utils, log_test_step):
        """Test event pagination with skip and limit."""

        log_test_step("Creating individual for pagination test")
        ind_data = {
            "sex_code": "M",
            "names": [{"given_name": "Page", "family_name": "Test"}]
        }
        response = client.post("/individuals", json=ind_data)
        assert response.status_code == 200
        ind_id = response.json()["id"]

        log_test_step("Creating 5 events for pagination test")
        for i in range(5):
            event_data = {
                "individual_id": ind_id,
                "event_type_code": "EVEN",
                "description": f"Event number {i+1}"
            }
            response = client.post("/events", json=event_data)
            assert response.status_code == 200

        log_test_step("Testing skip=0, limit=2")
        response = client.get("/events?skip=0&limit=2")
        assert response.status_code == 200
        events = response.json()
        assert len(events) == 2

        log_test_step("Testing skip=2, limit=2")
        response = client.get("/events?skip=2&limit=2")
        assert response.status_code == 200
        events = response.json()
        assert len(events) == 2

        log_test_step("Pagination tests completed!")

class TestMediaCRUD:
    """Test suite for Media CRUD operations."""

    def test_media_crud_workflow(self, client, db_utils, log_test_step):
        """Test complete CRUD workflows for media."""

        log_test_step("Creating individual for media testing")
        ind_data = {
            "sex_code": "F",
            "birth_date": "1988-07-22",
            "birth_place": "Saint Petersburg, Russia",
            "names": [{"given_name": "Olga", "family_name": "Smirnova"}]
        }
        response = client.post("/individuals", json=ind_data)
        assert response.status_code == 200
        ind_id = response.json()["id"]
        log_test_step(f"Individual created with id={ind_id}")

        log_test_step("Creating first media record")
        media_data = {
            "individual_id": ind_id,
            "file_path": "/media/photos/portrait_001.jpg",
            "media_type_code": "photo",
            "media_date": "1990-05-10",
            "description": "Black and white portrait"
        }
        response = client.post("/media", json=media_data)
        assert response.status_code == 200
        media1 = response.json()
        media1_id = media1["id"]
        log_test_step(f"Media 1 created with id={media1_id}")

        log_test_step("Creating second media record")
        media_data_2 = {
            "individual_id": ind_id,
            "file_path": "/media/photos/wedding_001.jpg",
            "media_type_code": "photo",
            "description": "Wedding photo"
        }
        response = client.post("/media", json=media_data_2)
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
        response = client.get(f"/media?individual_id={ind_id}")
        assert response.status_code == 200
        media_list = response.json()
        assert len(media_list) >= 2

        log_test_step("Listing all media records")
        response = client.get("/media")
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

    def test_media_error_handling(self, client, db_utils, log_test_step):
        """Test media API error handling."""

        log_test_step("Testing fetch of non-existent media id=99999")
        response = client.get("/media/99999")
        assert response.status_code == 404
        assert "Media not found" in response.json()["detail"]

        log_test_step("Testing update of non-existent media id=99999")
        response = client.put("/media/99999", json={"description": "Will fail"})
        assert response.status_code == 404
        assert "Media not found" in response.json()["detail"]

        log_test_step("Testing delete of non-existent media id=99999")
        response = client.delete("/media/99999")
        assert response.status_code == 404
        assert "Media not found" in response.json()["detail"]

        log_test_step("Media error handling tests completed!")

    def test_media_with_family(self, client, db_utils, log_test_step):
        """Test media associated with families."""

        log_test_step("Creating two individuals for family media test")
        ind1_data = {
            "sex_code": "M",
            "birth_date": "1975-03-10",
            "names": [{"given_name": "John", "family_name": "Doe"}]
        }
        response = client.post("/individuals", json=ind1_data)
        assert response.status_code == 200
        ind1_id = response.json()["id"]

        ind2_data = {
            "sex_code": "F",
            "birth_date": "1978-11-25",
            "names": [{"given_name": "Jane", "family_name": "Doe"}]
        }
        response = client.post("/individuals", json=ind2_data)
        assert response.status_code == 200
        ind2_id = response.json()["id"]

        log_test_step("Creating family")
        family_data = {
            "marriage_date": "2000-08-15",
            "members": [
                {"individual_id": ind1_id, "role": "husband"},
                {"individual_id": ind2_id, "role": "wife"}
            ]
        }
        response = client.post("/families", json=family_data)
        assert response.status_code == 200
        family_id = response.json()["id"]
        log_test_step(f"Family created with id={family_id}")

        log_test_step("Creating media for family (wedding photo)")
        media_data = {
            "family_id": family_id,
            "file_path": "/media/photos/wedding_ceremony.jpg",
            "media_type_code": "photo",
            "media_date": "2000-08-15",
            "description": "Wedding ceremony photo"
        }
        response = client.post("/media", json=media_data)
        assert response.status_code == 200
        media = response.json()
        assert media["family_id"] == family_id
        assert media["individual_id"] is None
        media_id = media["id"]
        log_test_step(f"Family media created with id={media_id}")

        log_test_step(f"Fetching media for family id={family_id}")
        response = client.get(f"/media?family_id={family_id}")
        assert response.status_code == 200
        media_list = response.json()
        assert len(media_list) >= 1
        assert any(m["id"] == media_id for m in media_list)

        log_test_step("Family media test completed!")

    def test_media_all_types(self, client, db_utils, log_test_step):
        """Test creating media with all supported media types."""

        log_test_step("Creating individual for media type testing")
        ind_data = {
            "sex_code": "M",
            "birth_date": "1950-01-01",
            "names": [{"given_name": "Media", "family_name": "Tester"}]
        }
        response = client.post("/individuals", json=ind_data)
        assert response.status_code == 200
        ind_id = response.json()["id"]

        # Test all media types from schema.sql
        media_types = [
            ("photo", "/media/photos/test.jpg", "Test photograph"),
            ("audio", "/media/audio/interview.mp3", "Audio interview"),
            ("video", "/media/video/home_movie.mp4", "Home video recording"),
        ]

        created_media = []
        for media_type, file_path, description in media_types:
            log_test_step(f"Creating {media_type} media")
            media_data = {
                "individual_id": ind_id,
                "file_path": file_path,
                "media_type_code": media_type,
                "description": description
            }
            response = client.post("/media", json=media_data)
            assert response.status_code == 200, f"Failed to create {media_type} media"
            created_media.append(response.json())

        log_test_step(f"Created {len(created_media)} media with different types")
        assert len(created_media) == len(media_types)

        log_test_step("Verifying all media for individual")
        response = client.get(f"/media?individual_id={ind_id}")
        assert response.status_code == 200
        media_list = response.json()
        assert len(media_list) >= len(media_types)

        log_test_step("All media types test completed!")

    def test_media_database_persistence(self, client, db_utils, log_test_step):
        """Test that media records are properly persisted in database."""

        log_test_step("Creating individual for persistence test")
        ind_data = {
            "sex_code": "F",
            "birth_date": "1920-05-05",
            "names": [{"given_name": "Historic", "family_name": "Person"}]
        }
        response = client.post("/individuals", json=ind_data)
        assert response.status_code == 200
        ind_id = response.json()["id"]

        log_test_step("Creating media with all fields populated")
        media_data = {
            "individual_id": ind_id,
            "file_path": "/archive/photos/old_portrait.jpg",
            "media_type_code": "photo",
            "media_date": "1940-06-15",
            "description": "Vintage portrait from 1940"
        }
        response = client.post("/media", json=media_data)
        assert response.status_code == 200
        media_id = response.json()["id"]

        log_test_step("Verifying media persistence via database query")
        media_records = db_utils.execute_query(
            "SELECT * FROM main_media WHERE id = ?",
            (media_id,)
        )
        assert len(media_records) == 1
        media_row = media_records[0]
        assert media_row["individual_id"] == ind_id
        assert media_row["file_path"] == "/archive/photos/old_portrait.jpg"
        assert media_row["media_type_code"] == "photo"
        assert media_row["description"] == "Vintage portrait from 1940"

        log_test_step("Testing update persistence")
        response = client.put(f"/media/{media_id}", json={
            "file_path": "/archive/photos/restored_portrait.jpg",
            "description": "Restored vintage portrait"
        })
        assert response.status_code == 200

        media_records = db_utils.execute_query(
            "SELECT * FROM main_media WHERE id = ?",
            (media_id,)
        )
        assert media_records[0]["file_path"] == "/archive/photos/restored_portrait.jpg"
        assert media_records[0]["description"] == "Restored vintage portrait"

        log_test_step("Testing delete persistence")
        response = client.delete(f"/media/{media_id}")
        assert response.status_code == 200

        media_records = db_utils.execute_query(
            "SELECT * FROM main_media WHERE id = ?",
            (media_id,)
        )
        assert len(media_records) == 0

        log_test_step("Media persistence tests completed!")

    def test_media_pagination(self, client, db_utils, log_test_step):
        """Test media pagination with skip and limit."""

        log_test_step("Creating individual for pagination test")
        ind_data = {
            "sex_code": "F",
            "names": [{"given_name": "Photo", "family_name": "Album"}]
        }
        response = client.post("/individuals", json=ind_data)
        assert response.status_code == 200
        ind_id = response.json()["id"]

        log_test_step("Creating 5 media records for pagination test")
        for i in range(5):
            media_data = {
                "individual_id": ind_id,
                "file_path": f"/media/photos/photo_{i+1}.jpg",
                "media_type_code": "photo",
                "description": f"Photo number {i+1}"
            }
            response = client.post("/media", json=media_data)
            assert response.status_code == 200

        log_test_step("Testing skip=0, limit=2")
        response = client.get("/media?skip=0&limit=2")
        assert response.status_code == 200
        media_list = response.json()
        assert len(media_list) == 2

        log_test_step("Testing skip=2, limit=2")
        response = client.get("/media?skip=2&limit=2")
        assert response.status_code == 200
        media_list = response.json()
        assert len(media_list) == 2

        log_test_step("Pagination tests completed!")

    def test_media_update_all_fields(self, client, db_utils, log_test_step):
        """Test updating all fields of a media record."""

        log_test_step("Creating individual for update test")
        ind_data = {
            "sex_code": "M",
            "names": [{"given_name": "Update", "family_name": "Test"}]
        }
        response = client.post("/individuals", json=ind_data)
        assert response.status_code == 200
        ind_id = response.json()["id"]

        log_test_step("Creating initial media record")
        media_data = {
            "individual_id": ind_id,
            "file_path": "/old/path/photo.jpg",
            "media_type_code": "photo",
            "media_date": "2000-01-01",
            "description": "Original description"
        }
        response = client.post("/media", json=media_data)
        assert response.status_code == 200
        media_id = response.json()["id"]

        log_test_step("Updating all fields")
        update_data = {
            "file_path": "/new/path/updated_photo.jpg",
            "media_type_code": "video",
            "media_date": "2020-12-25",
            "description": "Updated description"
        }
        response = client.put(f"/media/{media_id}", json=update_data)
        assert response.status_code == 200
        updated = response.json()

        assert updated["file_path"] == "/new/path/updated_photo.jpg"
        assert updated["media_type_code"] == "video"
        assert updated["description"] == "Updated description"

        log_test_step("Update all fields test completed!")


class TestHeaderCRUD:
    """Test suite for Header/Submitter CRUD operations.

    Note: Header is a singleton record (one per database).
    Only GET and PUT operations are supported, no CREATE/DELETE.
    """

    def test_header_get_creates_default(self, client, db_utils, log_test_step):
        """Test that GET /header/ creates a default header if none exists."""

        log_test_step("Fetching header (should create default if not exists)")
        response = client.get("/header")
        assert response.status_code == 200
        header = response.json()

        log_test_step("Verifying default header fields")
        assert header["id"] == 1
        assert header["gedcom_version"] == "5.5.1"
        assert header["gedcom_form"] == "LINEAGE-LINKED"
        assert header["charset"] == "UTF-8"
        assert "submitter_id" in header
        assert "submitter_name" in header

        log_test_step("Verifying header persisted in database")
        headers = db_utils.execute_query("SELECT * FROM meta_header WHERE id = 1")
        assert len(headers) == 1
        assert headers[0]["gedcom_version"] == "5.5.1"

        log_test_step("Header GET default test completed!")

    def test_header_update(self, client, db_utils, log_test_step):
        """Test updating header fields."""

        log_test_step("Ensuring header exists")
        response = client.get("/header")
        assert response.status_code == 200

        log_test_step("Updating header with source system info")
        update_data = {
            "source_system_id": "MyGenealogySoftware",
            "source_system_name": "My Family Tree App",
            "source_version": "2.0.0",
            "language": "English",
            "copyright": "Copyright 2025 Test User"
        }
        response = client.put("/header", json=update_data)
        assert response.status_code == 200
        updated = response.json()

        assert updated["source_system_id"] == "MyGenealogySoftware"
        assert updated["source_system_name"] == "My Family Tree App"
        assert updated["source_version"] == "2.0.0"
        assert updated["language"] == "English"
        assert updated["copyright"] == "Copyright 2025 Test User"

        log_test_step("Verifying update persisted in database")
        headers = db_utils.execute_query("SELECT * FROM meta_header WHERE id = 1")
        assert headers[0]["source_system_id"] == "MyGenealogySoftware"
        assert headers[0]["language"] == "English"

        log_test_step("Header update test completed!")

    def test_header_submitter_update(self, client, db_utils, log_test_step):
        """Test updating submitter information via dedicated endpoint."""

        log_test_step("Ensuring header exists")
        response = client.get("/header")
        assert response.status_code == 200

        log_test_step("Updating submitter contact details")
        submitter_data = {
            "submitter_name": "John Doe",
            "submitter_address": "123 Main Street",
            "submitter_city": "Boston",
            "submitter_state": "MA",
            "submitter_postal": "02101",
            "submitter_country": "USA",
            "submitter_phone": "+1-555-123-4567",
            "submitter_email": "john.doe@example.com",
            "submitter_www": "https://example.com"
        }
        response = client.put("/header/submitter", json=submitter_data)
        assert response.status_code == 200
        updated = response.json()

        assert updated["submitter_name"] == "John Doe"
        assert updated["submitter_address"] == "123 Main Street"
        assert updated["submitter_city"] == "Boston"
        assert updated["submitter_state"] == "MA"
        assert updated["submitter_postal"] == "02101"
        assert updated["submitter_country"] == "USA"
        assert updated["submitter_phone"] == "+1-555-123-4567"
        assert updated["submitter_email"] == "john.doe@example.com"
        assert updated["submitter_www"] == "https://example.com"

        log_test_step("Verifying submitter update persisted in database")
        headers = db_utils.execute_query("SELECT * FROM meta_header WHERE id = 1")
        assert headers[0]["submitter_name"] == "John Doe"
        assert headers[0]["submitter_email"] == "john.doe@example.com"

        log_test_step("Submitter update test completed!")

    def test_header_submitter_get(self, client, db_utils, log_test_step):
        """Test getting submitter information only."""

        log_test_step("Ensuring header with submitter exists")
        submitter_data = {
            "submitter_name": "Jane Smith",
            "submitter_email": "jane@example.com"
        }
        response = client.put("/header/submitter", json=submitter_data)
        assert response.status_code == 200

        log_test_step("Fetching submitter info via dedicated endpoint")
        response = client.get("/header/submitter")
        assert response.status_code == 200
        submitter = response.json()

        assert submitter["submitter_name"] == "Jane Smith"
        assert submitter["submitter_email"] == "jane@example.com"
        assert "submitter_id" in submitter
        assert "submitter_address" in submitter
        assert "submitter_city" in submitter
        assert "submitter_phone" in submitter

        # Verify only submitter fields are returned (not full header)
        assert "gedcom_version" not in submitter
        assert "source_system_id" not in submitter

        log_test_step("Submitter GET test completed!")

    def test_header_protected_fields(self, client, db_utils, log_test_step):
        """Test that protected fields cannot be updated via API."""

        log_test_step("Ensuring header exists")
        response = client.get("/header")
        assert response.status_code == 200
        original = response.json()
        original_id = original["id"]

        log_test_step("Attempting to update protected fields")
        update_data = {
            "id": 999,  # Should be ignored
            "file_name": "hacked.ged",  # Should be ignored
            "creation_date": "01 JAN 2000",  # Should be ignored
            "submitter_name": "Valid Update"  # Should be accepted
        }
        response = client.put("/header", json=update_data)
        assert response.status_code == 200
        updated = response.json()

        log_test_step("Verifying protected fields unchanged")
        assert updated["id"] == original_id  # ID unchanged
        assert updated["submitter_name"] == "Valid Update"  # This should update

        log_test_step("Protected fields test completed!")

    def test_header_partial_update(self, client, db_utils, log_test_step):
        """Test partial updates preserve other fields."""

        log_test_step("Setting up initial header values")
        initial_data = {
            "submitter_name": "Initial Name",
            "submitter_email": "initial@example.com",
            "language": "English"
        }
        response = client.put("/header", json=initial_data)
        assert response.status_code == 200

        log_test_step("Performing partial update (only language)")
        partial_update = {"language": "Russian"}
        response = client.put("/header", json=partial_update)
        assert response.status_code == 200
        updated = response.json()

        log_test_step("Verifying partial update preserved other fields")
        assert updated["language"] == "Russian"
        assert updated["submitter_name"] == "Initial Name"
        assert updated["submitter_email"] == "initial@example.com"

        log_test_step("Partial update test completed!")

    def test_header_last_modified_timestamp(self, client, db_utils, log_test_step):
        """Test that last_modified is updated on changes."""

        log_test_step("Ensuring header exists")
        response = client.get("/header")
        assert response.status_code == 200

        log_test_step("Updating header and checking last_modified")
        response = client.put("/header", json={"note": "Test update"})
        assert response.status_code == 200
        updated = response.json()

        assert updated["last_modified"] is not None
        log_test_step(f"last_modified set to: {updated['last_modified']}")

        log_test_step("Verifying timestamp in database")
        headers = db_utils.execute_query("SELECT last_modified FROM meta_header WHERE id = 1")
        assert headers[0]["last_modified"] is not None

        log_test_step("Last modified timestamp test completed!")
