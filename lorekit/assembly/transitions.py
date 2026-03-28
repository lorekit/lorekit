"""Cross-dissolve transition filter builder for ffmpeg."""

from __future__ import annotations

import logging

logger = logging.getLogger(__name__)


def build_transition_filter(
    clip_count: int,
    durations: list[float],
    transition_duration: float = 0.3,
) -> str:
    """Build ffmpeg xfade filter chain for cross-dissolve transitions.

    Each scene pair gets a cross-dissolve of transition_duration seconds.
    The filter chain accounts for cumulative duration offsets.

    For N clips, we need N-1 xfade operations chained together.
    Each xfade's offset = cumulative duration up to that point minus
    cumulative transition durations already applied.

    Example for 3 clips (durations 3, 3, 3, transition 0.3):
      [v0][v1]xfade=transition=fade:duration=0.3:offset=2.7[xf0];
      [xf0][v2]xfade=transition=fade:duration=0.3:offset=5.1[vout]
    """
    if clip_count < 2:
        logger.debug("Single clip, no transitions needed")
        return ""

    if len(durations) != clip_count:
        raise ValueError(
            f"Duration count ({len(durations)}) must match clip count ({clip_count})"
        )

    filters: list[str] = []
    cumulative_duration = durations[0]

    for i in range(1, clip_count):
        # Offset = cumulative duration of all previous clips, minus the
        # transition overlap that has already been consumed
        offset = cumulative_duration - transition_duration
        if offset < 0:
            offset = 0
            logger.warning(
                "Clip %d too short for %.1fs transition, clamping offset to 0",
                i - 1,
                transition_duration,
            )

        # Input labels
        if i == 1:
            left_label = "[v0]"
        else:
            left_label = f"[xf{i - 2}]"

        right_label = f"[v{i}]"

        # Output label
        if i == clip_count - 1:
            out_label = "[vout]"
        else:
            out_label = f"[xf{i - 1}]"

        filters.append(
            f"{left_label}{right_label}xfade=transition=fade:"
            f"duration={transition_duration}:offset={offset:.3f}{out_label}"
        )

        # Update cumulative duration (each xfade shortens total by transition_duration)
        cumulative_duration += durations[i] - transition_duration

    result = ";".join(filters)
    logger.debug("Transition filter: %s", result)
    return result
