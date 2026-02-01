# This module defines the API endpoints for managing individuals in the database.
# The "endpoint" refers to the URI path & HTTP Method that HTTP clients provide
# to the backend to manipulate database.
# Each endpoint corresponds to a handler function in backend that processes
# the request and sends back a response.

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List
from .. import schemas
from . import api_utils
import database.models
import database.db


router = APIRouter(prefix="/individuals", tags=["individuals"])

@router.post("", response_model=schemas.Individual)
def create_individual(
    individual: schemas.IndividualCreate,
    db: Session = Depends(database.db.get_db)
):
    """Create a new individual with associated names."""

    # Generate GEDCOM ID if not provided
    gedcom_id = individual.gedcom_id
    if not gedcom_id:
        gedcom_id = f"I{api_utils.generate_gedcom_id(db, database.models.Individual)}"
    else:
        # Check if provided GEDCOM ID already exists
        existing = db.query(database.models.Individual).filter(
            database.models.Individual.gedcom_id == gedcom_id
        ).first()

        if existing:
            raise HTTPException(status_code=400, detail="GEDCOM ID already exists")

    # Create Individual record
    db_individual = database.models.Individual(
        gedcom_id=gedcom_id,
        sex_code=individual.sex_code,
        birth_date=individual.birth_date,
        birth_place=individual.birth_place,
        death_date=individual.death_date,
        death_place=individual.death_place,
        notes=individual.notes,
    )

    # Create related IndividualName records
    for name_in in individual.names:
        db_name = database.models.IndividualName(
            given_name=name_in.given_name,
            family_name=name_in.family_name,
            individual=db_individual,
        )

        db.add(db_name)

    db.add(db_individual)
    db.commit()
    db.refresh(db_individual)

    return db_individual

@router.get("", response_model=List[schemas.Individual])
def read_individuals(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(database.db.get_db)
):
    """Read list of individuals with pagination."""

    individuals = (
        db.query(database.models.Individual)
        .options(joinedload(database.models.Individual.names)) # eager load names
        .offset(skip)
        .limit(limit)
        .all()
    )

    return individuals

@router.get("/{individual_id}", response_model=schemas.Individual)
def read_individual_by_id(
    individual_id: int,
    db: Session = Depends(database.db.get_db)
):
    """Read a single individual by ID."""

    individual = (
        db.query(database.models.Individual)
        .options(joinedload(database.models.Individual.names)) # eager load names
        .filter(database.models.Individual.id == individual_id)
        .first()
    )

    if individual is None:
        raise HTTPException(status_code=404, detail="Individual not found")

    return individual

@router.put("/{individual_id}", response_model=schemas.Individual)
def update_individual(
    individual_id: int,
    individual_update: schemas.IndividualUpdate,
    db: Session = Depends(database.db.get_db)
):
    """Update an individual."""

    individual = db.query(database.models.Individual).filter(
        database.models.Individual.id == individual_id
    ).first()

    if individual is None:
        raise HTTPException(status_code=404, detail="Individual not found")

    update_data = individual_update.model_dump(exclude_unset=True) # Pydantic V2

    # Update Individual fields (excluding 'names' which is handled separately)
    for key, value in update_data.items():
        if key == "names":
            # Handle name updates
            if value is not None:
                # Clear existing names and add new ones
                individual.names.clear()

                for name_in in value:
                    db_name = database.models.IndividualName(
                        given_name=name_in['given_name'],
                        family_name=name_in['family_name'],
                        individual=individual,
                    )

                    db.add(db_name)

        elif hasattr(individual, key):
            setattr(individual, key, value)

    db.commit()
    db.refresh(individual)

    return individual

@router.delete("/{individual_id}")
def delete_individual(
    individual_id: int,
    db: Session = Depends(database.db.get_db)
):
    """Delete an individual (cascade deletes related names)."""

    individual = db.query(database.models.Individual).filter(
        database.models.Individual.id == individual_id
    ).first()

    if individual is None:
        raise HTTPException(status_code=404, detail="Individual not found")

    # Deleting Individual will cascade delete related IndividualName due to relationship cascade
    db.delete(individual)
    db.commit()

    return {"detail": "Individual deleted"}
