# LoreKit Workflow Nodes

LoreKit uses a node-based workflow system where each node is a single operation — generating an image, creating a video, swapping a face, stitching clips together. You build pipelines by connecting nodes: the output of one feeds into the input of the next.

Nodes can be added via the canvas UI ("+ Add Node") or programmatically via MCP tools (`lorekit_workflow_add_node`). Claude can compose entire pipelines from natural language instructions.

---

## Image Generation

### Kontext Keyframe
**Type:** `kontext_keyframe` | **Cost:** $0.04 | **API:** fal.ai Flux Pro Kontext Max Multi

Generates a high-quality image from a text prompt and up to 4 reference photos. This is the primary way to create character-consistent keyframes that serve as the starting frame for video generation.

**Params:**
| Name | Type | Default | Description |
|------|------|---------|-------------|
| `prompt` | string | required | Detailed scene description: character pose, expression, setting, lighting |
| `reference_images` | string[] | `[]` | Up to 4 image URLs that anchor the character's appearance |
| `aspect_ratio` | string | `"9:16"` | `"9:16"` (portrait/mobile) or `"16:9"` (landscape) |
| `scene_id` | int | — | Links this node to a timeline scene for clip↔timeline sync |

**Inputs:** `ref_1` through `ref_4` — alternative way to connect upstream image nodes as references

**Output:** `url` — generated image URL

**Tips:**
- Be specific: "25-year-old man in navy vest, standing on NYC rooftop at golden hour, looking directly at camera with confident smile" beats "man on rooftop"
- Reference images matter more than prompt for face consistency — use 2-4 photos of the same person from different angles
- For UGC content, describe the phone/camera angle: "selfie angle, arm extended, phone visible at bottom edge"

---

### Kontext Edit
**Type:** `kontext_edit` | **Cost:** $0.04 | **API:** fal.ai Flux Pro Kontext Max

Edits an existing image while preserving the person's identity. Change the background, swap clothing, add objects, adjust lighting — the face stays the same.

**Params:**
| Name | Type | Default | Description |
|------|------|---------|-------------|
| `prompt` | string | required | Edit instruction (NOT a full scene description) |
| `aspect_ratio` | string | `"9:16"` | Output aspect ratio |

**Inputs:** `image` — the source image to edit

**Output:** `url` — edited image URL

**Tips:**
- Write edit instructions, not full descriptions: "Change background to a busy coffee shop" not "Person sitting in a coffee shop with exposed brick walls..."
- Great for product placement: "Add a red energy drink can on the table in front of the person"
- Chain multiple edits: portrait → edit outfit → edit background → edit lighting
- Use for creating character "views" — same person in different locations/outfits

---

### Nano Banana 2
**Type:** `nano_banana` | **Cost:** $0.04 | **API:** fal.ai Nano Banana 2

Fast image generation supporting up to 14 reference images. Trades some quality for speed and broader reference support.

**Params:**
| Name | Type | Default | Description |
|------|------|---------|-------------|
| `prompt` | string | required | Scene description |
| `image_urls` | string[] | `[]` | Up to 14 reference image URLs |
| `aspect_ratio` | string | `"9:16"` | Output aspect ratio |

**Output:** `url` — generated image URL

**When to use:** Need more than 4 references for style consistency, or prioritize speed over maximum quality.

---

## Video Generation

### Kling V3 Pro
**Type:** `kling_v3_pro` | **Cost:** $0.14/sec | **API:** fal.ai Kling Video V3 Pro

Generates 3-15 second video from a keyframe image. The best model for character-focused scenes — maintains face identity throughout the clip using the `elements` system.

**Params:**
| Name | Type | Default | Description |
|------|------|---------|-------------|
| `prompt` | string | required | Motion/action description (max 2500 chars) |
| `duration` | int | `5` | Clip length in seconds (3-15) |
| `scene_id` | int | — | Links to timeline scene |
| `cfg_scale` | float | `0.5` | Guidance strength: lower = more creative, higher = more literal |
| `negative_prompt` | string | (see below) | What to avoid in generation |
| `elements` | object[] | `[]` | Character identity anchors (see below) |

**Default negative prompt:** `"static, frozen, text, subtitles, watermarks, logos, words, blurry, distorted"`

**Inputs:** `start_image` (required keyframe), `end_image` (optional — creates a seamless loop back to this frame)

**Output:** `url` — generated video URL

**Character elements** preserve identity throughout the video:
```json
{
  "elements": [{
    "frontal_image_url": "character_portrait.png",
    "reference_image_urls": ["side_angle.png", "three_quarter.png"]
  }]
}
```

**Tips:**
- Describe MOTION, not appearance — the keyframe establishes the look: "Slowly turns to camera, raises one eyebrow, breaks into a grin" not "handsome man in suit"
- 5 seconds is the sweet spot for most scenes. 3s for quick cuts, 10-15s for slow cinematic shots
- `cfg_scale` at 0.3 gives more natural/surprising motion; 0.7+ keeps it very close to the prompt
- Always use `elements` when the character's face needs to stay consistent
- `end_image` is powerful for creating perfect loops or ensuring smooth transitions

---

### Kling O3
**Type:** `kling_o3` | **Cost:** $0.10/sec | **API:** fal.ai Kling Video O3 Standard

Generates 3-15 second cinematic video. Optimized for environments, landscapes, and wide shots where character face consistency isn't the priority.

**Params:**
| Name | Type | Default | Description |
|------|------|---------|-------------|
| `prompt` | string | required | Scene/motion description |
| `duration` | int | `5` | Clip length in seconds (3-15) |

**Inputs:** `image_url` or `start_image` (keyframe), `end_image` (optional)

**Output:** `url` — generated video URL

**When to use:** Establishing shots, b-roll, nature footage, architecture, aerial views, any scene where you're not zoomed in on a person's face. 30% cheaper than V3 Pro.

---

### Transition
**Type:** `transition` | **Cost:** $0.14/sec | **API:** fal.ai Kling Video V3 Pro

Generates a smooth morph video between two clips. Can auto-extract the last frame of clip A and first frame of clip B, or accept explicit frame images.

**Params:**
| Name | Type | Default | Description |
|------|------|---------|-------------|
| `prompt` | string | `"Smooth cinematic transition"` | Transition style description |
| `duration` | int | `3` | Transition length (3-15s) |

**Inputs (option A — preferred):** `start_image` + `end_image` — explicit frame URLs
**Inputs (option B):** `from_clip` + `to_clip` — local video paths (frames auto-extracted)

**Output:** `url` — transition video URL

**Tips:**
- 3-5 seconds works best for most transitions
- Prompt controls the style: "Camera sweeps right", "Dissolve through smoke", "Zoom into eye then pull out to new scene"
- For seamless results, ensure the start/end frames have similar composition or color palette

---

## Transform

### Face Swap
**Type:** `face_swap` | **Cost:** $0.05 | **API:** fal.ai Face Swap

Replaces the face in a target image with a face from a source photo. The body, pose, lighting, and background of the target are preserved.

**Inputs:** `source_face` (the face to paste in), `target_image` (the image to modify)

**Output:** `url` — face-swapped image URL

**Use cases:**
- **Clone yourself:** Generate a keyframe with `kontext_keyframe`, then swap your real face in, then animate with `kling_v3_pro`
- **Person replacement:** Extract frames from existing video, swap faces, re-animate
- **Consistency:** When Kontext doesn't nail the face, face_swap fixes it

**Pipeline:** `kontext_keyframe` → `face_swap` → `kling_v3_pro`

---

### Upscale
**Type:** `upscale` | **Cost:** $0.02 | **API:** fal.ai Real-ESRGAN

Enlarges an image 2x or 4x with AI-powered detail enhancement.

**Params:**
| Name | Type | Default | Description |
|------|------|---------|-------------|
| `scale` | int | `2` | Upscale factor (2 or 4) |

**Inputs:** `image` — image to upscale

**Output:** `url` — upscaled image URL

**When to use:** Before final render when keyframes are low-res, for thumbnail/cover images, or when you need print-quality output. A 512px image at 4x becomes 2048px.

---

### Background Removal
**Type:** `bg_remove` | **Cost:** $0.02 | **API:** fal.ai Bria Background Removal

Removes the background from an image, producing a transparent PNG.

**Inputs:** `image` — image to process

**Output:** `url` — transparent PNG URL

**Use cases:**
- Isolate a character for compositing onto a different background
- Create sticker-style assets
- Prepare product images for placement via `kontext_edit`
- Clean up AI-generated images before further processing

---

## Audio

### MiniMax TTS
**Type:** `tts_minimax` | **Cost:** $0.06 | **API:** fal.ai MiniMax Speech 2.6 Turbo

Fast text-to-speech. Good default choice for narration.

**Params:** `text` (required), `voice_id` (optional)
**Output:** `url` — audio file URL

### Orpheus TTS
**Type:** `tts_orpheus` | **Cost:** $0.06 | **API:** fal.ai Orpheus TTS

Voice cloning TTS. Provide a reference audio sample and it generates speech in that voice.

**Params:** `text` (required), `voice_id` (optional), `reference_audio` (URL to voice sample)
**Output:** `url` — audio file URL

**When to use:** When you need a specific voice — clone a client's voice, match a character's persona, or create a consistent narrator across videos.

### ElevenLabs TTS
**Type:** `tts_elevenlabs` | **Cost:** $0.06 | **API:** fal.ai ElevenLabs Multilingual v2

High-quality multilingual text-to-speech.

**Params:** `text` (required), `voice_id` (optional)
**Output:** `url` — audio file URL

---

## Local Operations (Free)

These nodes run locally using ffmpeg — no API calls, no cost.

### Download
**Type:** `download`

Fetches any URL to local storage. Use to import videos, images, or audio from the internet.

**Inputs:** `url` (HTTP URL to fetch)
**Params:** `dest_path` (optional storage location)
**Output:** `path` (local file path), `url` (original URL)

### Extract Frames
**Type:** `extract_frames`

Pulls PNG frames from a video at specific timestamps.

**Inputs:** `video_path` (local video file)
**Params:** `timestamps` — list of seconds, e.g. `[0, 2.5, 5, 10]`
**Output:** `frames` — list of extracted PNG paths

**Use cases:** Pull frames for face swap, create thumbnails, extract key moments for re-animation.

### Video Stitch
**Type:** `video_stitch` (or `ffmpeg_stitch`)

Concatenates multiple video clips into one continuous video using ffmpeg's concat demuxer.

**Inputs:** `clip_1`, `clip_2`, `clip_3`, ... — video URLs or local paths, sorted by key name. Can include `transition_1_2`, `transition_2_3` between clips.
**Output:** `path` — stitched video file

### Color Grade
**Type:** `ffmpeg_grade`

Applies color grading to a video using a named grading profile.

**Inputs:** `video` (video path)
**Params:** `environment_key` (grading profile name)
**Output:** `path` — graded video file

### Text Overlay
**Type:** `ffmpeg_overlay`

Burns text directly onto a video using ffmpeg drawtext.

**Inputs:** `video` (video path)
**Params:**
| Name | Type | Default | Description |
|------|------|---------|-------------|
| `text` | string | `""` | Text content to overlay |
| `font_size` | int | `48` | Font size in pixels |
| `color` | string | `"white"` | Font color (any ffmpeg color name) |
| `position` | string | `"center"` | `"center"`, `"top"`, or `"bottom"` |

**Output:** `path` — video with text overlay

### Character Reference
**Type:** `character_ref`

Pass-through node that holds a character image URL. Other nodes connect to it to reference the character's portrait.

**Params:** `image_url` (portrait path or URL)
**Output:** `url` (same image)

Drag images from the media gallery onto the canvas to create these automatically.

---

## Pipeline Examples

### UGC Ad (single reaction clip)
```
character_ref → kontext_keyframe → kling_v3_pro
```

### Multi-Scene Video
```
character_ref → keyframe_1 → clip_1 ─┐
             → keyframe_2 → clip_2 ──┼→ video_stitch
             → keyframe_3 → clip_3 ─┘
                     clip_1 + clip_2 → transition_1
                     clip_2 + clip_3 → transition_2
```

### Clone Yourself into AI Scene
```
kontext_keyframe → face_swap (your photo as source_face) → kling_v3_pro
```

### Product Placement
```
kontext_keyframe → kontext_edit ("Add product on table") → kling_v3_pro → ffmpeg_overlay ("Buy Now")
```

### Import & Remix
```
download (YouTube URL) → extract_frames → face_swap → kling_v3_pro → video_stitch → ffmpeg_grade
```

### Upscale + Background Swap
```
kontext_keyframe → bg_remove → kontext_edit ("Place on beach sunset") → upscale (4x)
```
