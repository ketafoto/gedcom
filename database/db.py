# Create SqlAlchemy session object connected to the gedcom.db SQLite database.
# We use Python generator to implement it. FastAPI will use this session to access the database file.
#
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from .models import Base

DEFAULT_DATABASE_FILE = "gedcom.db"

engine        = None
SessionLocal  = None

def init_db_once(database_file: str = DEFAULT_DATABASE_FILE):
    """Initializes database engine and sessionmaker for the given database file."""
    global SessionLocal, engine
    if not engine:
        engine = create_engine(f"sqlite:///{database_file}", connect_args={"check_same_thread": False})
        Base.metadata.create_all(bind=engine)   # Initialize database file - create tables
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    return engine

def get_db():
    """Dependency for FastAPI to get a database session."""
    if not SessionLocal:
        raise RuntimeError("Database engine is not initialized. Call init_db_once() first.")
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
