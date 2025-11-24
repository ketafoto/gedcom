# "models" stands for ORM models that reflect the format of the database tables.
# Models are python objects, where instance of object reflects the row in the table.
# The models are used by SQLAlchemy ORM to read and write data from/to the database.

from sqlalchemy import (
    Column,
    Integer,
    String,
    Date,
    Text,
    ForeignKey,
    LargeBinary,
)

from sqlalchemy.orm import relationship, declarative_base

Base = declarative_base()

class Individual(Base):
    __tablename__ = "main_individuals"

    id = Column(Integer, primary_key=True, index=True)
    gedcom_id = Column(String, unique=True, nullable=False, index=True)
    sex_code = Column(String, nullable=True)
    birth_date = Column(Date, nullable=True)
    birth_place = Column(String, nullable=True)
    death_date = Column(Date, nullable=True)
    death_place = Column(String, nullable=True)
    notes = Column(Text, nullable=True)

    # Relationships
    names = relationship("IndividualName", back_populates="individual", cascade="all, delete-orphan")
    families = relationship("FamilyMember", back_populates="individual", cascade="all, delete-orphan")
    events = relationship("Event", back_populates="individual", cascade="all, delete-orphan")
    media = relationship("Media", back_populates="individual", cascade="all, delete-orphan")

class IndividualName(Base):
    __tablename__ = "main_individual_names"

    id = Column(Integer, primary_key=True, index=True)
    individual_id = Column(Integer, ForeignKey("main_individuals.id"), nullable=False)
    name_type = Column(String, nullable=True)
    given_name = Column(String, nullable=True)
    family_name = Column(String, nullable=True)
    prefix = Column(String, nullable=True)
    suffix = Column(String, nullable=True)
    name_order = Column(Integer, nullable=True)

    # Relationships
    individual = relationship("Individual", back_populates="names")

class Family(Base):
    __tablename__ = "main_families"

    id = Column(Integer, primary_key=True, index=True)
    gedcom_id = Column(String, unique=True, nullable=False, index=True)
    husband_id = Column(Integer, ForeignKey("main_individuals.id"), nullable=True)
    wife_id = Column(Integer, ForeignKey("main_individuals.id"), nullable=True)
    marriage_date = Column(Date, nullable=True)
    marriage_place = Column(String, nullable=True)
    divorce_date = Column(Date, nullable=True)

    husband = relationship("Individual", foreign_keys=[husband_id])
    wife = relationship("Individual", foreign_keys=[wife_id])
    children = relationship("FamilyChild", back_populates="family", cascade="all, delete-orphan")
    members = relationship("FamilyMember", back_populates="family", cascade="all, delete-orphan")
    events = relationship("Event", back_populates="family", cascade="all, delete-orphan")

class FamilyChild(Base):
    __tablename__ = "main_family_children"

    id = Column(Integer, primary_key=True, index=True)
    family_id = Column(Integer, ForeignKey("main_families.id"), nullable=False)
    child_id = Column(Integer, ForeignKey("main_individuals.id"), nullable=False)

    family = relationship("Family", back_populates="children")
    child = relationship("Individual")

class FamilyMember(Base):
    __tablename__ = "main_family_members"

    id = Column(Integer, primary_key=True, index=True)
    family_id = Column(Integer, ForeignKey("main_families.id"), nullable=False)
    individual_id = Column(Integer, ForeignKey("main_individuals.id"), nullable=False)
    role = Column(String, nullable=True)

    family = relationship("Family", back_populates="members")
    individual = relationship("Individual", back_populates="families")

class Event(Base):
    __tablename__ = "main_events"

    id = Column(Integer, primary_key=True, index=True)
    individual_id = Column(Integer, ForeignKey("main_individuals.id"), nullable=True)
    family_id = Column(Integer, ForeignKey("main_families.id"), nullable=True)
    type_code = Column(String, nullable=False) # e.g., BIRT, DEAT, MARR
    date = Column(Date, nullable=True)
    place = Column(String, nullable=True)
    notes = Column(Text, nullable=True)

    individual = relationship("Individual", back_populates="events")
    family = relationship("Family", back_populates="events")

class Media(Base):
    __tablename__ = "main_media"

    id = Column(Integer, primary_key=True, index=True)
    individual_id = Column(Integer, ForeignKey("main_individuals.id"), nullable=True)
    title = Column(String, nullable=False)
    file_path = Column(String, nullable=True)
    media_blob = Column(LargeBinary, nullable=True)
    notes = Column(Text, nullable=True)

    individual = relationship("Individual", back_populates="media")

class Source(Base):
    __tablename__ = "main_sources"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    author = Column(String, nullable=True)
    publication = Column(String, nullable=True)
    notes = Column(Text, nullable=True)
