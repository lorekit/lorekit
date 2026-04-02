"""File storage abstraction for LoreKit.

Local mode: files stored on the local filesystem.
Cloud mode: files stored in Supabase Storage with org-scoped paths.
"""

from lorekit.storage.protocol import FileStore
from lorekit.storage.local import LocalFileStore
from lorekit.storage.paths import (
    project_clip_path,
    project_keyframe_path,
    project_frame_path,
    project_render_path,
    project_audio_path,
    character_image_path,
    character_reference_path,
    audio_upload_path,
    tts_audio_path,
)

_store: FileStore | None = None


def get_file_store() -> FileStore:
    """Return the global file store instance, creating it if needed."""
    global _store
    if _store is None:
        import os
        backend = os.environ.get("FILE_STORE", "local")
        if backend == "supabase":
            from lorekit.storage.supabase import SupabaseFileStore
            _store = SupabaseFileStore(
                supabase_url=os.environ["SUPABASE_URL"],
                supabase_key=os.environ["SUPABASE_SERVICE_ROLE_KEY"],
            )
        else:
            _store = LocalFileStore()
    return _store


__all__ = [
    "FileStore",
    "LocalFileStore",
    "get_file_store",
    "project_clip_path",
    "project_keyframe_path",
    "project_frame_path",
    "project_render_path",
    "project_audio_path",
    "character_image_path",
    "character_reference_path",
    "audio_upload_path",
    "tts_audio_path",
]
