"""Storage path builders.

All paths are relative — the FileStore backend roots them appropriately.

In cloud mode, paths are prefixed with org_id for Supabase Storage RLS:
    {org_id}/projects/{project_id}/clips/scene_001.mp4

In local mode, org_id is omitted (single user):
    projects/{project_id}/clips/scene_001.mp4
"""

from __future__ import annotations


def _base(org_id: str | None, *parts: str) -> str:
    """Build a path, optionally prefixed with org_id for cloud mode."""
    if org_id and org_id != "local":
        return "/".join([org_id, *parts])
    return "/".join(parts)


def project_clip_path(
    project_id: str, scene_id: int, org_id: str | None = None
) -> str:
    """Path for a video clip: projects/{id}/clips/scene_001.mp4"""
    return _base(org_id, "projects", project_id, "clips", f"scene_{scene_id:03d}.mp4")


def project_keyframe_path(
    project_id: str, scene_id: int, org_id: str | None = None
) -> str:
    """Path for a keyframe image: projects/{id}/keyframes/scene_001.png"""
    return _base(org_id, "projects", project_id, "keyframes", f"scene_{scene_id:03d}.png")


def project_render_path(
    project_id: str, filename: str = "final.mp4", org_id: str | None = None
) -> str:
    """Path for a rendered video: projects/{id}/renders/final.mp4"""
    return _base(org_id, "projects", project_id, "renders", filename)


def project_audio_path(
    project_id: str, filename: str = "audio_mix.wav", org_id: str | None = None
) -> str:
    """Path for project audio: projects/{id}/audio/audio_mix.wav"""
    return _base(org_id, "projects", project_id, "audio", filename)


def project_frame_path(
    project_id: str, scene_id: int, timestamp: float, org_id: str | None = None
) -> str:
    """Path for an extracted frame: projects/{id}/frames/scene_001_3_5s.png"""
    ts_label = f"{timestamp:.1f}".replace(".", "_") + "s"
    return _base(org_id, "projects", project_id, "frames", f"scene_{scene_id:03d}_{ts_label}.png")


def project_character_image_path(
    project_id: str, label: str, org_id: str | None = None
) -> str:
    """Path for a project-scoped character variation: projects/{id}/characters/{label}.png"""
    return _base(org_id, "projects", project_id, "characters", f"{label}.png")


def character_image_path(
    character_id: str, theme: str, view: str = "default", org_id: str | None = None
) -> str:
    """Path for a character portrait: characters/{id}/images/{theme}_{view}.png"""
    if view and view != "default":
        filename = f"{theme}_{view}.png"
    else:
        filename = f"{theme}.png"
    return _base(org_id, "characters", character_id, "images", filename)


def character_reference_path(
    character_id: str, filename: str, org_id: str | None = None
) -> str:
    """Path for a character reference image: characters/{id}/references/{filename}"""
    return _base(org_id, "characters", character_id, "references", filename)


def audio_upload_path(
    filename: str, org_id: str | None = None
) -> str:
    """Path for an uploaded audio file: uploads/{filename}"""
    return _base(org_id, "uploads", filename)


def tts_audio_path(
    filename: str, org_id: str | None = None
) -> str:
    """Path for generated TTS audio: tts/{filename}"""
    return _base(org_id, "tts", filename)
