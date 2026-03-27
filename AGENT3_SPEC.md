# Agent 3: Video Generation + Audio + Assembly + Export

Build the production pipeline — from scene descriptions to final rendered video.

## Files to Create

### 1. philosophywise/video/generator.py — fal.ai Veo Video Generation

```python
async def generate_scene_clips(
    scenes: list[Scene],
    philosopher: Philosopher,
    clips_dir: str,
) -> list[str]:
    """Generate all scene video clips in parallel via fal.ai Veo 3.
    
    For each scene:
    1. Build the Veo prompt from scene visual_description + philosopher character_description
       + civilization environment_description + camera direction
    2. Fire async request to fal.ai
    3. Download the resulting clip
    4. Return list of file paths in scene order
    
    All scenes are generated simultaneously using asyncio.gather().
    
    Returns list of clip file paths ordered by scene_id.
    """

async def generate_single_clip(
    scene: Scene,
    philosopher: Philosopher,
    clips_dir: str,
) -> str:
    """Generate one video clip via fal.ai Veo 3 API.
    
    API: fal.ai endpoint for Google Veo 3
    Parameters:
    - prompt: constructed from scene + character + environment
    - aspect_ratio: "9:16" (vertical shorts)
    - duration: scene.duration seconds
    - style: "cinematic, photorealistic, 8K detail"
    
    Returns path to downloaded clip.
    """
```

### 2. philosophywise/video/prompt_builder.py — Veo Prompt Construction

```python
def build_veo_prompt(
    scene: Scene,
    philosopher: Philosopher,
    civilization_config: dict,
) -> str:
    """Construct an optimized Veo prompt from scene data.
    
    Structure:
    [environment prefix] + [character description if philosopher visible] +
    [scene visual_description] + [camera direction] +
    "Cinematic quality, photorealistic, 8K detail, shallow depth of field." +
    "9:16 vertical aspect ratio. No text overlays, no subtitles, no watermarks."
    
    The "no text" instruction is critical — we add our own text via ffmpeg.
    """
```

### 3. philosophywise/video/characters.py — Character Templates

Store the character and environment descriptions that get injected into every prompt.
Load from the philosopher JSON files (quotes/sources/*.json).

```python
def get_character_description(philosopher_id: str) -> str:
def get_environment_description(civilization: str) -> str:
```

### 4. philosophywise/audio/mixer.py — Audio Timeline Builder

```python
def build_audio_timeline(
    scenes: list[Scene],
    total_duration: float,
    civilization: str,
    assets_dir: str,
) -> str:
    """Build a complete audio mix as a single WAV/MP3 file.
    
    Process:
    1. Select a music bed based on civilization + dominant scene mood
    2. Trim/loop music to total_duration
    3. Apply volume automation per scene (louder on conflict, softer on stillness)
    4. Layer SFX at their specified timestamps
    5. Layer ambient sounds
    6. Layer text reveal sounds at text overlay timestamps
    7. Mix everything down to a single audio file
    
    Uses ffmpeg for all mixing.
    Returns path to the mixed audio file.
    """

def select_music_bed(civilization: str, mood: str, assets_dir: str) -> str:
    """Pick appropriate music file from the assets library."""

def build_ffmpeg_audio_filter(
    music_path: str,
    sfx_entries: list[dict],
    ambient_entries: list[dict],
    total_duration: float,
    scene_volumes: list[dict],
) -> str:
    """Build the complex ffmpeg filter graph for audio mixing."""
```

### 5. philosophywise/audio/library.py — Audio Asset Index

```python
def scan_audio_assets(assets_dir: str) -> dict:
    """Scan the audio assets directory and build an index.
    
    Returns:
    {
        "music": {
            "roman": {"epic": [...], "intimate": [...], "ambient": [...]},
            "chinese": {"strategic": [...], "contemplative": [...], "war": [...]},
            ...
        },
        "sfx": {
            "transitions": [...],
            "battle": [...],
            "ambient": [...],
            "text_reveal": [...],
            "emotional": [...],
        }
    }
    """

def get_music_for_mood(index: dict, civilization: str, mood: str) -> str | None:
    """Get a music file path for the given civilization and mood.
    Returns None if no matching asset found."""

def get_sfx(index: dict, category: str, name: str) -> str | None:
    """Get an SFX file path."""
```

### 6. philosophywise/assembly/stitch.py — Video Assembly

```python
async def stitch_video(
    clips: list[str],
    scenes: list[Scene],
    audio_path: str,
    output_path: str,
    civilization: str,
    total_duration: float,
) -> str:
    """Assemble the final video from clips + audio.
    
    Steps:
    1. Trim each clip to its scene duration (clips may be slightly longer)
    2. Apply cross-dissolve transitions between scenes (0.3s)
    3. Concatenate all clips
    4. Apply civilization color grade
    5. Overlay the mixed audio
    6. Export as intermediate (for text overlay step)
    
    Returns path to intermediate video (no text yet).
    """
```

### 7. philosophywise/assembly/overlay.py — Text Overlay

```python
async def add_text_overlays(
    video_path: str,
    scenes: list[Scene],
    civilization: str,
    output_path: str,
    channel_name: str = "PhilosophyWise",
) -> str:
    """Burn text overlays onto the video using ffmpeg drawtext.
    
    For each scene with text_overlay:
    1. Calculate exact start/end time based on cumulative scene durations
    2. Text appears 0.5s after scene starts
    3. Apply civilization-specific font, color, shadow
    4. Add attribution text below quote
    5. Add persistent channel watermark (corner, 40% opacity)
    
    Uses ffmpeg ASS subtitle format for complex text styling,
    or drawtext filter for simpler overlays.
    
    Returns path to final video with text.
    """

def build_ass_subtitle(
    scenes: list[Scene],
    civilization_config: dict,
    resolution: tuple[int, int] = (1080, 1920),
) -> str:
    """Generate an ASS subtitle file content string for the text overlays.
    
    Benefits of ASS over drawtext:
    - Better font rendering
    - Easier word-by-word animation
    - Proper shadow/outline control
    - Can handle multiple text styles in one pass
    """
```

### 8. philosophywise/assembly/color_grade.py — Color Grading

```python
def get_color_grade_filter(civilization: str) -> str:
    """Return ffmpeg filter string for civilization-specific color grading.
    
    Roman: warm temperature, lifted shadows, slight vignette
    Greek: high contrast, clean whites, slightly cool mid-tones
    Chinese: desaturated, crushed blacks, green tint in shadows
    Japanese: low saturation, film grain, soft contrast, warm highlights
    """

def apply_color_grade(input_path: str, output_path: str, civilization: str) -> str:
    """Apply color grading via ffmpeg. Returns output path."""
```

### 9. philosophywise/assembly/transitions.py — Scene Transitions

```python
def build_transition_filter(
    clip_count: int,
    durations: list[float],
    transition_duration: float = 0.3,
) -> str:
    """Build ffmpeg xfade filter chain for cross-dissolve transitions.
    
    Each scene pair gets a 0.3s cross-dissolve.
    The filter chain must account for cumulative duration offsets.
    """
```

### 10. philosophywise/assembly/export.py — Final Export

```python
async def export_final(
    video_with_text_path: str,
    output_path: str,
) -> str:
    """Final encode optimized for YouTube Shorts.
    
    Specs:
    - Resolution: 1080x1920 (9:16)
    - Codec: H.264 (libx264)
    - Profile: high
    - Preset: slow (quality over speed)
    - CRF: 18 (high quality)
    - FPS: 30
    - Audio: AAC 192kbps
    - Pixel format: yuv420p
    - Faststart: yes (moov atom at start for streaming)
    
    Returns path to final .mp4
    """
```

### 11. philosophywise/publish/youtube.py — YouTube Upload

```python
async def upload_to_youtube(
    video_path: str,
    title: str,
    description: str,
    tags: list[str],
    category_id: str = "27",  # Education
) -> str:
    """Upload video to YouTube via Data API v3.
    
    Returns the YouTube video ID.
    
    Settings:
    - Privacy: public
    - Made for kids: false
    - Category: Education (27)
    - Shorts: auto-detected by YouTube (under 60s, vertical)
    """
```

### 12. philosophywise/publish/metadata.py — Title/Description Generator

```python
async def generate_metadata(
    philosopher: Philosopher,
    hook_quote: Quote,
    truth_quote: Quote,
    story: StoryBreakdown,
) -> dict:
    """Use Claude to generate YouTube-optimized metadata.
    
    Returns:
    {
        "title": "[Philosopher] on [Theme] | Ancient Wisdom #shorts",
        "description": "full quote + philosopher bio + call to action",
        "tags": ["shorts", "stoicism", "marcusaurelius", "philosophy", ...],
        "hashtags": "#shorts #stoicism #wisdom"
    }
    
    Title rules (for Shorts):
    - Under 60 characters
    - Include philosopher name
    - Include emotional hook
    - End with #shorts
    """
```

## ffmpeg Patterns to Use

### Cross-dissolve between two clips:
```bash
ffmpeg -i clip1.mp4 -i clip2.mp4 -filter_complex \
  "[0][1]xfade=transition=fade:duration=0.3:offset=2.7" output.mp4
```

### Text overlay with fade-in:
```bash
ffmpeg -i video.mp4 -vf \
  "drawtext=text='The obstacle is the way.':fontfile=Cinzel.ttf:fontsize=48:fontcolor=white:x=(w-text_w)/2:y=h*0.7:enable='between(t,2.5,6)':alpha='if(lt(t-2.5,0.5),(t-2.5)/0.5,1)'" \
  output.mp4
```

### Color temperature adjustment:
```bash
ffmpeg -i input.mp4 -vf "colortemperature=temperature=6500,eq=contrast=1.1:saturation=1.05" output.mp4
```

### Vignette:
```bash
ffmpeg -i input.mp4 -vf "vignette=PI/4" output.mp4
```

### Concatenate with transitions (complex):
Use the xfade filter chain — build it programmatically for N clips.

## Constraints
- ALL video/audio processing must use ffmpeg via subprocess (asyncio.create_subprocess_exec)
- fal.ai calls must be async (httpx or fal-client)
- Handle fal.ai errors gracefully (retry up to 3 times with exponential backoff)
- Log costs for every fal.ai call
- Audio mixer should work even if no SFX assets exist (music bed only is fine)
- Text overlay must handle multi-line quotes (line break at ~30 characters)
- Import models from philosophywise.models (Agent 1 creates them)
- Import config from philosophywise.config (Agent 1 creates them)
