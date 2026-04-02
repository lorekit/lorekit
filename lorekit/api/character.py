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
import ipaddress
import json as _json
import logging
import socket
import urllib.parse

import uuid
from pathlib import Path

import httpx
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel

from lorekit import db
from lorekit.auth.user import get_current_user, CurrentUser
from lorekit.config import get_settings, VIBE_PRESETS

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/character", tags=["character"])

# Image generation — all image gen uses Nano Banana 2
FAL_NANO_BANANA_2 = "https://queue.fal.run/fal-ai/nano-banana-2"


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
    return " ".join(parts)


# ---------------------------------------------------------------------------
# Per-theme image storage helpers
# ---------------------------------------------------------------------------

async def _load_character_styles(character_id: str) -> dict[str, dict]:
    """Load per-theme styles from character_styles_json."""
    pool = await db.get_pool()
    row = await pool.fetchrow(
        "SELECT character_styles_json, character_image_url FROM characters WHERE id = $1",
        character_id,
    )
    if not row:
        return {}
    styles: dict = _json.loads(row["character_styles_json"] or "{}") if row["character_styles_json"] else {}
    # Ensure the legacy default URL is also in the map
    if row["character_image_url"] and "default" not in styles:
        styles["default"] = {"image_url": row["character_image_url"], "image_path": None}
    return styles


def _load_character_images(styles: dict[str, dict]) -> dict[str, dict]:
    """Extract image data from styles dict (backward-compat helper)."""
    return {
        theme: {"url": data.get("image_url"), "local_path": data.get("image_path")}
        for theme, data in styles.items()
        if data.get("image_url")
    }


async def _save_character_image(
    character_id: str,
    theme: str,
    url: str,
    local_path: str,
) -> None:
    """Upsert one themed image into character_styles_json."""
    pool = await db.get_pool()
    row = await pool.fetchrow(
        "SELECT character_styles_json FROM characters WHERE id = $1",
        character_id,
    )
    styles: dict = _json.loads(row["character_styles_json"] or "{}") if row and row["character_styles_json"] else {}

    if theme not in styles:
        styles[theme] = {}
    styles[theme]["image_url"] = url
    styles[theme]["image_path"] = local_path

    async with pool.acquire() as conn:
        async with conn.transaction():
            await conn.execute(
                "UPDATE characters SET character_styles_json = $1 WHERE id = $2",
                _json.dumps(styles), character_id,
            )
            # Keep legacy column in sync
            await conn.execute(
                "UPDATE characters SET character_image_url = $1 WHERE id = $2",
                url, character_id,
            )


async def get_character_image_url(
    character_id: str,
    theme: str | None = None,
) -> str | None:
    """Get the character image URL for a character + theme.

    This is the single function that clip generation should call.
    Falls back: themed image -> default image -> None.

    Local /files/ URLs are uploaded to fal.ai CDN on-the-fly so that
    external services (Flux, Kling) can access them.
    """
    styles = await _load_character_styles(character_id)
    images = _load_character_images(styles)
    url: str | None = None
    if theme and theme in images:
        url = images[theme].get("url")
    elif "default" in images:
        url = images["default"].get("url")
    if not url:
        # Legacy fallback: check the old column directly
        pool = await db.get_pool()
        row = await pool.fetchrow(
            "SELECT character_image_url FROM characters WHERE id = $1",
            character_id,
        )
        url = row["character_image_url"] if row and row["character_image_url"] else None

    if not url:
        return None

    # If it's already a public URL, return as-is
    if url.startswith("http://") or url.startswith("https://"):
        return url

    # Local /files/ URL — upload to fal CDN so external services can access it
    resolved = await _resolve_ref_image_for_fal(url.split("?")[0])  # strip cache-buster
    return resolved or url


# ---------------------------------------------------------------------------
# Image generation
# ---------------------------------------------------------------------------

async def _generate_single_image(
    prompt: str, headers: dict, reference_image_urls: list[str] | None = None,
) -> str:
    """Generate one image via Nano Banana 2 and return its URL.

    If *reference_image_urls* is provided, they are passed as image_urls
    for identity preservation while applying the style described in the prompt.
    """
    payload: dict = {
        "prompt": prompt,
        "aspect_ratio": "9:16",
        "output_format": "png",
        "safety_tolerance": 6,
    }
    if reference_image_urls:
        payload["image_urls"] = reference_image_urls[:14]

    ref_count = len(reference_image_urls) if reference_image_urls else 0
    logger.info("Generating portrait with Nano Banana 2 (%d refs)", ref_count)

    async with httpx.AsyncClient(timeout=120.0) as client:
        resp = await client.post(FAL_NANO_BANANA_2, json=payload, headers=headers)
        resp.raise_for_status()
        job = resp.json()
        request_id = job["request_id"]

        status_url = job.get("status_url", f"{FAL_NANO_BANANA_2}/requests/{request_id}/status")
        response_url = job.get("response_url", f"{FAL_NANO_BANANA_2}/requests/{request_id}")

        logger.info("Nano Banana 2 job %s — polling %s", request_id, status_url)

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

        result_resp = await client.get(response_url, headers=headers)
        if result_resp.status_code == 404:
            fallback_url = f"{FAL_NANO_BANANA_2}/requests/{request_id}"
            result_resp = await client.get(fallback_url, headers=headers)
        result_resp.raise_for_status()
        result_data = result_resp.json()

    images = result_data.get("images", [])
    if not images:
        raise HTTPException(status_code=500, detail="No image in response")
    return images[0]["url"]


async def _resolve_ref_image_for_fal(url: str) -> str | None:
    """Resolve a local /files/ URL to a fal.ai-accessible CDN URL."""
    from lorekit.storage.upload import ensure_fal_url
    return await ensure_fal_url(url)


async def _generate_and_store(
    character_id: str,
    character_name: str,
    theme: str,
    char_desc: str,
    fal_key: str,
    reference_image_urls: list[str] | None = None,
) -> dict:
    """Generate a character image for a character+theme, save it, return metadata.

    If *reference_image_urls* is provided, uses Kontext image-to-image to
    preserve the reference likeness while applying the theme style.
    """
    vibe = VIBE_PRESETS.get(theme, {}).get("prompt", "")
    if not vibe:
        settings = get_settings()
        vibe = settings.video_vibe

    headers = {
        "Authorization": f"Key {fal_key}",
        "Content-Type": "application/json",
    }

    prompt = _build_character_prompt(character_name, char_desc, vibe, theme)

    # Resolve all reference images to URLs fal.ai can access
    resolved_refs: list[str] = []
    if reference_image_urls:
        for ref_url in reference_image_urls:
            resolved = await _resolve_ref_image_for_fal(ref_url)
            if resolved:
                resolved_refs.append(resolved)
            else:
                logger.warning("Could not resolve reference image %s — skipping", ref_url)

    image_url = await _generate_single_image(
        prompt, headers,
        reference_image_urls=resolved_refs if resolved_refs else None,
    )

    # Download and store via the file store
    from lorekit.storage import get_file_store, character_image_path

    store = get_file_store()
    storage_path = character_image_path(character_id, theme)

    async with httpx.AsyncClient(timeout=60.0) as client:
        img_resp = await client.get(image_url)
        img_resp.raise_for_status()
        await store.write(storage_path, img_resp.content)

    import time
    serving_url = await store.get_url(storage_path)
    # Cache-buster so browsers fetch the new image
    cache_bust_url = serving_url + f"?v={int(time.time())}"

    # Store the local serving URL in the DB (permanent, we own it)
    await _save_character_image(character_id, theme, serving_url, storage_path)

    return {
        "image_url": cache_bust_url,
        "local_path": storage_path,
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
async def generate_character_image(body: GenerateCharacterRequest, user: CurrentUser = Depends(get_current_user)) -> dict:
    """Generate a character reference image for a project.

    Stores the image per-theme on the character so it can be reused.
    Also copies the URL to the project for quick access.
    """
    project = await db.get_project(body.project_id, org_id=user.org_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    character_id = project["character_id"]
    theme = body.theme or "default"

    from lorekit.sources.database import get_character
    from lorekit.video.characters import get_character_description as get_themed_char

    pool = await db.get_pool()
    character = await get_character(pool, character_id)

    # Check for existing themed image (unless force regenerate)
    if not body.force and not body.custom_description:
        styles = await _load_character_styles(character_id)
        images = _load_character_images(styles)
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

    # Load reference images (if any) for identity-preserving generation
    ref_urls = await _load_ref_urls(character_id)

    result = await _generate_and_store(
        character_id, character.name, theme, char_desc, settings.fal_key,
        reference_image_urls=ref_urls or None,
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
async def generate_character_for_character(body: GenerateForCharacterRequest, user: CurrentUser = Depends(get_current_user)) -> dict:
    """Generate a character image for a character (no project needed).

    Stores per-theme so you can generate all themes and browse them.
    """
    from lorekit.sources.database import get_character
    from lorekit.video.characters import get_character_description as get_themed_char

    # Verify character belongs to user's org
    pool = await db.get_pool()
    char_check = await pool.fetchrow(
        """SELECT c.id FROM characters c
           JOIN universes u ON c.universe_id = u.id
           WHERE c.id = $1 AND u.organization_id = $2""",
        body.character_id, user.org_id,
    )
    if not char_check:
        raise HTTPException(status_code=404, detail="Character not found")

    theme = body.theme or "default"
    character = await get_character(pool, body.character_id)

    # Check existing
    if not body.force and not body.custom_description:
        styles = await _load_character_styles(body.character_id)
        images = _load_character_images(styles)
        if theme in images and images[theme].get("url"):
            return {
                "image_url": images[theme]["url"],
                "local_path": images[theme].get("local_path"),
                "reused": True,
                "theme": theme,
            }

    settings = get_settings()
    char_desc = body.custom_description or get_themed_char(body.character_id, theme=theme if theme != "default" else None)

    # Load reference images (if any) for identity-preserving generation
    ref_urls = await _load_ref_urls(body.character_id)

    return await _generate_and_store(
        body.character_id, character.name, theme, char_desc, settings.fal_key,
        reference_image_urls=ref_urls or None,
    )


# Backward-compatible endpoint
@router.post("/generate-for-philosopher")
async def generate_character_for_philosopher_legacy(body: GenerateForCharacterRequest, user: CurrentUser = Depends(get_current_user)) -> dict:
    """Legacy endpoint: generate a character image for a character (no project needed)."""
    return await generate_character_for_character(body, user=user)


@router.get("/images/{character_id}")
async def list_character_images(character_id: str, user: CurrentUser = Depends(get_current_user)) -> dict:
    """List all themed character images for a character.

    Returns a dict of theme -> {url, local_path} so the frontend can
    display them as a scrollable gallery with theme labels.
    """
    # Verify character belongs to user's org
    pool = await db.get_pool()
    char_check = await pool.fetchrow(
        """SELECT c.id FROM characters c
           JOIN universes u ON c.universe_id = u.id
           WHERE c.id = $1 AND u.organization_id = $2""",
        character_id, user.org_id,
    )
    if not char_check:
        raise HTTPException(status_code=404, detail="Character not found")
    styles = await _load_character_styles(character_id)
    images = _load_character_images(styles)
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


# ---------------------------------------------------------------------------
# Reference image upload / management
# ---------------------------------------------------------------------------

_ALLOWED_IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp"}
_MAX_REF_IMAGE_SIZE = 10 * 1024 * 1024  # 10 MB
_MAX_REF_IMAGES = 5  # Max reference images per character (fal.ai Kontext Max limit)

# Image magic bytes for content validation
_IMAGE_MAGIC = [
    (b"\x89PNG", ".png"),
    (b"\xff\xd8\xff", ".jpg"),   # JPEG
    (b"RIFF", ".webp"),          # WebP (RIFF container)
]

# Networks blocked for SSRF protection
_BLOCKED_NETWORKS = [
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("169.254.0.0/16"),  # link-local / cloud metadata
    ipaddress.ip_network("::1/128"),
    ipaddress.ip_network("fd00::/8"),
]


def _validate_image_content(data: bytes) -> None:
    """Verify file content starts with valid image magic bytes."""
    for magic, _ in _IMAGE_MAGIC:
        if data[:len(magic)] == magic:
            return
    raise HTTPException(status_code=400, detail="File content does not match a valid image format")


def _validate_url_target(url: str) -> None:
    """Block SSRF by resolving the hostname and checking against private networks."""
    parsed = urllib.parse.urlparse(url)
    hostname = parsed.hostname
    if not hostname:
        raise HTTPException(status_code=400, detail="Invalid URL")
    try:
        resolved = socket.getaddrinfo(hostname, None)
    except socket.gaierror:
        raise HTTPException(status_code=400, detail="Cannot resolve hostname")
    for _, _, _, _, sockaddr in resolved:
        ip = ipaddress.ip_address(sockaddr[0])
        for net in _BLOCKED_NETWORKS:
            if ip in net:
                raise HTTPException(status_code=400, detail="URL targets a blocked network")


async def _verify_character_ownership(character_id: str, org_id: str):
    """Verify character belongs to user's org, raise 404 if not."""
    pool = await db.get_pool()
    row = await pool.fetchrow(
        """SELECT c.id FROM characters c
           JOIN universes u ON c.universe_id = u.id
           WHERE c.id = $1 AND u.organization_id = $2""",
        character_id, org_id,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Character not found")


async def _load_ref_urls(character_id: str) -> list[str]:
    """Load the character_ref_urls JSON array from the DB."""
    pool = await db.get_pool()
    row = await pool.fetchrow(
        "SELECT character_ref_urls FROM characters WHERE id = $1",
        character_id,
    )
    if not row or not row["character_ref_urls"]:
        return []
    return _json.loads(row["character_ref_urls"])


async def _save_ref_urls(character_id: str, urls: list[str]):
    """Save the character_ref_urls JSON array to the DB."""
    pool = await db.get_pool()
    await pool.execute(
        "UPDATE characters SET character_ref_urls = $1 WHERE id = $2",
        _json.dumps(urls), character_id,
    )


@router.get("/reference-images/{character_id}")
async def list_reference_images(
    character_id: str,
    user: CurrentUser = Depends(get_current_user),
) -> dict:
    """List all reference images for a character."""
    await _verify_character_ownership(character_id, user.org_id)
    urls = await _load_ref_urls(character_id)
    return {"character_id": character_id, "urls": urls}


@router.post("/reference-images/{character_id}")
async def upload_reference_image(
    character_id: str,
    file: UploadFile = File(...),
    user: CurrentUser = Depends(get_current_user),
) -> dict:
    """Upload a reference image for a character."""
    await _verify_character_ownership(character_id, user.org_id)

    # Enforce upload cap
    urls = await _load_ref_urls(character_id)
    if len(urls) >= _MAX_REF_IMAGES:
        raise HTTPException(status_code=400, detail=f"Maximum {_MAX_REF_IMAGES} reference images allowed")

    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    ext = Path(file.filename).suffix.lower()
    if ext not in _ALLOWED_IMAGE_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {ext}. Allowed: {', '.join(_ALLOWED_IMAGE_EXTENSIONS)}",
        )

    content = await file.read()
    if len(content) > _MAX_REF_IMAGE_SIZE:
        raise HTTPException(status_code=413, detail="File too large. Maximum 10 MB.")

    # Validate actual image content (magic bytes)
    _validate_image_content(content)

    from lorekit.storage import get_file_store, character_reference_path

    store = get_file_store()
    unique_name = f"{uuid.uuid4().hex[:12]}{ext}"
    org_id = user.org_id if user.org_id != "local" else None
    storage_path = character_reference_path(character_id, unique_name, org_id=org_id)
    await store.write(storage_path, content)

    serving_url = await store.get_url(storage_path)

    # Append to character_ref_urls
    urls.append(serving_url)
    await _save_ref_urls(character_id, urls)

    return {"url": serving_url, "urls": urls}


class DeleteRefImageRequest(BaseModel):
    url: str


@router.delete("/reference-images/{character_id}")
async def delete_reference_image(
    character_id: str,
    body: DeleteRefImageRequest,
    user: CurrentUser = Depends(get_current_user),
) -> dict:
    """Remove a reference image from a character."""
    await _verify_character_ownership(character_id, user.org_id)

    urls = await _load_ref_urls(character_id)
    if body.url in urls:
        urls.remove(body.url)
        await _save_ref_urls(character_id, urls)

        # Delete the actual file from storage
        if body.url.startswith("/files/"):
            try:
                from lorekit.storage import get_file_store
                store = get_file_store()
                rel_path = body.url[len("/files/"):]
                await store.delete(rel_path)
            except Exception:
                logger.warning("Failed to delete reference image file: %s", body.url)

    return {"urls": urls}


class RefImageFromUrlRequest(BaseModel):
    url: str  # HTTP(S) URL or local file path


@router.post("/reference-images/{character_id}/from-url")
async def add_reference_image_from_url(
    character_id: str,
    body: RefImageFromUrlRequest,
    user: CurrentUser = Depends(get_current_user),
) -> dict:
    """Add a reference image from a URL or local file path.

    This endpoint is designed for MCP tools and agents that can't do
    multipart uploads. It downloads the image from the given URL (or reads
    from a local path in open-source mode) and stores it as a reference image.
    """
    await _verify_character_ownership(character_id, user.org_id)

    # Enforce upload cap
    existing_urls = await _load_ref_urls(character_id)
    if len(existing_urls) >= _MAX_REF_IMAGES:
        raise HTTPException(status_code=400, detail=f"Maximum {_MAX_REF_IMAGES} reference images allowed")

    from lorekit.storage import get_file_store, character_reference_path

    source = body.url.strip()

    if source.startswith("http://") or source.startswith("https://"):
        # SSRF protection: validate target is not a private/internal network
        _validate_url_target(source)

        # Download from URL — disable redirects to prevent SSRF via redirect
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=False) as client:
            resp = await client.get(source)
            if resp.is_redirect:
                raise HTTPException(status_code=400, detail="URL redirects are not allowed")
            if resp.status_code != 200:
                raise HTTPException(status_code=400, detail=f"Failed to download image: HTTP {resp.status_code}")
            content = resp.content
        # Infer extension from content type or URL
        ct = resp.headers.get("content-type", "")
        if "png" in ct:
            ext = ".png"
        elif "webp" in ct:
            ext = ".webp"
        elif "jpeg" in ct or "jpg" in ct:
            ext = ".jpg"
        else:
            # Try from URL path
            url_ext = Path(source.split("?")[0]).suffix.lower()
            ext = url_ext if url_ext in _ALLOWED_IMAGE_EXTENSIONS else ".png"
    else:
        # Local file path — only allowed in open-source (local) mode
        if user.org_id != "local":
            raise HTTPException(status_code=400, detail="Local file paths not allowed in cloud mode")

        local_path = Path(source).resolve()
        # Restrict to current working directory to prevent arbitrary file reads
        allowed_base = Path.cwd().resolve()
        if not local_path.is_relative_to(allowed_base):
            raise HTTPException(status_code=400, detail="Path outside allowed directory")
        if not local_path.exists():
            raise HTTPException(status_code=400, detail="File not found")
        ext = local_path.suffix.lower()
        if ext not in _ALLOWED_IMAGE_EXTENSIONS:
            raise HTTPException(status_code=400, detail=f"Unsupported file type: {ext}")
        content = local_path.read_bytes()

    if len(content) > _MAX_REF_IMAGE_SIZE:
        raise HTTPException(status_code=413, detail="Image too large. Maximum 10 MB.")

    # Validate actual image content (magic bytes)
    _validate_image_content(content)

    store = get_file_store()
    unique_name = f"{uuid.uuid4().hex[:12]}{ext}"
    org_id = user.org_id if user.org_id != "local" else None
    storage_path = character_reference_path(character_id, unique_name, org_id=org_id)
    await store.write(storage_path, content)

    serving_url = await store.get_url(storage_path)

    urls = await _load_ref_urls(character_id)
    urls.append(serving_url)
    await _save_ref_urls(character_id, urls)

    return {"url": serving_url, "urls": urls}
