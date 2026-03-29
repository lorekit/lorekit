"""Text chunking utility for splitting documents into overlapping chunks."""

from __future__ import annotations


def chunk_text(
    text: str,
    max_tokens: int = 500,
    overlap_tokens: int = 50,
) -> list[dict]:
    """Split text into overlapping chunks.

    Uses simple whitespace tokenization (~1 token per word).

    Returns list of dicts with keys: index (int), content (str), token_count (int).
    """
    if not text or not text.strip():
        return []

    words = text.split()
    if not words:
        return []

    # If text fits in a single chunk, return it directly
    if len(words) <= max_tokens:
        return [{"index": 0, "content": text.strip(), "token_count": len(words)}]

    chunks: list[dict] = []
    start = 0
    chunk_index = 0

    while start < len(words):
        end = min(start + max_tokens, len(words))
        chunk_words = words[start:end]
        chunk_content = " ".join(chunk_words)

        chunks.append({
            "index": chunk_index,
            "content": chunk_content,
            "token_count": len(chunk_words),
        })

        chunk_index += 1

        # Move forward by (max_tokens - overlap_tokens) to create overlap
        step = max_tokens - overlap_tokens
        if step <= 0:
            step = max_tokens  # Prevent infinite loop if overlap >= max_tokens
        start += step

        # If we've already consumed all words, stop
        if end >= len(words):
            break

    return chunks
