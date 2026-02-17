"""Google Cloud Text-to-Speech endpoint using Chirp3."""
import json
import base64
from flask import request, jsonify, Blueprint, stream_with_context, current_app
from services.google_tts_service import generate_speech_with_word_level_timestamps
from utils.firebase_auth import require_firebase_auth

google_tts_bp = Blueprint('google_tts', __name__)


@google_tts_bp.route('/tts/google', methods=['POST'])
@require_firebase_auth
def google_text_to_speech():
    """Convert text to speech using Google Cloud TTS Chirp3 with word timestamps.
    
    Expects JSON with:
    {
        "text": "text to convert to speech",
        "language_code": "en-US" (optional),
        "voice_name": "en-US-Chirp3-HD" (optional)
    }
    
    Returns a streaming response with progress events and final JSON data.
    """
    # Parse request data
    try:
        data = request.get_json()
        if not data or 'text' not in data:
            return jsonify({"error": "No text provided"}), 400
        
        text = data['text']
        language_code = data.get('language_code', 'en-US')
        voice_name = data.get('voice_name', 'en-US-Neural2-H"')
        
        if not text or not text.strip():
            return jsonify({"error": "Empty text"}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 400
    
    def generate():
        try:
            # Send starting status
            yield f"data: {json.dumps({'status': 'generating', 'progress': 0})}\n\n"
            
            # Generate audio with timestamps using Google TTS
            audio_content, timestamps = generate_speech_with_word_level_timestamps(
                text=text,
                language_code=language_code,
                voice_name=voice_name
            )
            
            yield f"data: {json.dumps({'status': 'generating', 'progress': 50})}\n\n"
            
            # Convert audio to base64
            audio_base64 = base64.b64encode(audio_content).decode('utf-8')
            
            yield f"data: {json.dumps({'status': 'generating', 'progress': 100})}\n\n"
            
            # Send final response
            response_data = {
                "status": "complete",
                "audio": audio_base64,
                "sample_rate": 24000,  # Google TTS Chirp3 uses 24kHz
                "timestamps": timestamps
            }
            
            yield f"data: {json.dumps(response_data)}\n\n"
        
        except (BrokenPipeError, ConnectionResetError) as e:
            print(f"Client disconnected: {str(e)}")
            return
        except Exception as e:
            print(f"Error in Google TTS: {str(e)}")
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
    
    return current_app.response_class(
        stream_with_context(generate()),
        mimetype='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'X-Accel-Buffering': 'no',
            'Connection': 'close'
        }
    )
