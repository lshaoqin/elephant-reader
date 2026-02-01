"""Google Cloud Speech-to-Text service."""
import os
from google.cloud import speech_v1 as speech
from google.oauth2 import service_account

# Path to credentials
CREDENTIALS_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'credentials', 'google-credentials.json')

# Global client instance
_speech_client = None


def get_speech_client():
    """Lazy load Google Speech client on first use.
    
    Returns:
        speech.SpeechClient instance
    """
    global _speech_client
    if _speech_client is None:
        credentials = service_account.Credentials.from_service_account_file(CREDENTIALS_PATH)
        _speech_client = speech.SpeechClient(credentials=credentials)
    return _speech_client


def process_audio_stream(audio_data: bytes, sample_rate: int = 48000):
    """Process audio data and return transcription with word-level timestamps.
    
    Args:
        audio_data: Audio data in bytes (WebM, WAV, etc.)
        sample_rate: Audio sample rate in Hz
        
    Returns:
        dict: Transcription results with words and timestamps
    """
    client = get_speech_client()
    
    # Configure recognition
    config = speech.RecognitionConfig(
        encoding=speech.RecognitionConfig.AudioEncoding.WEBM_OPUS,  # WebM with Opus codec
        sample_rate_hertz=sample_rate,
        language_code="en-US",
        enable_word_time_offsets=True,
        enable_automatic_punctuation=True,
        model="latest_long",  # Best for longer audio
    )
    
    audio = speech.RecognitionAudio(content=audio_data)
    
    try:
        # Perform recognition
        response = client.recognize(config=config, audio=audio)
        
        # Process results - collect all alternatives for better matching
        all_alternatives = []
        primary_transcript = ""
        primary_words = []
        
        for result in response.results:
            # Process all alternatives (ranked by confidence)
            result_alternatives = []
            for idx, alternative in enumerate(result.alternatives):
                alt_words = []
                for word_info in alternative.words:
                    word_data = {
                        "word": word_info.word,
                        "start_time": word_info.start_time.total_seconds(),
                        "end_time": word_info.end_time.total_seconds(),
                    }
                    alt_words.append(word_data)
                
                result_alternatives.append({
                    "transcript": alternative.transcript,
                    "confidence": alternative.confidence,
                    "words": alt_words,
                    "is_primary": idx == 0
                })
                
                # Keep track of primary (most confident) transcript
                if idx == 0:
                    primary_transcript += alternative.transcript + " "
                    primary_words.extend(alt_words)
            
            all_alternatives.extend(result_alternatives)
        
        return {
            "transcript": primary_transcript.strip(),
            "words": primary_words,
            "alternatives": all_alternatives,  # All possible transcriptions
            "status": "success"
        }
        
    except Exception as e:
        return {
            "error": str(e),
            "status": "error"
        }


def process_audio_stream_realtime(audio_generator, sample_rate: int = 48000):
    """Process streaming audio with real-time results.
    
    Args:
        audio_generator: Generator yielding audio chunks
        sample_rate: Audio sample rate in Hz
        
    Yields:
        dict: Interim and final transcription results
    """
    client = get_speech_client()
    
    # Configure streaming recognition
    config = speech.RecognitionConfig(
        encoding=speech.RecognitionConfig.AudioEncoding.WEBM_OPUS,
        sample_rate_hertz=sample_rate,
        language_code="en-US",
        enable_word_time_offsets=True,
        enable_automatic_punctuation=True,
    )
    
    streaming_config = speech.StreamingRecognitionConfig(
        config=config,
        interim_results=True,
    )
    
    # Create request generator
    def request_generator():
        yield speech.StreamingRecognizeRequest(streaming_config=streaming_config)
        for audio_chunk in audio_generator:
            yield speech.StreamingRecognizeRequest(audio_content=audio_chunk)
    
    # Stream audio and get results
    responses = client.streaming_recognize(request_generator())
    
    for response in responses:
        for result in response.results:
            alternative = result.alternatives[0]
            
            words = []
            for word_info in alternative.words:
                words.append({
                    "word": word_info.word,
                    "start_time": word_info.start_time.total_seconds(),
                    "end_time": word_info.end_time.total_seconds(),
                })
            
            yield {
                "transcript": alternative.transcript,
                "words": words,
                "is_final": result.is_final,
                "stability": result.stability,
            }
