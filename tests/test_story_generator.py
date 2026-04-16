"""Tests for lorekit.story.generator — system prompt generalization."""

from __future__ import annotations

import pytest

from lorekit.models import Character
from lorekit.story.templates import ARC_TEMPLATES


def _make_character(**overrides) -> Character:
    defaults = dict(
        id="test_char", name="Test Person", group="modern", era="",
        character_description="A test character.", environment_description="",
        source_texts=[], quotes=[],
    )
    defaults.update(overrides)
    return Character(**defaults)


def test_system_prompt_says_character_not_philosopher():
    from lorekit.story.generator import _build_system_prompt

    char = _make_character(name="Alex")
    arc = ARC_TEMPLATES["story"]
    prompt = _build_system_prompt(char, "Some world context", "", arc)
    assert "CHARACTER:" in prompt
    assert "PHILOSOPHER" not in prompt


def test_system_prompt_says_world_not_civilization():
    from lorekit.story.generator import _build_system_prompt

    char = _make_character()
    arc = ARC_TEMPLATES["story"]
    prompt = _build_system_prompt(char, "Modern city", "", arc)
    assert "WORLD:" in prompt
    assert "CIVILIZATION:" not in prompt


def test_system_prompt_no_philosophy_videos():
    from lorekit.story.generator import _build_system_prompt

    char = _make_character()
    arc = ARC_TEMPLATES["story"]
    prompt = _build_system_prompt(char, "", "", arc)
    assert "philosophy" not in prompt.lower()


def test_system_prompt_includes_character_name():
    from lorekit.story.generator import _build_system_prompt

    char = _make_character(name="Jordan")
    arc = ARC_TEMPLATES["story"]
    prompt = _build_system_prompt(char, "", "", arc)
    assert "Jordan" in prompt


def test_system_prompt_era_included_when_set():
    from lorekit.story.generator import _build_system_prompt

    char_with_era = _make_character(name="Alex", era="Modern")
    arc = ARC_TEMPLATES["story"]
    prompt = _build_system_prompt(char_with_era, "", "", arc)
    assert "Modern" in prompt

    char_no_era = _make_character(name="Alex", era="")
    prompt2 = _build_system_prompt(char_no_era, "", "", arc)
    assert "()" not in prompt2


def test_no_civilization_contexts_import():
    """CIVILIZATION_CONTEXTS should not exist in the module."""
    import lorekit.story.generator as gen
    assert not hasattr(gen, "CIVILIZATION_CONTEXTS")


def test_theme_context_used_for_known_theme():
    """THEME_CONTEXTS should have ugc_selfie."""
    from lorekit.story.generator import THEME_CONTEXTS
    assert "ugc_selfie" in THEME_CONTEXTS


def test_no_philosopher_in_system_prompt():
    """The word 'philosopher' should not appear anywhere in the system prompt."""
    from lorekit.story.generator import _build_system_prompt

    char = _make_character(name="Test")
    arc = ARC_TEMPLATES["story"]
    prompt = _build_system_prompt(char, "Test context", "", arc)
    assert "philosopher" not in prompt.lower()
