# API endpoints for managing media in the genealogy database

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from .. import schemas
import database.models
import database.db

router = APIRouter(prefix="/media", tags=["media"])

@router.post("", response_model=schemas.Media)
def create_media(
    media: schemas.MediaCreate,
    db: Session = Depends(database.db.get_db)
):
    """Create a new media record."""
    db_media = database.models.Media(
        individual_id=media.individual_id,
        family_id=media.family_id,
        file_path=media.file_path,
        media_type_code=media.media_type_code,
        media_date=media.media_date,
        description=media.description,
    )
    db.add(db_media)
    db.commit()
    db.refresh(db_media)
    return db_media

@router.get("", response_model=List[schemas.Media])
def read_media(
    skip: int = 0,
    limit: int = 100,
    individual_id: Optional[int] = None,
    family_id: Optional[int] = None,
    db: Session = Depends(database.db.get_db)
):
    """Read list of media with optional filtering."""
    query = db.query(database.models.Media)

    if individual_id:
        query = query.filter(database.models.Media.individual_id == individual_id)
    if family_id:
        query = query.filter(database.models.Media.family_id == family_id)

    media_list = query.offset(skip).limit(limit).all()
    return media_list

@router.get("/{media_id}", response_model=schemas.Media)
def read_media_by_id(
    media_id: int,
    db: Session = Depends(database.db.get_db)
):
    """Read a single media record by ID."""
    media = db.query(database.models.Media).filter(
        database.models.Media.id == media_id
    ).first()

    if media is None:
        raise HTTPException(status_code=404, detail="Media not found")

    return media

@router.put("/{media_id}", response_model=schemas.Media)
def update_media(
    media_id: int,
    media_update: schemas.MediaUpdate,
    db: Session = Depends(database.db.get_db)
):
    """Update a media record."""
    media = db.query(database.models.Media).filter(
        database.models.Media.id == media_id
    ).first()

    if media is None:
        raise HTTPException(status_code=404, detail="Media not found")

    update_data = media_update.model_dump(exclude_unset=True)

    for key, value in update_data.items():
        if hasattr(media, key):
            setattr(media, key, value)

    db.commit()
    db.refresh(media)
    return media

@router.delete("/{media_id}")
def delete_media(
    media_id: int,
    db: Session = Depends(database.db.get_db)
):
    """Delete a media record."""
    media = db.query(database.models.Media).filter(
        database.models.Media.id == media_id
    ).first()

    if media is None:
        raise HTTPException(status_code=404, detail="Media not found")

    db.delete(media)
    db.commit()

    return {"detail": "Media deleted"}
