"""Google Cloud Vision service for text extraction."""
import base64
import io
from google.cloud import vision
from typing import Dict, List
from PIL import Image, ExifTags


# Initialize Google Cloud Vision client
client = vision.ImageAnnotatorClient()


def correct_image_orientation(image_path: str) -> bytes:
    """Correct image orientation based on EXIF data.
    
    Args:
        image_path: Path to the image file
        
    Returns:
        Image bytes with corrected orientation
    """
    try:
        image = Image.open(image_path)
        
        # Check for EXIF orientation tag
        try:
            for orientation in ExifTags.TAGS.keys():
                if ExifTags.TAGS[orientation] == 'Orientation':
                    break
            
            exif = image._getexif()
            
            if exif is not None:
                orientation_value = exif.get(orientation)
                
                # Apply rotation based on EXIF orientation
                if orientation_value == 3:
                    image = image.rotate(180, expand=True)
                elif orientation_value == 6:
                    image = image.rotate(270, expand=True)
                elif orientation_value == 8:
                    image = image.rotate(90, expand=True)
        except (AttributeError, KeyError, IndexError):
            # No EXIF data or orientation tag
            pass
        
        # Convert to RGB if necessary (for PNG with transparency, etc.)
        if image.mode in ('RGBA', 'LA', 'P'):
            background = Image.new('RGB', image.size, (255, 255, 255))
            if image.mode == 'P':
                image = image.convert('RGBA')
            background.paste(image, mask=image.split()[-1] if image.mode in ('RGBA', 'LA') else None)
            image = background
        elif image.mode != 'RGB':
            image = image.convert('RGB')
        
        # Save to bytes
        img_byte_arr = io.BytesIO()
        image.save(img_byte_arr, format='JPEG', quality=95)
        return img_byte_arr.getvalue()
    except Exception as e:
        # If orientation correction fails, return original image
        with open(image_path, 'rb') as f:
            return f.read()


def get_document_blocks(image_file_path: str) -> dict:
    """Extract text blocks with bounding boxes from document using Vision API structure.
    
    Args:
        image_file_path: path to the image file.
        
    Returns:
        Dictionary with full_text and blocks containing raw OCR text and vertices.
    """
    # Correct image orientation first
    content = correct_image_orientation(image_file_path)
    
    image = vision.Image(content=content)
    response = client.document_text_detection(image=image)
    
    blocks = []
    full_text = response.full_text_annotation.text if response.full_text_annotation else ''
    
    if response.full_text_annotation:
        document = response.full_text_annotation
        
        # Extract blocks from the document structure
        for page in document.pages:
            for block in page.blocks:
                # Get text from all paragraphs in this block
                block_text = ''
                for paragraph in block.paragraphs:
                    for word in paragraph.words:
                        for symbol in word.symbols:
                            block_text += symbol.text
                        block_text += ' '
                    block_text += '\n'
                
                block_text = block_text.strip()
                
                # Get bounding box vertices
                if block.bounding_box and block_text:
                    vertices = []
                    for vertex in block.bounding_box.vertices:
                        vertices.append({'x': vertex.x, 'y': vertex.y})
                    
                    blocks.append({
                        'text': block_text,
                        'vertices': vertices
                    })
    
    return {
        'full_text': full_text,
        'blocks': blocks
    }


def extract_text_with_boxes(file_path: str) -> dict:
    """Extract text and bounding boxes from an image using Google Cloud Vision.
    
    Args:
        file_path: Path to the image file
        
    Returns:
        Dictionary with full_text, blocks, and base64 encoded image
        
    Raises:
        Exception: If extraction fails
    """
    try:
        # Correct orientation and encode to base64
        corrected_image = correct_image_orientation(file_path)
        image_base64 = base64.b64encode(corrected_image).decode('utf-8')
        
        # Get document blocks
        result = get_document_blocks(file_path)
        
        return {
            'full_text': result['full_text'],
            'blocks': result['blocks'],
            'image_base64': image_base64
        }
    except Exception as e:
        raise Exception(f"Error extracting text: {str(e)}")
