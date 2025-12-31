"""Utility functions for text processing."""
from typing import List


def split_text_into_words(text: str) -> List[str]:
    """Split text into words, preserving punctuation awareness.
    
    Args:
        text: Text to split into words
        
    Returns:
        List of words
    """
    words = text.split()
    return [w for w in words if w]  # Remove empty strings


def clean_text_for_alignment(text: str) -> str:
    """Remove markdown formatting and clean text for alignment.
    
    Args:
        text: Text to clean
        
    Returns:
        Cleaned text
    """
    import re
    clean_text = re.sub(r'\*\*(.+?)\*\*', r'\1', text)  # Remove bold markers
    clean_text = re.sub(r'\*(.+?)\*', r'\1', clean_text)  # Remove italic markers
    return clean_text.strip()
