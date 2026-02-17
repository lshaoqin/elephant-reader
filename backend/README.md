# Python OCR Backend

This is a Flask-based backend service that handles image text extraction using Google Cloud Vision API.

## Setup

### Prerequisites
- Python 3.8+
- Google Cloud Vision API credentials

### Installation

1. Create and activate a virtual environment:
```bash
python -m venv venv
venv\Scripts\activate  # On Windows
# or
source venv/bin/activate  # On macOS/Linux
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Set up Google Cloud credentials:
   - Download your service account JSON key from Google Cloud Console
   - Set the `GOOGLE_APPLICATION_CREDENTIALS` environment variable:
   ```bash
   set GOOGLE_APPLICATION_CREDENTIALS=path\to\service-account-key.json  # Windows
   # or
   export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json  # macOS/Linux
   ```

4. Copy `.env.example` to `.env` and configure as needed:
```bash
copy .env.example .env
```

5. Configure Firebase Admin for protected endpoints (`/extract`, `/format-text`, `/tts`, etc.):
  - Option A (recommended): set `FIREBASE_ADMIN_CREDENTIALS` to your Firebase service-account JSON path.
  - Option B: set `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY` directly.
  - Keep `GOOGLE_APPLICATION_CREDENTIALS` for Google Vision/TTS credentials.

## Running the Backend

```bash
python app.py
```

The server will start on `http://localhost:5000`

## API Endpoints

### POST /extract
Extracts text from an uploaded image.

**Request:**
- Content-Type: multipart/form-data
- File parameter: `file` (required)

**Response:**
```json
{
  "text": "Extracted text from image"
}
```

**Example:**
```bash
curl -X POST -F "file=@image.jpg" http://localhost:5000/extract
```

### GET /health
Health check endpoint.

**Response:**
```json
{
  "status": "ok"
}
```

## Development

The backend uses Flask with CORS enabled to allow requests from your Next.js frontend running on a different port.

### Connecting from Next.js

Update your Next.js API route to call this backend service instead of handling extraction locally.
