"""Supabase Storage backend.

Files are stored in a single Supabase Storage bucket with org-scoped paths.
RLS policies on storage.objects enforce that users can only access files
under their organization's prefix.

Requires: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.
"""

from __future__ import annotations

import httpx


class SupabaseFileStore:
    """Store files in Supabase Storage."""

    def __init__(
        self,
        supabase_url: str,
        supabase_key: str,
        bucket: str = "lorekit-files",
    ):
        self.base_url = f"{supabase_url}/storage/v1"
        self.bucket = bucket
        self.headers = {
            "apikey": supabase_key,
            "Authorization": f"Bearer {supabase_key}",
        }

    async def write(self, path: str, data: bytes, content_type: str = "application/octet-stream") -> str:
        """Upload a file to Supabase Storage."""
        url = f"{self.base_url}/object/{self.bucket}/{path}"
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                url,
                content=data,
                headers={**self.headers, "Content-Type": content_type},
            )
            resp.raise_for_status()
        return path

    async def read(self, path: str) -> bytes:
        """Download a file from Supabase Storage."""
        url = f"{self.base_url}/object/{self.bucket}/{path}"
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.get(url, headers=self.headers)
            resp.raise_for_status()
        return resp.content

    async def exists(self, path: str) -> bool:
        """Check if a file exists by attempting a HEAD request."""
        url = f"{self.base_url}/object/{self.bucket}/{path}"
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.head(url, headers=self.headers)
        return resp.status_code == 200

    async def get_url(self, path: str, expires_in: int = 3600) -> str:
        """Get a signed URL for temporary access."""
        url = f"{self.base_url}/object/sign/{self.bucket}/{path}"
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                url,
                json={"expiresIn": expires_in},
                headers=self.headers,
            )
            resp.raise_for_status()
            data = resp.json()
        return f"{self.base_url}{data['signedURL']}"

    async def delete(self, path: str) -> bool:
        """Delete a single file."""
        url = f"{self.base_url}/object/{self.bucket}"
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.delete(
                url,
                json={"prefixes": [path]},
                headers=self.headers,
            )
        return resp.status_code == 200

    async def delete_prefix(self, prefix: str) -> int:
        """Delete all files under a prefix."""
        files = await self.list_files(prefix)
        if not files:
            return 0
        url = f"{self.base_url}/object/{self.bucket}"
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.delete(
                url,
                json={"prefixes": files},
                headers=self.headers,
            )
            resp.raise_for_status()
        return len(files)

    async def list_files(self, prefix: str) -> list[str]:
        """List all files under a prefix."""
        url = f"{self.base_url}/object/list/{self.bucket}"
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                url,
                json={"prefix": prefix, "limit": 1000},
                headers=self.headers,
            )
            resp.raise_for_status()
            items = resp.json()
        return [f"{prefix}/{item['name']}" for item in items if item.get("name")]
