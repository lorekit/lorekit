"""Main pipeline orchestrator for LoreKit."""

from __future__ import annotations

import random
import uuid

from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn

from lorekit import db
from lorekit.config import CIVILIZATIONS, get_settings
from lorekit.models import VideoProject, StoryBreakdown

console = Console()

# --- Character registry (used for random selection) ---

CHARACTERS: dict[str, str] = {
    "marcus_aurelius": "roman",
    "seneca": "roman",
    "epictetus": "roman",
    "sun_tzu": "chinese",
    "lao_tzu": "chinese",
    "confucius": "chinese",
    "miyamoto_musashi": "japanese",
    "tsunetomo_yamamoto": "japanese",
    "socrates": "greek",
    "aristotle": "greek",
    "heraclitus": "greek",
}

# Backward compatibility alias
PHILOSOPHERS = CHARACTERS


async def select_quotes(
    character_id: str,
    hook_quote_id: str | None = None,
    truth_quote_id: str | None = None,
) -> tuple[dict | None, dict | None]:
    """Select hook and truth quotes for a character.

    If specific quote IDs are given, fetches those. Otherwise picks the least-used
    quotes from the DB.
    """
    hook = None
    truth = None

    if hook_quote_id:
        hooks = await db.get_unused_source_items(character_id, function="hook", limit=50)
        hook = next((q for q in hooks if q["id"] == hook_quote_id), None)
    else:
        hooks = await db.get_unused_source_items(character_id, function="hook", limit=1)
        hook = hooks[0] if hooks else None

    if truth_quote_id:
        truths = await db.get_unused_source_items(character_id, function="truth", limit=50)
        truth = next((q for q in truths if q["id"] == truth_quote_id), None)
    else:
        truths = await db.get_unused_source_items(character_id, function="truth", limit=1)
        truth = truths[0] if truths else None

    return hook, truth


# --- Stubs for Agent 2 (story generation) ---


async def generate_story_breakdown(
    character_id: str,
    civilization: str,
    hook_quote: dict,
    truth_quote: dict,
) -> dict:
    """Generate a story breakdown via Claude.

    Stub — Agent 2 implements this in lorekit/story/.
    """
    raise NotImplementedError("Story generation not yet implemented (Agent 2)")


# --- Stubs for Agent 3 (video/audio/assembly) ---


async def generate_video_clips(project: VideoProject) -> list[str]:
    """Generate video clips via fal.ai for each scene.

    Stub — Agent 3 implements this in lorekit/video/.
    """
    raise NotImplementedError("Video generation not yet implemented (Agent 3)")


async def build_audio_mix(project: VideoProject) -> str:
    """Build the audio mix for the video.

    Stub — Agent 3 implements this in lorekit/audio/.
    """
    raise NotImplementedError("Audio mix not yet implemented (Agent 3)")


async def assemble_final_video(project: VideoProject, audio_path: str) -> str:
    """Assemble clips + audio into the final video.

    Stub — Agent 3 implements this in lorekit/assembly/.
    """
    raise NotImplementedError("Video assembly not yet implemented (Agent 3)")


async def generate_metadata(project: VideoProject) -> dict:
    """Generate YouTube title, description, tags.

    Stub — Agent 2 implements this in lorekit/story/.
    """
    raise NotImplementedError("Metadata generation not yet implemented (Agent 2)")


# --- Main pipeline ---


async def generate_video(
    character_id: str | None = None,
    hook_quote_id: str | None = None,
    truth_quote_id: str | None = None,
    dry_run: bool = False,
    theme: str | None = None,
    arc_template: str | None = None,
) -> VideoProject:
    """Full pipeline: quote select -> story -> video -> audio -> assembly -> done.

    Args:
        theme: Vibe preset key (e.g. "dark_masculine"). When set, uses
            the theme's vibe prompt and per-theme character descriptions.
            Falls back to ``settings.video_vibe_preset`` if not provided.
        arc_template: Arc template ID (e.g. "story", "rapid_montage").
            Defaults to "story".
    """
    settings = get_settings()
    settings.ensure_dirs()
    await db.init_pool()

    # Resolve theme from settings if not explicitly provided
    if theme is None:
        theme = settings.video_vibe_preset

    # 0. Pick character if not specified
    if character_id is None:
        character_id = random.choice(list(CHARACTERS.keys()))
    civilization = CHARACTERS.get(character_id, "roman")

    console.print(f"\n[bold cyan]LoreKit[/] — Generating video for [bold]{character_id}[/] ({civilization})")

    with Progress(SpinnerColumn(), TextColumn("{task.description}"), console=console) as progress:
        # 1. Select quotes
        task = progress.add_task("Selecting quotes...", total=None)
        hook_quote, truth_quote = await select_quotes(character_id, hook_quote_id, truth_quote_id)
        if not hook_quote or not truth_quote:
            console.print("[red]No available quotes found. Import quotes first with: lk sources import[/]")
            raise SystemExit(1)
        progress.update(task, description="[green]Quotes selected[/]")

        # 2. Generate story breakdown via Claude
        task = progress.add_task("Generating story breakdown...", total=None)
        story_data = await generate_story_breakdown(character_id, civilization, hook_quote, truth_quote)
        progress.update(task, description="[green]Story breakdown ready[/]")

        # 3. Build VideoProject
        story = StoryBreakdown.model_validate(story_data)
        project = VideoProject(
            character_id=character_id,
            civilization=civilization,
            theme=theme or "",
            arc_template=arc_template or "story",
            story=story,
            status="queued",
        )

        if dry_run:
            console.print("\n[yellow]Dry run — skipping video generation[/]")
            console.print(project.model_dump_json(indent=2))
            return project

        # 4. Create DB record
        pool = await db.get_pool()
        await pool.execute(
            "INSERT INTO videos (id, character_id, status, created_at) VALUES ($1, $2, $3, NOW())",
            project.id, character_id, "generating",
        )

        # 5. Generate video clips via fal.ai (parallel)
        task = progress.add_task("Generating video clips...", total=None)
        project.clips = await generate_video_clips(project)
        await pool.execute(
            "INSERT INTO cost_log (id, video_id, component, cost_usd) VALUES ($1, $2, $3, $4)",
            uuid.uuid4().hex[:12], project.id, "video_gen", 0.0,
        )
        progress.update(task, description="[green]Video clips generated[/]")

        # 6. Build audio mix
        task = progress.add_task("Building audio mix...", total=None)
        audio_path = await build_audio_mix(project)
        await pool.execute(
            "INSERT INTO cost_log (id, video_id, component, cost_usd) VALUES ($1, $2, $3, $4)",
            uuid.uuid4().hex[:12], project.id, "audio", 0.0,
        )
        progress.update(task, description="[green]Audio mix ready[/]")

        # 7. Assemble final video
        task = progress.add_task("Assembling final video...", total=None)
        await pool.execute(
            "UPDATE videos SET status = $1 WHERE id = $2", "assembling", project.id,
        )
        project.output_path = await assemble_final_video(project, audio_path)
        await pool.execute(
            "INSERT INTO cost_log (id, video_id, component, cost_usd) VALUES ($1, $2, $3, $4)",
            uuid.uuid4().hex[:12], project.id, "assembly", 0.0,
        )
        progress.update(task, description="[green]Video assembled[/]")

        # 8. Generate metadata
        task = progress.add_task("Generating metadata...", total=None)
        _metadata = await generate_metadata(project)
        progress.update(task, description="[green]Metadata ready[/]")

        # 9. Mark complete
        await pool.execute(
            "UPDATE videos SET status = $1, output_path = $2, cost_usd = $3 WHERE id = $4",
            "complete", project.output_path, project.cost_usd, project.id,
        )
        project.status = "complete"

    console.print(f"\n[bold green]Done![/] Video: {project.output_path}")
    console.print(f"Project ID: [bold]{project.id}[/]  Cost: ${project.cost_usd:.2f}")
    return project


async def batch_generate(count: int = 1, schedule: str | None = None) -> list[VideoProject]:
    """Generate multiple videos, rotating characters."""
    settings = get_settings()
    settings.ensure_dirs()
    await db.init_pool()

    # If schedule is given, pick characters based on day-of-week mapping
    character_ids = list(CHARACTERS.keys())
    if schedule:
        # Simple rotation: pick character(s) based on schedule keyword
        import hashlib
        h = int(hashlib.md5(schedule.encode()).hexdigest(), 16)
        start = h % len(character_ids)
        selected = [character_ids[(start + i) % len(character_ids)] for i in range(count)]
    else:
        selected = random.sample(character_ids, min(count, len(character_ids)))

    console.print(f"\n[bold cyan]Batch generating {count} video(s)[/]")
    results: list[VideoProject] = []
    for i, pid in enumerate(selected):
        console.print(f"\n[bold]--- Video {i + 1}/{count} ---[/]")
        try:
            project = await generate_video(character_id=pid)
            results.append(project)
        except NotImplementedError as e:
            console.print(f"[yellow]Skipped: {e}[/]")
        except Exception as e:
            console.print(f"[red]Failed: {e}[/]")

    console.print(f"\n[bold green]Batch complete.[/] {len(results)}/{count} videos generated.")
    return results
