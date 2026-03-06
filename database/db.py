# Create SqlAlchemy session object connected to the owner's SQLite database.
# We use Python generator to implement it. FastAPI will use this session to access the database file.
#
# Owner support:
# - Each owner has their own database under datasets/<owner>/data.sqlite
# - Use init_db_once(owner_info) to initialize for a specific owner
#
from typing import Optional, Union
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from .models import Base
from .owner_info import OwnerInfo

# Current active owner info
_active_owner_info: Optional[OwnerInfo] = None

engine        = None
SessionLocal  = None

# Single source of truth for lookup tables.
# To add a new lookup table, add an entry here — init_db_once, engine_from_url,
# and tests will pick it up automatically.
# Format: table_name -> dict of code -> description.
LOOKUP_TABLES: dict[str, dict[str, str]] = {
    "lookup_sexes": {
        "M": "Male", "F": "Female", "NB": "Non-binary", "U": "Unknown",
    },
    "lookup_event_types": {
        "BIRT": "Birth", "DEAT": "Death", "BURI": "Burial", "CREM": "Cremation",
        "BAPM": "Baptism", "BARM": "Bar Mitzvah", "BASM": "Bat Mitzvah",
        "BLES": "Blessing", "CHR": "Christening", "CHRA": "Adult Christening",
        "CONF": "Confirmation", "FCOM": "First Communion",
        "ORDN": "Ordination", "NATU": "Naturalization",
        "EMIG": "Emigration", "IMMI": "Immigration",
        "CENS": "Census", "PROB": "Probate", "WILL": "Will",
        "GRAD": "Graduation", "RETI": "Retirement",
        "OCCU": "Occupation", "EDUC": "Education", "RESI": "Residence",
        "ADOP": "Adoption", "EVEN": "Other Event",
        "MARR": "Marriage", "MARB": "Marriage Banns", "MARC": "Marriage Contract",
        "MARL": "Marriage License", "MARS": "Marriage Settlement",
        "DIV": "Divorce", "DIVF": "Divorce Filed", "ANUL": "Annulment",
        "ENGA": "Engagement",
        "STUD_START": "Study Start", "STUD_END": "Study End",
        "WORK_START": "Work/Job Start", "WORK_END": "Work/Job End",
        "RELOC": "Relocation To",
    },
    "lookup_media_types": {
        "photo": "Photograph", "audio": "Audio", "video": "Video",
    },
    "lookup_family_roles": {
        "husband": "Husband", "wife": "Wife", "partner": "Unmarried Partner",
    },
    "lookup_name_types": {
        "birth": "Birth", "aka": "Also Known As",
        "married": "Married", "maiden": "Maiden",
    },
    "lookup_date_approx_types": {
        "ABT": "About", "CAL": "Calculated", "EST": "Estimated",
        "BEF": "Before", "AFT": "After",
        "BET": "Between X And Y", "FROM": "From X To Y",
    },
}


def init_db_once(owner_info: Optional[Union[OwnerInfo, str]] = None):
    """
    Initialize database engine and sessionmaker for an owner.

    Args:
        owner_info: OwnerInfo object, owner id string, or None for default owner.
                   - If OwnerInfo: uses the provided owner configuration
                   - If str: creates OwnerInfo for that owner id
                   - If None: uses default user (inovoseltsev)

    Returns:
        SQLAlchemy engine
    """
    global SessionLocal, engine, _active_owner_info

    # Convert input to OwnerInfo
    resolved_owner_info: OwnerInfo
    if owner_info is None:
        resolved_owner_info = OwnerInfo()
    elif isinstance(owner_info, str):
        resolved_owner_info = OwnerInfo(owner_id=owner_info)
    else:
        resolved_owner_info = owner_info

    if not engine:
        # Store active owner info
        _active_owner_info = resolved_owner_info

        # Create engine and tables
        engine = create_engine(
            f"sqlite:///{resolved_owner_info.db_file}",
            connect_args={"check_same_thread": False}
        )
        Base.metadata.create_all(bind=engine)
        _seed_lookup_tables(engine)
        _run_migrations(engine)
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    return engine


def _seed_lookup_tables(eng):
    """Create and populate lookup tables from LOOKUP_TABLES (idempotent).

    These tables are not tracked by the ORM so Base.metadata.create_all() won't
    create them.  LOOKUP_TABLES is the single source of truth — add new tables
    there and they'll be created automatically.
    """
    with eng.connect() as conn:
        for table_name, rows in LOOKUP_TABLES.items():
            conn.execute(text(
                f"CREATE TABLE IF NOT EXISTS {table_name} "
                f"(code TEXT PRIMARY KEY, description TEXT NOT NULL)"))
            for code, description in rows.items():
                conn.execute(text(
                    f"INSERT OR IGNORE INTO {table_name} (code, description) "
                    f"VALUES (:code, :desc)"),
                    {"code": code, "desc": description})
        conn.commit()


def _run_migrations(eng):
    """Add new columns to existing tables if they don't exist (idempotent)."""
    with eng.connect() as conn:
        cols = {row[1] for row in conn.execute(text("PRAGMA table_info(main_media)"))}
        if "is_default" not in cols:
            conn.execute(text("ALTER TABLE main_media ADD COLUMN is_default INTEGER DEFAULT 0"))
        if "age_on_photo" not in cols:
            conn.execute(text("ALTER TABLE main_media ADD COLUMN age_on_photo INTEGER"))
        conn.commit()


def reset_engine():
    """Reset the database engine (useful for tests or switching owners)."""
    global engine, SessionLocal, _active_owner_info
    if engine:
        engine.dispose()
    engine = None
    SessionLocal = None
    _active_owner_info = None


def get_active_owner() -> Optional[OwnerInfo]:
    """Get the currently active owner's info."""
    return _active_owner_info


def engine_from_url(url: str, create_tables: bool = True):
    """Create a new engine from a database URL (for import/export scripts).

    Args:
        url: SQLAlchemy database URL
        create_tables: If True, creates all tables defined in models

    Returns:
        SQLAlchemy engine
    """
    new_engine = create_engine(url, connect_args={"check_same_thread": False})
    if create_tables:
        Base.metadata.create_all(bind=new_engine)
        _seed_lookup_tables(new_engine)
    return new_engine


def get_db():
    """Dependency for FastAPI to get a database session."""
    if not SessionLocal:
        raise RuntimeError("Database engine is not initialized. Call init_db_once() first.")
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
