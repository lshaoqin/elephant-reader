"""Online lookup helpers for word illustrations."""
import html
import json
import re
import urllib.parse
import urllib.request

from services.gemini_service import get_word_illustration_search_query

WIKIPEDIA_SUMMARY_API = "https://en.wikipedia.org/api/rest_v1/page/summary"


def _fetch_json(url: str, timeout: int = 8) -> dict:
    req = urllib.request.Request(
        url,
        headers={
            "Accept": "application/json",
            "User-Agent": "fyp-word-helper/1.0",
        },
    )
    with urllib.request.urlopen(req, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def _fetch_text(url: str, timeout: int = 8) -> str:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
            "Accept-Language": "en-US,en;q=0.9",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
    )
    with urllib.request.urlopen(req, timeout=timeout) as response:
        return response.read().decode("utf-8", errors="ignore")


def _candidate_titles(word: str) -> list[str]:
    cleaned = (word or "").strip()
    if not cleaned:
        return []

    candidates = [
        cleaned,
        cleaned.lower(),
        cleaned.capitalize(),
        cleaned.title(),
    ]

    unique_candidates = []
    seen = set()
    for title in candidates:
        normalized = title.lower()
        if normalized in seen:
            continue
        seen.add(normalized)
        unique_candidates.append(title)
    return unique_candidates


def _build_contextual_search_query(word: str, context_sentence: str = "", language_code: str = "en") -> str:
    """Build a concise, context-aware image search query without depending on a live Gemini response."""
    cleaned_word = (word or "").strip()
    if not cleaned_word:
        return "real photo"

    context = str(context_sentence or "").strip()
    tokens = re.findall(r"[A-Za-z][A-Za-z'-]{2,}", context.lower()) if context else []
    stop_words = {
        "the", "and", "with", "that", "this", "into", "from", "over", "under", "after",
        "before", "while", "through", "there", "their", "them", "they", "themself", "your",
        "yours", "ours", "our", "about", "around", "during", "without", "within", "because",
        "where", "when", "what", "which", "whose", "some", "many", "more", "most", "have",
        "has", "had", "was", "were", "been", "being", "will", "would", "could", "should",
        "did", "does", "done", "very", "also", "just", "then", "than", "such", "these",
        "those", "again", "once", "only", "other", "another", "each", "every", "same",
        "make", "made", "look", "looks", "like", "said", "says", "saw", "seen", "words",
        "word", "people", "person", "child", "children",
    }

    relevant = []
    for token in tokens:
        if token == cleaned_word.lower():
            continue
        if token in stop_words:
            continue
        if len(token) < 3:
            continue
        if token.endswith(("ly", "ing", "ed")):
            continue
        if token not in relevant:
            relevant.append(token)

    query_parts = [cleaned_word]
    query_parts.extend(relevant[:4])
    query_parts.extend(["real photo", "non ai"])
    query = " ".join(query_parts)
    if len(query.split()) < 4:
        query = f"{cleaned_word} real photo non ai"
    return query.strip()


def _search_online_image_results(query: str) -> list[dict]:
    """Search the web for a real-world image result and return image + source metadata."""
    encoded_query = urllib.parse.quote_plus(query)
    search_url = f"https://www.bing.com/images/search?q={encoded_query}&form=HDRSC2"

    try:
        html_text = _fetch_text(search_url, timeout=12)
    except Exception:
        return []

    image_matches = re.findall(r'"murl":"(https?://[^"\\]+)"', html_text)
    page_matches = re.findall(r'"purl":"(https?://[^"\\]+)"', html_text)
    title_matches = re.findall(r'"t":"([^"]+)"', html_text)

    if not image_matches:
        return []

    results = []
    seen = set()
    max_items = min(len(image_matches), len(page_matches) if page_matches else len(image_matches))
    for index in range(max_items):
        image_url = html.unescape(image_matches[index]).replace("\\/", "/").replace("\\u0026", "&")
        page_url = html.unescape(page_matches[index]).replace("\\/", "/").replace("\\u0026", "&") if index < len(page_matches) else ""
        title = html.unescape(title_matches[index]).replace("\\/", "/") if index < len(title_matches) else ""

        if not image_url or image_url in seen:
            continue
        seen.add(image_url)

        if image_url.lower().endswith((".gif", ".svg")):
            continue

        source_label = "Web source"
        if page_url:
            parsed_host = urllib.parse.urlparse(page_url).netloc.lower().replace("www.", "")
            source_label = parsed_host.split(".")[0].replace("-", " ").title() if parsed_host else source_label

        lower_title = title.lower()
        if any(token in lower_title for token in ["ai generated", "generated by ai", "dall-e", "midjourney", "stable diffusion", "illustration", "clip art", "cartoon"]):
            continue

        results.append({
            "image_url": image_url,
            "page_url": page_url or "https://www.bing.com/images/search?q=" + encoded_query,
            "title": title or query,
            "source": source_label,
            "source_name": source_label,
        })

    return results


def fetch_word_illustration(word: str, context_sentence: str = "", language_code: str = "en") -> dict | None:
    """Get a real-world illustration for the target word using contextual web search.

    Gemini is used as a controller to choose a more precise query and we prefer a non-AI-generated
    photograph or factual image rather than a direct Wikimedia thumbnail lookup.
    """
    query = get_word_illustration_search_query(word, context_sentence=context_sentence, language_code=language_code)
    if not query:
        query = _build_contextual_search_query(word, context_sentence, language_code)

    for result in _search_online_image_results(query):
        return {
            "image_url": result["image_url"],
            "page_url": result["page_url"],
            "title": result["title"],
            "source": result["source"],
            "source_name": result["source_name"],
            "source_url": result["page_url"],
        }

    for title in _candidate_titles(word):
        try:
            encoded_title = urllib.parse.quote(title)
            data = _fetch_json(f"{WIKIPEDIA_SUMMARY_API}/{encoded_title}")
        except Exception:
            continue

        thumbnail = data.get("thumbnail") or {}
        image_url = thumbnail.get("source")
        if not image_url:
            continue

        content_urls = data.get("content_urls") or {}
        desktop = content_urls.get("desktop") or {}
        page_url = desktop.get("page")

        return {
            "image_url": image_url,
            "page_url": page_url,
            "title": data.get("title") or title,
            "source": "Wikipedia",
            "source_name": "Wikipedia",
            "source_url": page_url,
        }

    return None
