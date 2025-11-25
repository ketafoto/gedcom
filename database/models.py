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
    PrimaryKeyConstraint,
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
    marriage_date = Column(Date, nullable=True)
    marriage_place = Column(String, nullable=True)
    divorce_date = Column(Date, nullable=True)
    family_type = Column(String, nullable=False, default="marriage")
    notes = Column(Text, nullable=True)

    # Relationships
    members = relationship("FamilyMember", back_populates="family", cascade="all, delete-orphan")
    children = relationship("FamilyChild", back_populates="family", cascade="all, delete-orphan")
    events = relationship("Event", back_populates="family", cascade="all, delete-orphan")
    media = relationship("Media", back_populates="family", cascade="all, delete-orphan")

class FamilyMember(Base):
    __tablename__ = "main_family_members"

    family_id = Column(Integer, ForeignKey("main_families.id"), primary_key=True, nullable=False)
    individual_id = Column(Integer, ForeignKey("main_individuals.id"), primary_key=True, nullable=False)
    role = Column(String, nullable=True)

    # Relationships
    family = relationship("Family", back_populates="members")
    individual = relationship("Individual", back_populates="families")

class FamilyChild(Base):
    __tablename__ = "main_family_children"

    family_id = Column(Integer, ForeignKey("main_families.id"), primary_key=True, nullable=False)
    child_id = Column(Integer, ForeignKey("main_individuals.id"), primary_key=True, nullable=False)

    # Relationships
    family = relationship("Family", back_populates="children")
    child = relationship("Individual")

class Event(Base):
    __tablename__ = "main_events"

    id = Column(Integer, primary_key=True, index=True)
    individual_id = Column(Integer, ForeignKey("main_individuals.id"), nullable=True)
    family_id = Column(Integer, ForeignKey("main_families.id"), nullable=True)
    event_type_code = Column(String, nullable=False)  # References types_event(code)
    event_date = Column(Date, nullable=True)
    event_place = Column(String, nullable=True)
    description = Column(Text, nullable=True)

    # Relationships
    individual = relationship("Individual", back_populates="events")
    family = relationship("Family", back_populates="events")

class Media(Base):
    __tablename__ = "main_media"

    id = Column(Integer, primary_key=True, index=True)
    individual_id = Column(Integer, ForeignKey("main_individuals.id"), nullable=True)
    family_id = Column(Integer, ForeignKey("main_families.id"), nullable=True)
    file_path = Column(String, nullable=True)
    media_type_code = Column(String, nullable=True)  # References types_media(code)
    media_date = Column(Date, nullable=True)
    description = Column(Text, nullable=True)

    # Relationships
    individual = relationship("Individual", back_populates="media")
    family = relationship("Family", back_populates="media")

class Source(Base):
    __tablename__ = "main_sources"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    author = Column(String, nullable=True)
    publication = Column(String, nullable=True)
    publish_date = Column(Date, nullable=True)
    notes = Column(Text, nullable=True)
