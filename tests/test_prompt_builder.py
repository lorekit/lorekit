"""Tests for lorekit.video.prompt_builder — video prompt construction."""

from __future__ import annotations

import inspect

from lorekit.models import Character, SceneItem


def _make_character(**overrides) -> Character:
    defaults = dict(
        id="test_char", name="Test Person", group="modern", era="",
        character_description="A test character.", environment_description="",
        source_texts=[], quotes=[],
    )
    defaults.update(overrides)
    return Character(**defaults)


def _make_scene(**overrides) -> SceneItem:
    defaults = dict(
        scene_id=1, beat="reaction", duration_frames=120,
        visual_description="Person reacts with surprise to their phone.",
        camera="Static selfie angle", narration="wait what?!",
        text_attribution=None, character_present=True,
    )
    defaults.update(overrides)
    return SceneItem(**defaults)


def test_build_video_prompt_basic():
    """Prompt includes the scene's visual_description."""
    from lorekit.video.prompt_builder import build_video_prompt

    scene = _make_scene()
    char = _make_character()
    result = build_video_prompt(scene, char, {}, "Some art style")
    assert "Person reacts with surprise" in result


def test_build_video_prompt_with_character():
    """When character_present=True, prompt includes character description."""
    from lorekit.video.prompt_builder import build_video_prompt

    scene = _make_scene(character_present=True)
    char = _make_character(character_description="Tall person with red hair.")
    result = build_video_prompt(scene, char, {}, "Some art style")
    assert "Tall person with red hair" in result


def test_build_video_prompt_no_character():
    """When character_present=False, prompt includes 'No people'."""
    from lorekit.video.prompt_builder import build_video_prompt

    scene = _make_scene(character_present=False)
    char = _make_character()
    result = build_video_prompt(scene, char, {}, "Some art style")
    assert "No people" in result


def test_build_video_prompt_skip_character():
    """skip_character=True omits character description even when present."""
    from lorekit.video.prompt_builder import build_video_prompt

    scene = _make_scene(character_present=True)
    char = _make_character(character_description="Should not appear.")
    result = build_video_prompt(scene, char, {}, "Some art style", skip_character=True)
    assert "Should not appear" not in result


def test_ugc_selfie_theme_injects_phone_camera():
    """theme='ugc_selfie' should inject phone-camera language."""
    from lorekit.video.prompt_builder import build_video_prompt

    scene = _make_scene()
    char = _make_character()
    result = build_video_prompt(scene, char, {}, "UGC style", theme="ugc_selfie")
    assert "iPhone" in result or "phone" in result.lower()


def test_ugc_selfie_theme_no_cinematic():
    """theme='ugc_selfie' prompt must NOT contain ARRI or dolly."""
    from lorekit.video.prompt_builder import build_video_prompt

    scene = _make_scene()
    char = _make_character()
    result = build_video_prompt(scene, char, {}, "", theme="ugc_selfie")
    assert "ARRI" not in result
    assert "dolly" not in result


def test_dark_masculine_theme_still_works():
    """theme='dark_masculine' should still inject ARRI/cinematic language."""
    from lorekit.video.prompt_builder import build_video_prompt

    scene = _make_scene()
    char = _make_character()
    result = build_video_prompt(scene, char, {}, "Dark style", theme="dark_masculine")
    assert "ARRI" in result or "Photorealistic" in result


def test_no_civilization_parameter_name():
    """Function signature should use 'environment_config', not 'civilization_config'."""
    from lorekit.video.prompt_builder import build_video_prompt

    sig = inspect.signature(build_video_prompt)
    param_names = list(sig.parameters.keys())
    assert "environment_config" in param_names
    assert "civilization_config" not in param_names
