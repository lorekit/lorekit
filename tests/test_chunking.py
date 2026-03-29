"""Tests for the text chunking utility."""

from __future__ import annotations

from lorekit.sources.chunker import chunk_text


def test_chunk_short_text():
    """Text shorter than max_tokens returns a single chunk."""
    text = "This is a short text with just a few words."
    chunks = chunk_text(text, max_tokens=500)
    assert len(chunks) == 1
    assert chunks[0]["index"] == 0
    assert chunks[0]["content"] == text
    assert chunks[0]["token_count"] == len(text.split())


def test_chunk_long_text():
    """Text that exceeds max_tokens splits into multiple chunks."""
    # Create a text with 100 words
    words = [f"word{i}" for i in range(100)]
    text = " ".join(words)

    chunks = chunk_text(text, max_tokens=30, overlap_tokens=5)
    assert len(chunks) > 1

    # Each chunk (except possibly the last) should have at most 30 words
    for chunk in chunks[:-1]:
        assert chunk["token_count"] <= 30

    # Indices should be sequential
    for i, chunk in enumerate(chunks):
        assert chunk["index"] == i


def test_chunk_overlap():
    """Verify overlapping content between consecutive chunks."""
    words = [f"word{i}" for i in range(50)]
    text = " ".join(words)

    chunks = chunk_text(text, max_tokens=20, overlap_tokens=5)
    assert len(chunks) >= 2

    # Check that consecutive chunks share some words (the overlap)
    for i in range(len(chunks) - 1):
        words_a = chunks[i]["content"].split()
        words_b = chunks[i + 1]["content"].split()
        # The last `overlap_tokens` words of chunk A should appear
        # at the start of chunk B
        overlap_from_a = words_a[-5:]
        start_of_b = words_b[:5]
        assert overlap_from_a == start_of_b, (
            f"Expected overlap between chunk {i} and {i+1}: "
            f"{overlap_from_a} != {start_of_b}"
        )


def test_chunk_empty_text():
    """Empty string returns empty list."""
    assert chunk_text("") == []
    assert chunk_text("   ") == []
    assert chunk_text("", max_tokens=10) == []
