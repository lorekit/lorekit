"""PhilosophyWise CLI — Click commands with rich output."""

from __future__ import annotations

import asyncio
import json
from pathlib import Path

import click
from rich.console import Console
from rich.table import Table

from philosophywise import db
from philosophywise.pipeline import PHILOSOPHERS

console = Console()


def run_async(coro):
    """Run an async coroutine from sync Click commands."""
    return asyncio.run(coro)


@click.group()
def main():
    """PhilosophyWise — Ancient Wisdom Shorts pipeline."""
    pass


# --- generate ---


@main.command()
@click.option("--philosopher", type=click.Choice(list(PHILOSOPHERS.keys())), default=None, help="Philosopher ID")
@click.option("--random", "use_random", is_flag=True, help="Pick a random philosopher")
@click.option("--count", default=1, help="Number of videos to generate")
@click.option("--dry-run", is_flag=True, help="Validate pipeline without generating")
def generate(philosopher: str | None, use_random: bool, count: int, dry_run: bool):
    """Generate philosophy short videos."""
    from philosophywise.pipeline import batch_generate, generate_video

    if count > 1 or use_random:
        run_async(batch_generate(count=count))
    else:
        run_async(generate_video(philosopher_id=philosopher, dry_run=dry_run))


# --- batch ---


@main.command()
@click.option("--schedule", required=True, help="Schedule key (e.g. monday, tuesday)")
def batch(schedule: str):
    """Generate videos based on day-of-week calendar."""
    from philosophywise.pipeline import batch_generate

    run_async(batch_generate(count=1, schedule=schedule))


# --- quotes group ---


@main.group()
def quotes():
    """Manage philosopher quotes."""
    pass


@quotes.command("list")
@click.option("--philosopher", default=None, help="Filter by philosopher ID")
@click.option("--function", "fn", default=None, help="Filter by emotional function")
def quotes_list(philosopher: str | None, fn: str | None):
    """List quotes in the database."""
    results = run_async(db.list_quotes(philosopher_id=philosopher, function=fn))
    if not results:
        console.print("[yellow]No quotes found.[/]")
        return

    table = Table(title="Quotes")
    table.add_column("ID", style="dim")
    table.add_column("Philosopher")
    table.add_column("Function", style="cyan")
    table.add_column("Theme")
    table.add_column("Text", max_width=60)
    table.add_column("Used", justify="right")

    for q in results:
        table.add_row(
            q["id"],
            q.get("philosopher_name", q["philosopher_id"]),
            q["emotional_function"],
            q["theme"],
            q["text"][:60] + ("..." if len(q["text"]) > 60 else ""),
            str(q["used_count"]),
        )
    console.print(table)


@quotes.command("import")
@click.argument("path", type=click.Path(exists=True))
def quotes_import(path: str):
    """Import quotes from a JSON file.

    Expected format:
    {
        "philosopher": {"id": "...", "name": "...", "civilization": "...", "era": "..."},
        "quotes": [{"text": "...", "theme": "...", "emotional_function": "...", ...}]
    }
    """
    data = json.loads(Path(path).read_text())
    phil = data["philosopher"]

    async def _import():
        await db.init_db()
        await db.upsert_philosopher(
            philosopher_id=phil["id"],
            name=phil["name"],
            civilization=phil["civilization"],
            era=phil.get("era", ""),
            character_description=phil.get("character_description", ""),
        )
        count = 0
        for q in data["quotes"]:
            await db.insert_quote(
                philosopher_id=phil["id"],
                text=q["text"],
                theme=q["theme"],
                emotional_function=q["emotional_function"],
                short_version=q.get("short_version"),
                word_count=q.get("word_count", len(q["text"].split())),
                read_time_seconds=q.get("read_time_seconds", len(q["text"].split()) / 2.5),
                pair_with_visual=q.get("pair_with_visual", ""),
            )
            count += 1
        return count

    n = run_async(_import())
    console.print(f"[green]Imported {n} quotes for {phil['name']}[/]")


@quotes.command("stats")
def quotes_stats():
    """Show quote usage statistics."""
    async def _stats():
        await db.init_db()
        return await db.get_stats()

    stats = run_async(_stats())
    qs = stats["quotes"]
    console.print(f"\n[bold]Quote Stats[/]")
    console.print(f"  Total quotes: {qs['total_quotes']}")
    console.print(f"  Total uses:   {qs['total_uses']}")
    console.print(f"  Avg uses:     {qs['avg_uses']:.1f}")


# --- dev server commands ---


@main.command()
@click.option("--port", default=8000, help="Backend port")
@click.option("--reload", "use_reload", is_flag=True, default=True, help="Auto-reload on file changes")
def backend(port: int, use_reload: bool):
    """Start the FastAPI backend server."""
    import uvicorn
    console.print(f"[bold cyan]Starting backend on http://localhost:{port}[/]")
    uvicorn.run(
        "philosophywise.server:app",
        host="0.0.0.0",
        port=port,
        reload=use_reload,
    )


@main.command()
@click.option("--port", default=3000, help="Frontend port")
def frontend(port: int):
    """Start the Next.js frontend dev server."""
    import subprocess
    import os

    web_dir = Path(__file__).parent.parent / "web"
    if not (web_dir / "node_modules").exists():
        console.print("[yellow]Installing frontend dependencies...[/]")
        subprocess.run(["npm", "install"], cwd=web_dir, check=True)

    console.print(f"[bold cyan]Starting frontend on http://localhost:{port}[/]")
    env = {**os.environ, "PORT": str(port)}
    subprocess.run(["npm", "run", "dev", "--", "--port", str(port)], cwd=web_dir, env=env)


@main.command()
@click.option("--backend-port", default=8000, help="Backend port")
@click.option("--frontend-port", default=3000, help="Frontend port")
def dev(backend_port: int, frontend_port: int):
    """Start both backend and frontend (full dev environment)."""
    import subprocess
    import os
    import signal

    web_dir = Path(__file__).parent.parent / "web"
    if not (web_dir / "node_modules").exists():
        console.print("[yellow]Installing frontend dependencies...[/]")
        subprocess.run(["npm", "install"], cwd=web_dir, check=True)

    console.print(f"[bold cyan]Starting PhilosophyWise[/]")
    console.print(f"  Backend:  http://localhost:{backend_port}")
    console.print(f"  Frontend: http://localhost:{frontend_port}")
    console.print(f"  [dim]Press Ctrl+C to stop both[/]\n")

    procs = []
    try:
        # Start backend
        procs.append(subprocess.Popen(
            ["uvicorn", "philosophywise.server:app", "--host", "0.0.0.0",
             "--port", str(backend_port), "--reload"],
        ))

        # Start frontend
        env = {**os.environ, "PORT": str(frontend_port)}
        procs.append(subprocess.Popen(
            ["npm", "run", "dev", "--", "--port", str(frontend_port)],
            cwd=web_dir,
            env=env,
        ))

        # Wait for either to exit
        for p in procs:
            p.wait()

    except KeyboardInterrupt:
        console.print("\n[yellow]Shutting down...[/]")
    finally:
        for p in procs:
            try:
                p.send_signal(signal.SIGTERM)
                p.wait(timeout=5)
            except Exception:
                p.kill()
        console.print("[green]Stopped.[/]")


# --- status ---


async def _get_status() -> tuple:
    await db.init_db()
    stats = await db.get_stats()
    videos = await db.list_videos(limit=10)
    return stats, videos


@main.command()
def status():
    """Show pipeline status, recent videos, and costs."""
    stats, videos = run_async(_get_status())

    vs = stats["videos"]
    console.print(f"\n[bold cyan]PhilosophyWise Status[/]")
    console.print(f"  Total videos:  {vs['total']}")
    console.print(f"  Total cost:    ${vs['total_cost']:.2f}")
    console.print(f"  Avg cost:      ${vs['avg_cost']:.2f}")

    if videos:
        table = Table(title="Recent Videos")
        table.add_column("ID", style="dim")
        table.add_column("Philosopher")
        table.add_column("Status", style="cyan")
        table.add_column("Cost", justify="right")
        table.add_column("Created")

        for v in videos:
            table.add_row(
                v["id"],
                v["philosopher_id"],
                v["status"],
                f"${v['cost_usd']:.2f}",
                v["created_at"][:19],
            )
        console.print(table)
    else:
        console.print("[dim]No videos yet.[/]")

    if stats["cost_breakdown"]:
        table = Table(title="Cost Breakdown")
        table.add_column("Component")
        table.add_column("Total", justify="right")
        for c in stats["cost_breakdown"]:
            table.add_row(c["component"], f"${c['total']:.2f}")
        console.print(table)


# --- publish ---


@main.command()
@click.option("--video-id", required=True, help="Video ID to publish")
def publish(video_id: str):
    """Manually trigger YouTube upload for a video."""
    console.print("[yellow]YouTube publishing not yet implemented (Agent 3).[/]")
    console.print(f"Video ID: {video_id}")


# --- cost-report ---


async def _cost_report():
    await db.init_db()
    return await db.get_stats()


@main.command("cost-report")
def cost_report():
    """Show detailed cost breakdown by component."""
    stats = run_async(_cost_report())

    console.print(f"\n[bold cyan]Cost Report[/]")
    vs = stats["videos"]
    console.print(f"  Videos generated: {vs['total']}")
    console.print(f"  Total spend:      ${vs['total_cost']:.2f}")
    console.print(f"  Avg per video:    ${vs['avg_cost']:.2f}")

    if stats["cost_breakdown"]:
        console.print()
        table = Table(title="By Component")
        table.add_column("Component")
        table.add_column("Total", justify="right")
        table.add_column("% of Total", justify="right")
        total = vs["total_cost"] or 1
        for c in stats["cost_breakdown"]:
            pct = (c["total"] / total) * 100
            table.add_row(c["component"], f"${c['total']:.2f}", f"{pct:.1f}%")
        console.print(table)
    else:
        console.print("[dim]No costs recorded yet.[/]")
