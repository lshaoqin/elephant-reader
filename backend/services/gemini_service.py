"""Google Gemini service for text formatting and processing."""
import google.genai as genai
import json
import os
import re
from config import GEMINI_MODEL


# Initialize Gemini client
genai_client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
WORD_HUNT_MODEL = "gemini-2.5-flash"


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
  "part_of_speech": "noun|verb|adjective|adverb|other"
}}

Rules:
- Keep simple_definition to maximum 20 words.
- Keep example_sentence to maximum 12 words.
- Choose meaning that best matches the sentence context when available.
- Do not include markdown or extra text.
"""

    try:
        response = genai_client.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt
        )
    except Exception as e:
        raise RuntimeError(f"Gemini word learning data failed: {str(e)}") from e

    parsed = _extract_json_object(response.text.strip() if response.text else "")
    if not parsed:
        raise RuntimeError("Gemini word learning data failed: empty or invalid JSON response")

    return parsed


def get_word_hunt_vocabulary_data(text: str, excluded_words: list[str] | None = None) -> dict:
    """Generate a vocabulary-style word hunt question from source text.

    Returns:
        Dict with keys: question, correct_words, completion_feedback.
    """
    cleaned_text = (text or "").strip()
    if not cleaned_text:
        raise ValueError("No text provided for vocabulary word hunt")

    filtered_excluded = [str(word).strip() for word in (excluded_words or []) if str(word).strip()]
    excluded_block = ", ".join(filtered_excluded) if filtered_excluded else "(none)"

    prompt = f"""You are creating a child-friendly vocabulary word-hunt game.

Given this source text, choose one meaningful vocabulary word that appears exactly in the source text.
Then write a simple clue/definition and game feedback.

Source text:
{cleaned_text}

Words you MUST NOT choose as the target word:
{excluded_block}

Return ONLY valid JSON in this exact shape:
{{
  "question": "Tap the word that means ...",
  "correct_words": ["exact-word-from-source-text"],
  "completion_feedback": "Short encouraging feedback sentence."
}}

Rules:
- Use exactly one target word in correct_words.
- The target word must be copied exactly from the source text spelling.
- Do not choose any word listed in the forbidden words list above.
- Keep question under 18 words.
- Keep completion_feedback under 14 words.
- Do not include markdown or extra keys.
"""

    try:
        response = genai_client.models.generate_content(
            model=WORD_HUNT_MODEL,
            contents=prompt
        )
    except Exception as e:
        raise RuntimeError(f"Gemini vocabulary word hunt failed: {str(e)}") from e

    parsed = _extract_json_object(response.text.strip() if response.text else "")
    if not parsed:
        raise RuntimeError("Gemini vocabulary word hunt failed: empty or invalid JSON response")

    question = str(parsed.get("question", "")).strip()
    completion_feedback = str(parsed.get("completion_feedback", "")).strip()
    words = parsed.get("correct_words")

    if not isinstance(words, list):
        raise RuntimeError("Gemini vocabulary word hunt failed: correct_words must be a list")

    correct_words = [str(word).strip() for word in words if str(word).strip()]
    if not question or not completion_feedback or not correct_words:
        raise RuntimeError("Gemini vocabulary word hunt failed: missing required fields")

    return {
        "question": question,
        "correct_words": correct_words[:1],
        "completion_feedback": completion_feedback,
    }


