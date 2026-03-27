"""Main pipeline orchestrator for PhilosophyWise."""

from __future__ import annotations

import random

from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn

from philosophywise import db
from philosophywise.config import CIVILIZATIONS, get_settings
from philosophywise.models import VideoProject

console = Console()

# --- Philosopher registry (used for random selection) ---

PHILOSOPHERS: dict[str, str] = {
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


async def select_quotes(
    philosopher_id: str,
    hook_quote_id: str | None = None,
    truth_quote_id: str | None = None,
) -> tuple[dict | None, dict | None]:
    """Select hook and truth quotes for a philosopher.

    If specific quote IDs are given, fetches those. Otherwise picks the least-used
    quotes from the DB.
    """
    hook = None
    truth = None

    if hook_quote_id:
        hooks = await db.get_unused_quotes(philosopher_id, function="hook", limit=50)
        hook = next((q for q in hooks if q["id"] == hook_quote_id), None)
    else:
        hooks = await db.get_unused_quotes(philosopher_id, function="hook", limit=1)
        hook = hooks[0] if hooks else None

    if truth_quote_id:
        truths = await db.get_unused_quotes(philosopher_id, function="truth", limit=50)
        truth = next((q for q in truths if q["id"] == truth_quote_id), None)
    else:
        truths = await db.get_unused_quotes(philosopher_id, function="truth", limit=1)
        truth = truths[0] if truths else None

    return hook, truth


# --- Stubs for Agent 2 (story generation) ---


async def generate_story_breakdown(
    philosopher_id: str,
    civilization: str,
    hook_quote: dict,
    truth_quote: dict,
) -> dict:
    """Generate a story breakdown via Claude.

    Stub — Agent 2 implements this in philosophywise/story/.
    """
    raise NotImplementedError("Story generation not yet implemented (Agent 2)")


# --- Stubs for Agent 3 (video/audio/assembly) ---


async def generate_video_clips(project: VideoProject) -> list[str]:
    """Generate video clips via fal.ai for each scene.

    Stub — Agent 3 implements this in philosophywise/video/.
    """
    raise NotImplementedError("Video generation not yet implemented (Agent 3)")


async def build_audio_mix(project: VideoProject) -> str:
    """Build the audio mix for the video.

    Stub — Agent 3 implements this in philosophywise/audio/.
    """
    raise NotImplementedError("Audio mix not yet implemented (Agent 3)")


async def assemble_final_video(project: VideoProject, audio_path: str) -> str:
    """Assemble clips + audio into the final video.

    Stub — Agent 3 implements this in philosophywise/assembly/.
    """
    raise NotImplementedError("Video assembly not yet implemented (Agent 3)")


async def generate_metadata(project: VideoProject) -> dict:
    """Generate YouTube title, description, tags.

    Stub — Agent 2 implements this in philosophywise/story/.
    """
    raise NotImplementedError("Metadata generation not yet implemented (Agent 2)")


# --- Main pipeline ---


async def generate_video(
    philosopher_id: str | None = None,
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
    await db.init_db()

    # Resolve theme from settings if not explicitly provided
    if theme is None:
        theme = settings.video_vibe_preset

    # 0. Pick philosopher if not specified
    if philosopher_id is None:
        philosopher_id = random.choice(list(PHILOSOPHERS.keys()))
    civilization = PHILOSOPHERS.get(philosopher_id, "roman")

    console.print(f"\n[bold cyan]PhilosophyWise[/] — Generating video for [bold]{philosopher_id}[/] ({civilization})")

    with Progress(SpinnerColumn(), TextColumn("{task.description}"), console=console) as progress:
        # 1. Select quotes
        task = progress.add_task("Selecting quotes...", total=None)
        hook_quote, truth_quote = await select_quotes(philosopher_id, hook_quote_id, truth_quote_id)
        if not hook_quote or not truth_quote:
            console.print("[red]No available quotes found. Import quotes first with: pw quotes import[/]")
            raise SystemExit(1)
        progress.update(task, description="[green]Quotes selected[/]")

        # 2. Generate story breakdown via Claude
        task = progress.add_task("Generating story breakdown...", total=None)
        story_data = await generate_story_breakdown(philosopher_id, civilization, hook_quote, truth_quote)
        progress.update(task, description="[green]Story breakdown ready[/]")

        # 3. Build VideoProject
        from philosophywise.models import StoryBreakdown
        story = StoryBreakdown.model_validate(story_data)
        project = VideoProject(
            philosopher_id=philosopher_id,
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
        await db.create_video_record(project.id, philosopher_id)
        await db.update_video_status(project.id, "generating")

        # 5. Generate video clips via fal.ai (parallel)
        task = progress.add_task("Generating video clips...", total=None)
        project.clips = await generate_video_clips(project)
        await db.log_cost(project.id, "video_gen", 0.0)  # actual cost logged by Agent 3
        progress.update(task, description="[green]Video clips generated[/]")

        # 6. Build audio mix
        task = progress.add_task("Building audio mix...", total=None)
        audio_path = await build_audio_mix(project)
        await db.log_cost(project.id, "audio", 0.0)
        progress.update(task, description="[green]Audio mix ready[/]")

        # 7. Assemble final video
        task = progress.add_task("Assembling final video...", total=None)
        await db.update_video_status(project.id, "assembling")
        project.output_path = await assemble_final_video(project, audio_path)
        await db.log_cost(project.id, "assembly", 0.0)
        progress.update(task, description="[green]Video assembled[/]")

        # 8. Generate metadata
        task = progress.add_task("Generating metadata...", total=None)
        _metadata = await generate_metadata(project)
        progress.update(task, description="[green]Metadata ready[/]")

        # 9. Mark complete
        await db.update_video_status(
            project.id, "complete",
            output_path=project.output_path,
            cost_usd=project.cost_usd,
        )
        project.status = "complete"

    console.print(f"\n[bold green]Done![/] Video: {project.output_path}")
    console.print(f"Project ID: [bold]{project.id}[/]  Cost: ${project.cost_usd:.2f}")
    return project


async def batch_generate(count: int = 1, schedule: str | None = None) -> list[VideoProject]:
    """Generate multiple videos, rotating philosophers."""
    settings = get_settings()
    settings.ensure_dirs()
    await db.init_db()

    # If schedule is given, pick philosophers based on day-of-week mapping
    philosopher_ids = list(PHILOSOPHERS.keys())
    if schedule:
        # Simple rotation: pick philosopher(s) based on schedule keyword
        import hashlib
        h = int(hashlib.md5(schedule.encode()).hexdigest(), 16)
        start = h % len(philosopher_ids)
        selected = [philosopher_ids[(start + i) % len(philosopher_ids)] for i in range(count)]
    else:
        selected = random.sample(philosopher_ids, min(count, len(philosopher_ids)))

    console.print(f"\n[bold cyan]Batch generating {count} video(s)[/]")
    results: list[VideoProject] = []
    for i, pid in enumerate(selected):
        console.print(f"\n[bold]--- Video {i + 1}/{count} ---[/]")
        try:
            project = await generate_video(philosopher_id=pid)
            results.append(project)
        except NotImplementedError as e:
            console.print(f"[yellow]Skipped: {e}[/]")
        except Exception as e:
            console.print(f"[red]Failed: {e}[/]")

    console.print(f"\n[bold green]Batch complete.[/] {len(results)}/{count} videos generated.")
    return results
