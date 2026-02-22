# pytest tests/backend/test_photo_upload.py -s -v
#
# Tests for the photo upload feature:
#   - Upload with cropped JPEG, filename construction, collision handling
#   - Set-default clears previous default
#   - Delete removes file on disk
#   - Tree API photo selection heuristic (explicit default → closest-to-35 → first)
#   - Tree API photo list promotion logic

import io
import sqlite3
import pytest
from pathlib import Path


# ── Helpers ──────────────────────────────────────────────────────────────────

def _ensure_lookup_tables(db_file: Path):
    """Create lookup tables needed by the tree API (not covered by ORM create_all)."""
    conn = sqlite3.connect(str(db_file))
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS lookup_event_types (
            code TEXT PRIMARY KEY, description TEXT NOT NULL
        );
        INSERT OR IGNORE INTO lookup_event_types (code, description)
            VALUES ('BIRT','Birth'),('DEAT','Death'),('MARR','Marriage'),
                   ('EVEN','Other Event');
    """)
    conn.close()


def _create_individual(client, given="Test", family="Person", sex="M", birth="1980-01-01"):
    r = client.post("/individuals", json={
        "sex_code": sex,
        "birth_date": birth,
        "names": [{"given_name": given, "family_name": family}],
    })
    assert r.status_code == 200, r.text
    return r.json()


def _upload_photo(client, individual_id, age, is_default=False):
    """Upload a tiny valid JPEG for the given individual."""
    # Minimal valid JPEG (1×1 white pixel)
    jpeg_bytes = (
        b'\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00'
        b'\xff\xdb\x00C\x00\x08\x06\x06\x07\x06\x05\x08\x07\x07\x07\t\t'
        b'\x08\n\x0c\x14\r\x0c\x0b\x0b\x0c\x19\x12\x13\x0f\x14\x1d\x1a'
        b'\x1f\x1e\x1d\x1a\x1c\x1c $.\' ",#\x1c\x1c(7),01444\x1f\'9=82<.342'
        b'\xff\xc0\x00\x0b\x08\x00\x01\x00\x01\x01\x01\x11\x00'
        b'\xff\xc4\x00\x1f\x00\x00\x01\x05\x01\x01\x01\x01\x01\x01\x00'
        b'\x00\x00\x00\x00\x00\x00\x00\x01\x02\x03\x04\x05\x06\x07\x08\t\n\x0b'
        b'\xff\xc4\x00\xb5\x10\x00\x02\x01\x03\x03\x02\x04\x03\x05\x05\x04'
        b'\x04\x00\x00\x01}\x01\x02\x03\x00\x04\x11\x05\x12!1A\x06\x13Qa\x07"q\x142'
        b'\x81\x91\xa1\x08#B\xb1\xc1\x15R\xd1\xf0$3br\x82\t\n\x16\x17\x18\x19\x1a'
        b'%&\'()*456789:CDEFGHIJSTUVWXYZcdefghijstuvwxyz'
        b'\x83\x84\x85\x86\x87\x88\x89\x8a\x92\x93\x94\x95\x96\x97\x98\x99\x9a'
        b'\xa2\xa3\xa4\xa5\xa6\xa7\xa8\xa9\xaa\xb2\xb3\xb4\xb5\xb6\xb7\xb8\xb9\xba'
        b'\xc2\xc3\xc4\xc5\xc6\xc7\xc8\xc9\xca\xd2\xd3\xd4\xd5\xd6\xd7\xd8\xd9\xda'
        b'\xe1\xe2\xe3\xe4\xe5\xe6\xe7\xe8\xe9\xea\xf1\xf2\xf3\xf4\xf5\xf6\xf7\xf8\xf9\xfa'
        b'\xff\xda\x00\x08\x01\x01\x00\x00?\x00T\xdb\xa8\xa1\xc0\xa0\x02\x80\x0f\xff\xd9'
    )
    r = client.post(
        "/media/upload",
        data={
            "individual_id": str(individual_id),
            "age_on_photo": str(age),
            "is_default": str(is_default).lower(),
        },
        files={"file": ("photo.jpg", io.BytesIO(jpeg_bytes), "image/jpeg")},
    )
    assert r.status_code == 200, r.text
    return r.json()


# ── Tests ────────────────────────────────────────────────────────────────────

class TestPhotoUpload:
    """Upload endpoint: filename, collision, type validation, defaults."""

    def test_upload_creates_file_with_gedcom_id_and_age(self, client, test_user, log_test_step):
        log_test_step("Upload stores file as <GEDCOM_ID>_<age>.jpg")
        ind = _create_individual(client)
        media = _upload_photo(client, ind["id"], age=25)

        assert media["media_type_code"] == "photo"
        assert media["age_on_photo"] == 25
        assert media["individual_id"] == ind["id"]
        expected_name = f"{ind['gedcom_id']}_25.jpg"
        assert media["file_path"] == expected_name

        file_on_disk = Path(test_user.media_dir) / expected_name
        assert file_on_disk.exists(), f"Expected file at {file_on_disk}"

    def test_upload_collision_appends_suffix(self, client, test_user, log_test_step):
        log_test_step("Second upload at same age gets _2 suffix")
        ind = _create_individual(client)
        m1 = _upload_photo(client, ind["id"], age=30)
        m2 = _upload_photo(client, ind["id"], age=30)

        assert m1["file_path"] == f"{ind['gedcom_id']}_30.jpg"
        assert m2["file_path"] == f"{ind['gedcom_id']}_30_2.jpg"

        log_test_step("Third upload at same age gets _3 suffix")
        m3 = _upload_photo(client, ind["id"], age=30)
        assert m3["file_path"] == f"{ind['gedcom_id']}_30_3.jpg"

    def test_upload_rejects_unsupported_type(self, client, log_test_step):
        log_test_step("Uploading a text file should be rejected")
        ind = _create_individual(client)
        r = client.post(
            "/media/upload",
            data={"individual_id": str(ind["id"]), "age_on_photo": "20", "is_default": "false"},
            files={"file": ("notes.txt", io.BytesIO(b"hello"), "text/plain")},
        )
        assert r.status_code == 400
        assert "Unsupported file type" in r.json()["detail"]

    def test_upload_rejects_nonexistent_individual(self, client, log_test_step):
        log_test_step("Upload for non-existent individual returns 404")
        jpeg = b'\xff\xd8\xff\xe0' + b'\x00' * 20 + b'\xff\xd9'
        r = client.post(
            "/media/upload",
            data={"individual_id": "99999", "age_on_photo": "20", "is_default": "false"},
            files={"file": ("photo.jpg", io.BytesIO(jpeg), "image/jpeg")},
        )
        assert r.status_code == 404


class TestSetDefault:
    """Set-default endpoint clears previous default."""

    def test_set_default_clears_previous(self, client, db_utils, log_test_step):
        log_test_step("Upload two photos, first as default")
        ind = _create_individual(client)
        m1 = _upload_photo(client, ind["id"], age=20, is_default=True)
        m2 = _upload_photo(client, ind["id"], age=40, is_default=False)

        assert m1["is_default"] is True

        log_test_step("Set second photo as default via PUT")
        r = client.put(f"/media/{m2['id']}/set-default")
        assert r.status_code == 200
        assert r.json()["is_default"] is True

        log_test_step("Verify first photo lost its default status")
        r1 = client.get(f"/media/{m1['id']}")
        assert r1.json()["is_default"] is False

    def test_upload_with_default_clears_previous(self, client, log_test_step):
        log_test_step("First upload as default")
        ind = _create_individual(client)
        m1 = _upload_photo(client, ind["id"], age=20, is_default=True)

        log_test_step("Second upload also as default — should clear first")
        m2 = _upload_photo(client, ind["id"], age=30, is_default=True)

        r1 = client.get(f"/media/{m1['id']}")
        r2 = client.get(f"/media/{m2['id']}")
        assert r1.json()["is_default"] is False
        assert r2.json()["is_default"] is True


class TestDeleteMedia:
    """Delete removes both DB record and physical file."""

    def test_delete_removes_file_on_disk(self, client, test_user, log_test_step):
        log_test_step("Upload then delete — file should be gone")
        ind = _create_individual(client)
        media = _upload_photo(client, ind["id"], age=25)
        file_path = Path(test_user.media_dir) / media["file_path"]
        assert file_path.exists()

        r = client.delete(f"/media/{media['id']}")
        assert r.status_code == 200
        assert not file_path.exists(), "Physical file should be removed"


class TestTreePhotoSelection:
    """Tree API: photo_url selection and photos list for carousel."""

    @pytest.fixture(autouse=True)
    def _setup_lookup_tables(self, test_user):
        _ensure_lookup_tables(test_user.db_file)

    def test_no_photos_returns_none(self, client, log_test_step):
        log_test_step("Individual with no photos -> photo_url=None, photos=[]")
        ind = _create_individual(client)
        r = client.get(f"/individuals/{ind['id']}/tree?ancestor_depth=0&descendant_depth=0")
        assert r.status_code == 200
        node = r.json()["nodes"][0]
        assert node["photo_url"] is None
        assert node["photos"] == []

    def test_single_photo_used_as_default(self, client, log_test_step):
        log_test_step("Single photo (not marked default) -> used as photo_url, promoted in photos list")
        ind = _create_individual(client)
        _upload_photo(client, ind["id"], age=50)

        r = client.get(f"/individuals/{ind['id']}/tree?ancestor_depth=0&descendant_depth=0")
        node = r.json()["nodes"][0]
        assert node["photo_url"] is not None
        assert len(node["photos"]) == 1
        assert node["photos"][0]["is_default"] is True  # promoted

    def test_explicit_default_wins(self, client, log_test_step):
        log_test_step("Photo marked default is chosen even when another is closer to age 35")
        ind = _create_individual(client)
        _upload_photo(client, ind["id"], age=34)  # closer to 35
        m2 = _upload_photo(client, ind["id"], age=70, is_default=True)

        r = client.get(f"/individuals/{ind['id']}/tree?ancestor_depth=0&descendant_depth=0")
        node = r.json()["nodes"][0]
        assert node["photo_url"].endswith(f"/file")
        assert node["photo_url"] == f"/api/media/{m2['id']}/file"

    def test_closest_to_35_when_no_default(self, client, log_test_step):
        log_test_step("No explicit default -> closest to age 35 is chosen")
        ind = _create_individual(client)
        _upload_photo(client, ind["id"], age=10)
        m2 = _upload_photo(client, ind["id"], age=33)  # closest to 35
        _upload_photo(client, ind["id"], age=60)

        r = client.get(f"/individuals/{ind['id']}/tree?ancestor_depth=0&descendant_depth=0")
        node = r.json()["nodes"][0]
        assert node["photo_url"] == f"/api/media/{m2['id']}/file"

        promoted = [p for p in node["photos"] if p["is_default"]]
        assert len(promoted) == 1
        assert promoted[0]["age"] == 33

    def test_no_ages_falls_back_to_first(self, client, log_test_step):
        """When no photos have age_on_photo, the first one is promoted."""
        log_test_step("Create photos via metadata-only endpoint (no age)")
        ind = _create_individual(client)
        # Use the low-level POST /media (not upload) so age_on_photo stays None
        r1 = client.post("/media", json={
            "individual_id": ind["id"],
            "file_path": "fake1.jpg",
            "media_type_code": "photo",
        })
        client.post("/media", json={
            "individual_id": ind["id"],
            "file_path": "fake2.jpg",
            "media_type_code": "photo",
        })

        r = client.get(f"/individuals/{ind['id']}/tree?ancestor_depth=0&descendant_depth=0")
        node = r.json()["nodes"][0]

        # photo_url should point to first photo
        assert node["photo_url"] == f"/api/media/{r1.json()['id']}/file"

        promoted = [p for p in node["photos"] if p["is_default"]]
        assert len(promoted) == 1

    def test_photos_sorted_by_age(self, client, log_test_step):
        log_test_step("Photos in tree response are sorted youngest to oldest")
        ind = _create_individual(client)
        _upload_photo(client, ind["id"], age=60)
        _upload_photo(client, ind["id"], age=10)
        _upload_photo(client, ind["id"], age=35)

        r = client.get(f"/individuals/{ind['id']}/tree?ancestor_depth=0&descendant_depth=0")
        ages = [p["age"] for p in r.json()["nodes"][0]["photos"]]
        assert ages == [10, 35, 60]

    def test_equidistant_ages_picks_one(self, client, log_test_step):
        log_test_step("Age 30 and age 40 are equidistant from 35 — one should be promoted")
        ind = _create_individual(client)
        _upload_photo(client, ind["id"], age=30)
        _upload_photo(client, ind["id"], age=40)

        r = client.get(f"/individuals/{ind['id']}/tree?ancestor_depth=0&descendant_depth=0")
        node = r.json()["nodes"][0]
        promoted = [p for p in node["photos"] if p["is_default"]]
        assert len(promoted) == 1
        assert promoted[0]["age"] in (30, 40)


class TestServeFile:
    """GET /media/{id}/file serves the uploaded content."""

    def test_serve_uploaded_photo(self, client, log_test_step):
        log_test_step("Upload then fetch — should return image/jpeg")
        ind = _create_individual(client)
        media = _upload_photo(client, ind["id"], age=25)

        r = client.get(f"/media/{media['id']}/file")
        assert r.status_code == 200
        assert r.headers["content-type"].startswith("image/jpeg")
        assert len(r.content) > 0

    def test_serve_nonexistent_returns_404(self, client, log_test_step):
        log_test_step("Non-existent media id returns 404")
        r = client.get("/media/99999/file")
        assert r.status_code == 404
