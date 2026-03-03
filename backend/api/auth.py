"""
Viewer (browser identity) and role helpers.

Terminology:
- viewer: HTTP/browser caller. In future, viewers may get edit rights.
- owner: application-side data owner under datasets/<owner>/.
"""
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from backend.config import settings

router = APIRouter(prefix="/auth", tags=["Authentication"])

# Default local owner id used for local admin viewer identity.
DEFAULT_OWNER_ID = "inovoseltsev"


class ViewerResponse(BaseModel):
    """Viewer response model."""
    id: int
    viewer_id: str
    role: str
    email: Optional[str] = None
    is_active: bool = True
    is_admin: bool = True
    created_at: Optional[str] = None
    last_login_at: Optional[str] = None


def _build_local_admin_viewer() -> dict:
    """Return local admin viewer identity."""
    return {
        "id": 1,
        "viewer_id": DEFAULT_OWNER_ID,
        "role": "admin",
        "email": f"{DEFAULT_OWNER_ID}@localhost",
        "is_active": True,
        "is_admin": True,
        "created_at": datetime.utcnow().isoformat(),
        "last_login_at": datetime.utcnow().isoformat()
    }


def _build_anonymous_viewer() -> dict:
    """Return anonymous read-only viewer identity."""
    return {
        "id": 0,
        "viewer_id": "guest",
        "role": "anonymous",
        "email": None,
        "is_active": True,
        "is_admin": False,
        "created_at": datetime.utcnow().isoformat(),
        "last_login_at": None,
    }


def get_current_viewer() -> dict:
    """Resolve current viewer identity from app mode."""
    if settings.is_public:
        return _build_anonymous_viewer()
    return _build_local_admin_viewer()


def require_admin(x_admin_key: Optional[str] = Header(default=None, alias="X-Admin-Key")) -> dict:
    """Require admin-level viewer role for mutating operations."""
    if settings.is_public:
        raise HTTPException(status_code=403, detail="Read-only public mode")

    if settings.admin_api_key and x_admin_key != settings.admin_api_key:
        raise HTTPException(status_code=401, detail="Invalid admin API key")

    return _build_local_admin_viewer()


@router.get("/me", response_model=ViewerResponse)
def get_me():
    """Get current viewer info."""
    return get_current_viewer()

