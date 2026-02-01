"""
Export API endpoints.

Provides endpoints to export the user's genealogy database to GEDCOM format.
"""
import zipfile
import tempfile
from datetime import datetime
from pathlib import Path
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
import shutil

from database import db
from database.user_info import UserInfo
from database.gedcom_export import export_gedcom
from backend.api.auth import get_current_user

router = APIRouter(prefix="/export", tags=["Export"])


@router.post("/gedcom")
def export_gedcom_endpoint():
    """
    Export the user's database to GEDCOM format with media files.
    
    Returns a ZIP archive containing:
    - <username>_export.ged - GEDCOM 5.5.1 file
    - media/ - All associated media files
    """
    user = get_current_user()
    
    # Get user's database info
    user_info = db.get_current_user()
    if not user_info:
        # Initialize for this user
        user_info = UserInfo(username=user["username"])
        db.init_db_once(user_info)
    
    # Create temporary directory for export
    with tempfile.TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir)
        
        # Generate GEDCOM file
        gedcom_filename = f"{user['username']}_export.ged"
        gedcom_path = temp_path / gedcom_filename
        
        try:
            success = export_gedcom(user_info.db_file, gedcom_path)
            if not success:
                raise HTTPException(status_code=500, detail="Failed to generate GEDCOM")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to generate GEDCOM: {str(e)}")
        
        # Create ZIP archive
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        zip_filename = f"{user['username']}_export_{timestamp}.zip"
        zip_path = temp_path / zip_filename
        
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            # Add GEDCOM file
            zipf.write(gedcom_path, gedcom_filename)
            
            # Add media files if they exist
            if user_info.media_dir.exists():
                for media_file in user_info.media_dir.rglob('*'):
                    if media_file.is_file():
                        arcname = f"media/{media_file.relative_to(user_info.media_dir)}"
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
