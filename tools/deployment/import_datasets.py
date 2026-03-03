"""Import owner dataset archive on a public host.

Expected target layout:
<target_root>/
  releases/
  current/   (atomically switched)
  backups/   (previous versions)
"""

from __future__ import annotations

import argparse
import shutil
from datetime import datetime, timezone
from pathlib import Path
from zipfile import ZipFile


def _timestamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def _ensure_layout(target_root: Path) -> tuple[Path, Path, Path]:
    releases = target_root / "releases"
    backups = target_root / "backups"
    current = target_root / "current"
    releases.mkdir(parents=True, exist_ok=True)
    backups.mkdir(parents=True, exist_ok=True)
    return releases, backups, current


def _validate_release(release_dir: Path) -> None:
    db_file = release_dir / "data.sqlite"
    if not db_file.exists():
        raise RuntimeError(f"Invalid archive: missing {db_file}")
    media_dir = release_dir / "media"
    media_dir.mkdir(exist_ok=True)


def _rotate_old_backups(backups_dir: Path, keep: int) -> None:
    all_backups = sorted([p for p in backups_dir.iterdir() if p.is_dir()])
    to_delete = all_backups[:-keep] if len(all_backups) > keep else []
    for path in to_delete:
        shutil.rmtree(path, ignore_errors=True)


def import_datasets(archive_path: Path, target_root: Path, keep_backups: int) -> Path:
    if not archive_path.exists():
        raise FileNotFoundError(f"Archive not found: {archive_path}")

    releases_dir, backups_dir, current_dir = _ensure_layout(target_root)
    release_name = f"release-{_timestamp()}"
    release_dir = releases_dir / release_name
    release_dir.mkdir(parents=True, exist_ok=False)

    with ZipFile(archive_path, "r") as archive:
        archive.extractall(release_dir)

    _validate_release(release_dir)

    if current_dir.exists():
        backup_dir = backups_dir / f"backup-{_timestamp()}"
        current_dir.replace(backup_dir)

    release_dir.replace(current_dir)
    _rotate_old_backups(backups_dir, keep=max(1, keep_backups))
    return current_dir


def main() -> None:
    parser = argparse.ArgumentParser(description="Import owner dataset archive atomically.")
    parser.add_argument("--archive", type=Path, required=True, help="Path to dataset zip archive.")
    parser.add_argument(
        "--target-root",
        type=Path,
        default=Path("/srv/gedcom-public/data"),
        help="Root directory for current/releases/backups.",
    )
    parser.add_argument(
        "--keep-backups",
        type=int,
        default=5,
        help="Number of backup generations to keep.",
    )
    args = parser.parse_args()

    current_dir = import_datasets(args.archive, args.target_root, args.keep_backups)
    print(f"Archive imported. Active data at: {current_dir}")


if __name__ == "__main__":
    main()
