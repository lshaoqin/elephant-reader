"""Utility functions for audio processing."""
import base64
import io
import numpy as np
import soundfile as sf


def audio_to_base64(audio_data: np.ndarray, sample_rate: int = 24000) -> str:
    """Convert audio numpy array to base64 encoded WAV string.
    
    Args:
        audio_data: Numpy array containing audio samples
        sample_rate: Sample rate of the audio
        
    Returns:
        Base64 encoded audio string
    """
    audio_buffer = io.BytesIO()
    sf.write(audio_buffer, audio_data, sample_rate, format='WAV')
    audio_bytes = audio_buffer.getvalue()
    return base64.b64encode(audio_bytes).decode('utf-8')


def audio_to_bytes(audio_data: np.ndarray, sample_rate: int = 24000) -> bytes:
    """Convert audio numpy array to WAV bytes.
    
    Args:
        audio_data: Numpy array containing audio samples
        sample_rate: Sample rate of the audio
        
    Returns:
        Audio in WAV format as bytes
    """
    audio_buffer = io.BytesIO()
    sf.write(audio_buffer, audio_data, sample_rate, format='WAV')
    return audio_buffer.getvalue()
