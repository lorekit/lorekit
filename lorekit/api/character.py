"""Character image generation — per-theme reference images for consistent video.

Each character can have a character image per theme (mobile_game, cinematic,
dark_masculine, etc.).  Images are stored in ``character_images_json`` on the
character row as ``{theme: {url, local_path}}``.  The legacy
``character_image_url`` column is kept as the "default" (no-theme) image.

Helper ``get_character_image_url(character_id, theme)`` is the single place
clip generation should call to get the right portrait for Kling elements.
"""

from __future__ import annotations

import asyncio
import json as _json
import logging
from pathlib import Path

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from lorekit import db
from lorekit.config import get_settings, VIBE_PRESETS

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/character", tags=["character"])

# Flux Kontext Pro — text-to-image for character portraits
# Model ID: fal-ai/flux-pro/kontext/text-to-image
FAL_FLUX_KONTEXT_ENDPOINT = "https://queue.fal.run/fal-ai/flux-pro/kontext/text-to-image"


# ---------------------------------------------------------------------------
# Per-theme portrait prompt construction
# ---------------------------------------------------------------------------

_THEME_PORTRAIT_SETTINGS: dict[str, dict[str, str]] = {
    "dark_masculine": {
        "framing": (
            "Single still frame, 9:16 vertical composition, cinematic framing. "
            "Full body, facing camera, dramatic low-angle shot."
        ),
        "background": (
            "Pure black background with a single harsh rim light from behind. "
            "Volumetric fog and faint embers in the air. "
            "Deep crushed shadows, near-monochrome."
        ),
        "negative": (
            "NOT colorful, NOT bright, NOT cartoonish, NOT cute, NOT stylized, "
            "NOT mobile game, NOT warm lighting, NOT friendly."
        ),
    },
    "cinematic": {
        "framing": (
            "Single still frame, 9:16 vertical composition, cinematic framing. "
            "Full body, facing camera, dramatic golden-hour lighting."
        ),
        "background": (
            "Atmospheric environment with shallow depth of field. "
            "Rich cinematic lighting, film grain."
        ),
        "negative": "NOT cartoon, NOT stylized, NOT game art.",
    },
}

_DEFAULT_PORTRAIT_SETTINGS = {
    "framing": "Full body, front-facing, looking at camera.",
    "background": "Plain warm gradient background.",
    "negative": "",
}


def _build_character_prompt(
    name: str,
    char_desc: str,
    vibe: str,
    theme: str | None = None,
) -> str:
    """Build the image-gen prompt, adapting framing + background to the theme."""
    settings = _THEME_PORTRAIT_SETTINGS.get(theme or "", _DEFAULT_PORTRAIT_SETTINGS)
    framing = settings.get("framing", _DEFAULT_PORTRAIT_SETTINGS["framing"])
    background = settings.get("background", _DEFAULT_PORTRAIT_SETTINGS["background"])
    negative = settings.get("negative", "")

    parts = [
        framing,
        f"{name}. {char_desc}.",
        background,
        vibe,
    ]
    if negative:
        parts.append(negative)
    return " ".join(parts)[:2500]


# ---------------------------------------------------------------------------
# Per-theme image storage helpers
# ---------------------------------------------------------------------------

async def _load_character_images(character_id: str) -> dict[str, dict]:
    """Load the theme -> {url, local_path} map from the DB."""
    conn = await db.connect()
    try:
        cursor = await conn.execute(
            "SELECT character_images_json, character_image_url FROM characters WHERE id = ?",
            (character_id,),
        )
        row = await cursor.fetchone()
        if not row:
            return {}
        images: dict = _json.loads(row[0] or "{}") if row[0] else {}
        # Ensure the legacy default URL is also in the map
        if row[1] and "default" not in images:
            images["default"] = {"url": row[1], "local_path": None}
        return images
    finally:
        await conn.close()


async def _save_character_image(
    character_id: str,
    theme: str,
    url: str,
    local_path: str,
) -> None:
    """Upsert one themed image into the character's character_images_json."""
    conn = await db.connect()
    try:
        cursor = await conn.execute(
            "SELECT character_images_json FROM characters WHERE id = ?",
            (character_id,),
        )
        row = await cursor.fetchone()
        images: dict = _json.loads(row[0] or "{}") if row and row[0] else {}

        images[theme] = {"url": url, "local_path": local_path}

        await conn.execute(
            "UPDATE characters SET character_images_json = ? WHERE id = ?",
            (_json.dumps(images), character_id),
        )
        # Also keep legacy column in sync with the latest generation
        await conn.execute(
            "UPDATE characters SET character_image_url = ? WHERE id = ?",
            (url, character_id),
        )
        await conn.commit()
    finally:
        await conn.close()


async def get_character_image_url(
    character_id: str,
    theme: str | None = None,
) -> str | None:
    """Get the character image URL for a character + theme.

    This is the single function that clip generation should call.
    Falls back: themed image -> default image -> None.
    """
    images = await _load_character_images(character_id)
    if theme and theme in images:
        return images[theme].get("url")
    if "default" in images:
        return images["default"].get("url")
    # Legacy fallback: check the old column directly
    conn = await db.connect()
    try:
        cursor = await conn.execute(
            "SELECT character_image_url FROM characters WHERE id = ?",
            (character_id,),
        )
        row = await cursor.fetchone()
        return row[0] if row and row[0] else None
    finally:
        await conn.close()


# ---------------------------------------------------------------------------
# Image generation
# ---------------------------------------------------------------------------

async def _generate_single_image(prompt: str, headers: dict) -> str:
    """Generate one image via Flux Kontext Pro and return its URL."""
    payload = {
        "prompt": prompt,
        "aspect_ratio": "9:16",
        "output_format": "png",
        "safety_tolerance": 6,
    }

    async with httpx.AsyncClient(timeout=120.0) as client:
        resp = await client.post(FAL_FLUX_KONTEXT_ENDPOINT, json=payload, headers=headers)
        resp.raise_for_status()
        job = resp.json()
        request_id = job["request_id"]

        # Log the full job response so we can debug URL issues
        logger.info("Flux Kontext submit response: %s", _json.dumps(job, default=str))

        status_url = job.get("status_url", f"{FAL_FLUX_KONTEXT_ENDPOINT}/requests/{request_id}/status")
        response_url = job.get("response_url", f"{FAL_FLUX_KONTEXT_ENDPOINT}/requests/{request_id}")

        logger.info("Flux Kontext job %s — status: %s — result: %s", request_id, status_url, response_url)

        for _ in range(120):  # ~6 min max
            await asyncio.sleep(3)
            status_resp = await client.get(status_url, headers=headers)
            status_resp.raise_for_status()
            status_data = status_resp.json()
            if status_data.get("status") == "COMPLETED":
                break
            elif status_data.get("status") in ("FAILED", "CANCELLED"):
                raise HTTPException(status_code=500, detail="Image generation failed")
        else:
            raise HTTPException(status_code=504, detail="Image generation timed out")

        # Try response_url first, fall back to constructed URL
        logger.info("Flux Kontext job %s completed — fetching from %s", request_id, response_url)
        result_resp = await client.get(response_url, headers=headers)
        if result_resp.status_code == 404:
            # response_url from fal may use canonical model path; try constructed URL
            fallback_url = f"{FAL_FLUX_KONTEXT_ENDPOINT}/requests/{request_id}"
            logger.warning("response_url 404, trying fallback: %s", fallback_url)
            result_resp = await client.get(fallback_url, headers=headers)
        result_resp.raise_for_status()
        result_data = result_resp.json()

    images = result_data.get("images", [])
    if not images:
        raise HTTPException(status_code=500, detail="No image in Flux response")
    return images[0]["url"]


async def _generate_and_store(
    character_id: str,
    character_name: str,
    theme: str,
    char_desc: str,
    fal_key: str,
) -> dict:
    """Generate a character image for a character+theme, save it, return metadata."""
    vibe = VIBE_PRESETS.get(theme, {}).get("prompt", "")
    if not vibe:
        settings = get_settings()
        vibe = settings.video_vibe

    headers = {
        "Authorization": f"Key {fal_key}",
        "Content-Type": "application/json",
    }

    prompt = _build_character_prompt(character_name, char_desc, vibe, theme)
    image_url = await _generate_single_image(prompt, headers)

    # Save locally
    chars_dir = Path("characters")
    chars_dir.mkdir(exist_ok=True)
    local_path = str(chars_dir / f"{character_id}_{theme}_character.png")

    async with httpx.AsyncClient(timeout=60.0) as client:
        img_resp = await client.get(image_url)
        img_resp.raise_for_status()
        with open(local_path, "wb") as f:
            f.write(img_resp.content)

    # Store in the per-theme map
    await _save_character_image(character_id, theme, image_url, local_path)

    return {
        "image_url": image_url,
        "local_path": local_path,
        "theme": theme,
        "reused": False,
    }


# ---------------------------------------------------------------------------
# API endpoints
# ---------------------------------------------------------------------------

class GenerateCharacterRequest(BaseModel):
    project_id: str
    custom_description: str | None = None
    theme: str | None = None
    force: bool = False


@router.post("/generate")
async def generate_character_image(body: GenerateCharacterRequest) -> dict:
    """Generate a character reference image for a project.

    Stores the image per-theme on the character so it can be reused.
    Also copies the URL to the project for quick access.
    """
    project = await db.get_project(body.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    character_id = project["character_id"]
    theme = body.theme or "default"

    from lorekit.sources.database import get_character
    from lorekit.video.characters import get_character_description as get_themed_char

    conn = await db.connect()
    try:
        character = await get_character(conn, character_id)
    finally:
        await conn.close()

    # Check for existing themed image (unless force regenerate)
    if not body.force and not body.custom_description:
        images = await _load_character_images(character_id)
        if theme in images and images[theme].get("url"):
            existing_url = images[theme]["url"]
            await db.update_project(
                body.project_id,
                character_image_url=existing_url,
                character_image_path=images[theme].get("local_path", ""),
            )
            return {
                "image_url": existing_url,
                "local_path": images[theme].get("local_path"),
                "reused": True,
                "theme": theme,
            }

    # Generate new image
    settings = get_settings()
    char_desc = body.custom_description or get_themed_char(character_id, theme=theme if theme != "default" else None)

    result = await _generate_and_store(
        character_id, character.name, theme, char_desc, settings.fal_key,
    )

    # Copy to project
    await db.update_project(
        body.project_id,
        character_image_url=result["image_url"],
        character_image_path=result["local_path"],
    )

    return result


class GenerateForCharacterRequest(BaseModel):
    character_id: str
    custom_description: str | None = None
    theme: str | None = None
    force: bool = False


@router.post("/generate-for-character")
async def generate_character_for_character(body: GenerateForCharacterRequest) -> dict:
    """Generate a character image for a character (no project needed).

    Stores per-theme so you can generate all themes and browse them.
    """
    from lorekit.sources.database import get_character
    from lorekit.video.characters import get_character_description as get_themed_char

    theme = body.theme or "default"

    conn = await db.connect()
    try:
        character = await get_character(conn, body.character_id)

        # Check existing
        if not body.force and not body.custom_description:
            images = await _load_character_images(body.character_id)
            if theme in images and images[theme].get("url"):
                return {
                    "image_url": images[theme]["url"],
                    "local_path": images[theme].get("local_path"),
                    "reused": True,
                    "theme": theme,
                }
    finally:
        await conn.close()

    settings = get_settings()
    char_desc = body.custom_description or get_themed_char(body.character_id, theme=theme if theme != "default" else None)

    return await _generate_and_store(
        body.character_id, character.name, theme, char_desc, settings.fal_key,
    )


# Backward-compatible endpoint
@router.post("/generate-for-philosopher")
async def generate_character_for_philosopher_legacy(body: GenerateForCharacterRequest) -> dict:
    """Legacy endpoint: generate a character image for a character (no project needed)."""
    return await generate_character_for_character(body)


@router.get("/images/{character_id}")
async def list_character_images(character_id: str) -> dict:
    """List all themed character images for a character.

    Returns a dict of theme -> {url, local_path} so the frontend can
    display them as a scrollable gallery with theme labels.
    """
    images = await _load_character_images(character_id)
    # Add theme display names
    result: list[dict] = []
    for theme_key, data in images.items():
        preset = VIBE_PRESETS.get(theme_key, {})
        result.append({
            "theme": theme_key,
            "theme_name": preset.get("name", theme_key.replace("_", " ").title()),
            "url": data.get("url"),
            "local_path": data.get("local_path"),
        })
    return {"character_id": character_id, "images": result}
