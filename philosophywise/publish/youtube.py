"""YouTube Data API v3 upload."""

from __future__ import annotations

import asyncio
import logging
from functools import partial
from pathlib import Path

from google.oauth2.credentials import Credentials  # type: ignore[import-untyped]
from google_auth_oauthlib.flow import InstalledAppFlow  # type: ignore[import-untyped]
from googleapiclient.discovery import build  # type: ignore[import-untyped]
from googleapiclient.http import MediaFileUpload  # type: ignore[import-untyped]

from philosophywise.config import get_settings

logger = logging.getLogger(__name__)

SCOPES = ["https://www.googleapis.com/auth/youtube.upload"]
TOKEN_PATH = Path("~/.philosophywise/youtube_token.json").expanduser()


async def upload_to_youtube(
    video_path: str,
    title: str,
    description: str,
    tags: list[str],
    category_id: str = "27",  # Education
) -> str:
    """Upload video to YouTube via Data API v3.

    Returns the YouTube video ID.

    Settings:
    - Privacy: public
    - Made for kids: false
    - Category: Education (27)
    - Shorts: auto-detected by YouTube (under 60s, vertical)
    """
    credentials = await _get_credentials()

    body = {
        "snippet": {
            "title": title,
            "description": description,
            "tags": tags,
            "categoryId": category_id,
        },
        "status": {
            "privacyStatus": "public",
            "selfDeclaredMadeForKids": False,
        },
    }

    media = MediaFileUpload(
        video_path,
        mimetype="video/mp4",
        resumable=True,
        chunksize=10 * 1024 * 1024,  # 10MB chunks
    )

    # Run the upload in a thread pool (google API client is synchronous)
    loop = asyncio.get_running_loop()
    video_id = await loop.run_in_executor(
        None,
        partial(_execute_upload, credentials, body, media),
    )

    logger.info("Uploaded to YouTube: https://youtube.com/shorts/%s", video_id)
    return video_id


def _execute_upload(
    credentials: Credentials,
    body: dict,
    media: MediaFileUpload,
) -> str:
    """Execute the YouTube upload (synchronous, runs in executor)."""
    service = build("youtube", "v3", credentials=credentials)

    request = service.videos().insert(
        part="snippet,status",
        body=body,
        media_body=media,
    )

    response = None
    while response is None:
        status, response = request.next_chunk()
        if status:
            logger.info("Upload progress: %d%%", int(status.progress() * 100))

    video_id = response["id"]
    logger.info("Upload complete. Video ID: %s", video_id)
    return video_id


async def _get_credentials() -> Credentials:
    """Get or refresh YouTube API credentials.

    Uses stored token if available, otherwise initiates OAuth flow.
    """
    settings = get_settings()

    # Try loading existing token
    if TOKEN_PATH.exists():
        credentials = Credentials.from_authorized_user_file(str(TOKEN_PATH), SCOPES)
        if credentials.valid:
            return credentials
        if credentials.expired and credentials.refresh_token:
            loop = asyncio.get_running_loop()
            await loop.run_in_executor(
                None,
                lambda: credentials.refresh(None),
            )
            _save_token(credentials)
            return credentials

    # Need to authenticate
    if not settings.youtube_client_secret_path:
        raise RuntimeError(
            "YouTube client secret path not configured. "
            "Set YOUTUBE_CLIENT_SECRET_PATH in .env"
        )

    secret_path = settings.youtube_client_secret_path
    if not secret_path.exists():
        raise FileNotFoundError(
            f"YouTube client secret not found at {secret_path}"
        )

    loop = asyncio.get_running_loop()
    creds = await loop.run_in_executor(
        None,
        partial(_run_oauth_flow, str(secret_path)),
    )
    _save_token(creds)
    return creds


def _run_oauth_flow(client_secret_path: str) -> Credentials:  # type: ignore[return]
    """Run the OAuth2 installed app flow (synchronous)."""
    flow = InstalledAppFlow.from_client_secrets_file(client_secret_path, SCOPES)
    credentials = flow.run_local_server(port=0)
    return credentials


def _save_token(credentials: Credentials) -> None:
    """Save credentials to disk for reuse."""
    TOKEN_PATH.parent.mkdir(parents=True, exist_ok=True)
    TOKEN_PATH.write_text(credentials.to_json())
    logger.debug("Saved YouTube token to %s", TOKEN_PATH)
