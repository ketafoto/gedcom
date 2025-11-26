# Create SqlAlchemy session object connected to the user's SQLite database.
# We use Python generator to implement it. FastAPI will use this session to access the database file.
#
# Multi-user support:
# - Each user has their own database under users/<username>/data.sqlite
# - Use init_db_once(user_info) to initialize for a specific user
#
from typing import Optional, Union
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from .models import Base
from .user_info import UserInfo

# Current active user info
_current_user_info: Optional[UserInfo] = None

engine        = None
SessionLocal  = None


def init_db_once(user_info: Optional[Union[UserInfo, str]] = None):
    """
    Initialize database engine and sessionmaker for a user.

    Args:
        user_info: UserInfo object, username string, or None for default user.
                   - If UserInfo: uses the provided user configuration
                   - If str: creates UserInfo for that username
                   - If None: uses default user (inovoseltsev)

    Returns:
        SQLAlchemy engine
    """
    global SessionLocal, engine, _current_user_info

    # Convert input to UserInfo
    resolved_user_info: UserInfo
    if user_info is None:
        resolved_user_info = UserInfo()  # Uses default username
    elif isinstance(user_info, str):
        resolved_user_info = UserInfo(username=user_info)
    else:
        resolved_user_info = user_info

    if not engine:
        # Store current user info
        _current_user_info = resolved_user_info

        # Create engine and tables
        engine = create_engine(
            f"sqlite:///{resolved_user_info.db_file}",
            connect_args={"check_same_thread": False}
        )
        Base.metadata.create_all(bind=engine)
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    return engine


def reset_engine():
    """Reset the database engine (useful for tests or switching users)."""
    global engine, SessionLocal, _current_user_info
    if engine:
        engine.dispose()
    engine = None
    SessionLocal = None
    _current_user_info = None


def get_current_user() -> Optional[UserInfo]:
    """Get the currently active user's info."""
    return _current_user_info


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
