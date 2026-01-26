import os
import hashlib
import uuid
import logging
from typing import Tuple, Optional
from werkzeug.utils import secure_filename
from flask import current_app
from werkzeug.datastructures import FileStorage


logger = logging.getLogger(__name__)

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'webp'}
ALLOWED_MIME_TYPES = {'image/png', 'image/jpeg', 'image/webp'}

def allowed_file(filename: str) -> bool:
    """Check if the file has an allowed extension."""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def validate_image(file: FileStorage) -> Tuple[bool, Optional[str]]:
    """
    Validate image file based on MIME type and size.
    """
    if not file:
        return False, "No file provided"
    
    # Check MIME type
    if file.mimetype not in ALLOWED_MIME_TYPES:
        return False, f"Unsupported file type: {file.mimetype}. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"
    
    # Check file size (double checking here)
    file.seek(0, os.SEEK_END)
    size = file.tell()
    file.seek(0)
    
    max_size = current_app.config.get('MAX_CONTENT_LENGTH', 16 * 1024 * 1024)
    if size > max_size:
        return False, f"File too large. Max size: {max_size / (1024 * 1024)}MB"
    
    return True, None

def save_temp_file(file: FileStorage, folder: str) -> str:
    """
    Sanitize filename and save to a temporary folder with a unique ID.
    Return the absolute path.
    """
    original_filename = secure_filename(file.filename) if file.filename else "unnamed"
    unique_id = uuid.uuid4().hex
    filename = f"{unique_id}_{original_filename}"
    filepath = os.path.join(folder, filename)
    file.save(filepath)
    return filepath

def get_image_hash(image_bytes: bytes) -> str:
    """Generate a SHA256 hash for image bytes to use as cache key."""
    return hashlib.sha256(image_bytes).hexdigest()

def cleanup_files(*filepaths: str) -> None:
    """Delete files from the filesystem."""
    for filepath in filepaths:
        try:
            if filepath and os.path.exists(filepath):
                os.remove(filepath)
        except Exception as e:
            logger.warning(f"Failed to delete file {filepath}: {str(e)}")
