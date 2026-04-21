"""Node type registry — maps type strings to execution metadata.

Each node type defines:
- endpoint: fal.ai API endpoint (or None for local operations)
- category: grouping for UI (image, video, audio, local, transform)
- label: default human-readable label
- input_keys: expected input parameter names
- output_keys: output keys produced after execution
- cost_per_second: estimated cost for duration-based operations
- cost_flat: flat cost per execution
"""

from __future__ import annotations

from typing import Any


class NodeTypeDef:
    """Definition of a workflow node type."""

    def __init__(
        self,
        type_id: str,
        endpoint: str | None,
        category: str,
        label: str,
        input_keys: list[str],
        output_keys: list[str],
        cost_flat: float = 0.0,
        cost_per_second: float = 0.0,
        local: bool = False,
    ):
        self.type_id = type_id
        self.endpoint = endpoint
        self.category = category
        self.label = label
        self.input_keys = input_keys
        self.output_keys = output_keys
        self.cost_flat = cost_flat
        self.cost_per_second = cost_per_second
        self.local = local

    def to_dict(self) -> dict[str, Any]:
        return {
            "type": self.type_id,
            "endpoint": self.endpoint,
            "category": self.category,
            "label": self.label,
            "input_keys": self.input_keys,
            "output_keys": self.output_keys,
            "cost_flat": self.cost_flat,
            "cost_per_second": self.cost_per_second,
            "local": self.local,
        }


# ---------------------------------------------------------------------------
# Node type definitions
# ---------------------------------------------------------------------------

NODE_TYPES: dict[str, NodeTypeDef] = {}


def _register(type_id: str, **kwargs: Any) -> None:
    NODE_TYPES[type_id] = NodeTypeDef(type_id=type_id, **kwargs)


# ── Image generation ──────────────────────────────────────────────────────

_register(
    "kontext_keyframe",
    endpoint="fal-ai/flux-pro/kontext/max/multi",
    category="image",
    label="Kontext Keyframe",
    input_keys=["prompt", "ref_1", "ref_2", "ref_3", "ref_4", "aspect_ratio"],
    output_keys=["url"],
    cost_flat=0.04,
)

_register(
    "kontext_edit",
    endpoint="fal-ai/flux-pro/kontext/max",
    category="image",
    label="Kontext Edit",
    input_keys=["prompt", "image", "aspect_ratio"],
    output_keys=["url"],
    cost_flat=0.04,
)

_register(
    "nano_banana",
    endpoint="fal-ai/nano-banana-2",
    category="image",
    label="Nano Banana 2",
    input_keys=["prompt", "image_urls", "aspect_ratio"],
    output_keys=["url"],
    cost_flat=0.04,
)

_register(
    "flux_text_to_image",
    endpoint="fal-ai/flux-2-pro",
    category="image",
    label="Flux 2 Pro (Text-to-Image)",
    input_keys=["prompt", "aspect_ratio"],
    output_keys=["url"],
    cost_flat=0.03,
)

# ── Video generation ──────────────────────────────────────────────────────

_register(
    "kling_v3_pro",
    endpoint="fal-ai/kling-video/v3/pro/image-to-video",
    category="video",
    label="Kling V3 Pro",
    input_keys=["start_image", "prompt", "duration", "elements", "end_image", "cfg_scale", "negative_prompt"],
    output_keys=["url"],
    cost_flat=0.0,
    cost_per_second=0.14,
)

_register(
    "kling_v3_pro_t2v",
    endpoint="fal-ai/kling-video/v3/pro/text-to-video",
    category="video",
    label="Kling V3 Pro (Text-to-Video)",
    input_keys=["prompt", "duration", "aspect_ratio", "negative_prompt", "cfg_scale"],
    output_keys=["url"],
    cost_flat=0.0,
    cost_per_second=0.112,
)

_register(
    "kling_o3",
    endpoint="fal-ai/kling-video/o3/standard/image-to-video",
    category="video",
    label="Kling O3",
    input_keys=["image_url", "prompt", "duration", "end_image"],
    output_keys=["url"],
    cost_flat=0.0,
    cost_per_second=0.10,
)

_register(
    "lipsync",
    endpoint="fal-ai/sync-lipsync/v3",
    category="video",
    label="Lip Sync",
    input_keys=["video", "audio"],
    output_keys=["url"],
    cost_flat=0.0,
    cost_per_second=0.13,
)

# ── Audio ─────────────────────────────────────────────────────────────────

_register(
    "tts_minimax",
    endpoint="fal-ai/minimax/speech-2.6-turbo",
    category="audio",
    label="MiniMax TTS",
    input_keys=["text", "voice_id"],
    output_keys=["url"],
    cost_flat=0.06,
)

_register(
    "tts_orpheus",
    endpoint="fal-ai/orpheus-tts",
    category="audio",
    label="Orpheus TTS",
    input_keys=["text", "voice_id", "reference_audio"],
    output_keys=["url"],
    cost_flat=0.06,
)

_register(
    "tts_elevenlabs",
    endpoint="fal-ai/elevenlabs/tts/multilingual-v2",
    category="audio",
    label="ElevenLabs TTS",
    input_keys=["text", "voice_id"],
    output_keys=["url"],
    cost_flat=0.06,
)

# ── Transform / editing ──────────────────────────────────────────────────

_register(
    "face_swap",
    endpoint="fal-ai/face-swap",
    category="transform",
    label="Face Swap",
    input_keys=["source_face", "target_image"],
    output_keys=["url"],
    cost_flat=0.05,
)

_register(
    "upscale",
    endpoint="fal-ai/real-esrgan",
    category="transform",
    label="Upscale (Real-ESRGAN)",
    input_keys=["image", "scale"],
    output_keys=["url"],
    cost_flat=0.02,
)

_register(
    "bg_remove",
    endpoint="fal-ai/bria/background-removal",
    category="transform",
    label="Background Removal",
    input_keys=["image"],
    output_keys=["url"],
    cost_flat=0.02,
)

# ── Input / source nodes (no fal.ai call, provide data to downstream nodes) ──

_register(
    "character_ref",
    endpoint=None,
    category="content",
    label="Character Reference",
    input_keys=[],
    output_keys=["url"],
    local=True,
)

# ── Content nodes (editable scene/transition configs, no fal.ai call) ────

_register(
    "transition",
    endpoint="fal-ai/kling-video/v3/pro/image-to-video",
    category="video",
    label="Transition",
    input_keys=["from_clip", "to_clip", "start_image", "end_image", "prompt", "duration"],
    output_keys=["url"],
    cost_per_second=0.14,
)

# ── Local operations (no fal.ai call) ────────────────────────────────────

_register(
    "download",
    endpoint=None,
    category="local",
    label="Download File",
    input_keys=["url", "dest_path"],
    output_keys=["path"],
    local=True,
)

_register(
    "extract_frames",
    endpoint=None,
    category="local",
    label="Extract Frames",
    input_keys=["video_path", "timestamps"],
    output_keys=["frames"],
    local=True,
)

_register(
    "ffmpeg_stitch",
    endpoint=None,
    category="local",
    label="Stitch Video",
    input_keys=["clips", "audio", "output_path"],
    output_keys=["path"],
    local=True,
)

_register(
    "ffmpeg_grade",
    endpoint=None,
    category="local",
    label="Color Grade",
    input_keys=["video", "environment_key", "color_grade_override"],
    output_keys=["path"],
    local=True,
)

_register(
    "ffmpeg_overlay",
    endpoint=None,
    category="local",
    label="Text Overlay",
    input_keys=["video", "text_items"],
    output_keys=["path"],
    local=True,
)


_register(
    "video_stitch",
    endpoint=None,
    category="local",
    label="Stitch & Render",
    input_keys=["clips"],
    output_keys=["path"],
    local=True,
)


def get_node_type(type_id: str) -> NodeTypeDef:
    """Look up a node type definition. Raises KeyError if not found."""
    if type_id not in NODE_TYPES:
        raise KeyError(f"Unknown node type {type_id!r}. Choose from: {list(NODE_TYPES)}")
    return NODE_TYPES[type_id]


def list_node_types() -> list[dict]:
    """Return all node types as dicts (for API/MCP responses)."""
    return [nt.to_dict() for nt in NODE_TYPES.values()]
