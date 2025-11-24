# Pydantic schemas for parsing HTTP bodies that access the database.

from datetime import date
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field

class IndividualNameBase(BaseModel):
    given_name: Optional[str] = None
    family_name: Optional[str] = None

class IndividualNameCreate(IndividualNameBase):
    """Schema for creating individual names (no ID required yet)"""
    pass

class IndividualName(IndividualNameBase):
    """Schema for reading individual names (includes ID from database)"""
    id: int

    model_config = ConfigDict(from_attributes=True)

class IndividualBase(BaseModel):
    gedcom_id: Optional[str] = None
    sex_code: Optional[str] = None
    birth_date: Optional[date] = None
    birth_place: Optional[str] = None
    death_date: Optional[date] = None
    death_place: Optional[str] = None
    notes: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class IndividualCreate(IndividualBase):
    names: List[IndividualNameCreate] = Field(..., description="List of individual's names")

class IndividualUpdate(IndividualBase):
    names: Optional[List[IndividualNameCreate]] = None

class Individual(IndividualBase):
    id: int
    names: List[IndividualName] = []

    model_config = ConfigDict(from_attributes=True)
