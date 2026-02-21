"""Google Gemini service for text formatting and processing."""
import google.genai as genai
import json
import os
import re
from config import GEMINI_MODEL


# Initialize Gemini client
genai_client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))


def _extract_json_object(raw_text: str) -> dict:
    """Extract and parse JSON from Gemini response text."""
    if not raw_text:
        return {}

    try:
        return json.loads(raw_text)
    except json.JSONDecodeError:
        pass

    match = re.search(r"\{[\s\S]*\}", raw_text)
    if not match:
        return {}

    try:
        return json.loads(match.group(0))
    except json.JSONDecodeError:
        return {}


def format_text_with_gemini(raw_text: str) -> str:
    """Use Gemini to correct inaccuracies and format text for readability.
    
    Args:
        raw_text: Raw OCR text to be corrected and formatted.
        
    Returns:
        Formatted and corrected text.
    """
    try:
        prompt = f"""You are a text formatting expert. Please take the following OCR-extracted text and:

1. Correct any OCR inaccuracies or misspellings
2. Remove hyphens that result from words being split across lines (e.g., "hap-pened" -> "happened")
3. Add paragraph breaks where appropriate for readability and logical grouping
4. Bold section titles or headings using <b>text</b> format
5. Preserve the overall structure and meaning of the original text

IMPORTANT: Only format and correct the text provided. Do NOT generate, add, or expand content beyond what is given. Do NOT write articles, stories, or additional text.

Original OCR text:
{raw_text}

Please provide the corrected, formatted text only. Do not add any explanations, metadata, or additional content."""

        response = genai_client.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt
        )
        return response.text.strip()
    except Exception as e:
        # If Gemini fails, return original text
        print(f"Warning: Gemini formatting failed: {str(e)}")
        return raw_text


def get_word_learning_data(word: str, context_sentence: str = "") -> dict:
    """Generate a child-friendly definition and syllable breakdown for a word.

    Args:
        word: Target word.
        context_sentence: Optional sentence where the word appears.

    Returns:
        Dict with keys: simple_definition, example_sentence, syllables, part_of_speech.
    """
    sentence_context = context_sentence.strip() if context_sentence else ""
    context_block = sentence_context if sentence_context else "(No sentence context provided)"

    prompt = f"""You are a literacy tutor for primary school students.

Given this target word and optional sentence context, return a short, simple explanation.

Target word: {word}
Sentence context: {context_block}

Return ONLY valid JSON with this exact shape:
{{
  "word": "{word}",
  "simple_definition": "A clear, child-friendly definition in one short sentence.",
    "example_sentence": "A short example sentence suitable for a primary school student.",
  "part_of_speech": "noun|verb|adjective|adverb|other",
  "syllables": ["syll", "a", "bles"]
}}

Rules:
- Keep simple_definition to maximum 20 words.
- Keep example_sentence to maximum 12 words.
- Choose meaning that best matches the sentence context when available.
- syllables must be in speaking order and when joined should reconstruct the spoken word.
- Do not include markdown or extra text.
"""

    try:
        response = genai_client.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt
        )
        parsed = _extract_json_object(response.text.strip() if response.text else "")
        if parsed:
            return parsed
    except Exception as e:
        print(f"Warning: Gemini word learning data failed: {str(e)}")

    return {
        "word": word,
        "simple_definition": "A word used in this sentence.",
        "example_sentence": f"I use the word {word} every day.",
        "part_of_speech": "other",
        "syllables": [word]
    }


def get_word_hunt_activity(text: str) -> dict:
    """Generate a primary-school phonics word-hunt activity from passage text.

    Returns:
        Dict containing question, correct_words, and feedback details.
    """
    prompt = f"""You are creating a simple word-hunt mini-game for dyslexic primary-school learners.

Passage text:
{text}

Create ONE short, child-friendly word-hunt question.
Questions should avoid technical terms like "digraph" or "phoneme".
Good style examples:
- "Find words that start with 'sh'."
- "Find all the names in the passage."

Return ONLY valid JSON with this exact shape:
{{
    "question": "Find words that start with 'sh'.",
  "correct_words": ["blue", "black"],
  "completion_feedback": "Amazing work! You found all the words.",
    "phoneme_ssml": "Optional SSML string for playing a sound prompt, or empty string"
}}

Rules:
- Keep question simple and short.
- correct_words must be words that appear in the provided passage text.
- Include 2 to 8 words in correct_words.
- Deduplicate correct_words and keep original spelling from the passage.
- completion_feedback must be positive and child-friendly.
- phoneme_ssml is optional. Use it only when a sound prompt genuinely helps. If used, it must be valid SSML wrapped in <speak>...</speak>.
- No markdown or extra text.
"""

    try:
        response = genai_client.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt
        )
        parsed = _extract_json_object(response.text.strip() if response.text else "")
        if parsed:
            return parsed
    except Exception as e:
        print(f"Warning: Gemini word hunt generation failed: {str(e)}")

    fallback_words = []
    for token in re.findall(r"[A-Za-z][A-Za-z'-]*", text):
        if token.lower().startswith("bl"):
            fallback_words.append(token)
        if len(fallback_words) >= 4:
            break

    if not fallback_words:
        for token in re.findall(r"[A-Za-z][A-Za-z'-]*", text):
            fallback_words.append(token)
            if len(fallback_words) >= 4:
                break

    return {
        "question": "Find words that start with 'bl'.",
        "correct_words": fallback_words,
        "completion_feedback": "Excellent work! You found the target words.",
        "phoneme_ssml": ""
    }
