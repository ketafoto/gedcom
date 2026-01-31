"""
Authentication stubs - authentication disabled, using default user.

Multi-user structure is preserved (users/<username>/data.sqlite).
To change user, modify DEFAULT_USERNAME below.
"""
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

router = APIRouter(prefix="/auth", tags=["Authentication"])

# Default username - change this to switch users
DEFAULT_USERNAME = "inovoseltsev"


class UserResponse(BaseModel):
    """User info response model."""
    id: int
    username: str
    email: Optional[str] = None
    is_active: bool = True
    is_admin: bool = True
    created_at: Optional[str] = None
    last_login_at: Optional[str] = None


def _get_default_user() -> dict:
    """Return the default user (no authentication required)."""
    return {
        "id": 1,
        "username": DEFAULT_USERNAME,
        "email": f"{DEFAULT_USERNAME}@localhost",
        "is_active": True,
        "is_admin": True,
        "created_at": datetime.utcnow().isoformat(),
        "last_login_at": datetime.utcnow().isoformat()
    }


def get_current_user() -> dict:
    """Get the current user (always returns default user)."""
    return _get_default_user()


@router.get("/me", response_model=UserResponse)
def get_me():
    """Get current user info."""
    return _get_default_user()

