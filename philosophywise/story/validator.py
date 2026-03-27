"""Story validation — ensure generated stories meet pipeline constraints."""

from __future__ import annotations

from typing import TYPE_CHECKING

from difflib import SequenceMatcher

from philosophywise.models import StoryBreakdown
from philosophywise.story.templates import BEAT_DURATION_RANGES

if TYPE_CHECKING:
    from philosophywise.story.templates import ArcTemplate


def validate_story(
    story: StoryBreakdown,
    arc: "ArcTemplate | None" = None,
) -> list[str]:
    """Returns list of issues. Empty = valid.

    When *arc* is provided, validates against that template's constraints.
    Otherwise falls back to the legacy "story" defaults for backwards
    compatibility.

    Checks:
    - Total duration within template range
    - Scene count within template range
    - Beat-specific constraints (hook/loop for story arc)
    - Per-scene duration limits
    - Every scene has text_overlay
    - Total word count reasonable for duration
    """
    issues: list[str] = []
    scenes = story.scenes
    total_duration = sum(s.duration for s in scenes)

    # Resolve constraints from arc template or use story defaults
    if arc is not None:
        min_dur = arc.min_duration
        max_dur = arc.max_duration
        min_scenes = arc.min_scenes
        max_scenes = arc.max_scenes
        max_scene_dur = arc.max_scene_duration
        # Build beat duration ranges from this specific arc
        arc_beat_ranges: dict[str, tuple[int, int]] = {}
        for b in arc.beats + arc.optional_beats:
            arc_beat_ranges[b["beat"]] = (
                b["duration_range"][0],
                b["duration_range"][1],
            )
    else:
        # Legacy defaults (story arc)
        min_dur = 30
        max_dur = 50
        min_scenes = 5
        max_scenes = 8
        max_scene_dur = 8
        arc_beat_ranges = BEAT_DURATION_RANGES

    # ── Total duration ────────────────────────────────────────────────
    if total_duration < min_dur:
        issues.append(
            f"Total duration too short: {total_duration:.1f}s (min {min_dur}s)"
        )
    if total_duration > max_dur:
        issues.append(
            f"Total duration too long: {total_duration:.1f}s (max {max_dur}s)"
        )

    # ── Scene count ───────────────────────────────────────────────────
    if len(scenes) < min_scenes:
        issues.append(f"Too few scenes: {len(scenes)} (min {min_scenes})")
    if len(scenes) > max_scenes:
        issues.append(f"Too many scenes: {len(scenes)} (max {max_scenes})")

    # ── Beat-specific checks (only for the "story" arc) ──────────────
    is_story = arc is None or arc.id == "story"
    if is_story:
        beat_counts: dict[str, int] = {}
        for s in scenes:
            beat_counts[s.beat] = beat_counts.get(s.beat, 0) + 1

        hook_count = beat_counts.get("hook", 0)
        if hook_count != 1:
            issues.append(f"Expected exactly 1 hook beat, found {hook_count}")

        loop_count = beat_counts.get("loop", 0)
        if loop_count != 1:
            issues.append(f"Expected exactly 1 loop beat, found {loop_count}")

        truth_count = beat_counts.get("truth", 0)
        if truth_count < 1:
            issues.append("No truth beat found")

    # ── Per-scene checks ─────────────────────────────────────────────
    for s in scenes:
        # Max duration per scene
        if s.duration > max_scene_dur + 0.5:  # small tolerance
            issues.append(
                f"Scene {s.scene_id} ({s.beat}) exceeds "
                f"{max_scene_dur}s: {s.duration:.1f}s"
            )

        # Beat duration range (with 0.5 s tolerance)
        if s.beat in arc_beat_ranges:
            lo, hi = arc_beat_ranges[s.beat]
            if s.duration < lo - 0.5 or s.duration > hi + 0.5:
                issues.append(
                    f"Scene {s.scene_id} ({s.beat}) duration {s.duration:.1f}s "
                    f"outside range [{lo}-{hi}s]"
                )

    # ── Every scene must have text overlay ────────────────────────────
    for s in scenes:
        if not s.text_overlay:
            issues.append(f"Scene {s.scene_id} ({s.beat}) missing text_overlay")

    # ── Total text overlay word count vs duration ────────────────────
    total_words = sum(
        len(s.text_overlay.split()) for s in scenes if s.text_overlay
    )

    # Roughly 1.5 words/sec max comfortable; montages have very few words
    max_comfortable_words = int(total_duration * 1.5)
    if total_words > max_comfortable_words:
        issues.append(
            f"Too much text overlay: {total_words} words for "
            f"{total_duration:.0f}s video (max ~{max_comfortable_words})"
        )

    return issues
