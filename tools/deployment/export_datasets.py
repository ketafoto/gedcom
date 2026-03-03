"""Export owner dataset files for public deployment.

The output is a zip archive that contains:
- data.sqlite
- media/ (all files)
- manifest.json
"""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile


def sha256_file(path: Path) -> str:
    hasher = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            hasher.update(chunk)
    return hasher.hexdigest()


def collect_media_files(media_dir: Path) -> list[Path]:
    if not media_dir.exists():
        return []
    return sorted([path for path in media_dir.rglob("*") if path.is_file()])


def export_datasets(repo_root: Path, owner: str, output_dir: Path) -> Path:
    owner_root = repo_root / "datasets" / owner
    db_path = owner_root / "data.sqlite"
    media_dir = owner_root / "media"

    if not db_path.exists():
        raise FileNotFoundError(f"Database file not found: {db_path}")

    output_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    archive_path = output_dir / f"{owner}-datasets-export-{timestamp}.zip"

    media_files = collect_media_files(media_dir)
    manifest = {
        "owner": owner,
        "created_at_utc": timestamp,
        "db_file": "data.sqlite",
        "db_sha256": sha256_file(db_path),
        "media_count": len(media_files),
        "media_files": [
            {
                "relative_path": str(file_path.relative_to(media_dir)).replace("\\", "/"),
                "sha256": sha256_file(file_path),
                "size_bytes": file_path.stat().st_size,
            }
            for file_path in media_files
        ],
    }

    with ZipFile(archive_path, "w", compression=ZIP_DEFLATED) as archive:
        archive.write(db_path, arcname="data.sqlite")
        for file_path in media_files:
            rel_path = file_path.relative_to(media_dir).as_posix()
            archive.write(file_path, arcname=f"media/{rel_path}")
        archive.writestr("manifest.json", json.dumps(manifest, indent=2))

    return archive_path


def main() -> None:
    parser = argparse.ArgumentParser(description="Export owner dataset archive.")
    parser.add_argument(
        "--repo-root",
        type=Path,
        default=Path(__file__).resolve().parents[2],
        help="Repository root directory.",
    )
    parser.add_argument(
        "--owner",
        required=True,
        help="Owner folder under datasets/ that contains data.sqlite and media/.",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path(__file__).resolve().parents[2] / "dist" / "dataset-exports",
        help="Directory where archive will be written.",
    )
    parser.add_argument(
        "--copy-latest-to",
        type=Path,
        default=None,
        help="Optional path to copy the generated archive for upload convenience.",
    )
    args = parser.parse_args()

    archive_path = export_datasets(args.repo_root, args.owner, args.output_dir)
    print(f"Created archive: {archive_path}")

    if args.copy_latest_to:
        args.copy_latest_to.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(archive_path, args.copy_latest_to)
        print(f"Copied archive to: {args.copy_latest_to}")


if __name__ == "__main__":
    main()
