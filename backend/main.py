# run "uvicorn backend.main:app --host 0.0.0.0 --port 8000" from the root folder to start the webserver
# run "uvicorn backend.main:app --reload" if there is running server
#
# Open http://localhost:8000 for "Hello World!"
# Open http://localhost:8000/docs for interactive Swagger UI documentation
#
# Owner support:
# - Each owner has their own database in datasets/<owner>/data.sqlite
# - Local admin mode defaults to DEFAULT_OWNER_ID from backend/api/auth.py
# - Public mode serves read-only data from the active owner
#
import logging
import time
from collections import defaultdict, deque
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from database import db
from database.owner_info import OwnerInfo
from backend.api import individuals, families, events, media, header, auth, types, export, tree
from backend.config import settings
from backend.logging import setup_logging

# Initialize backend logging to use syslog
setup_logging()

logger = logging.getLogger("gedcom.backend")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    # Check if database was already initialized (e.g., by test fixtures)
    active_owner = db.get_active_owner()
    if active_owner:
        # Already initialized - just verify it's working
        try:
            engine = db.init_db_once()  # Returns existing engine
            with engine.connect() as connection:
                connection.execute(text("SELECT 1 FROM main_individuals LIMIT 1"))
            logger.info(f"Database verified for owner: {active_owner.owner_id}")
        except Exception as e:
            logger.error(f"Database verification failed: {e}")
            raise
        yield
        return

    # Initialize database for default user
    owner_id = auth.DEFAULT_OWNER_ID
    owner_info = OwnerInfo(owner_id=owner_id)

    try:
        logger.info(f"Initializing database for owner: {owner_id}")
        logger.info(f"Database path: {owner_info.db_file}")

        engine = db.init_db_once(owner_info)
        with engine.connect() as connection:
            connection.execute(text("SELECT 1 FROM main_individuals LIMIT 1"))

        logger.info(f"Database ready for owner: {owner_id}")
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
    redirect_slashes=False,  # Avoid 307 redirects for trailing slash mismatches
    docs_url="/docs" if settings.enable_api_docs else None,
    redoc_url="/redoc" if settings.enable_api_docs else None,
    openapi_url="/openapi.json" if settings.enable_api_docs else None,
)

# CORS middleware for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

WRITE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}
READ_ONLY_EXEMPT_PATHS = {"/health"}
_request_windows: dict[str, deque[float]] = defaultdict(deque)


def _get_client_ip(request: Request) -> str:
    # Support common reverse proxy header.
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


@app.middleware("http")
async def apply_public_security(request: Request, call_next):
    # Public mode must reject every write operation server-side.
    if (
        settings.is_public
        and request.method in WRITE_METHODS
        and request.url.path not in READ_ONLY_EXEMPT_PATHS
    ):
        return JSONResponse(
            status_code=403,
            content={"detail": "Read-only public mode"},
        )

    # Lightweight in-process rate limiter for public deployments.
    if settings.is_public:
        ip = _get_client_ip(request)
        now = time.time()
        window = _request_windows[ip]
        while window and now - window[0] > 60:
            window.popleft()
        if len(window) >= settings.rate_limit_per_minute:
            return JSONResponse(
                status_code=429,
                content={"detail": "Too many requests"},
            )
        window.append(now)

    response = await call_next(request)

    # Baseline security headers.
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Content-Security-Policy"] = "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self';"
    if settings.is_public:
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"

    return response

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
app.include_router(tree.full_tree_router)


@app.get("/")
def read_root():
    """Root endpoint with API info."""
    owner = db.get_active_owner()
    owner_id = owner.owner_id if owner else None
    return {
        "message": "Genealogy Database API - See /docs for interactive documentation",
        "current_owner": owner_id,
        "version": "1.0.0"
    }


@app.get("/owner")
def get_owner_endpoint():
    """Get information about the currently active owner."""
    owner = db.get_active_owner()
    if not owner:
        return {"error": "No owner initialized"}

    return {
        "owner_id": owner.owner_id,
        "db_file": str(owner.db_file),
        "gedcom_file": str(owner.gedcom_file),
        "media_dir": str(owner.media_dir),
    }


@app.get("/health")
def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}
