"""Upload local files to fal.ai CDN for use with AI APIs.

Any local /files/ path or raw storage path needs to be uploaded to fal CDN
before it can be passed to Kling, Flux, or other AI APIs. This module provides
a single utility for that.
"""

from __future__ import annotations

import logging
import os

logger = logging.getLogger(__name__)


async def ensure_fal_url(url_or_path: str | None) -> str | None:
    """Ensure a URL is accessible by fal.ai APIs.

    - If already an http(s) URL: return as-is
    - If a local /files/ path or raw storage path: upload to fal CDN
    - Returns None if the file can't be resolved or upload fails
    """
    if not url_or_path:
        return None

    # Already an HTTP URL — fal can fetch it directly
    if url_or_path.startswith("http://") or url_or_path.startswith("https://"):
        return url_or_path

    # Local path — need to upload to fal CDN
    from lorekit.storage import get_file_store
    from lorekit.config import get_settings

    store = get_file_store()
    if not hasattr(store, "base_dir"):
        logger.warning("File store has no base_dir, cannot resolve: %s", url_or_path)
        return None

    # Strip /files/ prefix if present
    rel_path = url_or_path
    if rel_path.startswith("/files/"):
        rel_path = rel_path[len("/files/"):]

    file_path = (store.base_dir / rel_path).resolve()

    # Prevent path traversal
    if not file_path.is_relative_to(store.base_dir.resolve()):
        logger.warning("Path traversal attempt: %s", url_or_path)
        return None

    if not file_path.exists():
        logger.warning("File not found for fal upload: %s", file_path)
        return None

    data = file_path.read_bytes()
    ext = file_path.suffix.lower().lstrip(".")
    mime = {"png": "image/png", "jpg": "image/jpeg", "jpeg": "image/jpeg", "webp": "image/webp"}.get(ext, "image/png")

    import fal_client
    if not os.environ.get("FAL_KEY"):
        os.environ["FAL_KEY"] = get_settings().fal_key

    try:
        cdn_url = fal_client.upload(data, content_type=mime)
        logger.info("Uploaded to fal CDN: %s -> %s", file_path.name, cdn_url[:80])
        return cdn_url
    except Exception as e:
        logger.error("fal CDN upload failed for %s: %s", file_path.name, e)
        return None
