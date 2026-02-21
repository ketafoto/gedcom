# run "uvicorn backend.main:app --host 0.0.0.0 --port 8000" from the root folder to start the webserver
# run "uvicorn backend.main:app --reload" if there is running server
#
# Open http://localhost:8000 for "Hello World!"
# Open http://localhost:8000/docs for interactive Swagger UI documentation
#
# Multi-user support:
# - Authentication is disabled (uses default user)
# - Each user has their own database in users/<username>/data.sqlite
# - To change user, modify DEFAULT_USERNAME in backend/api/auth.py
#
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from database import db
from database.user_info import UserInfo
from backend.api import individuals, families, events, media, header, auth, types, export, tree
from backend.logging import setup_logging

# Initialize backend logging to use syslog
setup_logging()

logger = logging.getLogger("gedcom.backend")


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
            logger.info(f"Database verified for user: {existing_user.username}")
        except Exception as e:
            logger.error(f"Database verification failed: {e}")
            raise
        yield
        return

    # Initialize database for default user
    username = auth.DEFAULT_USERNAME
    user_info = UserInfo(username=username)

    try:
        logger.info(f"Initializing database for user: {username}")
        logger.info(f"Database path: {user_info.db_file}")

        engine = db.init_db_once(user_info)
        with engine.connect() as connection:
            connection.execute(text("SELECT 1 FROM main_individuals LIMIT 1"))

        logger.info(f"Database ready for user: {username}")
    except Exception as e:
        logger.error(f"Database initialization failed: {e}")
        raise
    yield

    # Cleanup on shutdown
    db.reset_engine()


app = FastAPI(
    title="Genealogy Database API",
    description="REST API for managing genealogical data in GEDCOM 5.5.1 format",
    version="1.0.0",
    lifespan=lifespan,
    redirect_slashes=False  # Avoid 307 redirects for trailing slash mismatches
)

# CORS middleware for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router)
app.include_router(types.router)
app.include_router(individuals.router)
app.include_router(families.router)
app.include_router(events.router)
app.include_router(media.router)
app.include_router(header.router)
app.include_router(export.router)
app.include_router(tree.router)


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


@app.get("/health")
def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}
