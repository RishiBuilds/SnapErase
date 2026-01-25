import os
import io
import logging
import base64
from flask import Flask, request, jsonify, send_file, render_template
from flask_wtf.csrf import CSRFProtect
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from dotenv import load_dotenv
from pythonjsonlogger.json import JsonFormatter
from services.removal import remove_background
from utils.files import validate_image, save_temp_file, cleanup_files, get_image_hash

# Load env variables
load_dotenv()

# Setup structured logging
log_handler = logging.StreamHandler()
formatter = JsonFormatter('%(asctime)s %(levelname)s %(name)s %(message)s')
log_handler.setFormatter(formatter)
logging.basicConfig(level=logging.INFO, handlers=[log_handler])
logger = logging.getLogger(__name__)

app = Flask(__name__, static_folder='static', template_folder='static')

# Configuration
app.config.update(
    SECRET_KEY=os.getenv('SECRET_KEY', 'default-dev-key'),
    MAX_CONTENT_LENGTH=int(os.getenv('MAX_CONTENT_LENGTH', 16 * 1024 * 1024)),
    UPLOAD_FOLDER=os.getenv('UPLOAD_FOLDER', 'uploads'),
    PROCESSED_FOLDER=os.getenv('PROCESSED_FOLDER', 'processed'),
    WTF_CSRF_ENABLED=True
)

# Initialize Security
csrf = CSRFProtect(app)
limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=["200 per day", "50 per hour"],
    storage_uri=os.getenv('RATE_LIMIT_STORAGE_URL', 'memory://')
)

# Ensure folders exist
for folder in [app.config['UPLOAD_FOLDER'], app.config['PROCESSED_FOLDER']]:
    os.makedirs(folder, exist_ok=True)

# Simple in-memory cache (limit to 50 items to prevent memory leak)
image_cache = {}

@app.after_request
def add_security_headers(response):
    """Add security headers to every response."""
    response.headers['Content-Security-Policy'] = (
        "default-src 'self'; "
        "script-src 'self' https://fonts.googleapis.com; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
        "font-src 'self' https://fonts.gstatic.com; "
        "img-src 'self' data: blob:; "
        "connect-src 'self';"
    )
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'SAMEORIGIN'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    return response

@app.route('/')
def index():
    """Serve the main landing page."""
    return render_template('index.html')

@app.route('/health')
@limiter.exempt
def health():
    """Health check endpoint."""
    return jsonify({'status': 'healthy', 'service': 'SnapErase'}), 200

@app.route('/remove-bg', methods=['POST'])
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

    temp_input_path = None
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
    finally:
        # Ensure file pointer is reset or file is closed if saved to disk
        pass

@app.errorhandler(413)
def request_entity_too_large(error):
    return jsonify({'error': 'File is too large. Maximum size is 16MB.'}), 413

@app.errorhandler(429)
def ratelimit_handler(e):
    return jsonify({'error': f"Rate limit exceeded: {e.description}"}), 429

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=os.getenv('FLASK_DEBUG', 'False') == 'True')
