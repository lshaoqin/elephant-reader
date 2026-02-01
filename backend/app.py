"""Flask application for document processing and text-to-speech."""
from flask import Flask
from flask_cors import CORS
from flask_socketio import SocketIO
from config import FLASK_HOST, FLASK_PORT, FLASK_DEBUG, CORS_ENABLED
from routes.extract import extract_bp
from routes.extract_batch import extract_batch_bp
from routes.extract_pdf import extract_pdf_bp
from routes.format_text import format_text_bp
from routes.tts import tts_bp
from routes.google_tts import google_tts_bp
from routes.health import health_bp
from routes.define_word import define_word_bp
from routes.speech_recognition import speech_recognition_bp


def create_app():
    """Create and configure Flask application.
    
    Returns:
        Flask application instance and SocketIO instance
    """
    app = Flask(__name__)
    
    # Enable CORS
    if CORS_ENABLED:
        CORS(app, resources={r"/*": {"origins": "*"}})
    
    # Initialize SocketIO
    socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading')
    
    # Register blueprints
    app.register_blueprint(extract_bp)
    app.register_blueprint(extract_batch_bp)
    app.register_blueprint(extract_pdf_bp)
    app.register_blueprint(format_text_bp)
    app.register_blueprint(tts_bp)
    app.register_blueprint(google_tts_bp)
    app.register_blueprint(health_bp)
    app.register_blueprint(define_word_bp)
    app.register_blueprint(speech_recognition_bp)
    
    # Import and register SocketIO events
    from routes.streaming_speech import register_socketio_events
    register_socketio_events(socketio)
    
    return app, socketio


app, socketio = create_app()


if __name__ == '__main__':
    socketio.run(app, debug=FLASK_DEBUG, host=FLASK_HOST, port=FLASK_PORT)
