"""Firebase authentication helpers for protected routes."""
import os
from functools import wraps

import firebase_admin
from firebase_admin import auth, credentials
from flask import jsonify, request, g


firebase_admin_app = None


def get_firebase_credentials_path():
    """Resolve Firebase credentials path from environment variables."""
    return os.getenv("FIREBASE_ADMIN_CREDENTIALS") or os.getenv("GOOGLE_APPLICATION_CREDENTIALS")


def log_firebase_credentials_path():
    """Print Firebase credentials path at startup for debugging."""
    credentials_path = get_firebase_credentials_path()
    print(f"[Firebase Auth] credentials_path={credentials_path}")
    return credentials_path


def _initialize_firebase_admin():
    """Initialize Firebase Admin app if needed."""
    global firebase_admin_app

    if firebase_admin_app is not None:
        return firebase_admin_app

    if firebase_admin._apps:
        firebase_admin_app = firebase_admin.get_app()
        return firebase_admin_app

    credentials_path = get_firebase_credentials_path()
    if credentials_path and os.path.exists(credentials_path):
        cred = credentials.Certificate(credentials_path)
        firebase_admin_app = firebase_admin.initialize_app(cred)
        return firebase_admin_app

    project_id = os.getenv("FIREBASE_PROJECT_ID")
    client_email = os.getenv("FIREBASE_CLIENT_EMAIL")
    private_key = os.getenv("FIREBASE_PRIVATE_KEY")

    if project_id and client_email and private_key:
        cred = credentials.Certificate({
            "type": "service_account",
            "project_id": project_id,
            "client_email": client_email,
            "private_key": private_key.replace("\\n", "\n"),
        })
        firebase_admin_app = firebase_admin.initialize_app(cred)
        return firebase_admin_app

    raise RuntimeError("Firebase Admin credentials are not configured")


def require_firebase_auth(route_handler):
    """Decorator to enforce Firebase ID token authentication."""
    @wraps(route_handler)
    def wrapped(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Unauthorized"}), 401

        token = auth_header[7:].strip()
        if not token:
            return jsonify({"error": "Unauthorized"}), 401

        try:
            _initialize_firebase_admin()
            decoded_token = auth.verify_id_token(token)
            g.firebase_user = decoded_token
        except Exception:
            return jsonify({"error": "Invalid or expired token"}), 401

        return route_handler(*args, **kwargs)

    return wrapped
