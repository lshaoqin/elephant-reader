"""Google Cloud Speech-to-Text streaming route."""
from flask import Blueprint, request, Response, jsonify
import json
import io
from services.speech_recognition_service import process_audio_stream

speech_recognition_bp = Blueprint('speech_recognition', __name__)


@speech_recognition_bp.route('/api/speech-recognize', methods=['POST'])
def speech_recognize():
    """Stream audio to Google Speech-to-Text API and return results."""
    try:
        # Get audio data from request
        if 'audio' not in request.files:
            return jsonify({'error': 'No audio file provided'}), 400
        
        audio_file = request.files['audio']
        audio_data = audio_file.read()
        
        # Process audio and get transcription
        result = process_audio_stream(audio_data)
        
        return jsonify(result), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@speech_recognition_bp.route('/api/speech-recognize-stream', methods=['POST'])
def speech_recognize_stream():
    """Stream audio chunks to Google Speech-to-Text API with real-time results."""
    def generate():
        try:
            # This is a simple implementation - for true streaming we'd need WebSockets
            # For now, we'll process the complete audio
            audio_data = request.data
            
            if not audio_data:
                yield f"data: {json.dumps({'error': 'No audio data'})}\n\n"
                return
            
            # Send progress update
            yield f"data: {json.dumps({'status': 'processing'})}\n\n"
            
            # Process audio
            result = process_audio_stream(audio_data)
            
            # Send final result
            yield f"data: {json.dumps(result)}\n\n"
            
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
    
    return Response(generate(), mimetype='text/event-stream')
