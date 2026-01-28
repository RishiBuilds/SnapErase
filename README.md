# SnapErase 📸

[![Release](https://img.shields.io/github/v/release/RishiBuilds/SnapErase)](https://github.com/RishiBuilds/SnapErase/releases)
[![Python](https://img.shields.io/badge/Python-3.10%2B-blue?logo=python&logoColor=white)](https://www.python.org/)
[![Flask](https://img.shields.io/badge/Flask-2.3.3-lightgrey?logo=flask&logoColor=white)](https://flask.palletsprojects.com/)
[![Docker](https://img.shields.io/badge/Docker-Optimized-blue?logo=docker&logoColor=white)](https://www.docker.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

**SnapErase** (v1.2.0) is a professional-grade, AI-powered background removal tool. It combines the power of deep learning with a streamlined, secure web interface to provide instant, high-quality image processing.

[Features](#features) • [Tech Stack](#tech-stack) • [Installation](#installation) • [API Documentation](#api-documentation) • [Security](#security)

---

## Features

- **Precision Background Removal**: Leverages the `u2net` model (via `rembg`) for complex edge detection.
- **Interactive UI**:
  - **Before/After Demo**: Real-time comparison slider to see the AI magic in action.
  - **Adaptive Navbar**: Smooth glassmorphism transition on scroll for a premium feel.
- **Modern Design**: Sleek, AI-native interface featuring **Outfit** typography and glassmorphism panels.
- **Enterprise-Grade Security**: Hardened with CSRF protection, rate limiting, and strict CSP headers.
- **High Performance**: 
  - **In-Memory Buffer**: Processing happens in RAM to minimize disk I/O.
  - **Smart Caching**: Hash-based deduplication to serve repeat images instantly.
- **Cloud Native**: Optimized multistage Docker build with automated healthchecks and non-root security.

## Tech Stack

- **Backend**: Python 3.10+, Flask
- **AI Core**: `rembg` (U2-Net), PIL (Pillow)
- **Frontend**: Modern Vanilla CSS (Flexbox/Grid), Vanilla JavaScript (ES6+), **Lucide Icons**
- **Security**: Flask-WTF (CSRF), Flask-Limiter (Rate Limiting)
- **Infrastructure**: Gunicorn, Docker (Multistage), Healthcheck APIs

## Installation

### Local Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/RishiBuilds/SnapErase.git
   cd SnapErase
   ```

2. **Environment Configuration**:
   ```bash
   python -m venv venv
   source venv/bin/activate  # Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```

3. **Configure Environment Variables**:
   Create a `.env` file from the provided template:
   ```env
   SECRET_KEY=your_secure_random_key
   FLASK_DEBUG=False
   MAX_CONTENT_LENGTH=16777216
   ```

4. **Launch Application**:
   ```bash
   python app.py
   ```
   Access the dashboard at `http://localhost:5000`.

### Docker Deployment

SnapErase uses a multistage build for a lean production image:

```bash
docker build -t snaperase:latest .
docker run -d -p 5000:5000 --name snaperase_app snaperase:latest
```

The container includes a built-in healthcheck that monitors the service status every 30 seconds.

## API Documentation

### Background Removal Endpoint
`POST /remove-bg`

| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `image` | File | Yes | The image file (PNG, JPG, JPEG, WEBP) |
| `format` | String | No | `image` (direct download) or `json` (Base64) |

**Sample JSON Response:**
```json
{
  "success": true,
  "image": "data:image/png;base64,iVBORw0KGgoAAAANSUh..."
}
```

## Security Monitoring

SnapErase implements several layers of protection:
- **Rate Limiting**: Prevents API abuse (default: 200/day, 50/hour).
- **MIME Validation**: Strict checking of magic bytes to prevent polyglot file attacks.
- **Non-Root Execution**: Docker container runs as a non-privileged `appuser`.
- **Header Hardening**: CSP, X-Content-Type-Options, X-Frame-Options, and X-XSS-Protection.

---

<div align="center">
  <p>Developed with passion by <a href="https://github.com/RishiBuilds">Rishi Builds</a></p>
  <p>Released under the <a href="LICENSE">MIT License</a></p>
</div>

