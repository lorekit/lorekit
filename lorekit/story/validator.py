"""Story validation — ensure generated stories meet pipeline constraints."""

from __future__ import annotations

from typing import TYPE_CHECKING, Protocol

from lorekit.story.templates import BEAT_DURATION_RANGES

if TYPE_CHECKING:
    from lorekit.story.templates import ArcTemplate


class SceneLike(Protocol):
    """Anything with the fields the validator checks."""
    scene_id: int
    beat: str
    duration: float
    text_overlay: str


def validate_scenes(
    scenes: list[SceneLike],
    arc: "ArcTemplate | None" = None,
) -> list[str]:
    """Returns list of issues. Empty = valid.

    Accepts any scene-like objects (SceneItem, old Scene, etc.)
    as long as they have scene_id, beat, duration, text_overlay.
    """
    issues: list[str] = []
    total_duration = sum(s.duration for s in scenes)

    if arc is not None:
        min_dur = arc.min_duration
        max_dur = arc.max_duration
        min_scenes = arc.min_scenes
        max_scenes = arc.max_scenes
        max_scene_dur = arc.max_scene_duration
        arc_beat_ranges: dict[str, tuple[int, int]] = {}
        for b in arc.beats + arc.optional_beats:
            arc_beat_ranges[b["beat"]] = (
                b["duration_range"][0],
                b["duration_range"][1],
            )
    else:
        min_dur = 30
        max_dur = 50
        min_scenes = 5
        max_scenes = 8
        max_scene_dur = 8
        arc_beat_ranges = BEAT_DURATION_RANGES

    if total_duration < min_dur:
        issues.append(f"Total duration too short: {total_duration:.1f}s (min {min_dur}s)")
    if total_duration > max_dur:
        issues.append(f"Total duration too long: {total_duration:.1f}s (max {max_dur}s)")

    if len(scenes) < min_scenes:
        issues.append(f"Too few scenes: {len(scenes)} (min {min_scenes})")
    if len(scenes) > max_scenes:
        issues.append(f"Too many scenes: {len(scenes)} (max {max_scenes})")

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

    for s in scenes:
        if s.duration > max_scene_dur + 0.5:
            issues.append(
                f"Scene {s.scene_id} ({s.beat}) exceeds "
                f"{max_scene_dur}s: {s.duration:.1f}s"
            )

        if s.beat in arc_beat_ranges:
            lo, hi = arc_beat_ranges[s.beat]
            if s.duration < lo - 0.5 or s.duration > hi + 0.5:
                issues.append(
                    f"Scene {s.scene_id} ({s.beat}) duration {s.duration:.1f}s "
                    f"outside range [{lo}-{hi}s]"
                )

    for s in scenes:
        if not s.text_overlay:
            issues.append(f"Scene {s.scene_id} ({s.beat}) missing text_overlay")

    return issues


# Backward compat alias
validate_story = validate_scenes
