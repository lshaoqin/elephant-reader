"""WebSocket route for streaming speech recognition."""
from flask_socketio import emit
from services.streaming_speech_service import (
    get_speech_client,
    get_streaming_config,
    process_streaming_response
)
import threading
import queue


def register_socketio_events(socketio):
    """Register all SocketIO event handlers.
    
    Args:
        socketio: SocketIO instance
    """
    
    # Store active streaming sessions
    active_sessions = {}
    
    @socketio.on('connect')
    def handle_connect():
        """Handle client connection."""
        print(f"Client connected")
        emit('connected', {'status': 'ready'})
    
    @socketio.on('disconnect')
    def handle_disconnect():
        """Handle client disconnection."""
        print(f"Client disconnected")
        # Clean up any active sessions for this client
        # (Flask-SocketIO automatically manages session IDs)
    
    @socketio.on('start_streaming')
    def handle_start_streaming(data):
        """Start a new streaming recognition session.
        
        Args:
            data: dict with sample_rate (optional)
        """
        try:
            from flask import request
            session_id = request.sid
            
            sample_rate = data.get('sample_rate', 48000)
            
            # Create audio request queue
            audio_queue = queue.Queue()
            
            # Store session info
            active_sessions[session_id] = {
                'queue': audio_queue,
                'sample_rate': sample_rate,
                'running': True
            }
            
            # Start streaming thread
            thread = threading.Thread(
                target=streaming_recognize_worker,
                args=(session_id, audio_queue, sample_rate, socketio)
            )
            thread.daemon = True
            thread.start()
            
            emit('streaming_started', {'status': 'streaming'})
            
        except Exception as e:
            print(f"Error starting streaming: {e}")
            emit('error', {'error': str(e)})
    
    @socketio.on('audio_chunk')
    def handle_audio_chunk(data):
        """Receive audio chunk from client.
        
        Args:
            data: dict with 'audio' (bytes)
        """
        try:
            from flask import request
            session_id = request.sid
            
            if session_id not in active_sessions:
                emit('error', {'error': 'No active streaming session'})
                return
            
            audio_data = data.get('audio')
            if audio_data:
                # Convert to bytes if it's a list or other format
                if isinstance(audio_data, list):
                    audio_bytes = bytes(audio_data)
                elif isinstance(audio_data, str):
                    # Base64 encoded
                    import base64
                    audio_bytes = base64.b64decode(audio_data)
                else:
                    # Already bytes
                    audio_bytes = audio_data
                
                # Add to queue for processing
                active_sessions[session_id]['queue'].put(audio_bytes)
        
        except Exception as e:
            print(f"Error handling audio chunk: {e}")
            emit('error', {'error': str(e)})
    
    @socketio.on('stop_streaming')
    def handle_stop_streaming():
        """Stop the streaming recognition session."""
        try:
            from flask import request
            session_id = request.sid
            
            if session_id in active_sessions:
                active_sessions[session_id]['running'] = False
                active_sessions[session_id]['queue'].put(None)  # Signal to stop
                del active_sessions[session_id]
            
            emit('streaming_stopped', {'status': 'stopped'})
            
        except Exception as e:
            print(f"Error stopping streaming: {e}")
            emit('error', {'error': str(e)})


def streaming_recognize_worker(session_id, audio_queue, sample_rate, socketio):
    """Worker thread that handles streaming recognition.
    
    Args:
        session_id: Client session ID
        audio_queue: Queue of audio chunks to process
        sample_rate: Audio sample rate
        socketio: SocketIO instance for emitting events
    """
    try:
        from google.cloud import speech_v1 as speech
        
        client = get_speech_client()
        
        # Create recognition config (not streaming config)
        config = speech.RecognitionConfig(
            encoding=speech.RecognitionConfig.AudioEncoding.WEBM_OPUS,
            sample_rate_hertz=sample_rate,
            language_code="en-US",
            enable_word_time_offsets=True,
            enable_automatic_punctuation=True,
            model="latest_short",
            max_alternatives=3,
        )
        
        streaming_config = speech.StreamingRecognitionConfig(
            config=config,
            interim_results=True,
        )
        
        def request_generator():
            """Generator that yields StreamingRecognizeRequest objects."""
            # First request with config
            yield speech.StreamingRecognizeRequest(streaming_config=streaming_config)
            
            # Subsequent requests with audio
            while True:
                chunk = audio_queue.get()
                if chunk is None:  # Stop signal
                    break
                yield speech.StreamingRecognizeRequest(audio_content=chunk)
        
        # Start streaming recognition
        responses = client.streaming_recognize(requests=request_generator())
        
        # Process responses
        for response in responses:
            result_data = process_streaming_response(response)
            
            if result_data:
                # Emit result back to client
                socketio.emit('recognition_result', result_data, room=session_id)
    
    except Exception as e:
        print(f"Streaming recognition error: {e}")
        import traceback
        traceback.print_exc()
        socketio.emit('error', {'error': str(e)}, room=session_id)
