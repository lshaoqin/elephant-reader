"""Google Gemini service for text formatting and processing."""
import google.genai as genai
import os
from config import GEMINI_MODEL


# Initialize Gemini client
genai_client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))


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
4. Bold section titles or headings using **text** format
5. Preserve the overall structure and meaning of the original text

Original OCR text:
{raw_text}

Please provide the corrected, formatted text only. Do not add any explanations or metadata."""

        response = genai_client.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt
        )
        return response.text.strip()
    except Exception as e:
        # If Gemini fails, return original text
        print(f"Warning: Gemini formatting failed: {str(e)}")
        return raw_text
