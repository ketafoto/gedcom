# API endpoints for managing events in the genealogy database

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from .. import schemas
import database.models
import database.db

router = APIRouter(prefix="/events", tags=["events"])

@router.post("", response_model=schemas.Event)
def create_event(
    event: schemas.EventCreate,
    db: Session = Depends(database.db.get_db)
):
    """Create a new event."""
    db_event = database.models.Event(
        individual_id=event.individual_id,
        family_id=event.family_id,
        event_type_code=event.event_type_code,
        event_date=event.event_date,
        event_place=event.event_place,
        description=event.description,
    )
    db.add(db_event)
    db.commit()
    db.refresh(db_event)
    return db_event

@router.get("", response_model=List[schemas.Event])
def read_events(
    skip: int = 0,
    limit: int = 100,
    individual_id: Optional[int] = None,
    family_id: Optional[int] = None,
    db: Session = Depends(database.db.get_db)
):
    """Read list of events with optional filtering."""
    query = db.query(database.models.Event)

    if individual_id:
        query = query.filter(database.models.Event.individual_id == individual_id)
    if family_id:
        query = query.filter(database.models.Event.family_id == family_id)

    events = query.offset(skip).limit(limit).all()
    return events

@router.get("/{event_id}", response_model=schemas.Event)
def read_event(
    event_id: int,
    db: Session = Depends(database.db.get_db)
):
    """Read a single event by ID."""
    event = db.query(database.models.Event).filter(
        database.models.Event.id == event_id
    ).first()

    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")

    return event

@router.put("/{event_id}", response_model=schemas.Event)
def update_event(
    event_id: int,
    event_update: schemas.EventUpdate,
    db: Session = Depends(database.db.get_db)
):
    """Update an event."""
    event = db.query(database.models.Event).filter(
        database.models.Event.id == event_id
    ).first()

    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")

    update_data = event_update.model_dump(exclude_unset=True)

    for key, value in update_data.items():
        if hasattr(event, key):
            setattr(event, key, value)

    db.commit()
    db.refresh(event)
    return event

@router.delete("/{event_id}")
def delete_event(
    event_id: int,
    db: Session = Depends(database.db.get_db)
):
    """Delete an event."""
    event = db.query(database.models.Event).filter(
        database.models.Event.id == event_id
    ).first()

    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")

    db.delete(event)
    db.commit()

    return {"detail": "Event deleted"}
