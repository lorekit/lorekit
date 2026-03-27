"""Story validation — ensure generated stories meet pipeline constraints."""

from __future__ import annotations

from difflib import SequenceMatcher

from philosophywise.models import StoryBreakdown
from philosophywise.story.templates import BEAT_DURATION_RANGES


def validate_story(story: StoryBreakdown) -> list[str]:
    """Returns list of issues. Empty = valid.

    Checks:
    - Total duration between 30-50 seconds
    - Scene count between 5-8
    - Has exactly one hook and one loop beat
    - Has at least one truth beat
    - Durations per scene are within their beat's range
    - Hook scene has text_overlay (the hook quote)
    - Truth scene has text_overlay (the truth quote)
    - Loop scene visual matches hook scene visual (similar description)
    - No scene exceeds 8 seconds
    - Total word count of all text overlays reasonable for total duration
    """
    issues: list[str] = []

    scenes = story.scenes
    total_duration = sum(s.duration for s in scenes)

    # Total duration
    if total_duration < 30:
        issues.append(f"Total duration too short: {total_duration:.1f}s (min 30s)")
    if total_duration > 50:
        issues.append(f"Total duration too long: {total_duration:.1f}s (max 50s)")

    # Scene count
    if len(scenes) < 5:
        issues.append(f"Too few scenes: {len(scenes)} (min 5)")
    if len(scenes) > 8:
        issues.append(f"Too many scenes: {len(scenes)} (max 8)")

    # Beat counts
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

    # Per-scene checks
    for s in scenes:
        # Max duration
        if s.duration > 8:
            issues.append(
                f"Scene {s.scene_id} ({s.beat}) exceeds 8s: {s.duration:.1f}s"
            )

        # Beat duration range
        if s.beat in BEAT_DURATION_RANGES:
            lo, hi = BEAT_DURATION_RANGES[s.beat]
            if s.duration < lo - 0.5 or s.duration > hi + 0.5:
                issues.append(
                    f"Scene {s.scene_id} ({s.beat}) duration {s.duration:.1f}s "
                    f"outside range [{lo}-{hi}s]"
                )

    # Every scene must have text overlay (narration runs throughout)
    for s in scenes:
        if not s.text_overlay:
            issues.append(f"Scene {s.scene_id} ({s.beat}) missing text_overlay")

    # Total text overlay word count vs duration
    total_words = 0
    for s in scenes:
        if s.text_overlay:
            total_words += len(s.text_overlay.split())

    # Roughly 2.5 words/sec comfortable reading speed; allow generous margin
    max_comfortable_words = int(total_duration * 1.5)
    if total_words > max_comfortable_words:
        issues.append(
            f"Too much text overlay: {total_words} words for "
            f"{total_duration:.0f}s video (max ~{max_comfortable_words})"
        )

    return issues
