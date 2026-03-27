# Video Generation Pipeline — Architecture

Last updated: 2026-03-26

## Files

| File | Purpose |
|------|---------|
| `philosophywise/video/generator.py` | Main orchestrator — routes scenes, manages Flux + Kling jobs |
| `philosophywise/video/prompt_builder.py` | Builds prompts by layering scene + character + vibe |
| `philosophywise/api/generate.py` | API endpoints that call the generator |
| `philosophywise/api/character.py` | Character portrait generation (Flux Kontext Pro) |
| `philosophywise/config.py` | Global settings including vibe presets |

## Models Used

| Step | Model | Endpoint | Purpose |
|------|-------|----------|---------|
| Character portrait | Flux Kontext Pro | `fal-ai/flux-kontext/pro/v1` | Generate consistent character reference |
| Keyframe (with portrait) | Flux Dev img2img | `fal-ai/flux/dev/image-to-image` | Transform portrait into scene composition |
| Keyframe (no portrait) | Flux Dev t2i | `fal-ai/flux/dev` | Generate scene composition from text |
| Character video | Kling V3 Pro i2v | `fal-ai/kling-video/v3/pro/image-to-video` | Animate with native character elements |
| Environment video | Kling O3 Standard i2v | `fal-ai/kling-video/o3/standard/image-to-video` | Best visual quality for landscapes |

## Decision Flow Per Scene

```
Scene data (character_present, visual_description, camera)
        │
        ▼
character_present == True AND character_image_url exists?
        │
        ├── YES → Route 1: KLING V3 PRO + ELEMENTS
        │   1. Flux img2img: portrait → scene keyframe (keeps face DNA)
        │   2. Kling V3 Pro i2v:
        │      - start_image_url: the keyframe
        │      - elements: [{ frontal_image_url: portrait }]
        │      - prompt: scene + camera + vibe + "@Element1 is the main character"
        │      → CHARACTER-CONSISTENT animated clip
        │
        ├── character_present == True but NO portrait?
        │   └── Route 2: KLING V3 PRO (no elements)
        │       1. Flux t2i: full prompt (incl. character desc) → keyframe
        │       2. Kling V3 Pro i2v:
        │          - start_image_url: the keyframe
        │          - prompt: full prompt with character description
        │          → Best-effort character clip (no reference image)
        │
        └── character_present == False
            └── Route 3: KLING O3
                1. Flux t2i: scene + vibe prompt → keyframe
                2. Kling O3 i2v:
                    - image_url: the keyframe (O3 uses image_url, not start_image_url)
                    - prompt: scene + camera + vibe
                    → High-quality environment/landscape clip
```

## Prompt Building (prompt_builder.py)

`build_video_prompt(scene, philosopher, civ_config, vibe_text, skip_character=False)`

1. **Scene visual_description** — always included
2. **Camera direction** — always included if present
3. **Character appearance** — included when `character_present=True` AND `skip_character=False`
4. **Global vibe** — always included (from active vibe preset)
5. **Technical** — "Smooth fluid motion. No text, no subtitles, no watermarks."

Two prompts are built per character scene:
- `full_prompt` — includes character description (for keyframe generation)
- `anim_prompt` — skips character description (elements handle it in V3 Pro)

## Character Consistency Strategy

The key insight: **Kling V3 Pro's native `elements` feature** handles character consistency
at the model level. Instead of relying on img2img strength hacks:

1. Portrait generated once via Flux Kontext Pro (stored per philosopher)
2. Flux img2img transforms portrait into each scene's composition (face DNA preserved)
3. Kling V3 Pro receives both the keyframe AND the portrait as an element
4. Model natively understands "@Element1 is the main character" and maintains consistency

## Vibe Presets

`config.py` defines `VIBE_PRESETS`:
- `mobile_game` — Colorful Clash of Clans style (default)
- `cinematic` — Gladiator-meets-documentary photorealism
- `stylized_cinematic` — Arcane / animated epic
- `custom` — User writes their own prompt

## API Differences: V3 Pro vs O3

| Feature | V3 Pro i2v | O3 Standard i2v |
|---------|-----------|-----------------|
| Start image field | `start_image_url` | `image_url` |
| Character elements | ✅ `elements` array | ❌ Not supported |
| End frame | ✅ `end_image_url` | ✅ `end_image_url` |
| Multi-prompt | ✅ | ✅ |
| Duration | "3"-"15" (any second) | "3"-"15" (any second) |
| Native audio | ✅ `generate_audio` | ✅ `generate_audio` |
| Negative prompt | ✅ | ❌ |
| cfg_scale | ✅ (0-1) | ❌ |

## Cost Estimates

| Step | Cost |
|------|------|
| Flux Kontext Pro (portrait, once per philosopher) | ~$0.04 |
| Flux keyframe (per scene) | ~$0.04 |
| Kling V3 Pro i2v (per second) | ~$0.14/s |
| Kling O3 i2v (per second) | ~$0.10/s |
| **Typical 35s video (4 char scenes + 3 env scenes)** | **~$4-6** |
