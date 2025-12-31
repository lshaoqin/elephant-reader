"""Define word endpoint."""
from flask import request, jsonify, Blueprint
import requests

define_word_bp = Blueprint('define_word', __name__)


@define_word_bp.route('/define-word', methods=['POST'])
def define_word():
    """Fetch word definition from Dictionary API.
    
    Expects JSON with:
    {
        "word": "word to define"
    }
    
    Returns the full Dictionary API response including:
    - word and phonetic information
    - phonetics with audio links
    - origin
    - meanings with definitions, examples, synonyms, and antonyms
    """
    try:
        data = request.get_json()
        if not data or 'word' not in data:
            return jsonify({"error": "No word provided"}), 400
        
        word = data['word'].strip()
        if not word:
            return jsonify({"error": "Empty word"}), 400
        
        # Fetch definition from Dictionary API
        url = f"https://api.dictionaryapi.dev/api/v2/entries/en/{word}"
        response = requests.get(url, timeout=5)
        
        if response.status_code == 404:
            return jsonify({"error": f"Word '{word}' not found"}), 404
        
        if response.status_code != 200:
            return jsonify({"error": "Failed to fetch definition"}), response.status_code
        
        # Return the API response as-is
        data = response.json()
        return jsonify(data[0]), 200
    
    except requests.Timeout:
        return jsonify({"error": "Request timeout"}), 504
    except Exception as e:
        return jsonify({"error": str(e)}), 500
