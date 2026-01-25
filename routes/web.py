from flask import Blueprint, render_template, jsonify
from extensions import limiter

web_bp = Blueprint('web', __name__)

@web_bp.route('/')
def index():
    """Serve the main landing page."""
    return render_template('index.html')

@web_bp.route('/health')
@limiter.exempt
def health():
    """Health check endpoint."""
    return jsonify({'status': 'healthy', 'service': 'SnapErase'}), 200
