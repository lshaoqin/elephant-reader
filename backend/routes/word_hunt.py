"""Word hunt activity endpoint."""
import base64
import re
from flask import request, jsonify, Blueprint
from config import TTS_SAMPLE_RATE
from services.gemini_service import get_word_hunt_activity
from services.google_tts_service import generate_speech_from_ssml
from utils.firebase_auth import require_firebase_auth

word_hunt_bp = Blueprint('word_hunt', __name__)


def _normalize_word(word: str) -> str:
    return re.sub(r"[^a-z0-9']", "", (word or "").lower())


def _extract_text_words(text: str) -> list[str]:
    return re.findall(r"[A-Za-z][A-Za-z'-]*", text or "")


def _filter_words_in_text(candidate_words: list, text_words: list[str]) -> list[str]:
    """Keep words that actually exist in passage text (case-insensitive)."""
    if not candidate_words:
        return []

    normalized_text_words = {_normalize_word(word) for word in text_words}
    output = []
    seen = set()

    for word in candidate_words:
        value = str(word).strip()
        normalized = _normalize_word(value)
        if not normalized or normalized in seen:
            continue
        if normalized in normalized_text_words:
            seen.add(normalized)
            output.append(value)

    return output


@word_hunt_bp.route('/word-hunt', methods=['POST'])
@require_firebase_auth
def word_hunt():
    """Generate a phonics word-hunt activity for the provided text."""
    try:
        data = request.get_json()
        if not data or 'text' not in data:
            return jsonify({"error": "No text provided"}), 400

        text = str(data.get('text', '')).strip()
        if not text:
            return jsonify({"error": "Empty text"}), 400

        activity = get_word_hunt_activity(text)
        text_words = _extract_text_words(text)

        correct_words = _filter_words_in_text(activity.get('correct_words', []), text_words)
        if len(correct_words) == 0:
            correct_words = text_words[:4]

        response_data = {
            "question": str(activity.get('question', 'Find the words that match the sound pattern.')).strip(),
            "correct_words": correct_words,
            "completion_feedback": str(activity.get('completion_feedback', 'Amazing effort!')).strip(),
        }

        phoneme_ssml = str(activity.get('phoneme_ssml', '')).strip()
        if phoneme_ssml:
            audio_content = generate_speech_from_ssml(ssml=phoneme_ssml)
            response_data["phoneme_audio"] = {
                "audio": base64.b64encode(audio_content).decode('utf-8'),
                "sample_rate": TTS_SAMPLE_RATE,
            }

        return jsonify(response_data), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
