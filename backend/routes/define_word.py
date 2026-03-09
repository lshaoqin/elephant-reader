"""Define word endpoint."""
from flask import request, jsonify, Blueprint
import base64
import string
from typing import Optional
from pyphen import Pyphen
from config import TTS_SAMPLE_RATE
from services.gemini_service import get_word_learning_data
from services.google_tts_service import generate_speech_with_word_level_timestamps
from utils.firebase_auth import require_firebase_auth

define_word_bp = Blueprint('define_word', __name__)

# Initialize hyphenator for English
hyphenator = Pyphen(lang='en_US')


def strip_punctuation(word: str) -> str:
    """Strip punctuation from the beginning and end of a word.
    
    Args:
        word: The word to clean
        
    Returns:
        Word with punctuation removed
    """
    return word.strip(string.punctuation)


def get_syllabification(word: str) -> list:
    """Get syllabification of a word using pyphen.
    
    Args:
        word: The word to syllabify
        
    Returns:
        List of syllables
    """
    try:
        # pyphen uses hyphens for syllable breaks
        hyphenated = hyphenator.inserted(word)
        # Split by hyphen to get syllables
        syllables = hyphenated.split('-')
        return [s for s in syllables if s]  # Remove empty strings
    except Exception:
        return []


def synthesize_reading_payload(text: str) -> dict:
    """Generate TTS audio and convert to API payload."""
    audio_content, _ = generate_speech_with_word_level_timestamps(
        text=text,
        language_code='en-US',
        voice_name='en-US-Neural2-H'
    )

    return {
        "audio": base64.b64encode(audio_content).decode('utf-8'),
        "sample_rate": TTS_SAMPLE_RATE,
    }



@define_word_bp.route('/define-word', methods=['POST'])
@require_firebase_auth
def define_word():
    """Fetch word learning data from Gemini and generate TTS.
    
    Expects JSON with:
    {
        "word": "word to define",
        "context_sentence": "sentence containing the word" (optional, used for meaning selection)
    }
    """
    try:
        data = request.get_json()
        if not data or 'word' not in data:
            return jsonify({"error": "No word provided"}), 400
        
        word = data['word'].strip()
        if not word:
            return jsonify({"error": "Empty word"}), 400
        
        # Strip punctuation from the word
        word = strip_punctuation(word)
        if not word:
            return jsonify({"error": "Empty word after removing punctuation"}), 400

        context_sentence = str(data.get('context_sentence', '') or '').strip()

        gemini_data = get_word_learning_data(word=word, context_sentence=context_sentence)

        simple_definition = str(gemini_data.get('simple_definition', '')).strip()
        if not simple_definition:
            return jsonify({"error": "Could not generate a definition"}), 502

        example_sentence = str(gemini_data.get('example_sentence', '')).strip()
        if not example_sentence:
            example_sentence = f"I can use the word {word} in a sentence."

        syllables = get_syllabification(word) or [word]

        full_word_audio = synthesize_reading_payload(word)

        response_data = {
            "word": word,
            "definition": simple_definition,
            "part_of_speech": gemini_data.get('part_of_speech'),
            "example_sentence": example_sentence,
            "syllables": syllables,
            "audio": {
                "full_word": full_word_audio
            }
        }

        return jsonify(response_data), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500
