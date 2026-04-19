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
| **Workflow** | `lorekit_workflow_create`, `lorekit_workflow_get`, `lorekit_workflow_add_node`, `lorekit_workflow_update_node`, `lorekit_workflow_remove_node`, `lorekit_workflow_connect`, `lorekit_workflow_execute`, `lorekit_workflow_retry_node`, `lorekit_workflow_node_types` |
| **Config** | `lorekit_settings`, `lorekit_vibe_presets` |

---

## Before You Start: Ask the User

Before building anything, have a conversation with the user to understand what they want. Don't assume — ask. Cover these topics:

**Universe & Character:**
- Are we working in an existing universe or creating a new one? → `lorekit_universe_list` to show options
- New character or existing? → `lorekit_character_list` to show what's available
- Do they have reference images for the character? How many views (front, side, 3/4)?
- What's the character's personality, look, vibe?

**Content & Story:**
- What's the video about? (ad, narrative, reaction hook, explainer, montage)
- How long? (3-5s hook, 15-30s short, 60s+ full)
- How many scenes?
- What's the narration / script? Or should we generate one?

**Voice & Audio:**
- Should the character speak? → if yes, we'll add TTS + lip sync nodes
- Which TTS model / voice? → `lorekit_tts_models` to show options, or use the character's saved voice
- Background music? → they can upload audio or we use auto mode

**Visual Style:**
- What vibe/style? → `lorekit_vibe_presets` to show options
- Aspect ratio? (9:16 vertical for social, 16:9 horizontal for YouTube)
- Any specific visual references or mood?

**Pipeline decisions based on answers:**
- Character speaks → add `tts_*` + `lipsync` nodes per scene
- No voice → skip TTS and lip sync, just keyframe + video
- Multiple characters → add multiple `character_ref` nodes, set `character_id` per TTS node
- Background music → set `audio_mode: "uploaded"` on project + upload audio file

Only proceed to building once you have enough context. It's better to ask one extra question than to generate the wrong thing.

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

Build the generation pipeline by adding nodes and connecting them. Use `lorekit_workflow_add_node` to add nodes and `lorekit_workflow_connect` to wire outputs to inputs. Include `scene_id` in params to auto-link nodes to timeline scenes.

#### Node Reference

Every node takes `params` (JSON string of config) and `inputs` (JSON string mapping input names to upstream `<node_id>.outputs.<key>` references).

---

**`kontext_keyframe`** — Generate image from prompt + up to 4 reference photos. Best for creating consistent character keyframes. $0.04

Params: `prompt` (scene description), `reference_images` (list of up to 4 URLs), `aspect_ratio` ("9:16" or "16:9"), `scene_id` (links to timeline)
Inputs: `ref_1` through `ref_4` (upstream image URLs, alternative to `reference_images` in params)
Output: `url` (generated image)

When to use: Starting point for any scene. Describe the exact shot — character position, expression, lighting, setting. The more specific the prompt, the better. Reference images anchor the character's face/body across generations.

---

**`kontext_edit`** — Edit a single existing image. Change clothing, background, lighting, add/remove objects while keeping the person identical. $0.04

Params: `prompt` (edit instruction, NOT full scene description), `aspect_ratio`
Inputs: `image` (source image to edit)
Output: `url` (edited image)

When to use: Creating character views (same person, different setting), product placement into existing scenes, style transfers. Write edit instructions like "Change the background to a modern office" not full descriptions.

---

**`nano_banana`** — Fast image generation with up to 14 reference images. Good for style-consistent generation with many references. $0.04

Params: `prompt`, `image_urls` (list of up to 14 URLs), `aspect_ratio`
Output: `url`

When to use: When you need more than 4 reference images for style consistency, or want faster generation than Kontext.

---

**`kling_v3_pro`** — Generate 3-15 second video from a keyframe image. Best for character-focused scenes with identity preservation. $0.14/sec

Params: `prompt` (motion/action description), `duration` (3-15 seconds), `scene_id` (links to timeline), `cfg_scale` (guidance strength, default 0.5 — lower = more creative, higher = more prompt-adherent), `negative_prompt` (what to avoid)
Inputs: `start_image` (keyframe), `end_image` (optional — for seamless loops)
Output: `url` (video)

Character consistency via `elements` param:
```json
"elements": [{"frontal_image_url": "face.png", "reference_image_urls": ["angle1.png", "angle2.png"]}]
```
This tells Kling to maintain the character's face throughout the video. Use the character's portrait as `frontal_image_url` and additional angle photos as references.

Prompt tips: Describe MOTION, not appearance. "Man slowly turns to camera, raises eyebrow, slight smirk" not "handsome man in suit." The keyframe already establishes appearance.

---

**`kling_o3`** — Generate 3-15 second cinematic/environment video. Better for landscapes, architecture, wide shots without specific character focus. $0.10/sec

Params: `prompt`, `duration`
Inputs: `image_url` or `start_image` (keyframe), `end_image` (optional)
Output: `url` (video)

When to use: Establishing shots, transitions between scenes, nature/city b-roll, any shot where character face consistency isn't critical. Cheaper than V3 Pro.

---

**`transition`** — Generate a smooth morph video between two clips. Extracts end frame of clip A and start frame of clip B, then generates a transition between them. $0.14/sec

Params: `prompt` (transition style description, default "Smooth cinematic transition"), `duration` (3-15s, default 3)
Inputs: `start_image` + `end_image` (preferred — explicit frame URLs), OR `from_clip` + `to_clip` (video paths — frames auto-extracted via ffmpeg)
Output: `url` (transition video)

When to use: Between any two clips that need a smooth connection. Short durations (3-5s) work best. Prompt can describe the transition style: "Camera pans right revealing the next scene" or "Dissolve through particles."

---

**`face_swap`** — Replace the face in a target image with a source face. $0.05

Inputs: `source_face` (photo of the face to paste in), `target_image` (image to modify)
Output: `url` (swapped image)

When to use: Making yourself appear in AI-generated keyframes, replacing actors in existing content, creating consistent character across different generated scenes. Chain with `kling_v3_pro` to animate the swapped result.

---

**`upscale`** — Enlarge an image 2x or 4x using Real-ESRGAN. $0.02

Params: `scale` (2 or 4, default 2)
Inputs: `image` (image to upscale)
Output: `url` (upscaled image)

When to use: Before final render when source keyframes are too low-res, or for print/thumbnail output. 4x on a 512px image → 2048px.

---

**`bg_remove`** — Remove background from an image, producing a transparent PNG. $0.02

Inputs: `image` (image to process)
Output: `url` (transparent PNG)

When to use: Isolating characters or products for compositing, creating stickers, preparing assets for `kontext_edit` product placement.

---

**`tts_minimax`** — Fast text-to-speech via MiniMax. $0.06

Params: `text` (speech content), `voice_id` (optional)
Output: `url` (audio file)

---

**`tts_orpheus`** — Voice cloning TTS. Can clone a voice from a reference audio sample. $0.06

Params: `text`, `voice_id`, `reference_audio` (URL to voice sample for cloning)
Output: `url`

---

**`tts_elevenlabs`** — High-quality multilingual TTS. $0.06

Params: `text`, `voice_id`
Output: `url`

All TTS nodes support `scene_id` (auto-loads narration from scene) and `character_id` (auto-resolves voice from character's global voice config set in the Characters tab). When `character_id` is set and `voice_id` is omitted, the executor looks up the character's saved voice preference.

---

**`lipsync`** — Sync a character's lip movements to audio. Takes a video and audio input, outputs a new video with synced lips. $0.13/sec

Inputs: `video` (video URL — from a clip generation node), `audio` (audio URL — from a TTS node)
Output: `url` (synced video)

When to use: After generating both a video clip and TTS narration for a scene. The lip sync node is the final step that makes the character appear to speak the narration naturally. Always add this when a scene has both video and narration.

---

**`download`** — Fetch any URL to local storage. Free.

Inputs: `url` (any HTTP URL)
Params: `dest_path` (optional storage path)
Output: `path` (local file path), `url` (original URL)

When to use: Import videos from the internet for remixing, fetch reference images, pull audio files.

---

**`extract_frames`** — Pull PNG frames from a video at specific timestamps. Free.

Inputs: `video_path` (local video file)
Params: `timestamps` (list of seconds, e.g. `[0, 2.5, 5, 10]`)
Output: `frames` (list of PNG paths)

When to use: Pulling frames for face swap, creating thumbnails, extracting key moments from imported video for re-animation.

---

**`video_stitch`** / **`ffmpeg_stitch`** — Concatenate multiple clips into one video. Free.

Inputs: `clip_1`, `clip_2`, `clip_3`, ... (video URLs or paths, sorted by key name). Can also include `transition_1_2`, `transition_2_3` between clips.
Output: `path` (stitched video)

When to use: Final assembly of all generated clips + transitions into one continuous video.

---

**`ffmpeg_grade`** — Apply color grading to a video. Free.

Inputs: `video` (video path)
Params: `environment_key` (grading profile name)
Output: `path` (graded video)

---

**`ffmpeg_overlay`** — Burn text onto a video. Free.

Inputs: `video` (video path)
Params: `text` (content), `font_size` (default 48), `color` (default "white"), `position` ("center", "top", or "bottom")
Output: `path` (video with text)

When to use: Adding CTAs, watermarks, captions, branded text to final clips.

---

**`character_ref`** — Pass-through node that holds a character image URL. Free.

Params: `image_url` (character portrait path or URL)
Output: `url` (same image)

When to use: Anchor node that other keyframe nodes reference. Drag character images from the media gallery onto the canvas to create these automatically.

#### Building a Workflow

For each scene, build the full pipeline: **keyframe → video + TTS → lip sync**. If the scene has narration, always include TTS and lip sync nodes.

```
# 1. Create workflow
lorekit_workflow_create(project_id="...")

# 2. Add character reference node
lorekit_workflow_add_node(project_id="...", type="character_ref", label="Character",
  params='{"image_url": "path/to/character.png"}')

# 3. For each scene, add the full pipeline:

# 3a. Keyframe (image generation)
lorekit_workflow_add_node(project_id="...", type="kontext_keyframe", label="Scene 1 Keyframe",
  params='{"prompt": "...", "scene_id": 1, "aspect_ratio": "9:16"}')

# 3b. Video clip (from keyframe)
lorekit_workflow_add_node(project_id="...", type="kling_v3_pro", label="Scene 1 Video",
  params='{"prompt": "...", "duration": 5, "scene_id": 1}',
  inputs='{"start_image": "<keyframe_node_id>.outputs.url"}')

# 3c. TTS narration (with character_id for auto voice resolution)
lorekit_workflow_add_node(project_id="...", type="tts_minimax", label="Scene 1 TTS",
  params='{"scene_id": 1, "character_id": "<character_id>"}')

# 3d. Lip sync (combines video + audio)
lorekit_workflow_add_node(project_id="...", type="lipsync", label="Scene 1 Lip Sync",
  params='{"scene_id": 1}',
  inputs='{"video": "<video_node_id>.outputs.url", "audio": "<tts_node_id>.outputs.url"}')

# 4. Connect character ref to keyframes
lorekit_workflow_connect(project_id="...",
  from_node="<char_ref_id>", output_key="url",
  to_node="<keyframe_id>", input_key="ref_1")

# 5. Execute
lorekit_workflow_execute(project_id="...")
```

#### Legacy Per-Scene Generation (still works)
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

### Clone Yourself (AI Avatar)
1. Upload 3-5 reference photos of the person via `lorekit_character_reference_image_upload`
2. Workflow: `character_ref` → `kontext_keyframe` (with all refs) → `kling_v3_pro`
3. For face-perfect results: add `face_swap` node between keyframe and video — use a real photo as `source_face`, keyframe output as `target_image`

### Person Replacement in Existing Video
1. `download` node to fetch the source video
2. `extract_frames` to pull key frames
3. `face_swap` on each frame with the target person's face
4. `kling_v3_pro` to animate each swapped frame
5. `video_stitch` to reassemble

### Product Placement
1. `kontext_edit` — take a scene image, prompt: "Add a [product] on the table, natural lighting"
2. `kling_v3_pro` — animate the edited image into video
3. `ffmpeg_overlay` — add product name/CTA text

### Import & Remix
1. `download` — fetch any video URL
2. `extract_frames` — pull timestamps you want
3. `kontext_edit` — modify extracted frames (change style, add elements)
4. `kling_v3_pro` — re-animate modified frames
5. `video_stitch` + `ffmpeg_grade` — assemble and color-match

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
