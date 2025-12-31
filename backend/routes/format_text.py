"""Format text endpoint."""
from flask import request, jsonify, Blueprint
from services.gemini_service import format_text_with_gemini

format_text_bp = Blueprint('format_text', __name__)


@format_text_bp.route('/format-text', methods=['POST'])
def format_text():
    """Format raw OCR text using Gemini.
    
    Expects JSON with:
    {
        "text": "raw ocr text to format"
    }
    
    Returns:
    {
        "formatted_text": "formatted and corrected text"
    }
    """
    try:
        data = request.get_json()
        if not data or 'text' not in data:
            return jsonify({"error": "No text provided"}), 400
        
        raw_text = data['text']
        if not raw_text or not raw_text.strip():
            return jsonify({"error": "Empty text"}), 400
        
        # Format the text using Gemini
        formatted_text = format_text_with_gemini(raw_text)
        
        return jsonify({"formatted_text": formatted_text}), 200
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500
