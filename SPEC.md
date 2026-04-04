# LoreKit — Universal AI Video Creation Studio

> Formerly PhilosophyWise. A tool for creating themed AI-generated short-form video content across any domain.

## Vision

LoreKit is a **universe-based video creation platform**. Instead of being locked to philosophy content, users define **Universes** — self-contained creative worlds with their own characters, source material, visual themes, environments, and story templates. PhilosophyWise becomes the first Universe, but you could spin up "FinanceBros", "FútbolLegends", "MythologyEpics", or anything else.

Separately, a **Workshop** mode handles video editing tasks (face swap, style transfer) that don't belong inside a Universe.

---

## Architecture Overview

```
LoreKit
├── Themes (global visual style presets — reusable across universes)
│   ├── Mobile Game
│   ├── Cinematic
│   ├── Stylized Cinematic
│   ├── Dark Masculine
│   └── Custom
│
├── Studio (universe-based content creation)
│   ├── Universe: "PhilosophyWise"
│   │   ├── Theme: Dark Masculine (selected at creation, changeable)
│   │   ├── Characters (was: Philosophers)
│   │   │   ├── Marcus Aurelius
│   │   │   ├── Seneca
│   │   │   └── ...
│   │   ├── Source Material (was: Quotes)
│   │   │   ├── "The impediment to action..." — Marcus Aurelius
│   │   │   └── ...
│   │   ├── Environments (was: Civilizations)
│   │   │   ├── Roman (color grade, fonts, text style)
│   │   │   ├── Greek
│   │   │   └── ...
│   │   ├── Scene Templates (arc structures)
│   │   │   ├── Story (HOOK → WORLD → CONFLICT → STILLNESS → TRUTH → LOOP)
│   │   │   └── Rapid Montage
│   │   ├── Projects (video outputs)
│   │   └── Universe Settings
│   │
│   ├── Universe: "FinanceBros"
│   │   ├── Theme: Cinematic
│   │   ├── Characters: Warren Buffett, Charlie Munger, ...
│   │   ├── Source Material: Berkshire Letters, quotes, data points
│   │   ├── Environments: Wall Street, Silicon Valley, ...
│   │   └── ...
│   │
│   └── Universe: "FútbolLegends"
│       └── ...
│
└── Workshop (video editing — outside universes)
    ├── Face Swap (fal.ai face replacement)
    ├── Style Transfer (re-theme existing footage)
    └── Import & Edit (bring in external video)
```

---

## Stack (unchanged)

- **Backend:** Python 3.12+, FastAPI, asyncpg (PostgreSQL), asyncio
- **Frontend:** Next.js 16, React 19, Tailwind v4, Zustand
- **AI:** Claude/GPT for story generation, fal.ai (Veo 3) for video
- **Assembly:** ffmpeg for audio mixing, overlays, color grading, stitching
- **Publishing:** YouTube Data API v3

---

## Data Model

### New: `Universe`

```python
class Universe(BaseModel):
    id: str                    # e.g. "philosophywise", "financebros"
    name: str                  # Display name
    description: str = ""
    theme: str = ""            # Default vibe preset key
    icon: str = ""             # Emoji or icon identifier
    created_at: str
    updated_at: str
```

### Renamed: `Philosopher` → `Character`

```python
class Character(BaseModel):
    id: str
    universe_id: str           # FK → universes
    name: str
    group: str                 # Was "civilization" — generic grouping (e.g. "Roman", "Wall Street")
    era: str = ""
    character_description: str
    character_descriptions: dict[str, str] = {}  # theme → description override
    source_texts: list[str] = []
```

### Renamed: `Quote` → `SourceItem`

```python
class SourceItem(BaseModel):
    id: str
    universe_id: str           # FK → universes
    character_id: str          # FK → characters (was philosopher_id)
    text: str
    short_version: str | None = None
    theme: str                 # Content theme/category
    emotional_function: str    # hook, truth, conflict, loop
    word_count: int
    read_time_seconds: float
    pair_with_visual: str
```

### Renamed: `CivilizationPreset` → `EnvironmentPreset`

```python
class EnvironmentPreset(BaseModel):
    id: str
    universe_id: str           # FK → universes
    name: str                  # e.g. "Roman", "Wall Street"
    color_grade: ColorGrade
    font: str
    text_color: str
    text_shadow: str
    environment_description: str = ""
    themed_descriptions: dict[str, str] = {}  # theme → env description override
```

### `SceneTemplate` (new concept — replaces hardcoded arc templates)

```python
class SceneTemplate(BaseModel):
    id: str
    universe_id: str           # FK → universes
    name: str                  # e.g. "Story Arc", "Rapid Montage"
    description: str = ""
    beats: list[str]           # e.g. ["HOOK", "WORLD", "CONFLICT", "STILLNESS", "TRUTH", "LOOP"]
    min_duration: int = 25
    max_duration: int = 55
    min_scenes: int = 5
    max_scenes: int = 10
```

### Timeline Architecture (replaces old models)

> **Note (2026-04-03):** The old `VideoProject`, `StoryBreakdown`, `Scene`, `Transition`,
> `AudioSpec`, `SFXCue`, and `AmbientSpec` models have been deleted. All project editor
> data now lives in a single `timeline_json JSONB` column on `universe_projects`, using a
> track-based timeline document (OTIO/CapCut/Premiere industry standard).
>
> New models in `lorekit/models.py`: `Timeline`, `Track`, `Material`, `SceneItem`,
> `TransitionItem`, `TextItem`, `AudioItem`, `EffectItem`, `CaptionItem`, `StickerItem`.
>
> See `CLAUDE.md` for the full timeline data model and `docs/ROADMAP-timeline-refactor.md`
> for the migration history.

---

## Database Schema Changes

### New table: `universes`

```sql
CREATE TABLE IF NOT EXISTS universes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    theme TEXT NOT NULL DEFAULT '',
    icon TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
```

### New table: `environments`

```sql
CREATE TABLE IF NOT EXISTS environments (
    id TEXT PRIMARY KEY,
    universe_id TEXT NOT NULL REFERENCES universes(id),
    name TEXT NOT NULL,
    color_grade_json TEXT NOT NULL DEFAULT '{}',
    font TEXT NOT NULL DEFAULT 'Cinzel',
    text_color TEXT NOT NULL DEFAULT '#FFFFFF',
    text_shadow TEXT NOT NULL DEFAULT 'warm',
    environment_description TEXT NOT NULL DEFAULT '',
    themed_descriptions_json TEXT NOT NULL DEFAULT '{}'
);
```

### New table: `scene_templates`

```sql
CREATE TABLE IF NOT EXISTS scene_templates (
    id TEXT PRIMARY KEY,
    universe_id TEXT NOT NULL REFERENCES universes(id),
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    beats_json TEXT NOT NULL DEFAULT '[]',
    min_duration INTEGER NOT NULL DEFAULT 25,
    max_duration INTEGER NOT NULL DEFAULT 55,
    min_scenes INTEGER NOT NULL DEFAULT 5,
    max_scenes INTEGER NOT NULL DEFAULT 10
);
```

### Modified: `philosophers` → `characters`

```sql
CREATE TABLE IF NOT EXISTS characters (
    id TEXT PRIMARY KEY,
    universe_id TEXT NOT NULL REFERENCES universes(id),
    name TEXT NOT NULL,
    "group" TEXT NOT NULL DEFAULT '',
    era TEXT NOT NULL DEFAULT '',
    character_description TEXT NOT NULL DEFAULT '',
    character_image_url TEXT,
    character_ref_urls TEXT,
    character_images_json TEXT
);
```

### Modified: `quotes` → `source_items`

```sql
CREATE TABLE IF NOT EXISTS source_items (
    id TEXT PRIMARY KEY,
    universe_id TEXT NOT NULL REFERENCES universes(id),
    character_id TEXT NOT NULL REFERENCES characters(id),
    text TEXT NOT NULL,
    short_version TEXT,
    theme TEXT NOT NULL,
    emotional_function TEXT NOT NULL,
    word_count INTEGER NOT NULL DEFAULT 0,
    read_time_seconds REAL NOT NULL DEFAULT 0.0,
    pair_with_visual TEXT NOT NULL DEFAULT '',
    used_count INTEGER NOT NULL DEFAULT 0,
    last_used_at TEXT
);
```

### Modified: `projects`

```sql
-- Add universe_id column
ALTER TABLE projects ADD COLUMN universe_id TEXT NOT NULL DEFAULT 'philosophywise' REFERENCES universes(id);
-- Rename philosopher_id conceptually to character_id (migration renames column)
```

### Modified: `videos`

```sql
ALTER TABLE videos ADD COLUMN universe_id TEXT NOT NULL DEFAULT 'philosophywise' REFERENCES universes(id);
```

---

## API Routes

### New: Universe CRUD

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/universes` | List all universes |
| GET | `/api/universes/:id` | Get universe detail (with counts) |
| POST | `/api/universes` | Create universe |
| PATCH | `/api/universes/:id` | Update universe |
| DELETE | `/api/universes/:id` | Delete universe (cascade) |

### Updated: All existing routes become universe-scoped

All existing `/api/philosophers`, `/api/quotes`, `/api/projects`, `/api/generate` routes get prefixed or filtered by universe:

| Old Route | New Route |
|-----------|-----------|
| `/api/philosophers` | `/api/universes/:uid/characters` |
| `/api/philosophers/:id` | `/api/universes/:uid/characters/:id` |
| `/api/quotes` | `/api/universes/:uid/sources` |
| `/api/projects` | `/api/universes/:uid/projects` |
| `/api/generate/story` | `/api/universes/:uid/generate/story` |
| `/api/generate/clips` | `/api/universes/:uid/generate/clips` |
| `/api/generate/render` | `/api/universes/:uid/generate/render` |
| `/api/settings/vibe-presets` | `/api/themes` (global) |

**Backward compat:** Keep old routes working by defaulting to universe `"philosophywise"` if no universe_id is provided. Remove later.

### New: Environment routes

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/universes/:uid/environments` | List environments |
| POST | `/api/universes/:uid/environments` | Create environment |
| PATCH | `/api/universes/:uid/environments/:id` | Update environment |
| DELETE | `/api/universes/:uid/environments/:id` | Delete environment |

### New: Scene Template routes

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/universes/:uid/templates` | List scene templates |
| POST | `/api/universes/:uid/templates` | Create template |
| PATCH | `/api/universes/:uid/templates/:id` | Update template |
| DELETE | `/api/universes/:uid/templates/:id` | Delete template |

### New: Workshop routes (Phase 3)

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/workshop/face-swap` | Submit face swap job |
| POST | `/api/workshop/style-transfer` | Submit style transfer job |
| POST | `/api/workshop/import` | Import external video |

---

## Frontend Routes

```
/                               → Dashboard (universe selector + global stats)
/universes                      → Universe list / management
/universes/new                  → Create universe wizard
/studio/:universeId             → Universe dashboard
/studio/:universeId/characters  → Character list (was /philosophers)
/studio/:universeId/characters/:id → Character detail
/studio/:universeId/sources     → Source material list (was /quotes via philosopher detail)
/studio/:universeId/environments → Environment list/editor
/studio/:universeId/templates   → Scene template editor
/studio/:universeId/generate    → Generate new video (was /generate)
/studio/:universeId/projects    → Project list (was /projects)
/studio/:universeId/projects/:id → Project detail (was /projects/:id)
/workshop                       → Workshop home (Phase 3)
/workshop/face-swap             → Face swap tool
/workshop/style-transfer        → Style transfer tool
/settings                       → Global settings (API keys, LLM, themes)
```

---

## Sidebar Redesign

```
┌──────────────────────┐
│  🧰 LoreKit          │
├──────────────────────┤
│  ▼ Universe Switcher │  ← Dropdown: select active universe
│    ★ PhilosophyWise  │
│      FinanceBros     │
│      + New Universe  │
├──────────────────────┤
│  Studio              │  ← Context: active universe
│    📊 Dashboard      │
│    👤 Characters     │
│    📝 Sources        │
│    🌍 Environments   │
│    🎬 Scene Templates│
│    ✨ Generate       │
│    🎞 Projects       │
├──────────────────────┤
│  Workshop            │  ← Always visible
│    🎭 Face Swap      │
│    🎨 Style Transfer │
├──────────────────────┤
│  ⚙️ Settings         │
└──────────────────────┘
```

---

## Migration Strategy: PhilosophyWise → Default Universe

On first startup with the new schema:

1. Create `universes` row: `id="philosophywise"`, `name="PhilosophyWise"`, `theme="dark_masculine"`
2. Create `environments` rows from existing `CIVILIZATIONS` dict (roman, greek, chinese, japanese) with `universe_id="philosophywise"`
3. Create `scene_templates` rows from existing `ARC_TEMPLATES` with `universe_id="philosophywise"`
4. Add `universe_id="philosophywise"` to all existing `characters` (philosophers), `source_items` (quotes), `projects`, `videos`
5. Move hardcoded character descriptions from `characters.py` into `characters` table (already partially done)
6. Move hardcoded environment descriptions from `characters.py` into `environments` table

---

## Phase Plan

### Phase 1: Rename & Abstract (Foundation)

**Goal:** Rename the Python package, abstract the data model, migrate existing data. Everything still works, just one layer deeper.

**Backend tasks:**
- [ ] Rename `philosophywise/` → `lorekit/` (Python package)
- [ ] Update `pyproject.toml`: name, scripts (`pw` → `lk`), package find
- [x] Rename models: `Philosopher` → `Character`, `Quote` → `SourceItem`, `CivilizationPreset` → `EnvironmentPreset`
- [x] Rename fields: `philosopher_id` → `character_id`, `civilization` → `group` (in Character), keep `civilization` as environment concept
- [x] Timeline refactor: replaced `StoryBreakdown`/`Scene`/`Transition`/`VideoProject` with `Timeline`/`Track`/`SceneItem`/`TransitionItem` (see `docs/ROADMAP-timeline-refactor.md`)
- [ ] Add `Universe` model and `universes` table
- [ ] Add `environments` table (populated from CIVILIZATIONS)
- [ ] Add `scene_templates` table (populated from existing arc templates)
- [ ] Rename DB tables: `philosophers` → `characters`, `quotes` → `source_items`
- [ ] Add `universe_id` FK to `characters`, `source_items`, `projects`, `videos`
- [ ] Write migration function: detect old schema → create default universe → add FKs → rename tables
- [ ] Update all `db.py` functions for new table/column names
- [ ] Update `config.py`: move `CIVILIZATIONS` into seed data for default universe
- [ ] Update `pipeline.py`: use Character/SourceItem, universe-aware
- [ ] Update `video/characters.py`: load from DB instead of hardcoded dicts
- [ ] Update all API routes: rename endpoints, add universe_id param with default "philosophywise"
- [ ] Update `server.py`: rename title, update router registrations
- [ ] Update `cli.py`: rename commands (`pw` → `lk`), update help text
- [ ] Clean up all `__pycache__` dirs

**Frontend tasks:**
- [ ] Update `package.json` name
- [ ] Update `layout.tsx` metadata: title → "LoreKit"
- [ ] Update `Sidebar.tsx`: rename branding, update nav items
- [x] Update `api.ts`: rename types (`Philosopher` → `Character`, `Quote` → `SourceItem`), add `Timeline`/`Track`/`Item` types, update endpoints
- [ ] Rename `/philosophers` routes → `/characters` (temporary, Phase 2 moves to `/studio/:uid/`)
- [ ] Update all components referencing old types/names
- [ ] Update dashboard page: branding, text
- [ ] Update generate page: use new field names
- [ ] Update settings page: update references

**Tests:**
- [ ] Verify migration from old DB to new schema
- [ ] Verify API backward compat (old routes still work with default universe)
- [ ] Verify frontend loads and displays correctly

---

### Phase 2: Universe CRUD & UI

**Goal:** Full universe creation, switching, and management. Route restructuring.

**Backend tasks:**
- [ ] Universe CRUD API: `/api/universes` (list, get, create, update, delete)
- [ ] Environment CRUD API: `/api/universes/:uid/environments`
- [ ] Scene Template CRUD API: `/api/universes/:uid/templates`
- [ ] Update all existing routes to be universe-scoped: `/api/universes/:uid/characters`, etc.
- [ ] Universe creation wizard: pre-populate with environments, scene templates
- [ ] "Clone Universe" endpoint: duplicate a universe with all its config (no content)
- [ ] Cascade delete: removing a universe removes its characters, sources, environments, templates, projects

**Frontend tasks:**
- [ ] Universe switcher component in sidebar (dropdown + "New Universe" button)
- [ ] Universe creation wizard page (`/universes/new`)
  - Name, description, icon, theme selection
  - Initial environments setup
  - Scene template selection
- [ ] Universe dashboard page (`/studio/:uid`)
- [ ] Restructure all routes under `/studio/:uid/`
- [ ] Environment editor page (`/studio/:uid/environments`)
  - Color grade visual editor
  - Font/text style preview
  - Environment description editor
- [ ] Scene template editor (`/studio/:uid/templates`)
  - Beat sequence builder (drag-and-drop)
  - Duration range sliders
- [ ] Update generate page: universe context, use universe environments/templates
- [ ] Zustand store: active universe state, universe list

---

### Phase 3: Workshop

**Goal:** Video editing tools that live outside the Universe model.

**Backend tasks:**
- [ ] Face Swap endpoint using fal.ai
  - Upload source video + target face image
  - Return processed video
- [ ] Style Transfer endpoint
  - Apply vibe preset to existing video
- [ ] Video import: accept external video file, store in workshop library
- [ ] Workshop job tracking (reuse jobs table with type="workshop_*")

**Frontend tasks:**
- [ ] Workshop section in sidebar
- [ ] Face Swap page (`/workshop/face-swap`)
  - Video upload/URL input
  - Face image upload
  - Preview + download
- [ ] Style Transfer page (`/workshop/style-transfer`)
  - Video input
  - Theme/preset selector
  - Before/after preview
- [ ] Workshop library: browse past edits

---

### Phase 4: Universe-Specific Pipelines (Advanced)

**Goal:** Each universe can customize its generation pipeline beyond just characters/sources.

- [ ] Per-universe LLM prompts (story generation prompt template stored in universe config)
- [ ] Per-universe audio presets (music beds, SFX libraries per universe)
- [ ] Per-universe publishing config (different YouTube channels per universe)
- [ ] Universe templates marketplace (share/import universe configs)
- [ ] Per-universe character prompt injection (how characters behave in stories)
- [ ] Batch generation across universes

---

## File Structure After Phase 1

```
~/dev/lorekit/
├── lorekit/                    # Renamed from philosophywise/
│   ├── __init__.py
│   ├── models.py              # Universe, Character, SourceItem, EnvironmentPreset, SceneTemplate
│   ├── config.py              # Global config, VIBE_PRESETS (themes stay global)
│   ├── db.py                  # Updated schema, migration, new tables
│   ├── server.py              # FastAPI app, "LoreKit" title
│   ├── cli.py                 # `lk` CLI
│   ├── pipeline.py            # Universe-aware generation
│   ├── api/
│   │   ├── universes.py       # NEW: Universe CRUD
│   │   ├── characters.py      # Renamed from philosophers.py
│   │   ├── sources.py         # Renamed from quotes.py
│   │   ├── environments.py    # NEW: Environment CRUD
│   │   ├── templates.py       # NEW: Scene Template CRUD
│   │   ├── projects.py        # Updated with universe_id
│   │   ├── generate.py        # Updated with universe context
│   │   ├── scenes.py          # Mostly unchanged
│   │   ├── jobs.py            # Unchanged
│   │   ├── settings_routes.py # Updated
│   │   └── character.py       # Character image gen (renamed internally)
│   ├── video/
│   │   ├── characters.py      # Load from DB, not hardcoded
│   │   ├── generator.py       # Unchanged
│   │   └── prompt_builder.py  # Uses EnvironmentPreset
│   ├── story/
│   │   ├── generator.py       # Uses Character, SourceItem
│   │   ├── templates.py       # Load from DB scene_templates
│   │   ├── validator.py       # Updated field names
│   │   └── prompts/           # Per-environment prompts (loaded from DB eventually)
│   ├── assembly/              # Unchanged
│   ├── audio/                 # Unchanged
│   ├── publish/               # Unchanged
│   └── sources/               # Renamed from quotes/sources/
│       ├── marcus_aurelius.json
│       └── ...
├── web/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx           # Dashboard with universe selector
│   │   │   ├── characters/        # Renamed from philosophers/
│   │   │   ├── generate/
│   │   │   ├── projects/
│   │   │   └── settings/
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   └── Sidebar.tsx    # LoreKit branding, universe switcher
│   │   │   └── editor/            # Unchanged
│   │   ├── lib/
│   │   │   └── api.ts             # Updated types + endpoints
│   │   └── stores/
│   │       ├── project-store.ts
│   │       └── universe-store.ts  # NEW
│   └── package.json
├── pyproject.toml                  # name="lorekit", scripts: lk=...
├── SPEC.md                         # This file
└── ...
```

---

## Naming Glossary

| Old (PhilosophyWise) | New (LoreKit) | Notes |
|----------------------|---------------|-------|
| PhilosophyWise | LoreKit | App name |
| `pw` | `lk` | CLI command |
| Philosopher | Character | Any person/figure in a universe |
| Quote | SourceItem / Source | Any text content (quote, stat, lyric, etc.) |
| Civilization | Environment | Visual/cultural preset (Roman, Wall Street, etc.) |
| `philosopher_id` | `character_id` | FK field name |
| `civilization` (field) | `group` (on Character) | Character grouping |
| N/A | Universe | Top-level container |
| N/A | Workshop | Video editing tools |
| `video_vibe` / `video_vibe_preset` | Theme | Global visual style |
| Arc Template | Scene Template | Per-universe beat structures |
