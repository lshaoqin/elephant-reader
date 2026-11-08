"""Word hunt endpoints."""
import base64
from flask import request, jsonify, Blueprint

from services.gemini_service import get_word_hunt_phonics_data, get_word_hunt_vocabulary_data
from services.google_tts_service import generate_speech_with_word_level_timestamps
from utils.firebase_auth import optional_firebase_auth

word_hunt_bp = Blueprint('word_hunt', __name__)


def _build_word_hunt_response(word_hunt_data: dict, language_code: str, voice_name: str, mode: str):
    """Create the audio payload for a generated word-hunt question."""
    word_audio = {}
    for word in word_hunt_data["correct_words"]:
        try:
            audio_content, _ = generate_speech_with_word_level_timestamps(
                text=word,
                language_code=language_code,
                voice_name=voice_name,
            )
            word_audio[word] = {
                "audio": base64.b64encode(audio_content).decode('utf-8'),
                "sample_rate": 24000,
                "audio_mime_type": "audio/wav",
            }
        except Exception as tts_error:
            print(f"Warning: failed to generate word audio for '{word}': {str(tts_error)}")

    return jsonify({
        "mode": mode,
        "question": word_hunt_data["question"],
        "correct_words": word_hunt_data["correct_words"],
        "completion_feedback": word_hunt_data["completion_feedback"],
        "encouragement_prompt": word_hunt_data.get("encouragement_prompt") or word_hunt_data["completion_feedback"],
        "tip": word_hunt_data.get("tip") or "Look for the shared sound in each word.",
        "word_audio": word_audio,
    }), 200


@word_hunt_bp.route('/word-hunt/vocabulary', methods=['POST'])
@optional_firebase_auth
def get_vocabulary_word_hunt():
    """Generate a vocabulary word hunt question from text."""
    try:
        data = request.get_json()
        if not data or 'text' not in data:
            return jsonify({"error": "No text provided"}), 400

        text = str(data.get('text', '')).strip()
        language_code = str(data.get('language_code', '') or '').strip() or 'en-US'
        voice_name = str(data.get('voice_name', '') or '').strip() or 'en-US-Neural2-H'
        excluded_words_raw = data.get('excluded_words')
        excluded_words = [str(w).strip() for w in (excluded_words_raw or []) if str(w).strip()] or None
        if not text:
            return jsonify({"error": "Empty text"}), 400

        word_hunt_data = get_word_hunt_vocabulary_data(text, excluded_words=excluded_words, language_code=language_code)
        return _build_word_hunt_response(word_hunt_data, language_code, voice_name, "vocabulary")
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except RuntimeError as e:
        return jsonify({"error": str(e)}), 502
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@word_hunt_bp.route('/word-hunt/pattern', methods=['POST'])
@optional_firebase_auth
def get_pattern_word_hunt():
    """Generate a phonics/pattern word hunt question from text."""
    try:
        data = request.get_json()
        if not data or 'text' not in data:
            return jsonify({"error": "No text provided"}), 400

        text = str(data.get('text', '')).strip()
        language_code = str(data.get('language_code', '') or '').strip() or 'en-US'
        voice_name = str(data.get('voice_name', '') or '').strip() or 'en-US-Neural2-H'
        excluded_words_raw = data.get('excluded_words')
        excluded_words = [str(w).strip() for w in (excluded_words_raw or []) if str(w).strip()] or None
        if not text:
            return jsonify({"error": "Empty text"}), 400

        word_hunt_data = get_word_hunt_phonics_data(text, excluded_words=excluded_words, language_code=language_code)
        return _build_word_hunt_response(word_hunt_data, language_code, voice_name, "pattern")
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except RuntimeError as e:
        return jsonify({"error": str(e)}), 502
    except Exception as e:
        return jsonify({"error": str(e)}), 500
