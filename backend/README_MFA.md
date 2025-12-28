# Montreal Forced Aligner Integration Setup

This guide explains how to set up and use the Montreal Forced Aligner (MFA) container for word-level timestamp generation.

## Prerequisites

- Docker and Docker Compose installed
- Python 3.10+
- The existing Flask backend setup

## Setup Instructions

### 1. Build and Run Containers

From the `backend/` directory, run:

```bash
docker-compose up -d
```

This will:
- Pull the official MFA container image
- Build the Flask app container
- Start both services on a shared network
- Flask app runs on port 5000

### 2. Download MFA Models (First Time Only)

Once the MFA container is running, download the required language models:

```bash
docker exec mfa_aligner mfa model download acoustic english_us_arpa
docker exec mfa_aligner mfa model download language_model english_us_arpa
```

This downloads the English US acoustic and language models which are used for alignment.

### 3. Test the Integration

Send a POST request to the `/tts` endpoint with the `use_alignment` flag:

```bash
curl -X POST http://localhost:5000/tts \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Hello world, this is a test.",
    "voice": "af_heart",
    "use_alignment": true
  }'
```

### Expected Response

```json
{
  "audio": "UklGRiYAAABXQVZFZm10IBAAAAABAAEAQB...",
  "sample_rate": 24000,
  "timestamps": [
    {"word": "Hello", "start": 0.0, "end": 0.245},
    {"word": "world", "start": 0.245, "end": 0.512},
    ...
  ]
}
```

## How It Works

1. **TTS Generation**: Text is converted to speech using Kokoro TTS (24kHz, WAV format)
2. **Audio File Creation**: Audio is saved to a temporary file
3. **MFA Alignment**: Montreal Forced Aligner processes the audio and transcript to generate word-level timing information
4. **Timestamp Extraction**: TextGrid output from MFA is parsed to extract start/end times for each word
5. **Fallback**: If MFA alignment fails, the system provides equal-duration timestamps as a fallback

## File Structure

```
backend/
├── app.py                 # Flask app with MFA integration
├── Dockerfile            # Flask app container
├── docker-compose.yml    # Orchestration file
├── requirements.txt      # Python dependencies
└── README_MFA.md        # This file
```

## Key Functions in app.py

- `align_text_with_mfa()`: Main function that calls MFA subprocess
- `_parse_textgrid()`: Parses MFA output TextGrid file
- `_create_fallback_timestamps()`: Creates equal-duration timestamps as fallback
- `text_to_speech()`: Updated to include timestamp generation

## Configuration

### In the `/tts` endpoint:
- `text` (required): Text to convert and align
- `voice` (optional): Kokoro voice ID, defaults to 'af_heart'
- `use_alignment` (optional): Whether to generate timestamps, defaults to true

### Environment Variables

None required, but ensure your `.env` file has:
- `GEMINI_API_KEY` for the format-text endpoint

## Troubleshooting

### "MFA not found" error
Make sure the MFA container is running:
```bash
docker-compose ps
```

### Model not found
Download the models inside the container:
```bash
docker exec mfa_aligner mfa model download acoustic english_us_arpa
docker exec mfa_aligner mfa model download language_model english_us_arpa
```

### Slow alignment
MFA can be slow on first run. Consider:
- Using the fallback timestamps for large texts
- Running alignment asynchronously in production
- Caching results for repeated texts

### Memory issues
If the containers run out of memory:
1. Limit text length (MFA struggles with very long texts)
2. Increase Docker's allocated memory
3. Consider running MFA on a separate machine

## Stopping Services

```bash
docker-compose down
```

To also remove volumes:
```bash
docker-compose down -v
```

## Next Steps

Consider implementing:
1. **Async alignment**: Use Celery or similar for long-running MFA jobs
2. **Caching**: Store alignment results to avoid re-processing identical texts
3. **Custom models**: Train MFA models on domain-specific language
4. **Multiple languages**: Download and use models for other languages
5. **WebSocket support**: Stream audio and timestamps in real-time
