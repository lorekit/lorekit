# Agent 2: Quote Database + Story Generation

Build the content brain — the quote database and Claude-powered story generation.

## Files to Create

### 1. philosophywise/quotes/sources/*.json — Quote Database Files

Create comprehensive JSON files for these 10 philosophers. RESEARCH REAL QUOTES. Do not make them up. Each needs:
- 10+ hook quotes (shocking, mortality, paradoxical — must stop the scroll)
- 15+ truth quotes (deep wisdom, resolution, clarity — the payoff)
- 10+ conflict quotes (struggle, war, adversity — over battle scenes)
- 5+ loop/CTA quotes (about following wisdom, the examined life)

Format per file:
```json
{
    "philosopher": {
        "id": "marcus_aurelius",
        "name": "Marcus Aurelius",
        "civilization": "roman",
        "era": "121-180 AD, Roman Empire",
        "source_texts": ["Meditations"],
        "character_description": "Middle-aged Roman man, 50s, curly dark hair graying at temples, thick curly beard, prominent Roman nose, deep-set thoughtful eyes, wearing purple-bordered white toga when in Rome OR bronze military breastplate armor with red cloak when on campaign. Weathered face showing the weight of leadership.",
        "environment_description": "Ancient Roman setting, 1st-2nd century AD, marble columns and arches, terracotta roof tiles, stone-paved roads, Mediterranean vegetation, warm golden sunlight, blue sky, historically accurate architecture."
    },
    "quotes": [
        {
            "text": "You could leave life right now. Let that determine what you do and say and think.",
            "short_version": "You could leave life right now.",
            "source": "Meditations, Book 2",
            "theme": "mortality",
            "emotional_function": "hook",
            "pair_with_visual": "close-up of bust or face, direct eye contact"
        }
    ]
}
```

Create files for:
1. marcus_aurelius.json (Meditations — Gregory Hays translation quotes)
2. seneca.json (Letters to Lucilius, On the Shortness of Life)
3. epictetus.json (Discourses, Enchiridion)
4. sun_tzu.json (The Art of War)
5. musashi.json (The Book of Five Rings, Dokkodo)
6. lao_tzu.json (Tao Te Ching)
7. confucius.json (Analects)
8. socrates.json (via Plato's dialogues — Apology, Republic)
9. leonidas.json (historical accounts, Plutarch, Herodotus)
10. alexander.json (Plutarch's Lives, Arrian's Anabasis)

Include character_description and environment_description for each — these are the Veo prompt templates.

### 2. philosophywise/quotes/database.py — Quote CRUD

```python
async def load_all_quotes(db) -> dict[str, Philosopher]:
    """Load all philosophers and quotes from JSON files into DB if not already loaded."""

async def import_quotes_from_json(db, json_path: str):
    """Import a single philosopher's quotes from JSON."""

async def get_random_philosopher(db, exclude_recent: int = 3) -> str:
    """Pick a philosopher that hasn't been used in the last N videos."""

async def select_quote_pair(db, philosopher_id: str) -> tuple[Quote, Quote]:
    """Select a hook + truth quote pair. Prefers least-used quotes.
    Ensures the pair makes thematic sense (same theme family)."""

async def get_philosopher(db, philosopher_id: str) -> Philosopher:
    """Get full philosopher data including character/environment descriptions."""

def get_available_philosophers() -> list[str]:
    """List all philosopher IDs from JSON files on disk."""
```

### 3. philosophywise/quotes/selector.py — Smart Quote Selection

```python
THEME_FAMILIES = {
    "mortality": ["mortality", "death", "time", "impermanence"],
    "discipline": ["discipline", "mastery", "practice", "effort"],
    "strategy": ["strategy", "war", "leadership", "power"],
    "mindset": ["mindset", "perception", "thoughts", "attitude"],
    "virtue": ["virtue", "courage", "honor", "duty"],
    "nature": ["nature", "flow", "water", "balance"],
    "wisdom": ["wisdom", "knowledge", "ignorance", "learning"],
}

def themes_compatible(hook_theme: str, truth_theme: str) -> bool:
    """Check if a hook and truth quote make a coherent video together."""

def pick_quote_for_function(quotes: list[Quote], function: str, exclude_ids: set) -> Quote:
    """Pick the best unused quote for a given emotional function."""
```

### 4. philosophywise/story/generator.py — Claude-Powered Story Generation

```python
async def generate_story(
    philosopher: Philosopher,
    hook_quote: Quote,
    truth_quote: Quote,
    target_duration: int = 35,  # seconds
) -> StoryBreakdown:
    """Use Claude to generate a full scene-by-scene breakdown.
    
    Sends: philosopher details, quotes, civilization, arc template
    Receives: 6-8 scenes with visual descriptions, durations, camera directions,
              audio cues, text overlay timing
    
    The prompt instructs Claude to follow the universal arc:
    HOOK → WORLD → CONFLICT → STILLNESS → TRUTH → LOOP
    
    Returns validated StoryBreakdown."""
```

The Claude prompt should:
- Include the philosopher's character_description and environment_description
- Include the civilization-specific visual style notes
- Enforce the 3-second beat rule (something new every 3s)
- Ensure total duration hits 30-50 seconds
- Specify camera movements for each scene
- Include audio mood cues (not specific filenames — those get mapped later)
- Make the LOOP scene visually match the HOOK scene
- Output structured JSON matching the Scene model

### 5. philosophywise/story/templates.py — Arc Templates

```python
UNIVERSAL_ARC = [
    {"beat": "hook", "duration_range": [2, 4], "purpose": "Stop the scroll. Most striking quote + powerful opening image."},
    {"beat": "world", "duration_range": [4, 6], "purpose": "Establish the ancient world. Transport the viewer. Create awe."},
    {"beat": "conflict", "duration_range": [5, 8], "purpose": "Show chaos, war, struggle. Emotional intensity."},
    {"beat": "stillness", "duration_range": [4, 7], "purpose": "Philosopher alone. Writing, thinking, teaching. Contrast with chaos."},
    {"beat": "truth", "duration_range": [5, 8], "purpose": "Deepest quote over culminating visual. The payoff."},
    {"beat": "loop", "duration_range": [2, 4], "purpose": "Return to opening image. Seamless loop point."},
]

# Optional extra beats that can be inserted between conflict and stillness:
OPTIONAL_BEATS = [
    {"beat": "conflict_peak", "duration_range": [3, 5], "purpose": "Overhead/wide shot of aftermath. Transition from action to reflection."},
]
```

### 6. philosophywise/story/validator.py — Story Validation

```python
def validate_story(story: StoryBreakdown) -> list[str]:
    """Returns list of issues. Empty = valid.
    
    Checks:
    - Total duration between 30-50 seconds
    - Scene count between 5-8
    - Has exactly one hook and one loop beat
    - Has at least one truth beat
    - Durations per scene are within their beat's range
    - Hook scene has text_overlay (the hook quote)
    - Truth scene has text_overlay (the truth quote)
    - Loop scene visual matches hook scene visual (similar description)
    - No scene exceeds 8 seconds
    - Total word count of all text overlays reasonable for total duration
    """
```

### 7. philosophywise/story/prompts/roman.py, chinese.py, japanese.py, greek.py

Civilization-specific prompt additions for Claude story generation:

```python
ROMAN_STORY_CONTEXT = """
Visual style: warm golden light, marble architecture, military camps, imperial grandeur.
Battle style: legions in formation, shield walls, organized warfare, discipline.
Intimate style: oil lamps, scrolls, quill and ink, toga-draped figures.
Audio mood: epic orchestral, solo cello for intimate moments, war drums for conflict.
Cultural notes: contrast between supreme power and humble philosophy, Stoic restraint.
"""
```

Each file provides the civilization-specific creative context that shapes how Claude writes the scene descriptions.

## Constraints
- ALL quotes must be REAL, VERIFIED quotes from actual historical sources
- Do NOT invent quotes or misattribute them
- Each JSON file should have 40+ quotes minimum
- character_description must be detailed enough for consistent Veo generation
- Story generator must output valid JSON matching the Scene/StoryBreakdown models
- Import the models from philosophywise.models (Agent 1 creates them)
