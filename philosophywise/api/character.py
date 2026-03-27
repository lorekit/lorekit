"""Character image generation — create reference images for consistent video."""

from __future__ import annotations

import asyncio
import logging
from pathlib import Path

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from philosophywise import db
from philosophywise.config import get_settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/character", tags=["character"])

# Use fal.ai Flux Kontext Pro for high-quality character portraits
FAL_FLUX_KONTEXT_ENDPOINT = "https://queue.fal.run/fal-ai/flux-kontext/pro/v1"


async def _generate_single_image(prompt: str, headers: dict) -> str:
    """Generate one image via Flux Kontext Pro and return its URL."""
    payload = {
        "prompt": prompt,
        "aspect_ratio": "9:16",
        "output_format": "png",
        "safety_tolerance": 6,
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(FAL_FLUX_KONTEXT_ENDPOINT, json=payload, headers=headers)
        resp.raise_for_status()
        job = resp.json()
        request_id = job["request_id"]
        status_url = job.get("status_url", f"{FAL_FLUX_KONTEXT_ENDPOINT}/requests/{request_id}/status")

        while True:
            await asyncio.sleep(3)
            status_resp = await client.get(status_url, headers=headers)
            status_resp.raise_for_status()
            status_data = status_resp.json()
            if status_data.get("status") == "COMPLETED":
                break
            elif status_data.get("status") in ("FAILED", "CANCELLED"):
                raise HTTPException(status_code=500, detail="Image generation failed")

        result_url = status_url.replace("/status", "") if status_url.endswith("/status") else f"{FAL_FLUX_KONTEXT_ENDPOINT}/requests/{request_id}"
        result_resp = await client.get(result_url, headers=headers)
        result_resp.raise_for_status()
        result_data = result_resp.json()

    images = result_data.get("images", [])
    if not images:
        raise HTTPException(status_code=500, detail="No image in Flux response")
    return images[0]["url"]


class GenerateCharacterRequest(BaseModel):
    project_id: str
    custom_description: str | None = None
    force: bool = False  # Force regenerate even if philosopher already has one


@router.post("/generate")
async def generate_character_image(body: GenerateCharacterRequest) -> dict:
    """Generate a character reference image.

    If the philosopher already has a character image and force=False,
    reuses the existing one (saves money). The image is stored on both
    the philosopher (shared across projects) and the project (for this video).
    """
    project = await db.get_project(body.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    philosopher_id = project["philosopher_id"]

    # Get philosopher data
    from philosophywise.quotes.database import get_philosopher

    conn = await db.connect()
    try:
        philosopher = await get_philosopher(conn, philosopher_id)

        # Check if philosopher already has a character image
        if not body.force and not body.custom_description:
            cursor = await conn.execute(
                "SELECT character_image_url FROM philosophers WHERE id = ?",
                (philosopher_id,),
            )
            row = await cursor.fetchone()
            existing_url = row[0] if row else None

            if existing_url:
                # Reuse existing — just link it to this project
                local_path = str(Path("characters") / f"{philosopher_id}_character.png")
                await db.update_project(
                    body.project_id,
                    character_image_url=existing_url,
                    character_image_path=local_path,
                )
                return {
                    "image_url": existing_url,
                    "local_path": local_path,
                    "reused": True,
                }
    finally:
        await conn.close()

    settings = get_settings()
    headers = {
        "Authorization": f"Key {settings.fal_key}",
        "Content-Type": "application/json",
    }

    char_desc = body.custom_description or philosopher.character_description

    # One strong portrait — the character description drives everything
    prompt = (
        f"{philosopher.name}. {char_desc}. "
        f"Full body, front-facing, looking at camera. "
        f"Plain warm gradient background. "
        f"{settings.video_vibe}"
    )

    frontal_url = await _generate_single_image(prompt, headers)
    all_ref_urls = [frontal_url]

    # Save frontal locally
    chars_dir = Path("characters")
    chars_dir.mkdir(exist_ok=True)

    philosopher_path = str(chars_dir / f"{philosopher_id}_character.png")
    project_path = str(chars_dir / f"{body.project_id}_character.png")

    async with httpx.AsyncClient(timeout=60.0) as client:
        img_resp = await client.get(frontal_url)
        img_resp.raise_for_status()
        img_data = img_resp.content
        with open(philosopher_path, "wb") as f:
            f.write(img_data)
        with open(project_path, "wb") as f:
            f.write(img_data)

    # Save to philosopher — frontal as main image, all as reference URLs (JSON)
    import json as _json
    conn = await db.connect()
    try:
        await conn.execute(
            "UPDATE philosophers SET character_image_url = ?, character_ref_urls = ? WHERE id = ?",
            (frontal_url, _json.dumps(all_ref_urls), philosopher_id),
        )
        await conn.commit()
    finally:
        await conn.close()

    # Save to project
    await db.update_project(
        body.project_id,
        character_image_url=frontal_url,
        character_image_path=project_path,
    )

    return {
        "image_url": frontal_url,
        "reference_urls": all_ref_urls,
        "local_path": project_path,
        "reused": False,
    }


class GenerateForPhilosopherRequest(BaseModel):
    philosopher_id: str
    custom_description: str | None = None
    force: bool = False


@router.post("/generate-for-philosopher")
async def generate_character_for_philosopher(body: GenerateForPhilosopherRequest) -> dict:
    """Generate a character image for a philosopher (no project needed)."""
    from philosophywise.quotes.database import get_philosopher

    conn = await db.connect()
    try:
        philosopher = await get_philosopher(conn, body.philosopher_id)

        # Check existing
        if not body.force and not body.custom_description:
            cursor = await conn.execute(
                "SELECT character_image_url FROM philosophers WHERE id = ?",
                (body.philosopher_id,),
            )
            row = await cursor.fetchone()
            existing_url = row[0] if row else None
            if existing_url:
                return {"image_url": existing_url, "reused": True}
    finally:
        await conn.close()

    settings = get_settings()
    char_desc = body.custom_description or philosopher.character_description
    headers = {
        "Authorization": f"Key {settings.fal_key}",
        "Content-Type": "application/json",
    }

    prompt = (
        f"{philosopher.name}. {char_desc}. "
        f"Full body, front-facing, looking at camera. "
        f"Plain warm gradient background. "
        f"{settings.video_vibe}"
    )

    frontal_url = await _generate_single_image(prompt, headers)
    image_urls = [frontal_url]

    # Save locally
    chars_dir = Path("characters")
    chars_dir.mkdir(exist_ok=True)
    local_path = str(chars_dir / f"{body.philosopher_id}_character.png")

    async with httpx.AsyncClient(timeout=60.0) as client:
        img_resp = await client.get(frontal_url)
        img_resp.raise_for_status()
        with open(local_path, "wb") as f:
            f.write(img_resp.content)

    # Save to philosopher with all reference URLs
    import json as _json
    conn = await db.connect()
    try:
        await conn.execute(
            "UPDATE philosophers SET character_image_url = ?, character_ref_urls = ? WHERE id = ?",
            (frontal_url, _json.dumps(image_urls), body.philosopher_id),
        )
        await conn.commit()
    finally:
        await conn.close()

    return {"image_url": frontal_url, "reference_urls": image_urls, "local_path": local_path, "reused": False}
