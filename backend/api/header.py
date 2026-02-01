# API endpoints for managing GEDCOM header and submitter info
#
# The header is a singleton record (one per database) that stores:
# - Source system info (software that created the file)
# - Submitter info (person/organization responsible for the data)
# - GEDCOM format metadata
#
# Some fields are auto-populated by the backend during export,
# while others are user-editable via this API.
#
# Example API usage:
#
#   # Get header info
#   curl http://localhost:8000/header/
#
#   # Update submitter contact details
#   curl -X PUT http://localhost:8000/header/submitter \
#     -H "Content-Type: application/json" \
#     -d '{"submitter_name": "John Doe", "submitter_email": "john@example.com"}'

from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from .. import schemas
import database.models
import database.db

router = APIRouter(prefix="/header", tags=["header"])


class SubmitterUpdate(BaseModel):
    """User-editable submitter fields."""
    submitter_name: Optional[str] = None
    submitter_address: Optional[str] = None
    submitter_city: Optional[str] = None
    submitter_state: Optional[str] = None
    submitter_postal: Optional[str] = None
    submitter_country: Optional[str] = None
    submitter_phone: Optional[str] = None
    submitter_email: Optional[str] = None
    submitter_fax: Optional[str] = None
    submitter_www: Optional[str] = None

    # Optional metadata fields
    language: Optional[str] = None
    copyright: Optional[str] = None
    note: Optional[str] = None


def get_or_create_header(db: Session) -> database.models.Header:
    """Get existing header or create default one."""
    header = db.query(database.models.Header).filter(
        database.models.Header.id == 1
    ).first()

    if not header:
        # Create default header with sensible defaults
        header = database.models.Header(
            id=1,
            source_system_id="GEDCOM-Genealogy-App",
            source_system_name="Genealogy Database Application",
            source_version="1.0.0",
            gedcom_version="5.5.1",
            gedcom_form="LINEAGE-LINKED",
            charset="UTF-8",
            submitter_id="U00001",
            submitter_name="Database User",
        )
        db.add(header)
        db.commit()
        db.refresh(header)

    return header


@router.get("", response_model=schemas.Header)
def get_header(db: Session = Depends(database.db.get_db)):
    """Get GEDCOM header and submitter information.

    Returns the current header metadata. If no header exists,
    creates a default one with sensible values.
    """
    return get_or_create_header(db)


@router.put("", response_model=schemas.Header)
def update_header(
    header_update: schemas.HeaderUpdate,
    db: Session = Depends(database.db.get_db)
):
    """Update GEDCOM header and submitter information.

    Updates user-editable fields. System fields like gedcom_version,
    file_name, creation_date are managed automatically during export.
    """
    header = get_or_create_header(db)

    # Get update data, excluding unset fields
    update_data = header_update.model_dump(exclude_unset=True)

    # Fields that should NOT be updated via API (auto-populated during export)
    protected_fields = {
        "id",
        "file_name",
        "creation_date",
        "creation_time",
        "imported_at",
    }

    for key, value in update_data.items():
        if key in protected_fields:
            continue  # Skip protected fields
        if hasattr(header, key):
            setattr(header, key, value)

    # Update last_modified timestamp
    setattr(header, "last_modified", datetime.now().isoformat())

    db.commit()
    db.refresh(header)
    return header


@router.put("/submitter", response_model=schemas.Header)
def update_submitter(
    submitter: SubmitterUpdate,
    db: Session = Depends(database.db.get_db)
):
    """Update submitter information only.

    Convenience endpoint for updating just the submitter (contact) details
    without affecting other header fields.
    """
    header = get_or_create_header(db)

    update_data = submitter.model_dump(exclude_unset=True)

    for key, value in update_data.items():
        if hasattr(header, key):
            setattr(header, key, value)

    # Update last_modified timestamp
    setattr(header, "last_modified", datetime.now().isoformat())

    db.commit()
    db.refresh(header)
    return header


@router.get("/submitter")
def get_submitter(db: Session = Depends(database.db.get_db)):
    """Get submitter information only.

    Returns just the submitter (contact) details for display in UI.
    """
    header = get_or_create_header(db)

    return {
        "submitter_id": header.submitter_id,
        "submitter_name": header.submitter_name,
        "submitter_address": header.submitter_address,
        "submitter_city": header.submitter_city,
        "submitter_state": header.submitter_state,
        "submitter_postal": header.submitter_postal,
        "submitter_country": header.submitter_country,
        "submitter_phone": header.submitter_phone,
        "submitter_email": header.submitter_email,
        "submitter_fax": header.submitter_fax,
        "submitter_www": header.submitter_www,
    }

