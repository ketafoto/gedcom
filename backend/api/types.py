"""
Lookup types API endpoints.

Provides endpoints to fetch predefined GEDCOM lookup values
for dropdowns in the frontend.
"""
from fastapi import APIRouter
from sqlalchemy import text
from typing import List
from pydantic import BaseModel

from database import db

router = APIRouter(prefix="/types", tags=["Lookup Types"])


class LookupType(BaseModel):
    """A lookup type with code and description."""
    code: str
    description: str


@router.get("/sex", response_model=List[LookupType])
def get_sex_types():
    """Get all sex type codes for dropdowns."""
    engine = db.init_db_once()
    
    with engine.connect() as conn:
        result = conn.execute(
            text("SELECT code, description FROM lookup_sexes ORDER BY code")
        )
        rows = result.fetchall()
    
    return [LookupType(code=row[0], description=row[1]) for row in rows]


@router.get("/events", response_model=List[LookupType])
def get_event_types():
    """Get all event type codes for dropdowns."""
    engine = db.init_db_once()
    
    with engine.connect() as conn:
        result = conn.execute(
            text("SELECT code, description FROM lookup_event_types ORDER BY code")
        )
        rows = result.fetchall()
    
    return [LookupType(code=row[0], description=row[1]) for row in rows]


@router.get("/media", response_model=List[LookupType])
def get_media_types():
    """Get all media type codes for dropdowns."""
    engine = db.init_db_once()
    
    with engine.connect() as conn:
        result = conn.execute(
            text("SELECT code, description FROM lookup_media_types ORDER BY code")
        )
        rows = result.fetchall()
    
    return [LookupType(code=row[0], description=row[1]) for row in rows]


@router.get("/family-roles", response_model=List[LookupType])
def get_family_roles():
    """Get all family member role codes for dropdowns."""
    engine = db.init_db_once()
    
    with engine.connect() as conn:
        result = conn.execute(
            text("SELECT code, description FROM lookup_family_member_roles ORDER BY code")
        )
        rows = result.fetchall()
    
    return [LookupType(code=row[0], description=row[1]) for row in rows]

