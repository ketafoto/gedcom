# API endpoints for managing families in the genealogy database

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List
from .. import schemas
import database.models
import database.db
from .api_utils import generate_gedcom_id

router = APIRouter(prefix="/families", tags=["families"])

@router.post("/", response_model=schemas.Family)
def create_family(
    family: schemas.FamilyCreate,
    db: Session = Depends(database.db.get_db)
):
    """Create a new family."""
    gedcom_id = family.gedcom_id
    if not gedcom_id:
        gedcom_id = f"F{generate_gedcom_id(db, database.models.Family)}"
    else:
        existing = db.query(database.models.Family).filter(
            database.models.Family.gedcom_id == gedcom_id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="GEDCOM ID already exists")

    db_family = database.models.Family(
        gedcom_id=gedcom_id,
        marriage_date=family.marriage_date,
        marriage_place=family.marriage_place,
        divorce_date=family.divorce_date,
        family_type=family.family_type or "marriage",
        notes=family.notes,
    )

    # Add members
    for member_in in family.members:
        db_member = database.models.FamilyMember(
            individual_id=member_in.individual_id,
            role=member_in.role,
            family=db_family,
        )
        db.add(db_member)

    # Add children
    for child_in in family.children:
        db_child = database.models.FamilyChild(
            child_id=child_in.child_id,
            family=db_family,
        )
        db.add(db_child)

    db.add(db_family)
    db.commit()
    db.refresh(db_family)

    return db_family

@router.get("/", response_model=List[schemas.Family])
def read_families(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(database.db.get_db)
):
    """Read list of families with pagination."""
    families = (
        db.query(database.models.Family)
        .options(joinedload(database.models.Family.members),
                 joinedload(database.models.Family.children))
        .offset(skip)
        .limit(limit)
        .all()
    )
    return families

@router.get("/{family_id}", response_model=schemas.Family)
def read_family(
    family_id: int,
    db: Session = Depends(database.db.get_db)
):
    """Read a single family by ID."""
    family = (
        db.query(database.models.Family)
        .options(joinedload(database.models.Family.members),
                 joinedload(database.models.Family.children))
        .filter(database.models.Family.id == family_id)
        .first()
    )
    if family is None:
        raise HTTPException(status_code=404, detail="Family not found")
    return family

@router.put("/{family_id}", response_model=schemas.Family)
def update_family(
    family_id: int,
    family_update: schemas.FamilyUpdate,
    db: Session = Depends(database.db.get_db)
):
    """Update a family."""
    family = db.query(database.models.Family).filter(
        database.models.Family.id == family_id
    ).first()

    if family is None:
        raise HTTPException(status_code=404, detail="Family not found")

    update_data = family_update.model_dump(exclude_unset=True)

    for key, value in update_data.items():
        if key == "members":
            if value is not None:
                family.members.clear()
                for member_in in value:
                    db_member = database.models.FamilyMember(
                        individual_id=member_in.individual_id,
                        role=member_in.role,
                        family=family,
                    )
                    db.add(db_member)
        elif key == "children":
            if value is not None:
                family.children.clear()
                for child_in in value:
                    db_child = database.models.FamilyChild(
                        child_id=child_in['child_id'],
                        family=family,
                    )
                    db.add(db_child)
        elif hasattr(family, key):
            setattr(family, key, value)

    db.commit()
    db.refresh(family)
    return family

@router.delete("/{family_id}")
def delete_family(
    family_id: int,
    db: Session = Depends(database.db.get_db)
):
    """Delete a family."""
    family = db.query(database.models.Family).filter(
        database.models.Family.id == family_id
    ).first()

    if family is None:
        raise HTTPException(status_code=404, detail="Family not found")

    db.delete(family)
    db.commit()

    return {"detail": "Family deleted"}
