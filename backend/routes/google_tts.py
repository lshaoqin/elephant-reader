"""Text-to-speech endpoint with ElevenLabs-first and Google fallback."""
import base64
from flask import request, jsonify, Blueprint
from services.google_tts_service import generate_speech_with_word_level_timestamps
from services.elevenlabs_tts_service import (
    generate_speech_with_word_level_timestamps as generate_elevenlabs_speech,
    ElevenLabsTTSUnavailable,
)
from utils.firebase_auth import require_firebase_auth

google_tts_bp = Blueprint('google_tts', __name__)


@google_tts_bp.route('/tts/google', methods=['POST'])
@require_firebase_auth
def google_text_to_speech():
    """Convert text to speech with ElevenLabs-first and Google fallback.
    
    Expects JSON with:
    {
        "text": "text to convert to speech",
        "language_code": "en-US" (optional),
        "voice_name": "en-US-Chirp3-HD" (optional)
    }
    
    Returns a JSON response with base64 audio and timestamps.
    """
    # Parse request data
    try:
        data = request.get_json()
        if not data or 'text' not in data:
            return jsonify({"error": "No text provided"}), 400
        
        text = data['text']
        language_code = data.get('language_code', 'en-US')
        voice_name = data.get('voice_name', 'en-US-Neural2-H')
        
        if not text or not text.strip():
            return jsonify({"error": "Empty text"}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 400
    
    try:
        provider = 'elevenlabs'
        sample_rate = 24000
        audio_mime_type = 'audio/wav'

        try:
            audio_content, timestamps, sample_rate, audio_mime_type = generate_elevenlabs_speech(text=text)
        except ElevenLabsTTSUnavailable as elevenlabs_error:
            print(f"ElevenLabs unavailable, falling back to Google TTS: {str(elevenlabs_error)}")
            provider = 'google'
            audio_content, timestamps = generate_speech_with_word_level_timestamps(
                text=text,
                language_code=language_code,
                voice_name=voice_name
            )
            audio_mime_type = 'audio/wav'

        audio_base64 = base64.b64encode(audio_content).decode('utf-8')

        return jsonify({
            "status": "complete",
            "audio": audio_base64,
            "audio_mime_type": audio_mime_type,
            "sample_rate": sample_rate,
            "timestamps": timestamps,
            "provider": provider,
        }), 200
    except Exception as e:
        print(f"Error in Google TTS: {str(e)}")
        return jsonify({"error": str(e)}), 500
