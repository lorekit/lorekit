"""Scene → video prompt construction.

Layers three concerns cleanly:
1. Scene description (from story arc) — the action, environment, emotion
2. Character appearance (from philosopher) — what the character looks like
3. Global vibe (from settings) — the art style

The story arc should NOT contain character appearance or art style details.
This builder combines all three at video generation time.
"""

from __future__ import annotations

from philosophywise.models import Philosopher, Scene


def build_video_prompt(
    scene: Scene,
    philosopher: Philosopher,
    civilization_config: dict,
    vibe_text: str,
    skip_character: bool = False,
) -> str:
    """Construct a video prompt by layering scene + character + style.

    Args:
        scene: The scene to build a prompt for.
        philosopher: The philosopher (provides character_description).
        civilization_config: Civilization preset dict (unused currently, reserved).
        vibe_text: The active vibe/style prompt text.
        skip_character: If True, omit character description even when character_present.
            Used for Kling i2v animation prompts where the keyframe already
            contains the character's appearance.
    """
    parts: list[str] = []

    # 1. Scene: what happens (the story arc output)
    parts.append(scene.visual_description)

    # 2. Camera direction
    if scene.camera:
        parts.append(f"Camera: {scene.camera}.")

    # 3. Character appearance — when the philosopher appears in this scene
    #    Skip when the keyframe already handles it (Kling i2v path)
    if scene.character_present and not skip_character:
        parts.append(f"Character appearance: {philosopher.character_description}")

    # 4. Global art style / vibe
    if vibe_text:
        parts.append(f"Art style: {vibe_text}")

    # 5. Technical directives
    parts.append("Smooth fluid motion. No text, no subtitles, no watermarks.")

    return " ".join(parts)[:2500]
