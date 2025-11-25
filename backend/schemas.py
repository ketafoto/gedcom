# Pydantic schemas for parsing HTTP bodies that access the database.

from datetime import date
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field

# ==================== Individual Names ====================

class IndividualNameBase(BaseModel):
    name_type: Optional[str] = None
    given_name: Optional[str] = None
    family_name: Optional[str] = None
    prefix: Optional[str] = None
    suffix: Optional[str] = None
    name_order: Optional[int] = None

class IndividualNameCreate(IndividualNameBase):
    """Schema for creating individual names"""
    pass

class IndividualName(IndividualNameBase):
    """Schema for reading individual names"""
    id: int

    model_config = ConfigDict(from_attributes=True)

# ==================== Individuals ====================

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

# ==================== Families ====================

class FamilyMemberBase(BaseModel):
    individual_id: int
    role: Optional[str] = None

class FamilyMemberCreate(FamilyMemberBase):
    pass

class FamilyMember(FamilyMemberBase):
    family_id: int

    model_config = ConfigDict(from_attributes=True)

class FamilyChildBase(BaseModel):
    child_id: int

class FamilyChildCreate(FamilyChildBase):
    pass

class FamilyChild(FamilyChildBase):
    family_id: int

    model_config = ConfigDict(from_attributes=True)

class FamilyBase(BaseModel):
    gedcom_id: Optional[str] = None
    marriage_date: Optional[date] = None
    marriage_place: Optional[str] = None
    divorce_date: Optional[date] = None
    family_type: Optional[str] = "marriage"
    notes: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class FamilyCreate(FamilyBase):
    members: List[FamilyMemberCreate] = Field(default_factory=list)
    children: List[FamilyChildCreate] = Field(default_factory=list)

class FamilyUpdate(FamilyBase):
    members: Optional[List[FamilyMemberCreate]] = None
    children: Optional[List[FamilyChildCreate]] = None

class Family(FamilyBase):
    id: int
    members: List[FamilyMember] = []
    children: List[FamilyChild] = []

    model_config = ConfigDict(from_attributes=True)

# ==================== Events ====================

class EventBase(BaseModel):
    individual_id: Optional[int] = None
    family_id: Optional[int] = None
    event_type_code: str
    event_date: Optional[date] = None
    event_place: Optional[str] = None
    description: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class EventCreate(EventBase):
    pass

class EventUpdate(EventBase):
    event_type_code: Optional[str] = None

class Event(EventBase):
    id: int

    model_config = ConfigDict(from_attributes=True)

# ==================== Media ====================

class MediaBase(BaseModel):
    individual_id: Optional[int] = None
    family_id: Optional[int] = None
    file_path: Optional[str] = None
    media_type_code: Optional[str] = None
    media_date: Optional[date] = None
    description: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class MediaCreate(MediaBase):
    pass

class MediaUpdate(MediaBase):
    pass

class Media(MediaBase):
    id: int

    model_config = ConfigDict(from_attributes=True)
