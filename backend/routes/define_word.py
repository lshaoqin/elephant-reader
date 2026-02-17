"""Define word endpoint."""
from flask import request, jsonify, Blueprint
import requests
import string
from pyphen import Pyphen
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


def get_root_word_variations(word: str) -> list:
    """Generate common root word variations by removing suffixes.
    
    Args:
        word: The word to find variations for
        
    Returns:
        List of potential root words ordered by likelihood
    """
    variations = []
    
    # Remove plural 's' or 'es'
    if word.endswith('ies') and len(word) > 4:
        variations.append(word[:-3] + 'y')
    if word.endswith('es') and len(word) > 3:
        variations.append(word[:-2])
    if word.endswith('s') and len(word) > 2 and not word.endswith('ss'):
        variations.append(word[:-1])
    
    # Remove past tense 'ed'
    if word.endswith('ed') and len(word) > 3:
        variations.append(word[:-2])
        # Also try doubling the last consonant (e.g., "stopped" -> "stop")
        if len(word) > 4 and word[-3] == word[-4] and word[-3] not in 'aeiou':
            variations.append(word[:-3])
    
    # Remove '-ing'
    if word.endswith('ing') and len(word) > 4:
        variations.append(word[:-3])
        # Also try doubling the last consonant (e.g., "running" -> "run")
        if len(word) > 5 and word[-4] == word[-5] and word[-5] not in 'aeiou':
            variations.append(word[:-4])
    
    # Remove '-er' and '-est'
    if word.endswith('est') and len(word) > 4:
        variations.append(word[:-3])
    if word.endswith('er') and len(word) > 3:
        variations.append(word[:-2])
    
    return list(dict.fromkeys(variations))  # Remove duplicates while preserving order


def fetch_definition(word: str) -> tuple:
    """Fetch definition for a word, trying root variations if not found.
    
    Args:
        word: The word to define
        
    Returns:
        Tuple of (success: bool, result: dict)
    """
    # Try the word as-is first
    url = f"https://api.dictionaryapi.dev/api/v2/entries/en/{word}"
    response = requests.get(url, timeout=5)
    
    if response.status_code == 200:
        data = response.json()
        # Check if the response actually contains meanings
        if data and len(data) > 0 and data[0].get('meanings'):
            return True, data
    
    # Word not found, try root word variations
    variations = get_root_word_variations(word)
    for root_word in variations:
        url = f"https://api.dictionaryapi.dev/api/v2/entries/en/{root_word}"
        response = requests.get(url, timeout=5)
        
        if response.status_code == 200:
            data = response.json()
            # Check if the response actually contains meanings
            if data and len(data) > 0 and data[0].get('meanings'):
                return True, data
    
    # No definition found
    return False, {"error": f"Word '{word}' not found"}



@define_word_bp.route('/define-word', methods=['POST'])
@require_firebase_auth
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
        
        # Strip punctuation from the word
        word = strip_punctuation(word)
        if not word:
            return jsonify({"error": "Empty word after removing punctuation"}), 400
        
        # Fetch definition, trying root variations if needed
        success, result = fetch_definition(word)
        
        if not success:
            return jsonify(result), 404
        
        # Extract the first entry
        word_data = result[0]
        
        # Add syllabification
        word_data['syllables'] = get_syllabification(word_data.get('word', word))
        
        return jsonify(word_data), 200
    
    except requests.Timeout:
        return jsonify({"error": "Request timeout"}), 504
    except Exception as e:
        return jsonify({"error": str(e)}), 500
