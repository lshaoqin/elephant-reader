# """Kokoro TTS service for text-to-speech generation."""
# from kokoro import KPipeline
# from config import TTS_LANG_CODE


# # Global TTS pipeline instance
# tts_pipeline = None


# def get_tts_pipeline():
#     """Lazy load TTS pipeline on first use.
    
#     Returns:
#         KPipeline instance for text-to-speech generation
#     """
#     global tts_pipeline
#     if tts_pipeline is None:
#         tts_pipeline = KPipeline(lang_code=TTS_LANG_CODE)
#     return tts_pipeline


# def generate_speech(text: str, voice: str = 'af_heart'):
#     """Generate speech from text using Kokoro TTS.
    
#     Args:
#         text: Text to convert to speech
#         voice: Voice ID to use (default: 'af_heart')
        
#     Returns:
#         Generator yielding audio chunks
#     """
#     pipeline = get_tts_pipeline()
#     return pipeline(text, voice=voice)
