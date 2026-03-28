"""Pydantic models for the LoreKit pipeline."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from pydantic import BaseModel, Field


class SFXCue(BaseModel):
    sound: str
    time: float
    volume: float = 0.8


class AmbientSpec(BaseModel):
    sound: str
    volume: float = 0.2


class AudioSpec(BaseModel):
    music_bed: str
    music_volume: float = 0.7
    music_fade_in: float = 0.5
    sfx: list[SFXCue] = []
    ambient: AmbientSpec | None = None
    text_reveal_sfx: SFXCue | None = None


class SourceItem(BaseModel):
    text: str
    short_version: str | None = None
    theme: str
    emotional_function: str
    word_count: int
    read_time_seconds: float
    pair_with_visual: str


# Backward compatibility alias
Quote = SourceItem


class Character(BaseModel):
    id: str
    name: str
    universe_id: str = "philosophywise"
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


# Backward compatibility alias
Philosopher = Character


class Scene(BaseModel):
    scene_id: int
    beat: str
    duration: float
    visual_description: str
    camera: str
    text_overlay: str | None = None
    text_attribution: str | None = None
    audio: AudioSpec
    character_present: bool = False  # True when the character physically appears
    cta_scene: bool = False  # True if this scene contains the {{CTA}} placeholder


class StoryBreakdown(BaseModel):
    character_id: str
    civilization: str
    theme: str = ""  # vibe preset key (e.g. "dark_masculine", "mobile_game")
    arc_template: str = "story"  # arc template ID (e.g. "story", "rapid_montage")
    hook_quote: SourceItem
    truth_quote: SourceItem
    scenes: list[Scene]
    total_duration: float
    music_theme: str


class VideoProject(BaseModel):
    id: str = Field(default_factory=lambda: uuid.uuid4().hex[:12])
    character_id: str
    universe_id: str = "philosophywise"
    civilization: str
    theme: str = ""  # vibe preset key
    arc_template: str = "story"  # arc template ID
    story: StoryBreakdown
    status: str = "queued"
    clips: list[str] = []
    output_path: str | None = None
    youtube_id: str | None = None
    cost_usd: float = 0.0
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


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
