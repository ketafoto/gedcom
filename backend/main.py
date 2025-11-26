# run "uvicorn backend.main:app --host 0.0.0.0 --port 8000" from the root folder to start the webserver
# run "uvicorn backend.main:app --reload" if there is running server
#
# Open http://localhost:8000 for "Hello World!"
# Open http://localhost:8000/docs for interactive Swagger UI documentation
#
# Multi-user support:
# - By default, uses the "inovoseltsev" user
# - Set environment variable GEDCOM_USER to change the active user
# - Future: frontend will provide username via login
#
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from sqlalchemy import text

from database import db
from database.user_info import UserInfo
from backend.api import individuals, families, events, media, header


def get_active_username() -> str:
    """Get the currently active username from environment or default."""
    default_user = UserInfo()
    return os.environ.get("GEDCOM_USER", default_user.username)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    # Check if database was already initialized (e.g., by test fixtures)
    existing_user = db.get_current_user()
    if existing_user:
        # Already initialized - just verify it's working
        try:
            engine = db.init_db_once()  # Returns existing engine
            with engine.connect() as connection:
                connection.execute(text("SELECT 1 FROM main_individuals LIMIT 1"))
        except Exception as e:
            print(f"❌ Database verification failed: {e}")
            raise
        yield
        return

    # Normal startup - initialize database
    username = get_active_username()
    user_info = UserInfo(username=username)

    try:
        print(f"🔧 Initializing database for user: {username}")
        print(f"   Database path: {user_info.db_file}")

        engine = db.init_db_once(user_info)
        with engine.connect() as connection:
            connection.execute(text("SELECT 1 FROM main_individuals LIMIT 1"))

        print(f"✅ Database ready for user: {username}")
    except Exception as e:
        print(f"❌ Database not initialized or unavailable for user {username}:", e)
        raise RuntimeError(f"Database is not initialized properly for user {username}. Run database initialization.")
    yield

    # Cleanup on shutdown
    db.reset_engine()


app = FastAPI(
    title="Genealogy Database API",
    description="REST API for managing genealogical data in GEDCOM 5.5.1 format",
    version="1.0.0",
    lifespan=lifespan
)
app.include_router(individuals.router)
app.include_router(families.router)
app.include_router(events.router)
app.include_router(media.router)
app.include_router(header.router)


@app.get("/")
def read_root():
    """Root endpoint with API info."""
    user = db.get_current_user()
    username = user.username if user else None
    return {
        "message": "Genealogy Database API - See /docs for interactive documentation",
        "current_user": username,
        "version": "1.0.0"
    }


@app.get("/user")
def get_user_endpoint():
    """Get information about the currently active user."""
    user_info = db.get_current_user()
    if not user_info:
        return {"error": "No user initialized"}

    return {
        "username": user_info.username,
        "db_file": str(user_info.db_file),
        "gedcom_file": str(user_info.gedcom_file),
        "media_dir": str(user_info.media_dir),
    }
