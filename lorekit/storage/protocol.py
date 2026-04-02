"""FileStore protocol — the interface both local and cloud backends implement."""

from __future__ import annotations

from typing import Protocol


class FileStore(Protocol):
    """Abstract file storage interface.

    Paths are always relative (e.g., "projects/abc123/clips/scene_001.mp4").
    The backend decides how to root them (local dir vs Supabase bucket).
    """

    async def write(self, path: str, data: bytes, content_type: str = "") -> str:
        """Write bytes to a path. Returns the stored path or URL."""
        ...

    async def read(self, path: str) -> bytes:
        """Read bytes from a path."""
        ...

    async def exists(self, path: str) -> bool:
        """Check if a path exists."""
        ...

    async def get_url(self, path: str, expires_in: int = 3600) -> str:
        """Get a URL to access the file.

        Local: returns a relative URL for the file-serving endpoint.
        Cloud: returns a signed Supabase Storage URL.
        """
        ...

    async def delete(self, path: str) -> bool:
        """Delete a single file. Returns True if it existed."""
        ...

    async def delete_prefix(self, prefix: str) -> int:
        """Delete all files under a prefix. Returns count of deleted files.

        Used for cascade deletes: project, universe, or org cleanup.
        """
        ...

    async def list_files(self, prefix: str) -> list[str]:
        """List all file paths under a prefix."""
        ...
