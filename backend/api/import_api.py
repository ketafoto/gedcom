"""
Import API endpoints.

Provides endpoints to import GEDCOM files (plain text or ZIP archives)
into the owner's genealogy database.
"""
import zipfile
import tempfile
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
import shutil

from database import db
from database.owner_info import OwnerInfo
from database.gedcom_import import import_gedcom
from backend.api.auth import get_current_viewer, require_admin

router = APIRouter(prefix="/import", tags=["Import"])

MAX_UPLOAD_SIZE = 200 * 1024 * 1024  # 200 MB


def _find_gedcom_in_dir(directory: Path) -> Path | None:
    """Find the first GEDCOM-like text file in a directory (any extension)."""
    for f in sorted(directory.iterdir()):
        if f.is_file() and not f.name.startswith('.') and f.name != '__MACOSX':
            try:
                with open(f, 'r', encoding='utf-8') as fh:
                    first_line = fh.readline().strip()
                    if first_line.startswith('0 HEAD'):
                        return f
            except (UnicodeDecodeError, PermissionError):
                continue
    return None


def _is_zip_file(file_path: Path) -> bool:
    """Check if a file is a ZIP archive by magic bytes."""
    try:
        with open(file_path, 'rb') as f:
            return f.read(4) == b'PK\x03\x04'
    except Exception:
        return False


@router.post("/gedcom")
async def import_gedcom_endpoint(file: UploadFile = File(...), _admin: dict = Depends(require_admin)):
    """
    Import a GEDCOM file into the owner's database.

    Accepts either:
    - A plaintext GEDCOM file (any extension)
    - A ZIP archive containing a GEDCOM file and optionally a media/ folder
    """
    viewer = get_current_viewer()

    owner = db.get_active_owner()
    if not owner:
        owner = OwnerInfo(owner_id=viewer["viewer_id"])
        db.init_db_once(owner)

    content = await file.read()
    if len(content) > MAX_UPLOAD_SIZE:
        raise HTTPException(status_code=413, detail="File too large (max 200 MB)")
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Empty file uploaded")

    with tempfile.TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir)
        uploaded_path = temp_path / (file.filename or "upload")
        uploaded_path.write_bytes(content)

        gedcom_path: Path | None = None
        media_source: Path | None = None

        if _is_zip_file(uploaded_path):
            extract_dir = temp_path / "extracted"
            extract_dir.mkdir()
            try:
                with zipfile.ZipFile(uploaded_path, 'r') as zf:
                    zf.extractall(extract_dir)
            except zipfile.BadZipFile:
                raise HTTPException(status_code=400, detail="Invalid ZIP archive")

            gedcom_path = _find_gedcom_in_dir(extract_dir)

            media_dir = extract_dir / "media"
            if media_dir.is_dir():
                media_source = media_dir
        else:
            try:
                with open(uploaded_path, 'r', encoding='utf-8') as f:
                    first_line = f.readline().strip()
                    if first_line.startswith('0 HEAD'):
                        gedcom_path = uploaded_path
            except UnicodeDecodeError:
                pass

        if gedcom_path is None:
            raise HTTPException(
                status_code=400,
                detail="No valid GEDCOM file found. The file must start with '0 HEAD'."
            )

        if media_source:
            owner.media_dir.mkdir(parents=True, exist_ok=True)
            media_count = 0
            for media_file in media_source.rglob('*'):
                if media_file.is_file() and not media_file.name.startswith('.'):
                    dest = owner.media_dir / media_file.relative_to(media_source)
                    dest.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(media_file, dest)
                    media_count += 1

        try:
            success = import_gedcom(gedcom_path, owner.db_file)
            if not success:
                raise HTTPException(status_code=500, detail="Import failed — check server logs for details")
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Import failed: {str(e)}")

        db.reset_engine()
        db.init_db_once(owner)

        result = {"status": "ok", "message": "GEDCOM imported successfully"}
        if media_source:
            result["media_files_copied"] = media_count
        return result
