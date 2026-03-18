"""Wikimedia lookup helpers for word illustrations."""
import json
import urllib.parse
import urllib.request

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

    # Preserve order while removing duplicates.
    unique_candidates = []
    seen = set()
    for title in candidates:
        normalized = title.lower()
        if normalized in seen:
            continue
        seen.add(normalized)
        unique_candidates.append(title)
    return unique_candidates


def fetch_word_illustration(word: str) -> dict | None:
    """Get an image and page URL for a word from Wikipedia summary API.

    Returns None when no thumbnail is available.
    """
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
            "source": "wikimedia",
        }

    return None
