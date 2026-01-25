import logging
import base64
import io
from flask import Blueprint, request, jsonify, send_file
from extensions import limiter
from services.removal import remove_background
from utils.files import validate_image, get_image_hash

logger = logging.getLogger(__name__)

api_bp = Blueprint('api', __name__)

# Simple in-memory cache (limit to 50 items to prevent memory leak)
image_cache = {}

@api_bp.route('/remove-bg', methods=['POST'])
@limiter.limit("10 per minute")
def handle_remove_background():
    """
    Handle background removal request.
    Validates, processes, and returns the result as both a file and Base64.
    """
    if 'image' not in request.files:
        return jsonify({'error': 'No image uploaded'}), 400
    
    file = request.files['image']
    
    # Validation
    is_valid, error_msg = validate_image(file)
    if not is_valid:
        logger.warning(f"Invalid upload attempt: {error_msg}")
        return jsonify({'error': error_msg}), 400

    try:
        # Read image bytes
        image_bytes = file.read()
        
        # Check cache
        img_hash = get_image_hash(image_bytes)
        if img_hash in image_cache:
            logger.info(f"Cache hit for image {img_hash}")
            processed_bytes = image_cache[img_hash]
        else:
            # In-memory processing
            processed_bytes = remove_background(image_bytes)
            # Update cache 
            if len(image_cache) > 50:
                image_cache.pop(next(iter(image_cache)))
            image_cache[img_hash] = processed_bytes
        
        # Prepare response format
        response_type = request.args.get('format', 'image')
        
        if response_type == 'json':
            # Return Base64 for preview
            base64_image = base64.b64encode(processed_bytes).decode('utf-8')
            return jsonify({
                'success': True,
                'image': f"data:image/png;base64,{base64_image}"
            })
        
        # Return direct image download (default)
        return send_file(
            io.BytesIO(processed_bytes),
            mimetype='image/png',
            as_attachment=True,
            download_name='snaperase_result.png'
        )

    except Exception as e:
        logger.error(f"Processing error: {str(e)}")
        return jsonify({'error': 'An internal error occurred during processing'}), 500
