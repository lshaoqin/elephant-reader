"""Batch extract text endpoint for processing multiple images."""
import tempfile
from pathlib import Path
from flask import request, jsonify, Blueprint
from services.vision_service import extract_text_with_boxes
from utils.firebase_auth import require_firebase_auth
import os
from concurrent.futures import ThreadPoolExecutor, as_completed

extract_batch_bp = Blueprint('extract_batch', __name__)

MAX_BATCH_SIZE = 20
MAX_WORKERS = 4  # Process up to 4 images in parallel


def process_single_file(file_data, filename):
    """Process a single file and return the result."""
    try:
        # Save file to temporary location
        with tempfile.NamedTemporaryFile(delete=False, suffix=Path(filename).suffix) as tmp:
            tmp.write(file_data)
            tmp_path = tmp.name
        
        try:
            # Extract text and bounding boxes from image
            result = extract_text_with_boxes(tmp_path)
            return {"success": True, "data": result}
        finally:
            # Clean up temporary file
            try:
                os.unlink(tmp_path)
            except:
                pass
    
    except Exception as e:
        return {"success": False, "error": str(e)}


@extract_batch_bp.route('/extract-batch', methods=['POST'])
@require_firebase_auth
def extract_batch():
    """Handle multiple file uploads and extract text with bounding boxes from all images."""
    try:
        files = request.files.getlist('files')
        
        if not files:
            return jsonify({"error": "No files provided"}), 400
        
        if len(files) > MAX_BATCH_SIZE:
            return jsonify({"error": f"Too many files. Maximum is {MAX_BATCH_SIZE}"}), 400
        
        # Prepare file data for parallel processing
        file_tasks = []
        for file in files:
            if file.filename == '':
                continue
            file_data = file.read()
            file_tasks.append((file_data, file.filename))
        
        if not file_tasks:
            return jsonify({"error": "No valid files selected"}), 400
        
        # Process files in parallel
        results = []
        errors = []
        
        with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
            # Submit all tasks
            future_to_index = {
                executor.submit(process_single_file, file_data, filename): i 
                for i, (file_data, filename) in enumerate(file_tasks)
            }
            
            # Collect results in order
            result_map = {}
            for future in as_completed(future_to_index):
                index = future_to_index[future]
                result = future.result()
                result_map[index] = result
        
        # Build ordered results
        for i in range(len(file_tasks)):
            if i in result_map:
                result = result_map[i]
                if result["success"]:
                    results.append(result["data"])
                else:
                    errors.append(f"File {i+1}: {result['error']}")
        
        if not results and errors:
            return jsonify({"error": "; ".join(errors)}), 500
        
        return jsonify({
            "results": results,
            "errors": errors if errors else None,
            "total": len(results)
        }), 200
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500
