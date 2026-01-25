import os
import logging
from flask import Flask, jsonify
from dotenv import load_dotenv
from pythonjsonlogger.json import JsonFormatter
from extensions import limiter, csrf
from routes.web import web_bp
from routes.api import api_bp

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

# Initialize Security Extensions
csrf.init_app(app)
limiter.init_app(app)

# Register Blueprints
app.register_blueprint(web_bp)
app.register_blueprint(api_bp)

# Ensure folders exist
for folder in [app.config['UPLOAD_FOLDER'], app.config['PROCESSED_FOLDER']]:
    os.makedirs(folder, exist_ok=True)

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

@app.errorhandler(413)
def request_entity_too_large(error):
    return jsonify({'error': 'File is too large. Maximum size is 16MB.'}), 413

@app.errorhandler(429)
def ratelimit_handler(e):
    return jsonify({'error': f"Rate limit exceeded: {e.description}"}), 429

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=os.getenv('FLASK_DEBUG', 'False') == 'True')
