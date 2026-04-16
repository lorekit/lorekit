"""Tests for lorekit.config — environment presets and vibe presets."""

from __future__ import annotations


def test_environment_preset_has_required_fields():
    """EnvironmentPreset must have color_grade, font, text_color, text_shadow."""
    from lorekit.config import ColorGrade, EnvironmentPreset

    preset = EnvironmentPreset(
        name="Test",
        color_grade=ColorGrade(temperature=6500, saturation=1.0, contrast=1.0, vignette=0.0),
        font="Inter",
        text_color="#FFFFFF",
        text_shadow="minimal",
    )
    assert preset.font == "Inter"
    assert preset.text_color == "#FFFFFF"
    assert preset.color_grade is not None


def test_get_environment_returns_preset_for_known_key():
    """get_environment('roman') should return the roman preset."""
    from lorekit.config import get_environment

    preset = get_environment("roman")
    assert preset.name == "Roman"
    assert preset.font == "Cinzel"


def test_get_environment_returns_neutral_for_unknown():
    """get_environment with an unknown key must NOT raise — returns neutral default."""
    from lorekit.config import get_environment

    preset = get_environment("anything_completely_new")
    assert preset is not None
    assert preset.name == "Default"
    assert preset.color_grade.vignette == 0.0


def test_builtin_environments_includes_modern():
    """'modern' must exist in BUILTIN_ENVIRONMENTS."""
    from lorekit.config import BUILTIN_ENVIRONMENTS

    assert "modern" in BUILTIN_ENVIRONMENTS
    assert BUILTIN_ENVIRONMENTS["modern"].name == "Modern"


def test_vibe_presets_includes_ugc_selfie():
    """'ugc_selfie' must exist in VIBE_PRESETS with prompt and character_prompt."""
    from lorekit.config import VIBE_PRESETS

    assert "ugc_selfie" in VIBE_PRESETS
    preset = VIBE_PRESETS["ugc_selfie"]
    assert "prompt" in preset
    assert "character_prompt" in preset
    assert len(preset["prompt"]) > 20
    assert "iPhone" in preset["prompt"] or "phone" in preset["prompt"].lower()


def test_no_civilization_class_name():
    """The class should be EnvironmentPreset, not CivilizationPreset."""
    import lorekit.config as cfg

    assert hasattr(cfg, "EnvironmentPreset")
    # CivilizationPreset should not exist as a standalone name
    assert not hasattr(cfg, "CivilizationPreset") or cfg.CivilizationPreset is cfg.EnvironmentPreset


def test_no_get_civilization_function():
    """get_civilization should not exist — only get_environment."""
    import lorekit.config as cfg

    assert hasattr(cfg, "get_environment")


def test_no_civilizations_dict():
    """CIVILIZATIONS dict should not exist — only BUILTIN_ENVIRONMENTS."""
    import lorekit.config as cfg

    assert hasattr(cfg, "BUILTIN_ENVIRONMENTS")
