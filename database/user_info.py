# User configuration and path management for multi-user support.
#
# Each user has their own folder under users/<username>/ containing:
# - data.sqlite  : SQLite database with user's genealogy data
# - data.ged     : GEDCOM file (for import/export)
# - media/       : User's media files (photos, documents, etc.)
#
# Usage:
#   from database.user_info import UserInfo
#   user = UserInfo()                 # Default user (inovoseltsev)
#   user = UserInfo("john")           # Specific user
#   print(user.db_file)               # Path to user's database file
#   print(user.gedcom_file)           # Path to user's GEDCOM file
#   print(user.media_dir)             # Path to user's media folder

from pathlib import Path
from dataclasses import dataclass, field
from typing import Optional, Union

# Project root directory (parent of database/ folder)
PROJECT_ROOT = Path(__file__).parent.parent

# Base directory for all user data
USERS_DIR = PROJECT_ROOT / "users"

# Default username (used when UserInfo is created without username)
_DEFAULT_USERNAME = "inovoseltsev"


@dataclass
class UserInfo:
    """
    User-specific paths and information.

    Username defaults to the default user if None.
    All paths have sensible defaults based on the standard directory
    structure: <base_dir>/<username>/

    Args:
        username: Username (default: inovoseltsev)
        base_dir: Base directory for users (default: PROJECT_ROOT/users)
                  Useful for tests to use a separate directory.
        gedcom_file: Override GEDCOM file path (for import from custom location)
        db_file: Override database file path
        create_dirs: If True (default), create user directories on initialization
    """
    username: Optional[str] = None
    base_dir: Optional[Path] = field(default=None)
    gedcom_file: Optional[Union[str, Path]] = field(default=None)
    db_file: Optional[Union[str, Path]] = field(default=None)
    user_dir: Path = field(default=None)  # type: ignore[assignment]
    media_dir: Path = field(default=None)  # type: ignore[assignment]
    create_dirs: bool = field(default=True)

    def __post_init__(self):
        """Set default values for None fields and optionally create directories."""
        # Default username
        if self.username is None:
            self.username = _DEFAULT_USERNAME

        # Default base directory
        if self.base_dir is None:
            self.base_dir = USERS_DIR

        # Default user directory
        if self.user_dir is None:
            self.user_dir = self.base_dir / self.username

        # Default database file
        if self.db_file is None:
            self.db_file = self.user_dir / "data.sqlite"
        elif isinstance(self.db_file, str):
            self.db_file = Path(self.db_file)

        # Default GEDCOM file
        if self.gedcom_file is None:
            self.gedcom_file = self.user_dir / "data.ged"
        elif isinstance(self.gedcom_file, str):
            self.gedcom_file = Path(self.gedcom_file)

        # Default media directory
        if self.media_dir is None:
            self.media_dir = self.user_dir / "media"

        # Create directories if requested
        if self.create_dirs:
            self.user_dir.mkdir(parents=True, exist_ok=True)
            self.media_dir.mkdir(parents=True, exist_ok=True)


def list_users() -> list[str]:
    """
    List all available usernames.

    Returns:
        List of usernames that have data folders.
    """
    if not USERS_DIR.exists():
        return []

    return [
        d.name for d in USERS_DIR.iterdir()
        if d.is_dir() and not d.name.startswith('.')
    ]

