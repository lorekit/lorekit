---
name: lorekit-produce
description: >-
  End-to-end LoreKit video production guide. Use when creating universes,
  characters, generating stories, producing video clips, or rendering final
  videos via MCP tools. Covers all content types: cinematic narratives, UGC
  ads, rapid montages, and more. Guides vibe preset selection, character
  setup, source material, story generation, clip production, and rendering.

---

# LoreKit Production Guide

You are producing video content with LoreKit via MCP tools. Follow this guide for a reliable end-to-end workflow.

## Quick Reference: Available MCP Tools

| Category | Tools |
|----------|-------|
| **Universes** | `lorekit_universe_create`, `lorekit_universe_list`, `lorekit_universe_get`, `lorekit_universe_update`, `lorekit_universe_delete` |
| **Characters** | `lorekit_character_create`, `lorekit_character_list`, `lorekit_character_get`, `lorekit_character_update` |
| **Character Images** | `lorekit_character_image_generate`, `lorekit_character_image_list` |
| **Reference Images** | `lorekit_character_reference_image_upload`, `lorekit_character_reference_image_list`, `lorekit_character_reference_image_delete` |
| **Sources** | `lorekit_source_create`, `lorekit_source_list`, `lorekit_source_update`, `lorekit_source_delete` |
| **Scripts** | `lorekit_script_create`, `lorekit_script_list`, `lorekit_script_get`, `lorekit_script_update`, `lorekit_script_delete` |
| **Environments** | `lorekit_environment_create`, `lorekit_environment_list`, `lorekit_environment_update` |
| **Documents** | `lorekit_document_create`, `lorekit_document_list`, `lorekit_document_process` |
| **Story & Video** | `lorekit_generate_story`, `lorekit_generate_clips`, `lorekit_generate_clip`, `lorekit_generate_keyframe`, `lorekit_generate_render` |
| **Jobs** | `lorekit_job_status` |
| **Voices** | `lorekit_voice_get`, `lorekit_voice_set`, `lorekit_tts_models` |
| **Arc Templates** | `lorekit_arc_templates`, `lorekit_arc_template_create`, `lorekit_arc_template_update`, `lorekit_arc_template_delete` |
| **Config** | `lorekit_settings`, `lorekit_vibe_presets` |

---

## Production Workflow

### Step 1: Create a Universe

A universe is a story world that holds characters, sources, and projects.

```
lorekit_universe_create(
  name="...",
  description="...",
  icon="...",              # emoji
  video_vibe_preset="..."  # see Vibe Presets below
)
```

**Choose the right vibe preset** — this controls the visual style of all generated images and videos:

| Preset | Best For |
|--------|----------|
| `cinematic` | Documentary, historical, dramatic narratives |
| `dark_masculine` | Dark philosophy, Stoicism, power/discipline content |
| `mobile_game` | Colorful, fun, Clash of Clans-style characters |
| `stylized_cinematic` | Arcane/animated epic style |
| `ugc_selfie` | UGC ads, TikTok reactions, selfie-style content |

Call `lorekit_vibe_presets()` for the full list with descriptions.

### Step 2: Create Characters

Each character needs a **rich description** for best image/video results. The description is automatically saved as both the base description AND the theme-specific description for the universe's vibe preset.

```
lorekit_character_create(
  universe_id="...",
  name="The Finance Bro",
  character_description="25-year-old male. Sharp jawline, light stubble...",
  group_name="UGC Personas",  # optional grouping
  era="Modern"                # optional era/period
)
```

**Writing good character descriptions:**
- Lead with age, gender, and distinguishing physical features
- Include clothing, accessories, and setting details
- For UGC: describe the reaction/emotion choreography
- For cinematic: describe the character's role, armor, environment
- Be specific about skin texture, hair, scars, tattoos — details matter for AI image gen

### Step 3: Generate Character Images

Generate the default portrait, then optionally create additional views:

```
# Default portrait
lorekit_character_image_generate(
  character_id="...",
  theme="ugc_selfie"
)

# Additional views with different settings/angles
lorekit_character_image_generate(
  character_id="...",
  theme="ugc_selfie",
  view="work_truck",
  custom_description="Same person sitting in a work truck cab, Carhartt hoodie..."
)

lorekit_character_image_generate(
  character_id="...",
  theme="ugc_selfie",
  view="gym",
  custom_description="Same person at the gym, tank top, sweaty..."
)
```

**Key parameters:**
- `theme` — visual style (matches vibe presets)
- `view` — named variant for multiple images per character (e.g., different setting, angle, pose). Each view is stored separately.
- `custom_description` — override the character description for this specific generation. Use with `view` to place the character in different settings.

**Reference images** anchor visual identity across generations:
```
lorekit_character_reference_image_upload(character_id="...", url="https://...")
```
Upload 1-5 reference images before generating portraits for consistent likeness.

### Step 4: Add Source Material

Sources are the quotes, facts, and text content that drive story generation.

```
lorekit_source_create(
  character_id="...",
  text="The unexamined life is not worth living.",
  theme="philosophy",
  emotional_function="truth"  # or "hook"
)
```

**Emotional functions:**
- `hook` — attention-grabbing, scroll-stopping content (used for opening scenes)
- `truth` — deeper wisdom, insight, or payoff (used for climactic scenes)

**For bulk content**, use documents:
```
lorekit_document_create(universe_id="...", character_id="...", name="Meditations", content="...")
lorekit_document_process(universe_id="...", character_id="...", document_id="...")
```
Processing extracts individual source items automatically.

### Step 5: Generate a Story

Creates a project with a scene-by-scene breakdown:

```
lorekit_generate_story(
  character_id="...",
  universe_id="...",
  target_duration=35,          # seconds
  arc_template="story",        # see Arc Templates below
  aspect_ratio="9:16",         # or "16:9" for landscape
  quote_ids=["...", "..."]     # optional: pin specific sources
)
```

**Arc templates** control the narrative structure:

| Template | Duration | Scenes | Best For |
|----------|----------|--------|----------|
| `story` | 30-50s | 5-8 | Full narrative: hook → world → conflict → stillness → truth → loop |
| `rapid_montage` | 18-45s | 6-10 | Fast cuts with 1-3 words per scene. Viral TikTok quote style. |
| `ugc_reaction` | 3-5s | 1 | Single selfie reaction clip for ad hooks |

Call `lorekit_arc_templates()` for the full list (includes built-in + custom).

**Creating custom arc templates:**

```
lorekit_arc_template_create(
  name="Product Demo",
  description="15-25s product walkthrough with hook and CTA",
  min_duration=15,
  max_duration=25,
  min_scenes=3,
  max_scenes=6,
  max_scene_duration=8,
  beats_json='[{"beat": "hook", "duration_range": [3, 5], "purpose": "Attention-grabbing opener"}, {"beat": "demo", "duration_range": [5, 10], "purpose": "Show the product in action"}, {"beat": "cta", "duration_range": [3, 5], "purpose": "Call to action"}]',
  system_prompt_fragment=""  # auto-generated if empty
)
```

Built-in templates cannot be edited or deleted. You can duplicate them to create customizable variants.

### Step 6: Review & Edit Scenes

After story generation, review the scenes:

```
lorekit_scene_list(project_id="...")
```

Edit individual scenes if needed:
```
lorekit_scene_update(
  project_id="...",
  scene_id=1,
  visual_description="...",
  camera="slow push-in",
  text_overlay="...",
  duration=5.0
)
```

### Step 7: Build Workflow & Generate Clips

Build the generation pipeline by adding nodes. Each scene needs a keyframe node + clip node:

```
# For each scene, add a keyframe generator
lorekit_workflow_add_node(
  project_id="...",
  type="kontext_keyframe",
  label="Scene 1",
  params='{"prompt": "...", "scene_id": 1, "reference_images": ["..."], "aspect_ratio": "9:16"}'
)

# Add a video generator connected to the keyframe
lorekit_workflow_add_node(
  project_id="...",
  type="kling_v3_pro",
  label="Clip 1",
  params='{"prompt": "...", "duration": 5, "scene_id": 1}',
  inputs='{"start_image": "<keyframe_node_id>.outputs.url"}'
)
```

Include `scene_id` in params to auto-link nodes to timeline scenes.

Available node types: `kontext_keyframe`, `kontext_edit`, `nano_banana`, `kling_v3_pro`, `kling_o3`, `face_swap`, `video_stitch`, `ffmpeg_stitch`, `tts_minimax`, `tts_orpheus`, `tts_elevenlabs`

Execute the workflow:
```
lorekit_workflow_execute(project_id="...")
```

Or use the legacy per-scene generation:
```
lorekit_generate_clips(project_id="...")
lorekit_generate_clip(project_id="...", scene_id=1)
lorekit_generate_keyframe(project_id="...", scene_id=1)
```

### Step 8: Poll Job Status

Clip and render generation are async. Poll until complete:

```
lorekit_job_status(job_id="...")
```

Returns status (`queued`, `processing`, `completed`, `failed`), progress %, and message.

### Step 9: Render Final Video

Assemble all clips into the final video:

```
lorekit_generate_render(
  project_id="...",
  raw=False,           # True for quick preview without effects
  text_overlays=True,  # burn in text overlays
  color_grade=True,    # apply color grading
  audio=True           # include music + narration
)
```

Poll with `lorekit_job_status()` until complete.

---

## The `story_context` Parameter — Creative Direction for Any Content Type

The most powerful lever for variety is `story_context` on `lorekit_generate_story`. It tells the LLM exactly what kind of video to create. Character `performance_notes` are auto-injected, so you don't need to repeat reaction choreography.

**Use `story_context` to vary:**
- Reaction style: "Starts skeptical, slowly becomes convinced" vs "Immediate shock and excitement"
- Scenario: "Person discovers the app for the first time" vs "Person shows a friend the app"
- Mood: "Calm, understated reaction" vs "Over-the-top viral energy"
- Any creative direction that shapes the video

---

## Content Type Recipes

### UGC Ad Hooks — Infinite Variety (3-5s each)
1. Universe: `ugc_selfie` preset
2. Character: appearance only in `character_description`, audience in `target_audience`, reactions in `performance_notes`
3. Views: generate multiple starting frames using Kontext edits (different settings + expressions)
4. **Produce N videos by varying `story_context`:**

```
# Skeptical → convinced
lorekit_generate_story(character_id="...", universe_id="...",
  arc_template="ugc_reaction", target_duration=4,
  story_context="Person is scrolling with a bored, skeptical expression. They read something, squint doubtfully, then slowly nod with raised eyebrows — quietly impressed.")

# Shocked discovery
lorekit_generate_story(character_id="...", universe_id="...",
  arc_template="ugc_reaction", target_duration=4,
  story_context="Person is casually scrolling, then suddenly freezes. Eyes go wide, jaw drops, they lean toward the camera in disbelief.")

# Emotional relief
lorekit_generate_story(character_id="...", universe_id="...",
  arc_template="ugc_reaction", target_duration=4,
  story_context="Person looks stressed and tired, rubbing their temples. They see something on screen, expression softens, they exhale with visible relief and break into a gentle smile.")

# Excited share
lorekit_generate_story(character_id="...", universe_id="...",
  arc_template="ugc_reaction", target_duration=4,
  story_context="Person reads something, gasps, then excitedly points at the camera as if telling a friend. Mouths 'you NEED this' with emphatic energy.")
```

5. Each variation × each character view × each text overlay = exponential unique ads

### Cinematic Narrative (30-50s)
1. Universe: `cinematic` or `dark_masculine` preset
2. Character: historical figure with era-appropriate description
3. Sources: 3-5 quotes tagged as hooks and truths
4. Story: `story` arc, `9:16`, 35s target
5. Vary with `story_context`: "Focus on the theme of resilience" vs "Explore the tension between duty and freedom"
6. Render with all effects enabled

### Rapid Montage Quote Clip (15-30s)
1. Universe: `dark_masculine` or `cinematic` preset
2. Character: iconic figure or archetype
3. Sources: one powerful quote that can be split word-by-word
4. Story: `rapid_montage` arc, `9:16`, 20s target
5. Render with text overlays + color grading, no narration audio

### Product Demo / Explainer
1. Create a custom arc template with beats: `hook` → `demo` → `benefit` → `cta`
2. Character: product spokesperson or animated mascot
3. `story_context`: "Walkthrough of the app's key features with enthusiasm"
4. Different `story_context` per video for feature highlights

### Batch Production Pattern
For any content type, the formula is:
```
N characters × M views × K story_contexts × J text_overlays = N×M×K×J unique videos
```

Example: 5 UGC personas × 4 views each × 6 reaction styles × 7 text overlays = **840 unique ads**

---

## Tips

- **`story_context` is the variety engine** — change it for every video to get different creative output from the same character/template
- **`performance_notes` auto-inject** — set them once on the character, they're appended to every story generation
- **Views as starting frames** — name views by setting + expression (e.g. `home_bored`, `car_skeptical`) for clarity
- **Kontext for consistency** — views are generated by editing the default portrait, keeping the face identical
- **Parallel generation** — launch multiple `generate_story` calls in parallel for batch production
- **Keyframe previews** — use `lorekit_generate_keyframe` before committing to full clip generation
- **Scene editing** — review `lorekit_scene_list` and edit `visual_description` / `camera` before generating clips
- **Edit instructions for views** — when adding views, write edit instructions ("Change background to a gym, same person") not full descriptions
