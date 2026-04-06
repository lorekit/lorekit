"""Credit cost calculators — pure functions, zero external dependencies.

1 credit ≈ $0.01 of internal COGS.

These functions map generation actions to credit costs based on
the actual API pricing from fal.ai, OpenAI, and Modal.
"""

from __future__ import annotations

import math

# Fixed-cost actions (credits)
STORY_CREDITS = 5       # LLM story generation (~$0.05)
KEYFRAME_CREDITS = 3    # Flux Dev image (~$0.025)
PORTRAIT_CREDITS = 3    # Flux Kontext Pro portrait (~$0.04)
RENDER_CREDITS = 1      # ffmpeg render on Modal (~$0.01)
TTS_CREDITS_PER_1K = 6  # MiniMax TTS per 1,000 chars (~$0.06)

# Video generation: credits per second by model
VIDEO_CREDITS_PER_SEC = {
    "v3_pro": 11.0,    # Kling V3 Pro: $0.112/sec → 11.2 credits/sec
    "v3pro": 11.0,     # alias
    "o3": 8.4,         # Kling O3: $0.084/sec → 8.4 credits/sec
    "o3_standard": 8.4, # alias
}

# Default model if not specified
DEFAULT_VIDEO_MODEL = "v3_pro"


def estimate_video_clip_credits(duration_sec: float, model: str = DEFAULT_VIDEO_MODEL) -> int:
    """Estimate credits for a video clip generation."""
    per_sec = VIDEO_CREDITS_PER_SEC.get(model, VIDEO_CREDITS_PER_SEC[DEFAULT_VIDEO_MODEL])
    return math.ceil(duration_sec * per_sec)


def estimate_keyframe_credits() -> int:
    """Credits for a single keyframe image generation."""
    return KEYFRAME_CREDITS


def estimate_story_credits() -> int:
    """Credits for LLM story/script generation."""
    return STORY_CREDITS


def estimate_tts_credits(char_count: int) -> int:
    """Credits for TTS narration based on character count."""
    if char_count <= 0:
        return 0
    return math.ceil(char_count / 1000) * TTS_CREDITS_PER_1K


def estimate_transition_credits(duration_sec: float, model: str = DEFAULT_VIDEO_MODEL) -> int:
    """Credits for a transition clip (same cost as video clip)."""
    return estimate_video_clip_credits(duration_sec, model)


def estimate_portrait_credits() -> int:
    """Credits for a character portrait generation."""
    return PORTRAIT_CREDITS


def estimate_render_credits() -> int:
    """Credits for final video render/assembly."""
    return RENDER_CREDITS


def estimate_clips_credits(
    scenes: list[dict],
    default_duration: float = 5.0,
    default_model: str = DEFAULT_VIDEO_MODEL,
) -> int:
    """Estimate total credits for generating all clips in a scene list.

    Each scene costs: keyframe (3) + video clip (varies by duration and model).
    """
    total = 0
    for scene in scenes:
        duration = scene.get("duration", default_duration)
        model = scene.get("model", default_model)
        total += KEYFRAME_CREDITS + estimate_video_clip_credits(duration, model)
    return total
