"""
Export API endpoints.

Provides endpoints to export the owner's genealogy database to GEDCOM format.
"""
import zipfile
import tempfile
from datetime import datetime
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
import shutil

from database import db
from database.owner_info import OwnerInfo
from database.gedcom_export import export_gedcom
from backend.api.auth import get_current_viewer, require_admin

router = APIRouter(prefix="/export", tags=["Export"])


@router.post("/gedcom")
def export_gedcom_endpoint(_admin: dict = Depends(require_admin)):
    """
    Export the owner's database to GEDCOM format with media files.
    
    Returns a ZIP archive containing:
    - <viewer_id>_export.ged - GEDCOM 5.5.1 file
    - media/ - All associated media files
    """
    viewer = get_current_viewer()
    
    # Resolve active owner info
    owner = db.get_active_owner()
    if not owner:
        # Local admin viewer maps to same-named owner by default.
        owner = OwnerInfo(owner_id=viewer["viewer_id"])
        db.init_db_once(owner)
    
    # Create temporary directory for export
    with tempfile.TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir)
        
        # Generate GEDCOM file
        gedcom_filename = f"{viewer['viewer_id']}_export.ged"
        gedcom_path = temp_path / gedcom_filename
        
        try:
            success = export_gedcom(owner.db_file, gedcom_path)
            if not success:
                raise HTTPException(status_code=500, detail="Failed to generate GEDCOM")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to generate GEDCOM: {str(e)}")
        
        # Create ZIP archive
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        zip_filename = f"{viewer['viewer_id']}_export_{timestamp}.zip"
        zip_path = temp_path / zip_filename
        
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            # Add GEDCOM file
            zipf.write(gedcom_path, gedcom_filename)
            
            # Add media files if they exist (skip dotfiles like .gitkeep)
            if owner.media_dir.exists():
                for media_file in owner.media_dir.rglob('*'):
                    if media_file.is_file() and not media_file.name.startswith('.'):
                        arcname = f"media/{media_file.relative_to(owner.media_dir)}"
                        zipf.write(media_file, arcname)
        
        # Copy ZIP to a more permanent temp location (will be cleaned up by system)
        final_zip_path = Path(tempfile.gettempdir()) / zip_filename
        shutil.copy2(zip_path, final_zip_path)
    
    return FileResponse(
        path=str(final_zip_path),
        filename=zip_filename,
        media_type='application/zip',
        background=None  # Delete after sending would require background task
    )


@router.post("/gedcom-raw")
def export_gedcom_raw_endpoint(_admin: dict = Depends(require_admin)):
    """
    Export the user's database to a raw GEDCOM file (no media, no ZIP).
    """
    viewer = get_current_viewer()

    # Resolve active owner info
    owner = db.get_active_owner()
    if not owner:
        owner = OwnerInfo(owner_id=viewer["viewer_id"])
        db.init_db_once(owner)

    # Create temporary directory for export
    with tempfile.TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir)

        # Generate GEDCOM file
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        gedcom_filename = f"{viewer['viewer_id']}_export_{timestamp}.ged"
        gedcom_path = temp_path / gedcom_filename

        try:
            success = export_gedcom(owner.db_file, gedcom_path)
            if not success:
                raise HTTPException(status_code=500, detail="Failed to generate GEDCOM")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to generate GEDCOM: {str(e)}")

        # Copy GEDCOM to a more permanent temp location (will be cleaned up by system)
        final_ged_path = Path(tempfile.gettempdir()) / gedcom_filename
        shutil.copy2(gedcom_path, final_ged_path)

    return FileResponse(
        path=str(final_ged_path),
        filename=gedcom_filename,
        media_type='text/plain',
        background=None  # Delete after sending would require background task
    )
