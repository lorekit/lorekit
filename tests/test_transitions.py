"""Tests for the transition registry and filter builder."""

from __future__ import annotations

import pytest

from lorekit.assembly.transitions import (
    BEAT_TRANSITION_MAP,
    TRANSITION_LOOKUP,
    TRANSITION_TYPES,
    build_transition_filter,
)


def test_transition_registry_complete():
    """Verify TRANSITION_LOOKUP contains all keys from all groups."""
    expected_keys: set[str] = set()
    for group in TRANSITION_TYPES.values():
        expected_keys.update(group.keys())

    assert set(TRANSITION_LOOKUP.keys()) == expected_keys
    # Verify minimum expected transitions exist
    assert "fade" in TRANSITION_LOOKUP
    assert "hard_cut" in TRANSITION_LOOKUP
    assert "fadewhite" in TRANSITION_LOOKUP
    assert "zoomin" in TRANSITION_LOOKUP
    assert "slideleft" in TRANSITION_LOOKUP
    assert "wipeleft" in TRANSITION_LOOKUP
    assert "circleopen" in TRANSITION_LOOKUP
    assert "diagtl" in TRANSITION_LOOKUP
    assert "hlwind" in TRANSITION_LOOKUP


def test_transition_lookup_structure():
    """Each transition entry should have label, ffmpeg, duration keys."""
    for key, info in TRANSITION_LOOKUP.items():
        assert "label" in info, f"{key} missing 'label'"
        assert "ffmpeg" in info, f"{key} missing 'ffmpeg'"
        assert "duration" in info, f"{key} missing 'duration'"
        # ffmpeg is either None (hard_cut) or a string
        assert info["ffmpeg"] is None or isinstance(info["ffmpeg"], str)
        assert isinstance(info["duration"], (int, float))


def test_build_filter_default():
    """Build filter with no transitions specified — should use fade for all."""
    result = build_transition_filter(
        clip_count=3,
        durations=[3.0, 3.0, 3.0],
    )
    assert result != ""
    # Should have 2 xfade operations for 3 clips
    assert result.count("xfade=") == 2
    # All should be transition=fade
    assert result.count("transition=fade") == 2
    # Should have proper labels
    assert "[v0]" in result
    assert "[v1]" in result
    assert "[v2]" in result
    assert "[vout]" in result


def test_build_filter_single_clip():
    """Single clip should return empty string."""
    result = build_transition_filter(clip_count=1, durations=[5.0])
    assert result == ""


def test_build_filter_per_scene():
    """Build filter with mixed transitions — each xfade should use the right type."""
    result = build_transition_filter(
        clip_count=4,
        durations=[3.0, 3.0, 3.0, 3.0],
        transitions=["fadewhite", "zoomin", "slideleft"],
    )
    assert result.count("xfade=") == 3
    assert "transition=fadewhite" in result
    assert "transition=zoomin" in result
    assert "transition=slideleft" in result


def test_build_filter_hard_cut():
    """Hard cut should produce a near-instant transition (duration ~0.01)."""
    result = build_transition_filter(
        clip_count=3,
        durations=[3.0, 3.0, 3.0],
        transitions=["hard_cut", "fade"],
    )
    assert result.count("xfade=") == 2
    # The hard_cut should use duration=0.01 and transition=fade (barely visible)
    assert "duration=0.01" in result
    # The second transition should be a normal fade with duration=0.3
    assert "duration=0.3" in result


def test_build_filter_mismatched_durations():
    """Duration count must match clip count."""
    with pytest.raises(ValueError, match="Duration count"):
        build_transition_filter(clip_count=3, durations=[3.0, 3.0])


def test_build_filter_transitions_padded():
    """If fewer transitions than boundaries, default is used for the rest."""
    result = build_transition_filter(
        clip_count=4,
        durations=[3.0, 3.0, 3.0, 3.0],
        transitions=["zoomin"],  # Only 1 transition for 3 boundaries
    )
    assert result.count("xfade=") == 3
    assert "transition=zoomin" in result
    # Remaining should use default (fade)
    assert result.count("transition=fade") == 2


def test_beat_transition_map():
    """All beat analysis transition names should map to valid transition keys."""
    for beat_name, transition_key in BEAT_TRANSITION_MAP.items():
        assert transition_key in TRANSITION_LOOKUP, (
            f"BEAT_TRANSITION_MAP['{beat_name}'] = '{transition_key}' not in TRANSITION_LOOKUP"
        )


def test_build_filter_offset_calculation():
    """Verify offsets are calculated correctly with varying durations."""
    result = build_transition_filter(
        clip_count=3,
        durations=[5.0, 3.0, 4.0],
        transitions=["fade", "fade"],
    )
    # First offset = 5.0 - 0.3 = 4.7
    assert "offset=4.700" in result
    # Second offset = (5.0 + 3.0 - 0.3) - 0.3 = 7.4
    assert "offset=7.400" in result


def test_build_filter_unknown_transition_falls_back():
    """Unknown transition key should fall back to default."""
    result = build_transition_filter(
        clip_count=2,
        durations=[3.0, 3.0],
        transitions=["nonexistent_transition"],
    )
    assert result.count("xfade=") == 1
    # Should fall back to fade
    assert "transition=fade" in result
