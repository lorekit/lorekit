# Roadmap: Universal Video Platform Refactor

**Goal:** Remove all philosophy/civilization coupling from LoreKit so it can produce any kind of video — UGC ads, anime, car content, cooking, real estate, AI clones, and anything else.

**Approach:** Test-driven development. Write failing tests first, then implement until they pass.

**Database:** Fresh start is acceptable. No legacy migration needed.

---

## Phase 1: Core Config — Environment Presets (TDD)

Remove `CivilizationPreset` class and `CIVILIZATIONS` dict. Replace with `EnvironmentPreset` and `BUILTIN_ENVIRONMENTS`.

### Tests to write first (`tests/test_config.py`)

```
test_environment_preset_has_required_fields       — color_grade, font, text_color, text_shadow
test_get_environment_returns_preset_for_known_key  — "roman" returns roman preset
test_get_environment_returns_neutral_for_unknown   — "anything_new" returns neutral default (NOT KeyError)
test_builtin_environments_includes_modern          — "modern" key exists
test_vibe_presets_includes_ugc_selfie             — "ugc_selfie" key exists with prompt + character_prompt
test_no_civilization_references_in_config          — grep config.py for "civilization" → 0 hits
```

### Action items

- [ ] Create `tests/test_config.py` with above tests (all fail initially)
- [ ] `lorekit/config.py`: Rename `CivilizationPreset` → `EnvironmentPreset`
- [ ] `lorekit/config.py`: Remove `EnvironmentPreset = CivilizationPreset` alias
- [ ] `lorekit/config.py`: Rename `CIVILIZATIONS` → `BUILTIN_ENVIRONMENTS`
- [ ] `lorekit/config.py`: Replace `get_civilization()` with `get_environment()` — returns neutral default for unknown keys
- [ ] `lorekit/config.py`: Add `"modern"` entry to `BUILTIN_ENVIRONMENTS`
- [ ] `lorekit/config.py`: Add `"ugc_selfie"` entry to `VIBE_PRESETS`
- [ ] Run tests → all pass

---

## Phase 2: Video Prompt Builder (TDD)

Remove `civilization_config` parameter naming. Add UGC prompt overrides.

### Tests to write first (`tests/test_prompt_builder.py`)

```
test_build_video_prompt_basic                     — returns string with scene visual_description
test_build_video_prompt_with_character             — includes character description when character_present=True
test_build_video_prompt_no_character               — includes "No people" when character_present=False
test_build_video_prompt_skip_character             — omits character desc when skip_character=True
test_ugc_selfie_theme_injects_phone_camera        — theme="ugc_selfie" prompt contains "iPhone" or "phone"
test_ugc_selfie_theme_no_cinematic                — theme="ugc_selfie" prompt does NOT contain "ARRI" or "dolly"
test_dark_masculine_theme_injects_arri            — theme="dark_masculine" still works as before
test_no_civilization_parameter_name                — function signature has "environment_config" not "civilization_config"
```

### Action items

- [ ] Create `tests/test_prompt_builder.py` with above tests
- [ ] `lorekit/video/prompt_builder.py`: Rename `civilization_config` → `environment_config` parameter
- [ ] `lorekit/video/prompt_builder.py`: Add `"ugc_selfie"` to `_THEME_VIDEO_OVERRIDES`
- [ ] Update all callers of `build_video_prompt` (in `video/generator.py`)
- [ ] Run tests → all pass

---

## Phase 3: Story Templates — UGC Reaction Arc (TDD)

Add `ugc_reaction` arc template for single-scene 3-5 second clips.

### Tests to write first (`tests/test_templates.py`)

```
test_arc_templates_registry_has_story              — "story" in ARC_TEMPLATES
test_arc_templates_registry_has_rapid_montage      — "rapid_montage" in ARC_TEMPLATES
test_arc_templates_registry_has_ugc_reaction       — "ugc_reaction" in ARC_TEMPLATES
test_ugc_reaction_single_scene                    — max_scenes=1, min_scenes=1
test_ugc_reaction_short_duration                  — min_duration=3, max_duration=5
test_ugc_reaction_has_reaction_beat               — beats[0]["beat"] == "reaction"
test_get_arc_template_unknown_raises              — get_arc_template("nonexistent") raises KeyError
```

### Action items

- [ ] Create `tests/test_templates.py` with above tests
- [ ] `lorekit/story/templates.py`: Add `UGC_REACTION_ARC` definition
- [ ] `lorekit/story/templates.py`: Register in `ARC_TEMPLATES` dict
- [ ] Run tests → all pass

---

## Phase 4: Story Generator — Remove Philosophy System Prompt (TDD)

Generalize `_build_system_prompt()` and remove `CIVILIZATION_CONTEXTS`.

### Tests to write first (`tests/test_story_generator.py`)

```
test_system_prompt_says_character_not_philosopher  — "CHARACTER:" in prompt, "PHILOSOPHER" not in prompt
test_system_prompt_says_world_not_civilization     — "WORLD:" in prompt, "CIVILIZATION:" not in prompt
test_system_prompt_no_philosophy_videos            — "philosophy" not in prompt
test_system_prompt_includes_character_name         — character.name appears in prompt
test_system_prompt_era_included_when_set           — era="Modern" appears; era="" does not add "()"
test_story_context_parameter_used_when_provided    — explicit story_context appears in prompt
test_story_context_falls_back_to_theme_context     — theme="dark_masculine" uses THEME_CONTEXTS
test_story_context_generic_default                — unknown theme + no context → generic default (no "Roman")
test_no_civilization_contexts_import               — CIVILIZATION_CONTEXTS does not exist
```

### Action items

- [ ] Create `tests/test_story_generator.py` with above tests
- [ ] Delete `lorekit/story/prompts/roman.py`
- [ ] Delete `lorekit/story/prompts/chinese.py`
- [ ] Delete `lorekit/story/prompts/japanese.py`
- [ ] Delete `lorekit/story/prompts/greek.py`
- [ ] Update `lorekit/story/prompts/dark_masculine.py` docstring (remove "civilization" references)
- [ ] Create `lorekit/story/prompts/ugc_selfie.py` — UGC story context
- [ ] `lorekit/story/generator.py`: Delete `CIVILIZATION_CONTEXTS` dict and all its imports
- [ ] `lorekit/story/generator.py`: Add `story_context: str | None = None` param to `generate_story()`
- [ ] `lorekit/story/generator.py`: Replace "PHILOSOPHER" → "CHARACTER", "CIVILIZATION" → "WORLD" in `_build_system_prompt()`
- [ ] `lorekit/story/generator.py`: Replace "the philosopher" → "the character" (all occurrences)
- [ ] `lorekit/story/generator.py`: Replace "vertical philosophy videos" → "vertical videos"
- [ ] `lorekit/story/generator.py`: Register `"ugc_selfie"` in `THEME_CONTEXTS`
- [ ] `lorekit/story/generator.py`: Resolution chain: explicit story_context → THEME_CONTEXTS[theme] → generic default
- [ ] Run tests → all pass

---

## Phase 5: Character Descriptions — Remove Hardcoded Data (TDD)

Delete all 10 philosopher descriptions, 12 themed descriptions, 4 environment descriptions. DB is the only source of truth.

### Tests to write first (`tests/test_characters.py`)

```
test_get_character_description_from_db_base       — db_base_description provided → returns it
test_get_character_description_from_db_themed      — db_descriptions_json[theme] → returns themed
test_get_character_description_generic_fallback    — nothing provided → generic (NOT "ancient philosopher")
test_generic_fallback_no_philosopher_reference     — fallback does not contain "philosopher" or "ancient"
test_get_environment_description_generic_fallback  — unknown key → generic (NOT "ancient civilization")
test_environment_fallback_no_civilization_reference — fallback does not contain "civilization" or "ancient"
test_no_hardcoded_default_characters               — _DEFAULT_CHARACTERS does not exist
test_no_hardcoded_environment_descriptions         — _ENVIRONMENT_DESCRIPTIONS does not exist
```

### Action items

- [ ] Create `tests/test_characters.py` with above tests
- [ ] `lorekit/video/characters.py`: Delete `_DEFAULT_CHARACTERS` dict
- [ ] `lorekit/video/characters.py`: Delete `_THEMED_CHARACTERS` dict
- [ ] `lorekit/video/characters.py`: Delete `_ENVIRONMENT_DESCRIPTIONS` dict
- [ ] `lorekit/video/characters.py`: Delete `_THEMED_ENVIRONMENTS` dict
- [ ] `lorekit/video/characters.py`: Remove `CIVILIZATIONS` import
- [ ] `lorekit/video/characters.py`: Simplify `get_character_description()` — DB themed → DB base → generic
- [ ] `lorekit/video/characters.py`: Simplify `get_environment_description()` — DB only → generic
- [ ] `lorekit/video/characters.py`: Generic fallback: `"A character in their natural setting."`
- [ ] `lorekit/video/characters.py`: Generic env fallback: `"A setting appropriate to the story."`
- [ ] Run tests → all pass

---

## Phase 6: Video Generator — Graceful Environment Lookup (TDD)

Replace all `get_civilization()` calls with `get_environment()`.

### Tests to write first (`tests/test_video_generator.py`)

```
test_resolve_vibe_known_theme                     — "dark_masculine" returns its prompt
test_resolve_vibe_unknown_theme_returns_default    — "anything" falls back (no crash)
test_resolve_vibe_ugc_selfie                      — "ugc_selfie" returns its prompt
test_no_get_civilization_import                    — "get_civilization" not imported in generator.py
test_keyframe_prompt_no_hardcoded_cinematic        — for ugc_selfie theme, keyframe prompt != "cinematic framing"
```

### Action items

- [ ] Create `tests/test_video_generator.py` with above tests
- [ ] `lorekit/video/generator.py`: Replace `get_civilization` → `get_environment` (lines 85-86, 173-175)
- [ ] `lorekit/video/generator.py`: Rename `civ_config` → `env_config`
- [ ] `lorekit/video/generator.py`: Make keyframe framing text configurable (not hardcoded "cinematic framing")
- [ ] Run tests → all pass

---

## Phase 7: Color Grading — Remove Civilization Coupling (TDD)

### Tests to write first (`tests/test_color_grade.py`)

```
test_color_grade_known_environment                — "roman" returns valid ffmpeg filter
test_color_grade_unknown_environment_neutral       — "modern" returns "null" (neutral, no crash)
test_color_grade_with_override                    — color_grade_override dict used instead of lookup
test_no_civilization_variable_names                — no variable named "civilization" in color_grade.py
```

### Action items

- [ ] Create `tests/test_color_grade.py` with above tests
- [ ] `lorekit/assembly/color_grade.py`: Rename `civilization` → `environment_key` in all functions
- [ ] `lorekit/assembly/color_grade.py`: Replace `CIVILIZATIONS` import with `BUILTIN_ENVIRONMENTS`
- [ ] `lorekit/assembly/color_grade.py`: Move japanese film grain into `_GRADE_EXTRAS["japanese"]` dict
- [ ] Run tests → all pass

---

## Phase 8: Character Portraits — UGC Settings (TDD)

### Tests to write first (`tests/test_character_portraits.py`)

```
test_portrait_settings_dark_masculine_exists       — "dark_masculine" in _THEME_PORTRAIT_SETTINGS
test_portrait_settings_ugc_selfie_exists          — "ugc_selfie" in _THEME_PORTRAIT_SETTINGS
test_ugc_portrait_framing_mentions_selfie         — framing contains "selfie"
test_ugc_portrait_negative_anti_cinematic         — negative contains "NOT cinematic"
test_default_portrait_used_for_unknown_theme      — unknown theme → default settings (no crash)
```

### Action items

- [ ] Create `tests/test_character_portraits.py` with above tests
- [ ] `lorekit/api/character.py`: Add `"ugc_selfie"` to `_THEME_PORTRAIT_SETTINGS`
- [ ] Run tests → all pass

---

## Phase 9: Metadata — Remove Philosophy References (TDD)

### Tests to write first (`tests/test_metadata.py`)

```
test_system_prompt_no_philosophy                  — "philosophy" not in METADATA_SYSTEM_PROMPT
test_system_prompt_no_philosopher                 — "philosopher" not in METADATA_SYSTEM_PROMPT
test_user_template_says_character                 — "Character:" in template, "Philosopher:" not
test_validate_metadata_no_philosophy_tag_required — philosophy tag not force-added
test_fallback_metadata_no_ancient_wisdom          — "ancient wisdom" not in fallback
test_fallback_metadata_no_philosophy_tags         — "philosophy" not in fallback tags
```

### Action items

- [ ] Create `tests/test_metadata.py` with above tests
- [ ] `lorekit/publish/metadata.py`: Rewrite `METADATA_SYSTEM_PROMPT` — generic "YouTube Shorts metadata specialist"
- [ ] `lorekit/publish/metadata.py`: Replace "philosopher" → "character" in template
- [ ] `lorekit/publish/metadata.py`: Remove "philosophy" from required tags
- [ ] `lorekit/publish/metadata.py`: Rewrite `_fallback_metadata()` — generic title/description/tags
- [ ] Run tests → all pass

---

## Phase 10: API + DB Layer — Remove Legacy Aliases

### Tests to write first (`tests/test_legacy_cleanup.py`)

```
test_db_no_philosopher_id_params                  — "philosopher_id" not in db.py source
test_db_no_upsert_philosopher_alias               — hasattr(db, "upsert_philosopher") is False
test_db_no_civilization_param                     — "civilization" not in db.upsert_character signature
test_sources_database_no_philosopher_key          — "philosopher" not in database.py source (except compat parsing)
test_pipeline_no_philosophers_dict                — hasattr(pipeline, "PHILOSOPHERS") is False
test_pipeline_no_characters_hardcoded_dict        — no hardcoded character→civilization mapping
test_server_no_philosophers_router                — "philosophers" not in server.py source
test_api_generate_no_civilization_reference        — "civilization" not in generate.py source
test_api_sources_no_philosopher_param             — "philosopher" not in sources_routes.py source
```

### Action items

- [ ] Create `tests/test_legacy_cleanup.py` with above tests
- [ ] `lorekit/db.py`: Remove all `philosopher_id` keyword args from functions
- [ ] `lorekit/db.py`: Remove `upsert_philosopher` alias
- [ ] `lorekit/db.py`: Remove `civilization` keyword arg from `upsert_character`
- [ ] `lorekit/sources/database.py`: Update JSON parsing (`"philosopher"` → `"character"`)
- [ ] `lorekit/pipeline.py`: Remove `CHARACTERS` dict and `PHILOSOPHERS` alias
- [ ] `lorekit/pipeline.py`: Remove `CIVILIZATIONS` import
- [ ] `lorekit/pipeline.py`: Rename `civilization` variables → `environment_key`
- [ ] `lorekit/server.py`: Remove `philosophers_router` import and mount
- [ ] `lorekit/api/characters_routes.py`: Remove `legacy_router`
- [ ] `lorekit/api/sources_routes.py`: Remove `philosopher` query parameter
- [ ] `lorekit/api/generate.py`: Replace `get_civilization` → `get_environment`, rename `civ_config` → `env_config`
- [ ] `lorekit/cli.py`: Update any philosopher references
- [ ] Run tests → all pass

---

## Phase 11: Frontend Cleanup

### Action items

- [ ] `web/src/lib/api.ts`: Delete `Philosopher` type alias
- [ ] `web/src/lib/api.ts`: Delete `getPhilosophers`, `getPhilosopher`, `updatePhilosopher` aliases
- [ ] `web/src/lib/api.ts`: Remove `philosopher_id` from `getQuotes` params
- [ ] `web/src/lib/api.ts`: Rename `generateCharacterForPhilosopher` → remove (use existing character function)
- [ ] `web/src/stores/universe-store.ts`: Change `activeUniverseId: "philosophywise"` → `activeUniverseId: ""`
- [ ] `web/src/app/app/universes/new/page.tsx`: Update placeholder text
- [ ] `cd web && npm run build` — verify no TypeScript errors

---

## Phase 12: Final Verification — Full Codebase Grep

### Tests to write (`tests/test_no_legacy.py`)

```
test_no_philosopher_in_python_source              — grep lorekit/ for "philosopher" → 0 hits
test_no_civilization_in_python_source             — grep lorekit/ for "civilization" → 0 hits (except BUILTIN_ENVIRONMENTS comments)
test_no_ancient_wisdom_in_python_source           — grep lorekit/ for "ancient wisdom" → 0 hits
test_no_philosophy_in_python_source               — grep lorekit/ for "philosophy" → 0 hits
test_app_imports_cleanly                          — `from lorekit.server import app` succeeds
```

### Action items

- [ ] Create `tests/test_no_legacy.py` with above tests
- [ ] Run full grep scan — fix any remaining references
- [ ] `python -c "from lorekit.server import app"` — no import errors
- [ ] Run full test suite: `pytest tests/ -v` — all pass

---

## Phase 13: Money Lock Universe — Content Creation

No code changes. Uses the generalized platform.

### Action items

- [ ] Create "Money Lock" universe with `video_vibe_preset="ugc_selfie"`
- [ ] Create "modern" environment with neutral color grade, Inter font
- [ ] Create 5 characters (all group="modern"):
  - [ ] The Finance Bro (25M) — jawline, stubble, fade, suit jacket, white tee, silver watch
  - [ ] The Overwhelmed Mom (32F) — messy bun, gray sweatshirt, gold hoops, under-eye circles
  - [ ] The College Student (21F) — black hair, nose stud, band tee, gold chain
  - [ ] The Blue-Collar Grinder (28M) — dark beard, Carhartt hoodie, neon safety shirt
  - [ ] The Recent Grad (24F) — auburn hair, freckles, cream tank top, moon tattoo
- [ ] Upload reference images (or generate portraits with theme="ugc_selfie")
- [ ] Create source items (reaction-trigger phrases from UGC_PROMPTS.md)
- [ ] Generate test reaction clip: `arc_template="ugc_reaction"`, `theme="ugc_selfie"`, `target_duration=4`
- [ ] Review output — iterate on prompts if needed

---

## Test Commands

```bash
# Run all tests
pytest tests/ -v

# Run a specific phase's tests
pytest tests/test_config.py -v
pytest tests/test_prompt_builder.py -v
pytest tests/test_templates.py -v

# Run the final legacy check
pytest tests/test_no_legacy.py -v

# Full codebase grep (should return nothing)
grep -rn "philosopher\|civilization\|ancient wisdom\|philosophy" lorekit/ --include="*.py" | grep -v "BUILTIN_ENVIRONMENTS\|__pycache__"

# Import check
python -c "from lorekit.server import app; print('OK')"

# Frontend build check
cd web && npm run build
```

---

## Files Modified (21 files) + Created (8 test files + 1 prompt file) + Deleted (4 files)

### Modified
| File | Phase |
|------|-------|
| `lorekit/config.py` | 1 |
| `lorekit/video/prompt_builder.py` | 2 |
| `lorekit/story/templates.py` | 3 |
| `lorekit/story/generator.py` | 4 |
| `lorekit/story/prompts/dark_masculine.py` | 4 |
| `lorekit/video/characters.py` | 5 |
| `lorekit/video/generator.py` | 6 |
| `lorekit/assembly/color_grade.py` | 7 |
| `lorekit/api/character.py` | 8 |
| `lorekit/publish/metadata.py` | 9 |
| `lorekit/db.py` | 10 |
| `lorekit/sources/database.py` | 10 |
| `lorekit/pipeline.py` | 10 |
| `lorekit/server.py` | 10 |
| `lorekit/api/characters_routes.py` | 10 |
| `lorekit/api/sources_routes.py` | 10 |
| `lorekit/api/generate.py` | 10 |
| `lorekit/cli.py` | 10 |
| `web/src/lib/api.ts` | 11 |
| `web/src/stores/universe-store.ts` | 11 |
| `web/src/app/app/universes/new/page.tsx` | 11 |

### Created
| File | Phase |
|------|-------|
| `tests/test_config.py` | 1 |
| `tests/test_prompt_builder.py` | 2 |
| `tests/test_templates.py` | 3 |
| `tests/test_story_generator.py` | 4 |
| `tests/test_characters.py` | 5 |
| `tests/test_video_generator.py` | 6 |
| `tests/test_color_grade.py` | 7 |
| `tests/test_character_portraits.py` | 8 |
| `tests/test_metadata.py` | 9 |
| `tests/test_legacy_cleanup.py` | 10 |
| `tests/test_no_legacy.py` | 12 |
| `lorekit/story/prompts/ugc_selfie.py` | 4 |

### Deleted
| File | Phase |
|------|-------|
| `lorekit/story/prompts/roman.py` | 4 |
| `lorekit/story/prompts/chinese.py` | 4 |
| `lorekit/story/prompts/japanese.py` | 4 |
| `lorekit/story/prompts/greek.py` | 4 |
