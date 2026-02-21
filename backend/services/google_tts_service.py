"""Google Cloud Text-to-Speech service using Chirp3 model."""
import os
from google.cloud import texttospeech_v1beta1 as texttospeech
from google.oauth2 import service_account

# Path to credentials
CREDENTIALS_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'credentials', 'google-credentials.json')

# Global client instance
_tts_client = None


def get_tts_client():
    """Lazy load Google TTS client on first use.
    
    Returns:
        texttospeech.TextToSpeechClient instance
    """
    global _tts_client
    if _tts_client is None:
        credentials = service_account.Credentials.from_service_account_file(CREDENTIALS_PATH)
        _tts_client = texttospeech.TextToSpeechClient(credentials=credentials)
    return _tts_client


def generate_speech_with_timestamps(text: str, language_code: str = 'en-US', voice_name: str = 'en-US-Neural2-H"'):
    """Generate speech from text using Google Cloud TTS Chirp3 with word timestamps.
    
    Args:
        text: Text to convert to speech
        language_code: Language code (default: 'en-US')
        voice_name: Voice name (default: 'en-US-Chirp3-HD')
        
    Returns:
        tuple: (audio_content bytes, list of word timestamps)
        
    Word timestamps format:
        [
            {"word": "hello", "start": 0.0, "end": 0.5},
            {"word": "world", "start": 0.6, "end": 1.0},
            ...
        ]
    """
    client = get_tts_client()
    
    # Set the text input to be synthesized
    synthesis_input = texttospeech.SynthesisInput(text=text)
    
    # Build the voice request
    voice = texttospeech.VoiceSelectionParams(
        language_code=language_code,
        name=voice_name
    )
    
    # Select the type of audio file
    audio_config = texttospeech.AudioConfig(
        audio_encoding=texttospeech.AudioEncoding.LINEAR16,
        sample_rate_hertz=24000
    )
    
    # Enable word-level timestamps
    enable_time_pointing = [texttospeech.SynthesizeSpeechRequest.TimepointType.SSML_MARK]
    
    # Perform the text-to-speech request with timepoints
    response = client.synthesize_speech(
        request=texttospeech.SynthesizeSpeechRequest(
            input=synthesis_input,
            voice=voice,
            audio_config=audio_config,
            enable_time_pointing=enable_time_pointing
        )
    )
    
    # Extract word timestamps from timepoints
    timestamps = []
    if hasattr(response, 'timepoints') and response.timepoints:
        for timepoint in response.timepoints:
            # Timepoints are in seconds
            word_info = {
                "word": timepoint.mark_name if hasattr(timepoint, 'mark_name') else "",
                "start": timepoint.time_seconds if hasattr(timepoint, 'time_seconds') else 0.0,
                "end": timepoint.time_seconds if hasattr(timepoint, 'time_seconds') else 0.0  # End time will be start of next word
            }
            timestamps.append(word_info)
        
        # Update end times to be the start of the next word
        for i in range(len(timestamps) - 1):
            timestamps[i]["end"] = timestamps[i + 1]["start"]
        
        # For the last word, estimate end time (add average word duration)
        if timestamps:
            avg_duration = sum(t["end"] - t["start"] for t in timestamps[:-1]) / max(len(timestamps) - 1, 1)
            timestamps[-1]["end"] = timestamps[-1]["start"] + avg_duration
    
    return response.audio_content, timestamps


def generate_speech_with_word_level_timestamps(text: str, language_code: str = 'en-US', voice_name: str = 'en-US-Neural2-H"'):
    """Generate speech with accurate word-level timestamps using SSML marks.
    
    This method inserts SSML mark tags between words to get precise timing information.
    Handles paragraph breaks (double newlines) with SSML <break> tags.
    
    Args:
        text: Text to convert to speech
        language_code: Language code (default: 'en-US')
        voice_name: Voice name (default: 'en-US-Chirp3-HD')
        
    Returns:
        tuple: (audio_content bytes, list of word timestamps)
    """
    client = get_tts_client()
    
    # Split text into paragraphs and create SSML with mark tags
    # First, normalize newlines and split by double newlines
    paragraphs = text.split('\n\n')
    
    ssml_parts = ['<speak>']
    word_index = 0
    
    for paragraph in paragraphs:
        # Add paragraph tags
        ssml_parts.append('<p>')
        
        # Split paragraph into words
        words = paragraph.split()
        
        for word in words:
            mark_name = f"word_{word_index}"
            ssml_parts.append(f'<mark name="{mark_name}"/>{word}')
            word_index += 1
        
        ssml_parts.append('</p>')
    
    ssml_parts.append('</speak>')
    ssml_text = ' '.join(ssml_parts)
    
    # Set the SSML input
    synthesis_input = texttospeech.SynthesisInput(ssml=ssml_text)
    
    # Build the voice request
    voice = texttospeech.VoiceSelectionParams(
        language_code=language_code,
        name=voice_name
    )
    
    # Select the audio encoding and sample rate
    audio_config = texttospeech.AudioConfig(
        audio_encoding=texttospeech.AudioEncoding.LINEAR16,
        sample_rate_hertz=24000
    )

    enable_time_pointing = [texttospeech.SynthesizeSpeechRequest.TimepointType.SSML_MARK]
    
    # Perform the text-to-speech request with timepoints
    response = client.synthesize_speech(
        request=texttospeech.SynthesizeSpeechRequest(
            input=synthesis_input,
            voice=voice,
            audio_config=audio_config,
            enable_time_pointing=enable_time_pointing
        )
    )
    
    # Build timestamps from timepoints
    timestamps = []
    timepoint_dict = {}
    
    if hasattr(response, 'timepoints') and response.timepoints:
        for timepoint in response.timepoints:
            mark_name = timepoint.mark_name if hasattr(timepoint, 'mark_name') else ""
            time_seconds = timepoint.time_seconds if hasattr(timepoint, 'time_seconds') else 0.0
            timepoint_dict[mark_name] = time_seconds
    
    # Create timestamps with start and end times
    word_index = 0
    for paragraph in paragraphs:
        words = paragraph.split()
        for word in words:
            mark_name = f"word_{word_index}"
            start_time = timepoint_dict.get(mark_name, 0.0)
            
            # End time is the start of the next word
            next_mark = f"word_{word_index + 1}"
            end_time = timepoint_dict.get(next_mark, start_time + 0.3)  # Default 300ms if no next word
            
            timestamps.append({
                "word": word,
                "start": start_time,
                "end": end_time
            })
            word_index += 1
    
    return response.audio_content, timestamps


def generate_speech_from_ssml(ssml: str, language_code: str = 'en-US', voice_name: str = 'en-US-Neural2-H'):
    """Generate speech from raw SSML.

    Args:
        ssml: SSML content wrapped in <speak>...</speak>
        language_code: Language code
        voice_name: Google voice name

    Returns:
        Audio bytes (LINEAR16, 24kHz)
    """
    client = get_tts_client()

    synthesis_input = texttospeech.SynthesisInput(ssml=ssml)
    voice = texttospeech.VoiceSelectionParams(
        language_code=language_code,
        name=voice_name
    )
    audio_config = texttospeech.AudioConfig(
        audio_encoding=texttospeech.AudioEncoding.LINEAR16,
        sample_rate_hertz=24000
    )

    response = client.synthesize_speech(
        request=texttospeech.SynthesizeSpeechRequest(
            input=synthesis_input,
            voice=voice,
            audio_config=audio_config,
        )
    )

    return response.audio_content
