"""FastAPI application for LoreKit."""

from __future__ import annotations

import json
import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from lorekit import db
from lorekit.auth.user import get_current_user, CurrentUser
from lorekit.config import get_settings

logger = logging.getLogger(__name__)
from lorekit.api.characters_routes import router as characters_router
from lorekit.api.sources_routes import router as sources_router
from lorekit.api.projects import router as projects_router
from lorekit.api.generate import router as generate_router
from lorekit.api.scenes import router as scenes_router
from lorekit.api.jobs import router as jobs_router
from lorekit.api.settings_routes import router as settings_router
from lorekit.api.character import router as character_router

from lorekit.api.universes import router as universes_router
from lorekit.api.environments import router as environments_router
from lorekit.api.templates import router as templates_router
from lorekit.api.documents import router as documents_router
from lorekit.api.workflow import router as workflow_router
from lorekit.api.scripts import router as scripts_router
from lorekit.api.voices import router as voices_router
from lorekit.api.audio import router as audio_router
from lorekit.api.billing import router as billing_router
from lorekit.api.effects import router as effects_router


def _init_cloud_if_present() -> None:
    """Load cloud layer if the cloud/ submodule is available.

    Called at module level (before MCP app creation) so that auth providers
    are registered before FastMCP's http_app() bakes in the auth config.
    """
    try:
        from cloud.startup import init_cloud
        init_cloud()
    except ImportError:
        pass  # No cloud submodule — open source mode


# Cloud init MUST run before MCP http_app() so auth is wired up
_init_cloud_if_present()


@asynccontextmanager
async def _lorekit_lifespan(app: FastAPI):
    """Initialize DB pool, ensure directories on startup."""
    settings = get_settings()
    settings.ensure_dirs()
    await db.init_pool()
    await db.seed_builtin_video_styles()
    await db.seed_builtin_arc_templates()
    await db.seed_builtin_context_presets()
    from lorekit.auth.user import _user_provider
    if _user_provider is None:
        logger.warning(
            "SECURITY: Running without authentication. All API endpoints are "
            "public. Set BETTER_AUTH_SECRET for production."
        )
    yield
    from lorekit.tasks import get_task_runner
    await get_task_runner().shutdown()
    await db.close_pool()


# MCP server — mounted at /mcp for streamable HTTP transport
from lorekit.mcp.server import mcp as _mcp_server
from lorekit.mcp.auth import get_mcp_auth
from fastmcp.utilities.lifespan import combine_lifespans

_mcp_server.auth = get_mcp_auth()  # None (open-source) or BetterAuthMCPVerifier (cloud)
if os.environ.get("BETTER_AUTH_SECRET") and _mcp_server.auth is None:
    raise RuntimeError(
        "BETTER_AUTH_SECRET is set but MCP auth provider was not registered. "
        "Check cloud/ submodule initialization order."
    )
_mcp_app = _mcp_server.http_app(path="/mcp")

app = FastAPI(
    title="LoreKit",
    lifespan=combine_lifespans(_lorekit_lifespan, _mcp_app.lifespan),
)
app.mount("/mcp", _mcp_app)

# CORS for Next.js frontend
cors_origins = os.environ.get("CORS_ORIGINS", "http://localhost:3001").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

# Register API routers
app.include_router(characters_router)
app.include_router(sources_router)
app.include_router(projects_router)
app.include_router(generate_router)
app.include_router(scenes_router)
app.include_router(jobs_router)
app.include_router(settings_router)
app.include_router(character_router)

app.include_router(universes_router)
app.include_router(environments_router)
app.include_router(templates_router)
app.include_router(documents_router)
app.include_router(workflow_router)
app.include_router(scripts_router)
app.include_router(voices_router)
app.include_router(audio_router)
app.include_router(billing_router)
app.include_router(effects_router)


@app.get("/api/health")
async def health() -> dict:
    """Health check."""
    return {"status": "ok"}


@app.get("/api/stats")
async def stats(user: CurrentUser = Depends(get_current_user)) -> dict:
    """Aggregate stats: videos, sources, costs."""
    return await db.get_stats(org_id=user.org_id)


@app.get("/clips/{project_id}/{filename}")
async def serve_clip(
    project_id: str,
    filename: str,
    user: CurrentUser = Depends(get_current_user),
) -> FileResponse:
    """Serve a clip file with auth check."""
    project = await db.get_project(project_id, org_id=user.org_id)
    if not project:
        raise HTTPException(status_code=404)
    file_path = Path("clips") / project_id / filename
    if not file_path.resolve().is_relative_to(Path("clips").resolve()) or not file_path.exists():
        raise HTTPException(status_code=404)
    return FileResponse(file_path)


@app.get("/output/{project_id}/{filename}")
async def serve_output(
    project_id: str,
    filename: str,
    user: CurrentUser = Depends(get_current_user),
) -> FileResponse:
    """Serve an output file with org ownership check."""
    project = await db.get_project(project_id, org_id=user.org_id)
    if not project:
        raise HTTPException(status_code=404)
    file_path = (Path("output") / project_id / filename).resolve()
    if not file_path.is_relative_to(Path("output").resolve()) or not file_path.exists():
        # Fallback: legacy flat files like {project_id}_final.mp4
        file_path = (Path("output") / f"{project_id}_{filename}").resolve()
        if not file_path.is_relative_to(Path("output").resolve()) or not file_path.exists():
            raise HTTPException(status_code=404)
    return FileResponse(file_path)


@app.get("/characters/{character_id}/{filename}")
async def serve_character(
    character_id: str,
    filename: str,
    user: CurrentUser = Depends(get_current_user),
) -> FileResponse:
    """Serve a character image with org ownership check."""
    pool = await db.get_pool()
    char = await pool.fetchrow(
        """SELECT c.id FROM characters c
           JOIN universes u ON c.universe_id = u.id
           WHERE c.id = $1 AND u.organization_id = $2""",
        character_id, user.org_id,
    )
    if not char:
        raise HTTPException(status_code=404)
    file_path = (Path("characters") / f"{character_id}_{filename}").resolve()
    if not file_path.is_relative_to(Path("characters").resolve()) or not file_path.exists():
        raise HTTPException(status_code=404)
    return FileResponse(file_path)


@app.get("/files/{path:path}")
async def serve_file(
    path: str,
    user: CurrentUser = Depends(get_current_user),
) -> FileResponse:
    """Serve any file from the store with auth + org ownership check.

    This is the generic file-serving endpoint that the store's get_url()
    returns local URLs for (e.g., /files/projects/abc/renders/final.mp4).
    """
    from lorekit.storage import get_file_store
    store = get_file_store()

    if not hasattr(store, "base_dir"):
        raise HTTPException(status_code=404)

    file_path = (store.base_dir / path).resolve()
    if not file_path.is_relative_to(store.base_dir) or not file_path.exists():
        raise HTTPException(status_code=404)

    # Cloud mode: paths are prefixed with org_id — verify it matches the user
    parts = path.split("/")
    if user.org_id != "local":
        # In cloud mode, all paths must be prefixed with the user's org_id
        if not parts or parts[0] != user.org_id:
            raise HTTPException(status_code=404)
        # Strip org_id prefix for the ownership checks below
        parts = parts[1:]

    # Org ownership check based on path structure
    if len(parts) >= 2 and parts[0] == "projects":
        # projects/{project_id}/... — verify project ownership
        project_id = parts[1]
        project = await db.get_project(project_id, org_id=user.org_id)
        if not project:
            raise HTTPException(status_code=404)
    elif len(parts) >= 2 and parts[0] == "characters":
        # characters/{character_id}/... — verify character ownership
        character_id = parts[1]
        pool = await db.get_pool()
        char = await pool.fetchrow(
            """SELECT c.id FROM characters c
               JOIN universes u ON c.universe_id = u.id
               WHERE c.id = $1 AND u.organization_id = $2""",
            character_id, user.org_id,
        )
        if not char:
            raise HTTPException(status_code=404)
    elif len(parts) >= 1 and parts[0] == "uploads":
        pass  # Upload paths validated by org_id prefix above (cloud) or auth-only (local)
    else:
        # Unknown path structure — deny by default in cloud mode
        if user.org_id != "local":
            raise HTTPException(status_code=404)

    return FileResponse(file_path, headers={
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "no-cache",
    })


@app.get("/api/projects/{project_id}/download")
async def download_project_file(
    project_id: str,
    type: str = "render",
    filename: str = "final.mp4",
    scene_id: int | None = None,
    user: CurrentUser = Depends(get_current_user),
) -> dict:
    """Get a download URL for a project file.

    Query params:
        type: "render" | "clip" | "raw"
        filename: override filename (default: final.mp4)
        scene_id: required when type=clip

    Returns: { url: string } — local file path or signed Supabase URL.
    """
    import re
    # Validate filename — alphanumeric, hyphens, underscores, dots only
    if not re.match(r'^[a-zA-Z0-9_.-]+$', filename):
        raise HTTPException(status_code=400, detail="Invalid filename")

    project = await db.get_project(project_id, org_id=user.org_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    from lorekit.storage import get_file_store
    from lorekit.storage.paths import project_render_path, project_clip_path
    store = get_file_store()

    if type == "clip":
        if scene_id is None:
            raise HTTPException(status_code=400, detail="scene_id required for clip download")
        path = project_clip_path(project_id, scene_id, org_id=user.org_id)
    elif type == "raw":
        path = project_render_path(project_id, "raw.mp4", org_id=user.org_id)
    else:
        # Use the project's actual output_path from DB if available
        db_output = project.get("output_path", "")
        if db_output:
            path = db_output
        else:
            path = project_render_path(project_id, filename, org_id=user.org_id)

    if not await store.exists(path):
        # Fallback to legacy paths (pre-storage-abstraction files)
        legacy_paths = {
            "render": f"output/{project_id}/{filename}",
            "raw": f"output/{project_id}/raw.mp4",
            "clip": f"clips/{project_id}/scene_{scene_id:03d}.mp4" if scene_id else "",
        }
        legacy = legacy_paths.get(type, "")
        if legacy:
            from pathlib import Path as P
            legacy_resolved = P(legacy).resolve()
            if legacy_resolved.is_relative_to(P.cwd()) and legacy_resolved.exists():
                return {"url": f"/{legacy}", "legacy": True}
        raise HTTPException(status_code=404, detail="File not found")

    url = await store.get_url(path)
    return {"url": url}


@app.get("/api/projects/{project_id}/renders")
async def list_project_renders(
    project_id: str,
    user: CurrentUser = Depends(get_current_user),
) -> dict:
    """List render history for a project from completed render jobs."""
    project = await db.get_project(project_id, org_id=user.org_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    pool = await db.get_pool()
    rows = await pool.fetch(
        """SELECT id, result_json, created_at, updated_at
           FROM jobs WHERE project_id = $1 AND type = 'render' AND status = 'completed'
           ORDER BY created_at DESC""",
        project_id,
    )
    renders = []
    for row in rows:
        try:
            result = json.loads(row["result_json"]) if row["result_json"] else {}
        except (json.JSONDecodeError, TypeError):
            result = {}
        renders.append({
            "id": row["id"],
            "output_path": result.get("output_path") or result.get("history_path"),
            "history_path": result.get("history_path"),
            "timestamp": result.get("timestamp"),
            "created_at": row["created_at"],
        })
    return {"renders": renders}


@app.delete("/api/projects/{project_id}/renders/{job_id}")
async def delete_project_render(
    project_id: str,
    job_id: str,
    user: CurrentUser = Depends(get_current_user),
) -> dict:
    """Delete a render: removes the file and the job record."""
    project = await db.get_project(project_id, org_id=user.org_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    job = await db.get_job(job_id)
    if not job or job.get("project_id") != project_id or job.get("type") != "render":
        raise HTTPException(status_code=404, detail="Render not found")

    # Delete files from storage
    from lorekit.storage import get_file_store
    store = get_file_store()
    try:
        result = json.loads(job.get("result_json", "{}")) if job.get("result_json") else {}
        for key in ("history_path", "output_path"):
            path = result.get(key)
            if path:
                await store.delete(path)
    except Exception:
        pass  # Best-effort file cleanup

    await db.delete_job(job_id)
    return {"deleted": job_id}


@app.get("/api/projects/{project_id}/assets")
async def list_project_assets(
    project_id: str,
    user: CurrentUser = Depends(get_current_user),
) -> dict:
    """List all files for a project with metadata.

    Returns categorized assets: clips, renders, audio, keyframes.
    """
    project = await db.get_project(project_id, org_id=user.org_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    from lorekit.storage import get_file_store
    store = get_file_store()

    assets: list[dict] = []
    prefix = f"projects/{project_id}"
    files = await store.list_files(prefix)

    for f in files:
        parts = f.split("/")
        # Determine category from path: projects/{id}/{category}/{filename}
        category = parts[2] if len(parts) > 2 else "other"
        filename = parts[-1]
        url = await store.get_url(f)

        asset = {
            "path": f,
            "filename": filename,
            "category": category,
            "url": url,
        }

        # Extract scene_id from clip filenames like scene_001.mp4
        if category == "clips" and filename.startswith("scene_"):
            try:
                asset["scene_id"] = int(filename.split("_")[1].split(".")[0])
            except (ValueError, IndexError):
                pass

        assets.append(asset)

    # Sort: renders first, then clips by scene_id, then audio
    category_order = {"renders": 0, "clips": 1, "keyframes": 2, "audio": 3}
    assets.sort(key=lambda a: (category_order.get(a["category"], 9), a.get("scene_id", 0), a["filename"]))

    return {
        "project_id": project_id,
        "project_name": project.get("name", ""),
        "assets": assets,
        "count": len(assets),
    }
