"""Tests for lorekit.video.characters — character and environment descriptions."""

from __future__ import annotations


def test_get_character_description_from_db_base():
    from lorekit.video.characters import get_character_description

    result = get_character_description(
        "unknown_char", db_base_description="A tall person with a red hat."
    )
    assert result == "A tall person with a red hat."


def test_get_character_description_from_db_themed():
    import json
    from lorekit.video.characters import get_character_description

    themed = json.dumps({"dark_masculine": "A dark warrior."})
    result = get_character_description(
        "unknown_char", theme="dark_masculine", db_descriptions_json=themed
    )
    assert result == "A dark warrior."


def test_get_character_description_generic_fallback():
    from lorekit.video.characters import get_character_description

    result = get_character_description("completely_unknown_character_xyz")
    assert result  # non-empty
    assert "philosopher" not in result.lower()
    assert "ancient" not in result.lower()


def test_get_environment_description_generic_fallback():
    from lorekit.video.characters import get_environment_description

    result = get_environment_description("completely_unknown_env")
    assert result  # non-empty
    assert "civilization" not in result.lower()
    assert "ancient" not in result.lower()


def test_no_hardcoded_default_characters():
    import lorekit.video.characters as chars
    assert not hasattr(chars, "_DEFAULT_CHARACTERS")


def test_no_hardcoded_environment_descriptions():
    import lorekit.video.characters as chars
    assert not hasattr(chars, "_ENVIRONMENT_DESCRIPTIONS")
