"""Text-to-speech endpoint."""
import os
import json
import tempfile
import numpy as np
from flask import request, jsonify, Blueprint, stream_with_context, current_app
from services.tts_service import generate_speech
from utils.audio_utils import audio_to_base64
from config import TTS_SAMPLE_RATE

tts_bp = Blueprint('tts', __name__)


@tts_bp.route('/tts', methods=['POST'])
def text_to_speech():
    """Convert text to speech using Kokoro TTS and align with Montreal Forced Aligner.
    
    Streams progress updates and returns final audio data.
    
    Expects JSON with:
    {
        "text": "text to convert to speech",
        "voice": "voice_id" (optional, defaults to 'af_heart'),
        "use_alignment": true/false (optional, defaults to true)
    }
    
    Returns a streaming response with progress events and final JSON data.
    """
    # Parse request data outside of generator (while in request context)
    try:
        data = request.get_json()
        if not data or 'text' not in data:
            return jsonify({"error": "No text provided"}), 400
        
        text = data['text']
        voice = data.get('voice', 'af_heart')
        use_alignment = data.get('use_alignment', True)
        
        if not text or not text.strip():
            return jsonify({"error": "Empty text"}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 400
    
    def generate():
        try:
            # Send starting status
            yield f"data: {json.dumps({'status': 'generating', 'progress': 0})}\n\n"
            
            # Generate audio
            generator = generate_speech(text, voice=voice)
            
            # Collect all audio chunks from generator
            audio_chunks = []
            chunk_count = 0
            try:
                for gs, ps, audio in generator:
                    audio_chunks.append(audio)
                    chunk_count += 1
                    # Send progress update
                    yield f"data: {json.dumps({'status': 'generating', 'progress': chunk_count})}\n\n"
            except (BrokenPipeError, ConnectionResetError) as e:
                print(f"Client disconnected during audio generation: {str(e)}")
                return
            
            if not audio_chunks:
                yield f"data: {json.dumps({'error': 'Failed to generate audio'})}\n\n"
                return
            
            # Concatenate all audio chunks
            audio_data = np.concatenate(audio_chunks)
            
            # Convert audio to base64
            audio_base64 = audio_to_base64(audio_data, TTS_SAMPLE_RATE)
            
            # Get word-level timestamps using MFA if requested
            timestamps = None
            if use_alignment:
                try:
                    yield f"data: {json.dumps({'status': 'aligning', 'progress': 0})}\n\n"
                    
                    # Save audio to temporary file for MFA
                    from utils.audio_utils import audio_to_bytes
                    audio_bytes = audio_to_bytes(audio_data, TTS_SAMPLE_RATE)
                    
                    with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as tmp_audio:
                        tmp_audio.write(audio_bytes)
                        tmp_audio_path = tmp_audio.name
                    
                    try:
                        # Clean up temporary audio file
                        try:
                            os.unlink(tmp_audio_path)
                        except:
                            pass
                    finally:
                        pass
                except (BrokenPipeError, ConnectionResetError) as e:
                    print(f"Client disconnected during alignment: {str(e)}")
                    return
                except Exception as e:
                    print(f"Warning: Could not get word timestamps: {str(e)}")
            
            # Send final response
            response_data = {
                "status": "complete",
                "audio": audio_base64,
                "sample_rate": TTS_SAMPLE_RATE
            }
            
            if timestamps:
                response_data["timestamps"] = timestamps
            
            yield f"data: {json.dumps(response_data)}\n\n"
        
        except (BrokenPipeError, ConnectionResetError) as e:
            print(f"Client disconnected: {str(e)}")
            return
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
    
    return current_app.response_class(
        stream_with_context(generate()),
        mimetype='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'X-Accel-Buffering': 'no',
            'Connection': 'close'
        }
    )
