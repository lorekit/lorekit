# PhilosophyWise Web App — Full Spec

## Overview

A web UI for the PhilosophyWise pipeline. FastAPI backend + Next.js frontend.
Takes heavy influence from Intertwine's content studio (dark theme, amber accents,
project-based workflow, editor with scene strip).

Supports OpenAI API as an alternative to Anthropic for story generation.

## Architecture

```
Browser (Next.js 15 + React 19)
    |
    | fetch /api/...
    v
FastAPI Server (port 8000)
    |
    |-- /api/philosophers — list, detail
    |-- /api/quotes — list, search, stats
    |-- /api/projects — CRUD
    |-- /api/generate — create story breakdown, start video gen
    |-- /api/jobs/{id} — poll job status
    |-- /api/scenes/{project_id} — get/update individual scenes
    |-- /api/render — final assembly
    |-- /api/publish — YouTube upload
    |
    v
SQLite (data/) + File System (clips/, output/)
```

## Backend: FastAPI Server

### New file: philosophywise/server.py

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

app = FastAPI(title="PhilosophyWise")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:3000"], ...)
app.mount("/clips", StaticFiles(directory="clips"), name="clips")
app.mount("/output", StaticFiles(directory="output"), name="output")

# Register all routers
```

### New file: philosophywise/api/philosophers.py
```
GET /api/philosophers — list all philosophers with quote counts
GET /api/philosophers/{id} — detail: name, civ, character desc, quote breakdown
```

### New file: philosophywise/api/quotes.py
```
GET /api/quotes?philosopher={id}&function={hook|truth|conflict}&limit=50
GET /api/quotes/stats — per-philosopher usage stats
```

### New file: philosophywise/api/projects.py
```
GET /api/projects — list all projects (video generation attempts)
GET /api/projects/{id} — detail with scenes
POST /api/projects — create new project (picks philosopher + quotes OR user chooses)
DELETE /api/projects/{id}
PATCH /api/projects/{id} — update name, status
```

A project = one video. It has:
- philosopher_id
- hook_quote, truth_quote (selected or auto-picked)
- story breakdown (scenes)
- status: draft | story_ready | generating | clips_ready | assembling | rendered | published
- scene clips (individual video files)
- final output video

### New file: philosophywise/api/generate.py
```
POST /api/generate/story — generate story breakdown from Claude/OpenAI
  body: {philosopher_id, hook_quote_id?, truth_quote_id?, target_duration?}
  returns: {project_id, story: StoryBreakdown}

POST /api/generate/clips — generate all scene clips via fal.ai
  body: {project_id}
  returns: {job_id} → poll via /api/jobs/{id}

POST /api/generate/clip — regenerate ONE scene clip
  body: {project_id, scene_id}
  returns: {job_id}

POST /api/generate/render — assemble final video from clips
  body: {project_id}
  returns: {job_id}
```

### New file: philosophywise/api/scenes.py
```
GET /api/scenes/{project_id} — all scenes with clip URLs
PATCH /api/scenes/{project_id}/{scene_id} — update scene text, duration, visual desc
  (allows editing individual scenes before regenerating)
POST /api/scenes/{project_id}/reorder — reorder scenes
```

### New file: philosophywise/api/jobs.py
```
GET /api/jobs/{id} — poll status {status, progress, message, result}
```

### New file: philosophywise/api/settings.py
```
GET /api/settings — current config (redacted keys)
PATCH /api/settings — update API keys, preferences
```

### Update: philosophywise/config.py
Add:
```python
    openai_api_key: str = ""  # Alternative to Anthropic
    llm_provider: str = "openai"  # "openai" or "anthropic"
    llm_model: str = "gpt-4o"  # or "claude-sonnet-4-20250514"
```

### Update: philosophywise/story/generator.py
Support both OpenAI and Anthropic:
```python
async def generate_story(...):
    settings = get_settings()
    if settings.llm_provider == "openai":
        return await _generate_with_openai(...)
    else:
        return await _generate_with_anthropic(...)
```

Same for publish/metadata.py.

### Update: philosophywise/db.py
Add projects table:
```sql
CREATE TABLE projects (
    id TEXT PRIMARY KEY,
    name TEXT,
    philosopher_id TEXT,
    civilization TEXT,
    hook_quote_id TEXT,
    truth_quote_id TEXT,
    story_json TEXT,  -- full StoryBreakdown as JSON
    status TEXT DEFAULT 'draft',
    clips_json TEXT,  -- list of {scene_id, clip_path} as JSON
    output_path TEXT,
    youtube_id TEXT,
    youtube_title TEXT,
    cost_usd REAL DEFAULT 0,
    created_at TEXT,
    updated_at TEXT
);
```

## Frontend: Next.js 15

### Tech Stack (same as Intertwine)
- Next.js 15 + React 19
- Tailwind CSS v4
- Zustand for state
- Lucide icons
- shadcn/ui components (Button, Select, Slider, Tabs, Textarea, Input, Label, Dialog)
- Dark theme: slate-950 bg, slate-800 borders, amber-500 accents

### File Structure

```
web/
├── src/
│   ├── app/
│   │   ├── layout.tsx          — Root layout (dark theme, sidebar)
│   │   ├── page.tsx            — Dashboard (recent projects, stats, quick generate)
│   │   ├── philosophers/
│   │   │   └── page.tsx        — Philosopher grid (cards with avatars, quote counts)
│   │   ├── generate/
│   │   │   └── page.tsx        — New video wizard (pick philosopher → pick quotes → generate story)
│   │   ├── projects/
│   │   │   ├── page.tsx        — Project list (grid of video projects with status)
│   │   │   └── [id]/
│   │   │       └── page.tsx    — Project detail / EDITOR (the main scene-by-scene view)
│   │   └── settings/
│   │       └── page.tsx        — API keys, preferences
│   ├── components/
│   │   ├── ui/                 — shadcn components (button, select, slider, etc.)
│   │   ├── layout/
│   │   │   └── Sidebar.tsx     — Left sidebar nav (same pattern as Intertwine content layout)
│   │   └── editor/
│   │       ├── SceneStrip.tsx  — Horizontal strip of scene thumbnails (like Intertwine's SlideStrip)
│   │       ├── SceneDetail.tsx — Edit one scene: visual desc, text overlay, duration, camera
│   │       ├── ScenePreview.tsx — Video player for individual scene clip
│   │       ├── Timeline.tsx    — Visual timeline showing all scenes with durations
│   │       ├── QuotePicker.tsx — Modal to browse/pick quotes for a scene
│   │       └── StoryOverview.tsx — Full story arc visualization
│   ├── stores/
│   │   └── project-store.ts   — Zustand: current project, scenes, editing state
│   └── lib/
│       ├── api.ts             — Typed fetch wrappers for all endpoints
│       └── utils.ts           — cn(), formatDuration(), etc.
```

### Page: Dashboard (/)
- Hero: "PhilosophyWise" title + tagline
- Quick actions: "Generate New Video", "Browse Philosophers", "View Projects"
- Recent projects grid (last 6) with status badges
- Stats row: total videos, total quotes, total cost, avg cost/video

### Page: Philosophers (/philosophers)
- Grid of philosopher cards (2-3 columns)
- Each card: name, civilization badge (colored), era, quote count, hook/truth breakdown
- Click → expands to show sample quotes + "Generate Video with This Philosopher" button

### Page: Generate (/generate) — The Wizard
Multi-step flow:

**Step 1: Choose Philosopher**
- Grid of philosopher cards (selectable)
- Or "Random" option

**Step 2: Choose Quotes**
- Auto-selected hook + truth pair (theme-matched)
- Can override: browse quotes in a searchable list
- Preview the selected pair: hook quote shown with amber styling, truth quote below

**Step 3: Generate Story**
- Hit "Generate Story" → Claude/OpenAI creates scene breakdown
- Shows the story as a visual timeline:
  - Each scene = a card showing: beat name (HOOK/WORLD/CONFLICT/etc.), duration, visual description, text overlay
  - Drag to reorder
  - Click to edit any field
  - Can regenerate the entire story or tweak individual scenes

**Step 4: Generate Clips**
- Hit "Generate All Clips" → fires parallel fal.ai calls
- Progress: each scene card shows a progress spinner, then a video thumbnail when done
- Can regenerate individual scenes (click "Regenerate" on any scene card)
- Preview each clip inline (small video player per scene card)

**Step 5: Review & Render**
- Full preview: plays all clips in sequence with text overlays (client-side preview)
- Can still edit text, swap clips, adjust timing
- Hit "Render Final Video" → server-side ffmpeg assembly
- Download or publish to YouTube

### Page: Projects (/projects)
- Grid of project cards showing:
  - Philosopher name + avatar
  - Hook quote (truncated)
  - Status badge (draft → story_ready → generating → clips_ready → rendered → published)
  - Thumbnail (first scene clip)
  - Created date
- Click → opens editor

### Page: Project Editor (/projects/[id]) — THE MAIN VIEW
This is the crown jewel. Takes influence from Intertwine's carousel editor.

**Layout:**
```
┌────────────────────────────────────────────────────────┐
│ [← Back]   "Marcus Aurelius — Mortality"    [Render] [Publish] │
├───────────────────────┬────────────────────────────────┤
│                       │                                │
│   Scene Preview       │   Scene Details                │
│   (video player)      │   ┌─────────────────────┐     │
│                       │   │ Beat: HOOK           │     │
│   ┌───────────────┐   │   │ Duration: 3.0s       │     │
│   │               │   │   │ Camera: Slow zoom    │     │
│   │  video clip   │   │   │                      │     │
│   │  preview      │   │   │ Visual Description:  │     │
│   │               │   │   │ [editable textarea]  │     │
│   └───────────────┘   │   │                      │     │
│                       │   │ Text Overlay:        │     │
│                       │   │ [editable textarea]  │     │
│                       │   │                      │     │
│                       │   │ [Regenerate Clip]    │     │
│                       │   │ [Change Quote]       │     │
│                       │   └─────────────────────┘     │
├───────────────────────┴────────────────────────────────┤
│ Scene Strip (horizontal scrollable thumbnails)          │
│ [HOOK] [WORLD] [CONFLICT] [STILLNESS] [TRUTH] [LOOP]  │
│  3.0s   5.0s    6.0s       5.0s       6.0s    3.0s    │
└────────────────────────────────────────────────────────┘
```

- Left panel: video player showing the selected scene's clip (or placeholder if not generated)
- Right panel: editable scene details (visual desc, text overlay, duration, camera direction)
- Bottom: horizontal scene strip (like Intertwine's SlideStrip) with thumbnails, beat labels, durations
- Click a scene thumbnail to select it and load it in the preview/detail panels
- "Regenerate Clip" button per scene (re-fires fal.ai for just that one)
- "Render" button assembles all clips into final video
- "Publish" button uploads to YouTube

### Page: Settings (/settings)
- API keys: OpenAI / Anthropic / fal.ai (masked input fields)
- LLM provider toggle: OpenAI or Anthropic
- Default model selection
- YouTube OAuth connect button
- Audio asset management (future)

### Sidebar (persistent)
```
PhilosophyWise (logo)
──────────────
Dashboard
Philosophers
Generate New
Projects
──────────────
Settings
```

Same pattern as Intertwine's content layout sidebar.

## Styling

- Exact same dark theme as Intertwine: bg-slate-950, borders slate-800, text slate-300/white
- Amber-500 for primary actions, accents, active states
- Civilization color coding on badges/tags:
  - Roman: amber-500
  - Chinese: emerald-500
  - Japanese: rose-500
  - Greek: blue-500
- Beat color coding:
  - HOOK: red-500
  - WORLD: blue-500
  - CONFLICT: orange-500
  - STILLNESS: purple-500
  - TRUTH: amber-500
  - LOOP: slate-500
- Use Lucide icons throughout
- Same shadcn component patterns

## Implementation Order

### Agent A: Backend (FastAPI server + API routes + config updates)
1. philosophywise/server.py
2. philosophywise/api/philosophers.py
3. philosophywise/api/quotes.py
4. philosophywise/api/projects.py
5. philosophywise/api/generate.py
6. philosophywise/api/scenes.py
7. philosophywise/api/jobs.py
8. philosophywise/api/settings_routes.py
9. Update philosophywise/config.py (add openai_api_key, llm_provider, llm_model)
10. Update philosophywise/db.py (add projects table)
11. Update philosophywise/story/generator.py (add OpenAI support)
12. Update philosophywise/publish/metadata.py (add OpenAI support)

### Agent B: Frontend (Next.js app)
1. Initialize Next.js project in web/ (next 15, react 19, tailwind v4, typescript)
2. Set up shadcn/ui components
3. Layout + Sidebar
4. Dashboard page
5. Philosophers page
6. Generate wizard page (multi-step)
7. Projects list page
8. Project editor page (the scene-by-scene editor with SceneStrip, preview, detail panel)
9. Settings page
10. Zustand store
11. API client lib
