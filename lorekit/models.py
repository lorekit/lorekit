"""Pydantic models for the LoreKit pipeline."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from typing import Literal

from pydantic import BaseModel, Field


class SourceItem(BaseModel):
    text: str
    short_version: str | None = None
    theme: str
    emotional_function: str
    word_count: int
    read_time_seconds: float
    pair_with_visual: str



class Character(BaseModel):
    id: str
    name: str
    universe_id: str = ""
    group: str
    era: str
    character_description: str
    character_descriptions: dict[str, str] = {}  # theme -> character description
    source_texts: list[str] = []
    quotes: list[SourceItem] = []

    def get_character_for_theme(self, theme: str | None = None) -> str:
        """Return the character description for a given theme.

        Falls back to the default ``character_description`` when the requested
        theme has no override.
        """
        if theme and theme in self.character_descriptions:
            return self.character_descriptions[theme]
        return self.character_description



class Universe(BaseModel):
    id: str = Field(default_factory=lambda: uuid.uuid4().hex[:12])
    name: str
    description: str = ""
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class EnvironmentPreset(BaseModel):
    id: str = Field(default_factory=lambda: uuid.uuid4().hex[:12])
    universe_id: str
    name: str
    color_grade: dict = {}
    font: str = "Cinzel"
    text_color: str = "#FFFFFF"
    text_shadow: str = "warm"
    environment_description: str = ""
    themed_descriptions: dict[str, str] = {}


class SceneTemplate(BaseModel):
    id: str = Field(default_factory=lambda: uuid.uuid4().hex[:12])
    universe_id: str
    name: str
    description: str = ""
    beats: list[dict] = []
    min_duration: float = 30
    max_duration: float = 50
    min_scenes: int = 5
    max_scenes: int = 8


# ============================================================
# Timeline document models (track-based editor)
#
# Follows industry standard: Timeline > Track > Items
# References: OpenTimelineIO, CapCut draft_content.json, FCPXML
#
# Key design decisions:
#   - Transitions are siblings of clips on the video track (OTIO model)
#   - Materials dict separates media refs from clip placement (CapCut model)
#   - Story metadata lives on the project row, not the timeline
#   - Frame-integer positioning (avoids float drift)
# ============================================================


class Material(BaseModel):
    """A media asset referenced by timeline items (CapCut 'materials' pattern)."""
    id: str = Field(default_factory=lambda: uuid.uuid4().hex[:12])
    type: Literal["video", "image", "audio"] = "video"
    path: str | None = None
    url: str | None = None
    name: str = ""
    duration_frames: int = 0
    width: int = 0
    height: int = 0


class BaseItem(BaseModel):
    id: str = Field(default_factory=lambda: uuid.uuid4().hex[:12])
    from_frame: int = 0
    duration_frames: int = 0
    enabled: bool = True


class SceneItem(BaseItem):
    """A video clip on the timeline. References materials by ID."""
    type: Literal["scene"] = "scene"
    scene_id: int
    beat: str = ""
    visual_description: str = ""
    camera: str = ""
    narration: str = ""
    character_present: bool = False
    speed: float = 1.0
    # Material references (IDs into Timeline.materials)
    clip_material_id: str | None = None
    keyframe_material_id: str | None = None
    keyframe_history: list[str] = []
    end_keyframe_material_id: str | None = None
    extracted_frame_ids: list[str] = []
    reference_image_ids: list[str] = []
    # Workflow node IDs — permanently link this scene to its generation nodes
    keyframe_node_id: str | None = None
    clip_node_id: str | None = None

    @property
    def duration(self) -> float:
        """Duration in seconds (for compatibility with video generation APIs)."""
        return self.duration_frames / 30.0

    @property
    def effective_duration(self) -> float:
        """Timeline duration = clip length / speed."""
        return self.duration / self.speed if self.speed > 0 else self.duration


class TransitionItem(BaseItem):
    """Sits between two SceneItems on the video track (OTIO model).

    in_offset/out_offset define overlap with neighboring clips:
    - in_offset: frames of overlap with the preceding clip
    - out_offset: frames of overlap with the following clip
    """
    type: Literal["transition"] = "transition"
    transition_type: str = "ai_morph"
    prompt: str = ""
    speed: float = 1.5
    in_offset: int = 0   # frames overlapping with preceding clip
    out_offset: int = 0  # frames overlapping with following clip
    clip_material_id: str | None = None
    start_image_url: str | None = None  # optional override for morph start frame
    end_image_url: str | None = None    # optional override for morph end frame


class TextItem(BaseItem):
    type: Literal["text"] = "text"
    text: str = ""
    font_family: str = "Cinzel"
    font_size: int = 48
    color: str = "#FFFFFF"
    font_weight: int = 400         # 100-900
    font_style: str = "normal"     # "normal" | "italic"
    text_decoration: str = "none"  # "none" | "underline"
    position: dict = Field(default_factory=lambda: {"x": 0.5, "y": 0.5})
    width: float = 0.8  # container width as fraction of video width (0.1-1.0)
    animation: dict | None = None


class AudioItem(BaseItem):
    type: Literal["audio"] = "audio"
    audio_type: str = "music"
    material_id: str | None = None
    volume: float = 1.0
    fade_in: float = 0.0
    fade_out: float = 0.0
    trim_start: float = 0.0
    loop: bool = False


class EffectItem(BaseItem):
    type: Literal["effect"] = "effect"
    effect_type: str = "color_grade"
    name: str = ""
    settings: dict = Field(default_factory=dict)


class CaptionItem(BaseItem):
    type: Literal["caption"] = "caption"
    words: list[dict] = []
    style: dict = Field(default_factory=lambda: {
        "font_family": "Cinzel",
        "font_size": 32,
        "color": "#FFFFFF",
        "position": "bottom",
    })


class StickerItem(BaseItem):
    type: Literal["sticker"] = "sticker"
    asset_path: str = ""
    position: dict = Field(default_factory=lambda: {"x": 0.5, "y": 0.5})
    scale: float = 1.0
    rotation: float = 0.0


TimelineItem = SceneItem | TransitionItem | TextItem | AudioItem | EffectItem | CaptionItem | StickerItem


class Track(BaseModel):
    id: str
    name: str
    type: Literal["video", "overlay", "text", "sticker", "audio", "effect"]
    locked: bool = False
    visible: bool = True
    muted: bool = False
    volume: float = 1.0
    items: list[TimelineItem] = []


class Timeline(BaseModel):
    """Track-based timeline document stored as JSONB.

    Story metadata (character_id, theme, etc.) lives on the project row,
    not here. The timeline is purely about time and tracks.
    """
    version: int = 1
    fps: int = 30
    width: int = 1080
    height: int = 1920
    duration_frames: int = 0

    # Materials dictionary — all media assets referenced by items
    # Keyed by material ID (CapCut 'materials' pattern)
    materials: dict[str, Material] = Field(default_factory=dict)

    # Extensible metadata for anything that doesn't fit a typed field
    metadata: dict = Field(default_factory=dict)

    tracks: list[Track] = Field(default_factory=lambda: [
        Track(id="video-main", name="Main Video", type="video"),
        Track(id="text-overlay", name="Text", type="text"),
        Track(id="audio-music", name="Music", type="audio"),
        Track(id="audio-narration", name="Narration", type="audio"),
        Track(id="effect-main", name="Effects", type="effect"),
    ])

    def get_track(self, track_id: str) -> Track | None:
        for t in self.tracks:
            if t.id == track_id:
                return t
        return None

    def get_video_track(self) -> Track:
        return self.get_track("video-main") or Track(id="video-main", name="Main Video", type="video")

    def get_audio_track(self, track_id: str = "audio-music") -> Track:
        return self.get_track(track_id) or Track(id=track_id, name="Audio", type="audio")

    def add_material(self, material: Material) -> str:
        """Add a material and return its ID."""
        self.materials[material.id] = material
        return material.id
