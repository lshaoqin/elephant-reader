"""Word hunt endpoints."""
import base64
from flask import request, jsonify, Blueprint

from services.gemini_service import get_word_hunt_vocabulary_data
from services.google_tts_service import generate_speech_with_word_level_timestamps
from utils.firebase_auth import require_firebase_auth

word_hunt_bp = Blueprint('word_hunt', __name__)


@word_hunt_bp.route('/word-hunt/vocabulary', methods=['POST'])
@require_firebase_auth
def get_vocabulary_word_hunt():
    """Generate a vocabulary word hunt question from text."""
    try:
        data = request.get_json()
        if not data or 'text' not in data:
            return jsonify({"error": "No text provided"}), 400

        text = str(data.get('text', '')).strip()
        if not text:
            return jsonify({"error": "Empty text"}), 400

        word_hunt_data = get_word_hunt_vocabulary_data(text)

        # Generate tappable audio for each correct vocabulary answer.
        word_audio = {}
        for word in word_hunt_data["correct_words"]:
            try:
                audio_content, _ = generate_speech_with_word_level_timestamps(
                    text=word,
                    language_code='en-US',
                    voice_name='en-US-Neural2-H'
                )
                word_audio[word] = {
                    "audio": base64.b64encode(audio_content).decode('utf-8'),
                    "sample_rate": 24000,
                    "audio_mime_type": "audio/wav",
                }
            except Exception as tts_error:
                # Keep the word-hunt playable even if TTS fails for one word.
                print(f"Warning: failed to generate word audio for '{word}': {str(tts_error)}")

        return jsonify({
            "mode": "vocabulary",
            "question": word_hunt_data["question"],
            "correct_words": word_hunt_data["correct_words"],
            "completion_feedback": word_hunt_data["completion_feedback"],
            "word_audio": word_audio,
        }), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except RuntimeError as e:
        return jsonify({"error": str(e)}), 502
    except Exception as e:
        return jsonify({"error": str(e)}), 500
