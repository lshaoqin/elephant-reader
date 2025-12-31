"""Configuration settings for the Flask application."""
import os
from dotenv import load_dotenv

load_dotenv()

# API Keys and Credentials
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# Models
GEMINI_MODEL = "gemini-2.5-flash-lite"

# TTS Configuration
TTS_LANG_CODE = 'b'
TTS_SAMPLE_RATE = 24000

# MFA Configuration
MFA_CONTAINER_NAME = "mfa_aligner"
MFA_WORKDIR = "/mfa_workdir"

# Flask Configuration
FLASK_DEBUG = False
FLASK_HOST = '0.0.0.0'
FLASK_PORT = 5000
CORS_ENABLED = True
