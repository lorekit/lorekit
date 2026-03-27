# Agent 1: Core Infrastructure

Build the foundational layer for the PhilosophyWise pipeline.

## Files to Create

### 1. philosophywise/config.py
Settings using pydantic-settings. Env vars:
- ANTHROPIC_API_KEY
- FAL_KEY
- YOUTUBE_CLIENT_SECRET_PATH (optional)
- DB_PATH (default: ./data/philosophywise.db)
- OUTPUT_DIR (default: ./output)
- CLIPS_DIR (default: ./clips)
- AUDIO_ASSETS_DIR (default: ./philosophywise/audio/assets)

Style presets per civilization:
```python
CIVILIZATIONS = {
    "roman": {
        "name": "Roman",
        "color_grade": {"temperature": 6500, "saturation": 1.05, "contrast": 1.1, "vignette": 0.3},
        "font": "Cinzel",
        "text_color": "#FFFFFF",
        "text_shadow": "warm",
    },
    "chinese": {
        "name": "Chinese",
        "color_grade": {"temperature": 5500, "saturation": 0.85, "contrast": 1.0, "vignette": 0.2},
        "font": "Noto Serif",
        "text_color": "#FFD700",
        "text_shadow": "cool",
    },
    "japanese": {
        "name": "Japanese",
        "color_grade": {"temperature": 5800, "saturation": 0.8, "contrast": 0.95, "vignette": 0.1},
        "font": "Noto Sans JP",
        "text_color": "#FFFFFF",
        "text_shadow": "minimal",
    },
    "greek": {
        "name": "Greek",
        "color_grade": {"temperature": 6000, "saturation": 1.0, "contrast": 1.15, "vignette": 0.15},
        "font": "Cinzel",
        "text_color": "#FFFFFF",
        "text_shadow": "cool",
    },
}
```

### 2. philosophywise/models.py
Pydantic models for the entire pipeline:

```python
class Quote(BaseModel):
    text: str
    short_version: str | None
    theme: str  # mortality, mindset, strategy, discipline, etc.
    emotional_function: str  # hook, conflict, truth, loop
    word_count: int
    read_time_seconds: float
    pair_with_visual: str

class Philosopher(BaseModel):
    id: str  # marcus_aurelius, sun_tzu, etc.
    name: str
    civilization: str  # roman, chinese, japanese, greek
    era: str
    character_description: str  # for Veo prompts
    source_texts: list[str]
    quotes: list[Quote]

class Scene(BaseModel):
    scene_id: int
    beat: str  # hook, world, conflict, conflict_peak, stillness, truth, loop
    duration: float  # seconds
    visual_description: str
    camera: str  # camera movement description
    text_overlay: str | None  # quote text to show, None for visual-only scenes
    text_attribution: str | None  # "— Marcus Aurelius"
    audio: AudioSpec

class AudioSpec(BaseModel):
    music_bed: str  # filename from audio assets
    music_volume: float = 0.7
    music_fade_in: float = 0.5
    sfx: list[SFXCue] = []
    ambient: AmbientSpec | None = None
    text_reveal_sfx: SFXCue | None = None

class SFXCue(BaseModel):
    sound: str  # filename
    time: float  # offset in seconds within scene
    volume: float = 0.8

class AmbientSpec(BaseModel):
    sound: str
    volume: float = 0.2

class StoryBreakdown(BaseModel):
    philosopher_id: str
    civilization: str
    hook_quote: Quote
    truth_quote: Quote
    scenes: list[Scene]
    total_duration: float
    music_theme: str

class VideoProject(BaseModel):
    id: str  # uuid
    philosopher_id: str
    civilization: str
    story: StoryBreakdown
    status: str  # queued, generating, assembling, complete, failed
    clips: list[str]  # file paths
    output_path: str | None
    youtube_id: str | None
    cost_usd: float = 0.0
    created_at: str
```

### 3. philosophywise/db.py
SQLite database using aiosqlite:

Tables:
- `philosophers` — id, name, civilization, character_description
- `quotes` — id, philosopher_id, text, short_version, theme, emotional_function, word_count, read_time_seconds, pair_with_visual, used_count, last_used_at
- `videos` — id, philosopher_id, hook_quote_id, truth_quote_id, status, output_path, youtube_id, youtube_title, cost_usd, views, created_at, published_at
- `costs` — id, video_id, component (story_gen, video_gen, audio, assembly), amount_usd, created_at

Functions:
- init_db() — create tables
- get_unused_quotes(philosopher_id, function, limit) — quotes sorted by least used
- mark_quote_used(quote_id, video_id)
- create_video_record(project) → id
- update_video_status(id, status, **kwargs)
- log_cost(video_id, component, amount)
- get_stats() — total videos, total cost, avg cost, quote usage stats

### 4. philosophywise/cli.py
Click CLI:

```
pw generate --philosopher marcus_aurelius --count 1
pw generate --random --count 3
pw batch --schedule monday  # generate based on day-of-week calendar
pw quotes list --philosopher sun_tzu --function hook
pw quotes import quotes/sources/marcus_aurelius.json
pw quotes stats
pw status  # show pipeline status, recent videos, costs
pw publish --video-id <id>  # manually trigger YouTube upload
pw cost-report  # breakdown by component
```

### 5. philosophywise/pipeline.py
The main orchestrator that ties everything together:

```python
async def generate_video(
    philosopher_id: str | None = None,
    hook_quote_id: str | None = None,
    truth_quote_id: str | None = None,
    dry_run: bool = False,
) -> VideoProject:
    """Full pipeline: quote select → story → video → audio → assembly → done."""
    # 1. Select quotes (or use provided)
    # 2. Generate story breakdown via Claude
    # 3. Validate story
    # 4. Generate video clips via fal.ai (parallel)
    # 5. Build audio mix
    # 6. Assemble final video
    # 7. Generate metadata
    # 8. Log to DB
    # Return completed project

async def batch_generate(count: int = 1, schedule: str | None = None):
    """Generate multiple videos, rotating philosophers."""
```

Make all functions properly async. Use rich for console output (progress bars, tables).

## Constraints
- DO NOT create the quote JSON files (Agent 2 does that)
- DO NOT implement story generation logic (Agent 2 does that)
- DO NOT implement video/audio/assembly (Agent 3 does that)
- DO implement the interfaces/stubs so Agents 2 and 3 can fill them in
- Use proper Python 3.12 typing throughout
- Use async/await everywhere for IO
