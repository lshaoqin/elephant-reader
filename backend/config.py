"""Configuration settings for the Flask application."""
import os

try:
    from dotenv import load_dotenv
except ImportError:  # pragma: no cover - optional dependency in lightweight local environments
    def load_dotenv():
        return False

load_dotenv()

# API Keys and Credentials
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# Models
GEMINI_MODEL = "gemini-2.5-flash-lite"

# TTS Configuration
TTS_LANG_CODE = 'b'
TTS_SAMPLE_RATE = 24000

# Flask Configuration
FLASK_DEBUG = False
FLASK_HOST = '0.0.0.0'
FLASK_PORT = int(os.getenv('PORT', 8080))  # Cloud Run uses PORT env var
CORS_ENABLED = True
