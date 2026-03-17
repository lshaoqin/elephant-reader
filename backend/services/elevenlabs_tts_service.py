"""ElevenLabs Text-to-Speech service with word-level timestamps."""
import base64
import json
import os
import urllib.error
import urllib.request
import wave
from io import BytesIO

ELEVENLABS_API_BASE = "https://api.elevenlabs.io/v1"
DEFAULT_ELEVENLABS_MODEL_ID = "eleven_flash_v2_5"
DEFAULT_ELEVENLABS_VOICE_ID = "Xb7hH8MSUJpSbSDYk0k2"
DEFAULT_SAMPLE_RATE = 24000


class ElevenLabsTTSUnavailable(Exception):
    """Raised when ElevenLabs cannot be used and caller should fall back."""


class ElevenLabsRequestError(Exception):
    """Raised for ElevenLabs HTTP/API request errors."""

    def __init__(self, status_code: int, response_body: str):
        self.status_code = status_code
        self.response_body = response_body
        super().__init__(f"ElevenLabs HTTP {status_code}: {response_body}")


def _looks_like_wav(audio_bytes: bytes) -> bool:
    return len(audio_bytes) >= 12 and audio_bytes[:4] == b"RIFF" and audio_bytes[8:12] == b"WAVE"


def _looks_like_mp3(audio_bytes: bytes) -> bool:
    return (
        len(audio_bytes) >= 3 and audio_bytes[:3] == b"ID3"
    ) or (
        len(audio_bytes) >= 2 and audio_bytes[0] == 0xFF and (audio_bytes[1] & 0xE0) == 0xE0
    )


def _build_word_timestamps_from_alignment(alignment: dict) -> list[dict]:
    """Convert ElevenLabs character-level alignment into word timestamps."""
    if not alignment:
        return []

    chars = alignment.get("characters") or []
    starts = alignment.get("character_start_times_seconds") or []
    ends = alignment.get("character_end_times_seconds") or []

    if not chars or not starts or not ends:
        return []

    timestamps: list[dict] = []
    current_word = ""
    word_start = None
    word_end = None

    for i, ch in enumerate(chars):
        if i >= len(starts) or i >= len(ends):
            break

        if ch.isspace():
            if current_word:
                timestamps.append(
                    {
                        "word": current_word,
                        "start": float(word_start or 0.0),
                        "end": float(word_end or word_start or 0.0),
                    }
                )
                current_word = ""
                word_start = None
                word_end = None
            continue

        if not current_word:
            word_start = starts[i]

        current_word += ch
        word_end = ends[i]

    if current_word:
        timestamps.append(
            {
                "word": current_word,
                "start": float(word_start or 0.0),
                "end": float(word_end or word_start or 0.0),
            }
        )

    return timestamps


def _pcm_to_wav_bytes(pcm_data: bytes, sample_rate: int = DEFAULT_SAMPLE_RATE) -> bytes:
    """Wrap raw 16-bit mono PCM bytes into a WAV container."""
    output = BytesIO()
    with wave.open(output, "wb") as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(pcm_data)
    return output.getvalue()


def _request_json(api_key: str, url: str, payload: dict) -> dict:
    """Make a JSON POST request to ElevenLabs and return parsed JSON."""
    req = urllib.request.Request(
        url=url,
        data=json.dumps(payload).encode("utf-8"),
        method="POST",
        headers={
            "Content-Type": "application/json",
            "xi-api-key": api_key,
        },
    )

    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            response_body = response.read().decode("utf-8")
    except urllib.error.HTTPError as err:
        error_body = ""
        try:
            error_body = err.read().decode("utf-8")
        except Exception:
            error_body = str(err)
        raise ElevenLabsRequestError(err.code, error_body) from err

    try:
        return json.loads(response_body)
    except json.JSONDecodeError as err:
        raise ElevenLabsRequestError(502, "Invalid JSON response from ElevenLabs") from err


def generate_speech_with_word_level_timestamps(text: str):
    """Generate speech and word timestamps from ElevenLabs.

    Returns:
        tuple: (audio_bytes, word_timestamps, sample_rate, audio_mime_type)

    Raises:
        ElevenLabsTTSUnavailable: When ElevenLabs is unavailable, misconfigured,
            out of credits, or returns an invalid payload.
    """
    api_key = os.getenv("ELEVENLABS_API_KEY", "").strip()
    if not api_key:
        raise ElevenLabsTTSUnavailable("ELEVENLABS_API_KEY is not configured")

    # Free-plan safe default non-library voice; avoids extra voices-list API call.
    voice_id = DEFAULT_ELEVENLABS_VOICE_ID
    model_id = os.getenv("ELEVENLABS_MODEL_ID", DEFAULT_ELEVENLABS_MODEL_ID).strip() or DEFAULT_ELEVENLABS_MODEL_ID

    payload = {
        "text": text,
        "model_id": model_id,
        "output_format": "pcm_24000",
    }

    request_url = f"{ELEVENLABS_API_BASE}/text-to-speech/{voice_id}/with-timestamps"
    try:
        data = _request_json(api_key=api_key, url=request_url, payload=payload)
    except ElevenLabsRequestError as err:
        raise ElevenLabsTTSUnavailable(str(err)) from err
    except Exception as err:
        raise ElevenLabsTTSUnavailable(str(err)) from err

    audio_b64 = data.get("audio_base64")
    if not audio_b64:
        raise ElevenLabsTTSUnavailable("ElevenLabs response missing audio_base64")

    try:
        decoded_audio = base64.b64decode(audio_b64)
    except Exception as err:
        raise ElevenLabsTTSUnavailable("Invalid base64 audio from ElevenLabs") from err

    alignment = data.get("alignment") or data.get("normalized_alignment") or {}
    timestamps = _build_word_timestamps_from_alignment(alignment)

    if _looks_like_wav(decoded_audio):
        audio_bytes = decoded_audio
        audio_mime_type = "audio/wav"
    elif _looks_like_mp3(decoded_audio):
        audio_bytes = decoded_audio
        audio_mime_type = "audio/mpeg"
    else:
        # Fallback: treat as raw PCM and wrap into WAV for browser playback.
        audio_bytes = _pcm_to_wav_bytes(decoded_audio, DEFAULT_SAMPLE_RATE)
        audio_mime_type = "audio/wav"

    return audio_bytes, timestamps, DEFAULT_SAMPLE_RATE, audio_mime_type
