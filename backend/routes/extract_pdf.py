"""Extract text from PDF files endpoint."""
import tempfile
from pathlib import Path
from flask import request, jsonify, Blueprint
from google.cloud import vision
import os
import base64
from pdf2image import convert_from_path
from io import BytesIO

extract_pdf_bp = Blueprint('extract_pdf', __name__)


def extract_text_from_pdf_page(image_bytes):
    """
    Extract text and bounding boxes from a single PDF page (as image).
    
    Args:
        image_bytes: Image bytes of the PDF page
        
    Returns:
        Dictionary with full_text, blocks, and image_base64
    """
    client = vision.ImageAnnotatorClient()
    
    feature = vision.Feature(type_=vision.Feature.Type.DOCUMENT_TEXT_DETECTION)
    
    # Create image with page content
    image = vision.Image(content=image_bytes)
    
    # Request with document text detection
    request_obj = vision.AnnotateImageRequest(image=image, features=[feature])
    
    # Use batch process to handle the document
    response = client.batch_annotate_images(requests=[request_obj])
    
    if not response.responses or not response.responses[0]:
        return {
            "full_text": "",
            "blocks": [],
            "image_base64": base64.b64encode(image_bytes).decode('utf-8')
        }
    
    annotation = response.responses[0].full_text_annotation
    
    # Extract full text
    full_text = annotation.text if annotation else ""
    
    # Extract blocks with bounding boxes
    blocks = []
    if annotation and annotation.pages:
        for page in annotation.pages:
            if page.blocks:
                for block in page.blocks:
                    if block.paragraphs:
                        # Extract text from paragraphs in the block
                        block_text = ""
                        for paragraph in block.paragraphs:
                            for word in paragraph.words:
                                for symbol in word.symbols:
                                    block_text += symbol.text
                                block_text += " "
                            block_text = block_text.rstrip() + "\n"
                        
                        block_text = block_text.rstrip()
                        
                        # Extract bounding box vertices
                        vertices = []
                        if block.bounding_box and block.bounding_box.vertices:
                            for vertex in block.bounding_box.vertices:
                                vertices.append({
                                    "x": vertex.x,
                                    "y": vertex.y
                                })
                        
                        if block_text.strip():  # Only add non-empty blocks
                            blocks.append({
                                "text": block_text,
                                "vertices": vertices
                            })
    
    # Encode page image as base64
    image_base64 = base64.b64encode(image_bytes).decode('utf-8')
    
    return {
        "full_text": full_text,
        "blocks": blocks,
        "image_base64": image_base64
    }


def convert_pdf_to_images(pdf_path):
    """
    Convert PDF pages to images and extract text from each page.
    
    Args:
        pdf_path: Path to the PDF file
        
    Returns:
        List of dictionaries, one for each page with full_text, blocks, and image_base64
    """
    # Convert PDF to images (one per page)
    # Using DPI of 200 for good quality without being too large
    images = convert_from_path(pdf_path, dpi=200)
    
    results = []
    
    for page_num, image in enumerate(images, start=1):
        # Convert PIL Image to bytes
        img_byte_arr = BytesIO()
        image.save(img_byte_arr, format='JPEG', quality=95)
        img_byte_arr = img_byte_arr.getvalue()
        
        # Extract text from this page
        page_result = extract_text_from_pdf_page(img_byte_arr)
        results.append(page_result)
    
    return results


@extract_pdf_bp.route('/extract-pdf', methods=['POST'])
def extract_pdf():
    """Handle PDF file upload and extract text with bounding boxes from each page."""
    try:
        # Check if file is in the request
        if 'file' not in request.files:
            return jsonify({"error": "No file provided"}), 400
        
        file = request.files['file']
        
        if file.filename == '':
            return jsonify({"error": "No file selected"}), 400
        
        # Validate file is PDF
        if not file.filename.lower().endswith('.pdf'):
            return jsonify({"error": "Only PDF files are supported"}), 400
        
        # Save file to temporary location
        with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as tmp:
            file.save(tmp.name)
            tmp_path = tmp.name
        
        try:
            # Convert PDF pages to images and extract text from each
            results = convert_pdf_to_images(tmp_path)
            
            # Return results as an array (one per page)
            return jsonify({
                "results": results,
                "total": len(results)
            }), 200
        finally:
            # Clean up temporary file
            try:
                os.unlink(tmp_path)
            except:
                pass
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500
