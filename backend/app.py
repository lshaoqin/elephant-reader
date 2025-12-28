from flask import Flask, request, jsonify
from flask_cors import CORS
from google.cloud import vision
import google.genai as genai
import os
import tempfile
import base64
from pathlib import Path
from dotenv import load_dotenv
from kokoro import KPipeline
import soundfile as sf
import io
import numpy as np
import subprocess
import json
import shutil
import re
import docker
from typing import List, Tuple, Dict

load_dotenv()

app = Flask(__name__)
CORS(app)

# Initialize Google Cloud Vision client
client = vision.ImageAnnotatorClient()

gemini_model = "gemini-2.5-flash-lite"
genai_client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

# Initialize Kokoro TTS pipeline
tts_pipeline = None

def get_tts_pipeline():
    """Lazy load TTS pipeline on first use."""
    global tts_pipeline
    if tts_pipeline is None:
        tts_pipeline = KPipeline(lang_code='b')
    return tts_pipeline


def split_text_into_words(text: str) -> List[str]:
    """Split text into words, preserving punctuation awareness."""
    # Split by whitespace
    words = text.split()
    return [w for w in words if w]  # Remove empty strings


def align_text_with_mfa(audio_path: str, text: str, mfa_container: str = "mfa_aligner") -> Dict:
    """Use Montreal Forced Aligner to align text with audio and get timestamps.
    
    Args:
        audio_path: Path to the audio file
        text: Text to align with audio
        mfa_container: Name of the MFA container
        
    Returns:
        Dictionary with word-level timestamps:
        {
            "words": ["word1", "word2", ...],
            "timestamps": [
                {"word": "word1", "start": 0.0, "end": 0.5},
                {"word": "word2", "start": 0.5, "end": 1.0},
                ...
            ]
        }
    """
    try:
        # Create working directories in shared volume
        # Using /mfa_workdir which is shared between Flask and MFA containers
        # MFA requires input and output to be separate directories
        workdir = "/mfa_workdir"
        os.makedirs(workdir, exist_ok=True)
        
        # Create unique subdirectories for this job (input and output separate)
        import uuid
        job_id = str(uuid.uuid4())[:8]
        input_dir = os.path.join(workdir, f"mfa_input_{job_id}")
        output_dir = os.path.join(workdir, f"mfa_output_{job_id}")
        os.makedirs(input_dir, exist_ok=True)
        os.makedirs(output_dir, exist_ok=True)
        
        try:
            # Copy audio to input directory
            audio_name = "audio.wav"
            audio_in_container = os.path.join(input_dir, audio_name)
            shutil.copy(audio_path, audio_in_container)
            
            # Strip markdown formatting from text for alignment
            clean_text = re.sub(r'\*\*(.+?)\*\*', r'\1', text)  # Remove bold markers
            clean_text = re.sub(r'\*(.+?)\*', r'\1', text)  # Remove italic markers
            clean_text = clean_text.strip()
            
            # Create transcript file in input directory
            transcript_file = os.path.join(input_dir, "audio.txt")
            with open(transcript_file, 'w') as f:
                f.write(clean_text)
            
            # Run MFA alignment using Docker SDK
            # Connect to Docker daemon via socket
            try:
                docker_client = docker.from_env()
                container = docker_client.containers.get("mfa_aligner")
                
                # Run MFA align_one command for single file alignment
                # Format: mfa align_one SOUND_FILE TEXT_FILE DICTIONARY ACOUSTIC_MODEL OUTPUT_PATH
                output_textgrid = os.path.join(output_dir, "audio.TextGrid")
                result = container.exec_run(
                    cmd=f"mfa align_one {audio_in_container} {transcript_file} english_us_arpa english_us_arpa {output_textgrid}",
                    workdir="/",
                    stderr=True
                )
                
                if result.exit_code != 0:
                    print(f"MFA alignment error: {result.output.decode()}")
                    return _create_fallback_timestamps(clean_text)
                    
            except Exception as e:
                print(f"Error running MFA via Docker: {str(e)}")
                return _create_fallback_timestamps(clean_text)
            
            # Parse the resulting TextGrid file to extract word timestamps
            textgrid_file = os.path.join(output_dir, "audio.TextGrid")
            
            if os.path.exists(textgrid_file):
                timestamps = _parse_textgrid(textgrid_file, clean_text)
                return timestamps
            else:
                print("TextGrid file not found after alignment")
                return _create_fallback_timestamps(clean_text)
                
        finally:
            # Clean up working directories
            for dir_path in [input_dir, output_dir]:
                try:
                    shutil.rmtree(dir_path, ignore_errors=True)
                except:
                    pass
            
    except subprocess.TimeoutExpired:
        print("MFA alignment timed out")
        return _create_fallback_timestamps(text)
    except Exception as e:
        print(f"Error in MFA alignment: {str(e)}")
        return _create_fallback_timestamps(text)


def _parse_textgrid(textgrid_path: str, original_text: str) -> Dict:
    """Parse TextGrid file and extract word-level timestamps.
    
    Args:
        textgrid_path: Path to the TextGrid file from MFA
        original_text: Original text for reference
        
    Returns:
        Dictionary with words and timestamps
    """
    try:
        words = split_text_into_words(original_text)
        timestamps = []
        
        # Read TextGrid file
        with open(textgrid_path, 'r') as f:
            content = f.read()
        
        lines = content.split('\n')
        
        # Find xmin and xmax of the file to understand time scale
        file_xmin = None
        file_xmax = None
        
        for line in lines[:50]:  # Check first 50 lines for file header
            if line.strip().startswith('xmin'):
                file_xmin = float(line.split('=')[1].strip())
            elif line.strip().startswith('xmax'):
                file_xmax = float(line.split('=')[1].strip())
        
        print(f"TextGrid time range: {file_xmin} to {file_xmax}")
        
        # Find words tier and parse intervals
        in_words_tier = False
        i = 0
        
        while i < len(lines):
            line = lines[i].strip()
            
            # Detect tier markers - check if this is the words tier
            if line.startswith('item ['):
                # Look ahead to see the tier name
                if i + 1 < len(lines):
                    for j in range(i + 1, min(i + 5, len(lines))):
                        check_line = lines[j].strip()
                        if 'name = "words"' in check_line or 'name = "word"' in check_line:
                            in_words_tier = True
                            break
                        elif check_line.startswith('item ['):
                            # Found next tier before finding words name
                            in_words_tier = False
                            break
                    # If no tier name found, assume not words tier
                    if 'name' not in ''.join(lines[i+1:min(i+5, len(lines))]):
                        in_words_tier = False
            
            # Parse intervals in words tier only
            if in_words_tier and 'intervals [' in line:
                try:
                    start_time = None
                    end_time = None
                    word_text = None
                    
                    # Look ahead for xmin, xmax, text
                    j = i
                    while j < len(lines) and j < i + 5:
                        curr = lines[j].strip()
                        if 'xmin' in curr and '=' in curr:
                            start_time = float(curr.split('=')[1].strip())
                        elif 'xmax' in curr and '=' in curr:
                            end_time = float(curr.split('=')[1].strip())
                        elif 'text' in curr and '=' in curr:
                            # Extract text between quotes
                            if '"' in curr:
                                parts = curr.split('"')
                                if len(parts) >= 2:
                                    word_text = parts[1]
                            break
                        j += 1
                    
                    # Only add non-empty words (keep <eps>, exclude phonemes)
                    # Phonemes are typically uppercase single letters or vowel codes like "AH1", "EY1", etc.
                    # Words are typically lowercase or mixed case
                    if (word_text and word_text.strip() and 
                        word_text not in ['sil', '<SIL>'] and 
                        start_time is not None and end_time is not None):
                        timestamps.append({
                            "word": word_text,
                            "start": round(start_time, 3),
                            "end": round(end_time, 3)
                        })
                except (ValueError, IndexError) as e:
                    print(f"Error parsing interval: {e}")
                    pass
            
            # Exit when we hit next tier (and we were in words tier)
            if in_words_tier and line.startswith('item [') and 'name = "words"' not in ''.join(lines[i:min(i+4, len(lines))]):
                in_words_tier = False
            
            i += 1
        
        print(f"Parsed {len(timestamps)} words from TextGrid")
        
        # If we got timestamps, return them
        if timestamps:
            return {
                "words": [ts["word"] for ts in timestamps],
                "timestamps": timestamps
            }
        else:
            print("No timestamps found in TextGrid, using fallback")
            return _create_fallback_timestamps(original_text)
        
    except Exception as e:
        print(f"Error parsing TextGrid: {str(e)}")
        return _create_fallback_timestamps(original_text)


def _create_fallback_timestamps(text: str, duration: float = None) -> Dict:
    """Create simple equal-duration timestamps as fallback.
    
    Args:
        text: Text to create timestamps for
        duration: Total duration in seconds (if known)
        
    Returns:
        Dictionary with fallback word timestamps
    """
    words = split_text_into_words(text)
    
    if not words:
        return {"words": [], "timestamps": []}
    
    # Default to 3 seconds total or use provided duration
    total_duration = duration or 3.0
    word_duration = total_duration / len(words)
    
    timestamps = []
    for idx, word in enumerate(words):
        start = idx * word_duration
        end = (idx + 1) * word_duration
        timestamps.append({
            "word": word,
            "start": round(start, 3),
            "end": round(end, 3)
        })
    
    return {
        "words": words,
        "timestamps": timestamps
    }


def format_text_with_gemini(raw_text: str) -> str:
    """Use Gemini to correct inaccuracies and format text for readability.
    
    Args:
        raw_text: Raw OCR text to be corrected and formatted.
        
    Returns:
        Formatted and corrected text.
    """
    try:
        prompt = f"""You are a text formatting expert. Please take the following OCR-extracted text and:

1. Correct any OCR inaccuracies or misspellings
2. Remove hyphens that result from words being split across lines (e.g., "hap-pened" -> "happened")
3. Add paragraph breaks where appropriate for readability and logical grouping
4. Bold section titles or headings using **text** format
5. Preserve the overall structure and meaning of the original text

Original OCR text:
{raw_text}

Please provide the corrected, formatted text only. Do not add any explanations or metadata."""

        response = genai_client.models.generate_content(
    model="gemini-2.5-flash-lite", contents=prompt
)
        return response.text.strip()
    except Exception as e:
        # If Gemini fails, return original text
        print(f"Warning: Gemini formatting failed: {str(e)}")
        return raw_text


def get_document_blocks(image_file_path: str) -> dict:
    """Extract text blocks with bounding boxes from document using Vision API structure.
    
    Args:
        image_file_path: path to the image file.
        
    Returns:
        Dictionary with full_text and blocks containing raw OCR text and vertices.
    """
    with open(image_file_path, 'rb') as image_file:
        content = image_file.read()
    
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
    """Extract text and bounding boxes from an image using Google Cloud Vision."""
    try:
        # Read the image for base64 encoding
        with open(file_path, 'rb') as image_file:
            image_base64 = base64.b64encode(image_file.read()).decode('utf-8')
        
        # Get document blocks
        result = get_document_blocks(file_path)
        
        return {
            'full_text': result['full_text'],
            'blocks': result['blocks'],
            'image_base64': image_base64
        }
    except Exception as e:
        raise Exception(f"Error extracting text: {str(e)}")


@app.route('/extract', methods=['POST'])
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


@app.route('/format-text', methods=['POST'])
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

@app.route('/tts', methods=['POST'])
def text_to_speech():
    """Convert text to speech using Kokoro TTS and align with Montreal Forced Aligner.
    
    Expects JSON with:
    {
        "text": "text to convert to speech",
        "voice": "voice_id" (optional, defaults to 'af_heart'),
        "use_alignment": true/false (optional, defaults to true)
    }
    
    Returns:
    {
        "audio": "base64-encoded audio data",
        "sample_rate": 24000,
        "timestamps": [
            {"word": "word1", "start": 0.0, "end": 0.5},
            {"word": "word2", "start": 0.5, "end": 1.0},
            ...
        ]
    }
    """
    try:
        data = request.get_json()
        if not data or 'text' not in data:
            return jsonify({"error": "No text provided"}), 400
        
        text = data['text']
        voice = data.get('voice', 'af_heart')
        use_alignment = data.get('use_alignment', True)
        
        if not text or not text.strip():
            return jsonify({"error": "Empty text"}), 400
        
        # Get TTS pipeline
        pipeline = get_tts_pipeline()
        
        # Generate audio
        generator = pipeline(text, voice=voice)
        
        # Collect all audio chunks from generator
        audio_chunks = []
        for gs, ps, audio in generator:
            audio_chunks.append(audio)
        
        if not audio_chunks:
            return jsonify({"error": "Failed to generate audio"}), 500
        
        # Concatenate all audio chunks
        audio_data = np.concatenate(audio_chunks)
        
        # Convert audio to bytes and encode as base64
        audio_buffer = io.BytesIO()
        sf.write(audio_buffer, audio_data, 24000, format='WAV')
        audio_bytes = audio_buffer.getvalue()
        audio_base64 = base64.b64encode(audio_bytes).decode('utf-8')
        
        # Get word-level timestamps using MFA if requested
        timestamps = None
        if use_alignment:
            try:
                # Save audio to temporary file for MFA
                with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as tmp_audio:
                    tmp_audio.write(audio_bytes)
                    tmp_audio_path = tmp_audio.name
                
                try:
                    # Get duration of audio in seconds
                    audio_duration = len(audio_data) / 24000
                    
                    # Run alignment
                    alignment_result = align_text_with_mfa(tmp_audio_path, text)
                    timestamps = alignment_result.get('timestamps', [])
                finally:
                    # Clean up temporary audio file
                    try:
                        os.unlink(tmp_audio_path)
                    except:
                        pass
            except Exception as e:
                print(f"Warning: Could not get word timestamps: {str(e)}")
                # Continue without timestamps rather than failing
        
        response = {
            "audio": audio_base64,
            "sample_rate": 24000
        }
        
        if timestamps:
            response["timestamps"] = timestamps
        
        return jsonify(response), 200
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint."""
    return jsonify({"status": "ok"}), 200

if __name__ == '__main__':
    app.run(debug=False, host='0.0.0.0', port=5000)
