"""Extract text endpoint."""
import tempfile
from pathlib import Path
from flask import request, jsonify, Blueprint
from services.vision_service import extract_text_with_boxes
import os

extract_bp = Blueprint('extract', __name__)


@extract_bp.route('/extract', methods=['POST'])
def extract():
    """Handle file upload and extract text with bounding boxes from image."""
    try:
        # Check if file is in the request
        if 'file' not in request.files:
            return jsonify({"error": "No file provided"}), 400
        
        file = request.files['file']
        
        if file.filename == '':
            return jsonify({"error": "No file selected"}), 400
        
        # Save file to temporary location
        with tempfile.NamedTemporaryFile(delete=False, suffix=Path(file.filename).suffix) as tmp:
            file.save(tmp.name)
            tmp_path = tmp.name
        
        try:
            # Extract text and bounding boxes from image
            result = extract_text_with_boxes(tmp_path)
            return jsonify(result), 200
        finally:
            # Clean up temporary file
            try:
                os.unlink(tmp_path)
            except:
                pass
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500
