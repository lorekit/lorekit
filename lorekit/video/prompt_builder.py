"""Scene → video prompt construction.

Layers three concerns cleanly:
1. Scene description (from story arc) — the action, environment, emotion
2. Character appearance (from character) — what the character looks like
3. Global vibe (from settings) — the art style

The story arc should NOT contain character appearance or art style details.
This builder combines all three at video generation time.

Supports per-theme character descriptions: when a ``theme`` is provided,
the builder uses the character's theme-specific appearance instead of the
base character description.
"""

from __future__ import annotations

from lorekit.models import Character, SceneItem as Scene

# ---------------------------------------------------------------------------
# Per-theme prompt fragments injected into video prompts
# ---------------------------------------------------------------------------

_THEME_VIDEO_OVERRIDES: dict[str, dict[str, str]] = {
    "dark_masculine": {
        "prefix": (
            "Photorealistic dark cinematic footage. Shot on ARRI Alexa 65. "
            "Real actors, real costumes, real practical lighting. "
            "NOT animation, NOT cartoon, NOT 3D render, NOT illustration, NOT game art. "
        ),
        "technical": (
            "Slow, deliberate motion. Heavy atmosphere. Volumetric fog and haze. "
            "Real camera movement — dolly, crane, steadicam. Film grain. "
            "No text, no subtitles, no watermarks."
        ),
    },
    "ugc_selfie": {
        "prefix": (
            "Raw iPhone front-camera selfie video. NOT cinematic, NOT professional, "
            "NOT DSLR, NOT film camera. Real phone-quality with compression artifacts. "
        ),
        "technical": (
            "Steady handheld shot, minimal movement, one hand holding the camera still. Slight barrel distortion. "
            "Natural ambient lighting. Digital noise. Computational bokeh. "
            "No text, no subtitles, no watermarks, no words on screens, no UI elements, "
            "no phone screens visible, no pop-ups, no notifications."
        ),
    },
}

_DEFAULT_TECHNICAL = "Smooth fluid motion. No text, no subtitles, no watermarks."


def build_video_prompt(
    scene: Scene,
    character: Character,
    environment_config: dict,
    vibe_text: str,
    skip_character: bool = False,
    theme: str | None = None,
) -> str:
    """Construct a video prompt by layering scene + character + style.

    Args:
        scene: The scene to build a prompt for.
        character: The character (provides character descriptions).
        environment_config: Environment preset dict (unused currently, reserved).
        vibe_text: The active vibe/style prompt text.
        skip_character: If True, omit character description even when character_present.
            Used for Kling i2v animation prompts where the keyframe already
            contains the character's appearance.
        theme: Vibe preset key (e.g. "dark_masculine"). When set, uses the
            character's theme-specific character description.
    """
    overrides = _THEME_VIDEO_OVERRIDES.get(theme or "", {})
    parts: list[str] = []

    # 0. Theme-specific prefix (anchors the model toward the right aesthetic)
    if prefix := overrides.get("prefix"):
        parts.append(prefix)

    # 1. Scene: what happens (the story arc output)
    parts.append(scene.visual_description)

    # 2. Camera direction
    if scene.camera:
        parts.append(f"Camera: {scene.camera}.")

    # 3. Character appearance — when the character appears in this scene
    #    Skip when the keyframe already handles it (Kling i2v path)
    if scene.character_present and not skip_character:
        char_desc = character.get_character_for_theme(theme)
        parts.append(f"Character appearance: {char_desc}")
        # Add vibe's character-specific prompt (e.g. skin texture, costume style)
        from lorekit.config import VIBE_PRESETS
        char_vibe = VIBE_PRESETS.get(theme or "", {}).get("character_prompt", "")
        if char_vibe:
            parts.append(char_vibe)
    elif not scene.character_present:
        parts.append("No people, no characters, no human figures, no silhouettes.")

    # 4. Global art style / vibe (environment + style only, no character references)
    if vibe_text:
        parts.append(f"Art style: {vibe_text}")

    # 5. Technical directives (theme-specific or default)
    parts.append(overrides.get("technical", _DEFAULT_TECHNICAL))

    return " ".join(parts)
