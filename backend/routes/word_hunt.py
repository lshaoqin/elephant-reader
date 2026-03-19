"""Word hunt endpoints."""
from flask import request, jsonify, Blueprint

from services.gemini_service import get_word_hunt_vocabulary_data
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

        return jsonify({
            "mode": "vocabulary",
            "question": word_hunt_data["question"],
            "correct_words": word_hunt_data["correct_words"],
            "completion_feedback": word_hunt_data["completion_feedback"],
        }), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except RuntimeError as e:
        return jsonify({"error": str(e)}), 502
    except Exception as e:
        return jsonify({"error": str(e)}), 500