"""Google Cloud Speech-to-Text streaming service."""
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


def get_streaming_config(sample_rate: int = 48000):
    """Get streaming recognition configuration.
    
    Args:
        sample_rate: Audio sample rate in Hz
        
    Returns:
        speech.StreamingRecognitionConfig instance
    """
    config = speech.RecognitionConfig(
        encoding=speech.RecognitionConfig.AudioEncoding.WEBM_OPUS,
        sample_rate_hertz=sample_rate,
        language_code="en-US",
        enable_word_time_offsets=True,
        enable_automatic_punctuation=True,
        model="latest_short",  # Optimized for streaming/short utterances
        max_alternatives=3,  # Get top 3 alternatives for better matching
    )
    
    streaming_config = speech.StreamingRecognitionConfig(
        config=config,
        interim_results=True,  # Get interim results while user is speaking
    )
    
    return streaming_config


def process_streaming_response(response):
    """Process a streaming response and extract results.
    
    Args:
        response: StreamingRecognizeResponse from Google
        
    Returns:
        dict: Processed response with transcript, words, and alternatives
    """
    if not response.results:
        return None
    
    result = response.results[0]
    
    # Extract all alternatives
    all_alternatives = []
    primary_transcript = ""
    primary_words = []
    is_final = result.is_final
    
    for idx, alternative in enumerate(result.alternatives):
        alt_words = []
        for word_info in alternative.words:
            word_data = {
                "word": word_info.word,
                "start_time": word_info.start_time.total_seconds(),
                "end_time": word_info.end_time.total_seconds(),
            }
            alt_words.append(word_data)
        
        alt_data = {
            "transcript": alternative.transcript,
            "confidence": alternative.confidence,
            "words": alt_words,
            "is_primary": idx == 0
        }
        
        all_alternatives.append(alt_data)
        
        if idx == 0:
            primary_transcript = alternative.transcript
            primary_words = alt_words
    
    return {
        "transcript": primary_transcript,
        "words": primary_words,
        "alternatives": all_alternatives,
        "is_final": is_final,
        "status": "success"
    }
