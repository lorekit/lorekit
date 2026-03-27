"""Pydantic models for the PhilosophyWise pipeline."""

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


class Quote(BaseModel):
    text: str
    short_version: str | None = None
    theme: str
    emotional_function: str
    word_count: int
    read_time_seconds: float
    pair_with_visual: str


class Philosopher(BaseModel):
    id: str
    name: str
    civilization: str
    era: str
    character_description: str
    source_texts: list[str] = []
    quotes: list[Quote] = []


class Scene(BaseModel):
    scene_id: int
    beat: str
    duration: float
    visual_description: str
    camera: str
    text_overlay: str | None = None
    text_attribution: str | None = None
    audio: AudioSpec
    character_present: bool = False  # True when the philosopher physically appears
    cta_scene: bool = False  # True if this scene contains the {{CTA}} placeholder


class StoryBreakdown(BaseModel):
    philosopher_id: str
    civilization: str
    hook_quote: Quote
    truth_quote: Quote
    scenes: list[Scene]
    total_duration: float
    music_theme: str


class VideoProject(BaseModel):
    id: str = Field(default_factory=lambda: uuid.uuid4().hex[:12])
    philosopher_id: str
    civilization: str
    story: StoryBreakdown
    status: str = "queued"
    clips: list[str] = []
    output_path: str | None = None
    youtube_id: str | None = None
    cost_usd: float = 0.0
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
