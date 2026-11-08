"""Google Gemini service for text formatting and processing."""
import json
import os
import re

try:
    import google.genai as genai
except ImportError:  # pragma: no cover - optional dependency in local/test environments
    genai = None

from config import GEMINI_MODEL


# Initialize Gemini client
genai_client = genai.Client(api_key=os.getenv("GEMINI_API_KEY")) if genai and os.getenv("GEMINI_API_KEY") else None
WORD_HUNT_MODEL = "gemini-3.5-flash"
ILLUSTRATION_SEARCH_MODEL = "gemini-3.6-flash"


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


def get_word_learning_data(word: str, context_sentence: str = "", language_code: str = "en") -> dict:
    """Generate a child-friendly definition and syllable breakdown for a word.

    Args:
        word: Target word.
        context_sentence: Optional sentence where the word appears.
        language_code: BCP-47 language code (e.g. "en", "ms-MY").

    Returns:
        Dict with keys: simple_definition, example_sentence, syllables, part_of_speech.
    """
    sentence_context = context_sentence.strip() if context_sentence else ""
    context_block = sentence_context if sentence_context else "(No sentence context provided)"

    is_malay = language_code and language_code.startswith("ms")

    if is_malay:
        prompt = f"""Anda seorang tutor literasi untuk murid sekolah rendah.

Berdasarkan perkataan sasaran dan konteks ayat yang diberikan, berikan penerangan yang ringkas dan mudah difahami.

Perkataan sasaran: {word}
Konteks ayat: {context_block}

Kembalikan JSON SAHAJA dengan format tepat berikut:
{{
  "word": "{word}",
  "simple_definition": "Definisi ringkas yang mudah difahami oleh kanak-kanak dalam satu ayat.",
  "example_sentence": "Ayat contoh pendek yang sesuai untuk murid sekolah rendah.",
  "part_of_speech": "kata_nama|kata_kerja|kata_sifat|kata_keterangan|lain"
}}

Peraturan:
- simple_definition maksimum 20 patah perkataan.
- example_sentence maksimum 12 patah perkataan.
- Jangan sertakan markah atau teks tambahan.
"""
    else:
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


def get_word_illustration_search_query(word: str, context_sentence: str = "", language_code: str = "en") -> str:
    """Generate a context-aware search query for a real-world illustration.

    The returned query is used by the image search service to look for a non-AI-generated
    photograph matching the intended word meaning in context.
    """
    cleaned_word = (word or "").strip()
    if not cleaned_word:
        return "real photo"

    sentence_context = str(context_sentence or "").strip()
    context_block = sentence_context if sentence_context else "(No sentence context provided)"
    is_malay = language_code and language_code.startswith("ms")

    if is_malay:
        prompt = f"""Anda seorang pembantu carian imej yang memastikan hasilnya ialah foto sebenar, bukan imej yang dijana AI.

Berdasarkan perkataan sasaran dan konteks ayat, cipta satu pertanyaan carian web yang sangat tepat untuk mencari foto sebenar yang sesuai dengan maksud perkataan itu.

Perkataan sasaran: {cleaned_word}
Konteks ayat: {context_block}

Kembalikan JSON SAHAJA dengan format tepat berikut:
{{
  "search_query": "query carian pendek dan tepat yang merangkumi maksud yang betul sahaja"
}}

Peraturan:
- Fokus pada maksud yang tepat dalam konteks, bukan makna umum yang lain.
- Gunakan istilah sebenar seperti objek, tindakan, atau tempat yang relevan.
- Sertakan kata kunci seperti 'real photo' atau 'photograph' jika perlu.
- Elakkan imej yang dijana AI, ilustrasi kartun, atau hasil generatif.
- Jangan sertakan markdown atau teks tambahan.
"""
    else:
        prompt = f"""You are a search-planning assistant for finding real-world photos, not AI-generated images.

Based on the target word and sentence context, create a highly specific web search query that matches the intended meaning of the word in context.

Target word: {cleaned_word}
Sentence context: {context_block}

Return ONLY valid JSON in this exact shape:
{{
  "search_query": "short, precise search query for the intended meaning"
}}

Rules:
- Focus on the correct meaning in context, not a generic definition.
- Use real-world objects, actions, or places that match the sentence.
- Include 'real photo' or 'photograph' when helpful.
- Avoid AI-generated images, cartoons, clip art, or generative art.
- Do not include markdown or extra text.
"""

    try:
        if not genai_client:
            raise RuntimeError("Gemini SDK is not configured")

        response = genai_client.models.generate_content(
            model=ILLUSTRATION_SEARCH_MODEL,
            contents=prompt,
        )
        parsed = _extract_json_object(response.text.strip() if response.text else "")
        if isinstance(parsed, dict) and str(parsed.get("search_query", "")).strip():
            return str(parsed["search_query"]).strip()
    except Exception:
        pass

    fallback = _build_contextual_search_query(cleaned_word, sentence_context, language_code)
    return fallback


def build_phonics_word_hunt_prompt(text: str, excluded_words: list[str] | None = None, language_code: str = "en") -> str:
    """Build a child-friendly phonics prompt that prefers multiple matching answers and simple wording."""
    cleaned_text = (text or "").strip()
    filtered_excluded = [str(word).strip() for word in (excluded_words or []) if str(word).strip()]
    excluded_block = ", ".join(filtered_excluded) if filtered_excluded else "(none)"
    is_malay = language_code and language_code.startswith("ms")

    if is_malay:
        return f"""Anda sedang menghasilkan permainan word hunt fonik yang mudah untuk murid sekolah rendah.

Pilih satu pola bunyi yang terdapat di dalam teks dan mempunyai lebih daripada satu perkataan yang sepadan. Ini boleh jadi bunyi awal, bunyi akhir, gabungan huruf, bunyi vokal, atau pola bunyi yang mudah dilihat.
Minta murid cari 2 hingga 5 perkataan yang sama bunyi. Jangan buat soalan yang hanya ada satu jawapan.
Gunakan bahasa yang ringkas dan mudah untuk kanak-kanak. Elakkan istilah teknikal yang susah seperti "phoneme" atau "grapheme".

Teks sumber:
{cleaned_text}

Perkataan yang TIDAK BOLEH dipilih:
{excluded_block}

Kembalikan JSON SAHAJA dengan format tepat berikut:
{{
  "question": "Ketuk perkataan yang ...",
  "correct_words": ["perkataan-1", "perkataan-2", "perkataan-3"],
  "completion_feedback": "Ayat maklum balas pendek yang menggalakkan.",
  "encouragement_prompt": "Ayat pendek yang menggalakkan murid terus mencuba.",
  "tip": "Tip mudah untuk membantu murid mencari jawapan."
}}

Peraturan:
- Pilih 2 hingga 5 perkataan yang sepadan dalam correct_words.
- Semua perkataan mesti tepat seperti dalam teks sumber.
- Jangan pilih perkataan dalam senarai larangan.
- Soalan mesti ringkas, jelas, dan mudah difahami murid sekolah rendah.
- Soalan maksimum 18 patah perkataan.
- completion_feedback maksimum 14 patah perkataan.
- encouragement_prompt maksimum 12 patah perkataan.
- tip maksimum 16 patah perkataan.
- Jangan guna istilah teknikal yang terlalu sukar.
- Jangan sertakan markah atau kunci tambahan.
"""

    return f"""You are creating a simple phonics word-hunt game for primary school children.

Choose a sound pattern that appears in the source text and has more than one matching word. Good choices are beginning sounds, ending sounds, blends, digraphs, vowel patterns, or any easy sound family children can spot.
Aim for 2 to 5 correct answers, not just one. Keep the question simple, short, and easy for young children to understand.
Use everyday school language. Avoid technical terms like "phoneme" or "grapheme".
Your "tip" must give concrete examples of other words with this same sound feature, using simple everyday words when possible.

Source text:
{cleaned_text}

Words you MUST NOT choose as targets:
{excluded_block}

Return ONLY valid JSON in this exact shape:
{{
  "question": "Tap the words with the ... sound",
  "correct_words": ["word-1", "word-2", "word-3"],
  "completion_feedback": "Short encouraging feedback sentence.",
  "encouragement_prompt": "Short sentence encouraging the child to keep trying.",
  "tip": "Tip with 1 or 2 example words that share the same sound feature, like 'sun, run' or 'ship, shop'."
}}

Rules:
- Choose 2 to 5 matching words in correct_words.
- Every target word must be copied exactly from the source text.
- Do not choose any word listed in the forbidden words list above.
- Keep the question clear, short, and child-friendly.
- Keep question under 18 words.
- Keep completion_feedback under 14 words.
- Keep encouragement_prompt under 12 words.
- Keep tip under 22 words.
- The tip should include example words that share the same feature, not just a general hint.
- Use simple primary-school wording, not technical phonics language.
- Do not include markdown or extra keys.
"""


def get_word_hunt_vocabulary_data(text: str, excluded_words: list[str] | None = None, language_code: str = "en") -> dict:
    """Generate a vocabulary-style word hunt question from source text."""
    cleaned_text = (text or "").strip()
    if not cleaned_text:
        raise ValueError("No text provided for vocabulary word hunt")

    filtered_excluded = [str(word).strip() for word in (excluded_words or []) if str(word).strip()]
    excluded_block = ", ".join(filtered_excluded) if filtered_excluded else "(none)"

    is_malay = language_code and language_code.startswith("ms")

    if is_malay:
        prompt = f"""Anda sedang mencipta permainan cari perkataan (word hunt) untuk kanak-kanak.

Berdasarkan teks sumber ini, pilih satu perkataan bermakna yang muncul tepat dalam teks sumber.
Kemudian tulis satu petunjuk/definisi mudah, ayat galakan, dan tip ringkas untuk membantu murid.

Teks sumber:
{cleaned_text}

Perkataan yang TIDAK BOLEH dipilih sebagai perkataan sasaran:
{excluded_block}

Kembalikan JSON SAHAJA dengan format tepat berikut:
{{
  "question": "Ketuk perkataan yang bermaksud ...",
  "correct_words": ["perkataan-tepat-dari-teks-sumber"],
  "completion_feedback": "Ayat maklum balas pendek yang menggalakkan.",
  "encouragement_prompt": "Ayat pendek yang menggalakkan murid meneruskan usaha.",
  "tip": "Tip ringkas untuk membantu murid mencari jawapan."
}}

Peraturan:
- Gunakan tepat satu perkataan sasaran dalam correct_words.
- Perkataan sasaran mesti disalin tepat dari teks sumber.
- Jangan pilih perkataan yang tersenarai dalam senarai perkataan larangan di atas.
- Soalan maksimum 18 patah perkataan.
- completion_feedback maksimum 14 patah perkataan.
- encouragement_prompt maksimum 12 patah perkataan.
- tip maksimum 16 patah perkataan.
- Jangan sertakan markah atau kunci tambahan.
"""
    else:
        prompt = f"""You are creating a child-friendly vocabulary word-hunt game.

Given this source text, choose one meaningful vocabulary word that appears exactly in the source text.
Then write a simple clue/definition, an encouraging line, and a short tip for the child.

Source text:
{cleaned_text}

Words you MUST NOT choose as the target word:
{excluded_block}

Return ONLY valid JSON in this exact shape:
{{
  "question": "Tap the word that means ...",
  "correct_words": ["exact-word-from-source-text"],
  "completion_feedback": "Short encouraging feedback sentence.",
  "encouragement_prompt": "Short sentence encouraging the child to keep trying.",
  "tip": "A simple tip to help find the answer."
}}

Rules:
- Use exactly one target word in correct_words.
- The target word must be copied exactly from the source text spelling.
- Do not choose any word listed in the forbidden words list above.
- Keep question under 18 words.
- Keep completion_feedback under 14 words.
- Keep encouragement_prompt under 12 words.
- Keep tip under 16 words.
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
    encouragement_prompt = str(parsed.get("encouragement_prompt", "") or parsed.get("encouragement", "")).strip()
    tip = str(parsed.get("tip", "")).strip()
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
        "encouragement_prompt": encouragement_prompt or completion_feedback,
        "tip": tip or "Keep looking for the word pattern.",
    }


def get_word_hunt_phonics_data(text: str, excluded_words: list[str] | None = None, language_code: str = "en") -> dict:
    """Generate a flexible phonics-based word hunt question from source text."""
    cleaned_text = (text or "").strip()
    if not cleaned_text:
        raise ValueError("No text provided for phonics word hunt")

    prompt = build_phonics_word_hunt_prompt(cleaned_text, excluded_words=excluded_words, language_code=language_code)

    try:
        response = genai_client.models.generate_content(
            model=WORD_HUNT_MODEL,
            contents=prompt,
        )
    except Exception as e:
        raise RuntimeError(f"Gemini phonics word hunt failed: {str(e)}") from e

    parsed = _extract_json_object(response.text.strip() if response.text else "")
    if not parsed:
        raise RuntimeError("Gemini phonics word hunt failed: empty or invalid JSON response")

    question = str(parsed.get("question", "")).strip()
    completion_feedback = str(parsed.get("completion_feedback", "")).strip()
    encouragement_prompt = str(parsed.get("encouragement_prompt", "") or parsed.get("encouragement", "")).strip()
    tip = str(parsed.get("tip", "")).strip()
    words = parsed.get("correct_words")

    if not isinstance(words, list):
        raise RuntimeError("Gemini phonics word hunt failed: correct_words must be a list")

    correct_words = list(dict.fromkeys(str(word).strip() for word in words if str(word).strip()))
    if not question or not completion_feedback or len(correct_words) < 2:
        raise RuntimeError("Gemini phonics word hunt failed: missing required fields or not enough matching words")

    return {
        "question": question,
        "correct_words": correct_words[:5],
        "completion_feedback": completion_feedback,
        "encouragement_prompt": encouragement_prompt or completion_feedback,
        "tip": tip or "Look for the shared sound in each word.",
    }


