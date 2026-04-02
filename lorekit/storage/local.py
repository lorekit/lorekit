"""Local filesystem storage backend.

Files are stored under a base directory (default: data/files/).
Used for self-hosted/open-source mode.
"""

from __future__ import annotations

import shutil
from pathlib import Path


class LocalFileStore:
    """Store files on the local filesystem."""

    def __init__(self, base_dir: str = "data/files"):
        self.base_dir = Path(base_dir).resolve()
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def _resolve(self, path: str) -> Path:
        """Resolve a relative path to an absolute path within base_dir."""
        full = (self.base_dir / path).resolve()
        if not str(full).startswith(str(self.base_dir)):
            raise ValueError(f"Path escapes base directory: {path}")
        return full

    async def write(self, path: str, data: bytes, content_type: str = "") -> str:
        """Write bytes to a file. Creates parent directories as needed."""
        full = self._resolve(path)
        full.parent.mkdir(parents=True, exist_ok=True)
        full.write_bytes(data)
        return path

    async def read(self, path: str) -> bytes:
        """Read bytes from a file."""
        full = self._resolve(path)
        if not full.exists():
            raise FileNotFoundError(f"File not found: {path}")
        return full.read_bytes()

    async def exists(self, path: str) -> bool:
        """Check if a file exists."""
        return self._resolve(path).exists()

    async def get_url(self, path: str, expires_in: int = 3600) -> str:
        """Return a local file-serving URL.

        The actual serving is handled by authenticated endpoints in server.py.
        This just builds the URL path.
        """
        return f"/files/{path}"

    async def delete(self, path: str) -> bool:
        """Delete a single file."""
        full = self._resolve(path)
        if full.exists():
            full.unlink()
            return True
        return False

    async def delete_prefix(self, prefix: str) -> int:
        """Delete all files under a prefix (directory)."""
        full = self._resolve(prefix)
        if not full.exists():
            return 0
        count = sum(1 for _ in full.rglob("*") if _.is_file())
        shutil.rmtree(full)
        return count

    async def list_files(self, prefix: str) -> list[str]:
        """List all file paths under a prefix."""
        full = self._resolve(prefix)
        if not full.exists():
            return []
        base_len = len(str(self.base_dir)) + 1  # +1 for trailing /
        return [str(p)[base_len:] for p in full.rglob("*") if p.is_file()]
