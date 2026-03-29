"""Cross-dissolve transition filter builder for ffmpeg."""

from __future__ import annotations

import logging

logger = logging.getLogger(__name__)

# All ffmpeg xfade transitions, grouped for UI
TRANSITION_TYPES = {
    "cuts": {
        "hard_cut": {"label": "Hard Cut", "ffmpeg": None, "duration": 0.0},
    },
    "fades": {
        "fade": {"label": "Fade", "ffmpeg": "fade", "duration": 0.3},
        "fadeblack": {"label": "Fade to Black", "ffmpeg": "fadeblack", "duration": 0.5},
        "fadewhite": {"label": "Flash", "ffmpeg": "fadewhite", "duration": 0.3},
        "fadefast": {"label": "Fast Fade", "ffmpeg": "fadefast", "duration": 0.2},
        "fadeslow": {"label": "Slow Fade", "ffmpeg": "fadeslow", "duration": 0.5},
        "fadegrays": {"label": "Fade Grays", "ffmpeg": "fadegrays", "duration": 0.4},
        "dissolve": {"label": "Dissolve", "ffmpeg": "dissolve", "duration": 0.4},
    },
    "wipes": {
        "wipeleft": {"label": "Wipe Left", "ffmpeg": "wipeleft", "duration": 0.3},
        "wiperight": {"label": "Wipe Right", "ffmpeg": "wiperight", "duration": 0.3},
        "wipeup": {"label": "Wipe Up", "ffmpeg": "wipeup", "duration": 0.3},
        "wipedown": {"label": "Wipe Down", "ffmpeg": "wipedown", "duration": 0.3},
        "wipetl": {"label": "Wipe Top-Left", "ffmpeg": "wipetl", "duration": 0.3},
        "wipetr": {"label": "Wipe Top-Right", "ffmpeg": "wipetr", "duration": 0.3},
        "wipebl": {"label": "Wipe Bottom-Left", "ffmpeg": "wipebl", "duration": 0.3},
        "wipebr": {"label": "Wipe Bottom-Right", "ffmpeg": "wipebr", "duration": 0.3},
    },
    "slides": {
        "slideleft": {"label": "Slide Left", "ffmpeg": "slideleft", "duration": 0.3},
        "slideright": {"label": "Slide Right", "ffmpeg": "slideright", "duration": 0.3},
        "slideup": {"label": "Slide Up", "ffmpeg": "slideup", "duration": 0.3},
        "slidedown": {"label": "Slide Down", "ffmpeg": "slidedown", "duration": 0.3},
        "smoothleft": {"label": "Smooth Left", "ffmpeg": "smoothleft", "duration": 0.4},
        "smoothright": {"label": "Smooth Right", "ffmpeg": "smoothright", "duration": 0.4},
        "smoothup": {"label": "Smooth Up", "ffmpeg": "smoothup", "duration": 0.4},
        "smoothdown": {"label": "Smooth Down", "ffmpeg": "smoothdown", "duration": 0.4},
    },
    "reveals": {
        "circleopen": {"label": "Circle Open", "ffmpeg": "circleopen", "duration": 0.4},
        "circleclose": {"label": "Circle Close", "ffmpeg": "circleclose", "duration": 0.4},
        "circlecrop": {"label": "Circle Crop", "ffmpeg": "circlecrop", "duration": 0.4},
        "rectcrop": {"label": "Rect Crop", "ffmpeg": "rectcrop", "duration": 0.4},
        "radial": {"label": "Radial", "ffmpeg": "radial", "duration": 0.4},
        "vertopen": {"label": "Vertical Open", "ffmpeg": "vertopen", "duration": 0.3},
        "vertclose": {"label": "Vertical Close", "ffmpeg": "vertclose", "duration": 0.3},
        "horzopen": {"label": "Horizontal Open", "ffmpeg": "horzopen", "duration": 0.3},
        "horzclose": {"label": "Horizontal Close", "ffmpeg": "horzclose", "duration": 0.3},
    },
    "zoom_squeeze": {
        "zoomin": {"label": "Zoom In", "ffmpeg": "zoomin", "duration": 0.4},
        "squeezeh": {"label": "Squeeze Horizontal", "ffmpeg": "squeezeh", "duration": 0.3},
        "squeezev": {"label": "Squeeze Vertical", "ffmpeg": "squeezev", "duration": 0.3},
        "pixelize": {"label": "Pixelize", "ffmpeg": "pixelize", "duration": 0.4},
    },
    "covers": {
        "coverleft": {"label": "Cover Left", "ffmpeg": "coverleft", "duration": 0.3},
        "coverright": {"label": "Cover Right", "ffmpeg": "coverright", "duration": 0.3},
        "coverup": {"label": "Cover Up", "ffmpeg": "coverup", "duration": 0.3},
        "coverdown": {"label": "Cover Down", "ffmpeg": "coverdown", "duration": 0.3},
        "revealleft": {"label": "Reveal Left", "ffmpeg": "revealleft", "duration": 0.3},
        "revealright": {"label": "Reveal Right", "ffmpeg": "revealright", "duration": 0.3},
        "revealup": {"label": "Reveal Up", "ffmpeg": "revealup", "duration": 0.3},
        "revealdown": {"label": "Reveal Down", "ffmpeg": "revealdown", "duration": 0.3},
    },
    "diagonal": {
        "diagtl": {"label": "Diagonal Top-Left", "ffmpeg": "diagtl", "duration": 0.3},
        "diagtr": {"label": "Diagonal Top-Right", "ffmpeg": "diagtr", "duration": 0.3},
        "diagbl": {"label": "Diagonal Bottom-Left", "ffmpeg": "diagbl", "duration": 0.3},
        "diagbr": {"label": "Diagonal Bottom-Right", "ffmpeg": "diagbr", "duration": 0.3},
    },
    "wind": {
        "hlwind": {"label": "Wind Left", "ffmpeg": "hlwind", "duration": 0.4},
        "hrwind": {"label": "Wind Right", "ffmpeg": "hrwind", "duration": 0.4},
        "vuwind": {"label": "Wind Up", "ffmpeg": "vuwind", "duration": 0.4},
        "vdwind": {"label": "Wind Down", "ffmpeg": "vdwind", "duration": 0.4},
    },
}

# Flat lookup: transition_key -> transition info
TRANSITION_LOOKUP: dict[str, dict] = {}
for _group_transitions in TRANSITION_TYPES.values():
    TRANSITION_LOOKUP.update(_group_transitions)

# Map beat-analysis transition names to actual ffmpeg transitions
BEAT_TRANSITION_MAP = {
    "hard_cut": "hard_cut",
    "flash": "fadewhite",
    "zoom": "zoomin",
    "fade": "fade",
    "whip_pan": "slideleft",
}


def build_transition_filter(
    clip_count: int,
    durations: list[float],
    transitions: list[str] | None = None,
    default_transition: str = "fade",
    default_duration: float = 0.3,
) -> str:
    """Build ffmpeg xfade filter chain with per-transition type support.

    Args:
        clip_count: number of clips
        durations: duration of each clip
        transitions: list of transition keys (length = clip_count - 1).
                     Each is a key from TRANSITION_LOOKUP (e.g. "fade", "zoomin", "fadewhite").
                     If None, uses default_transition for all.
        default_transition: fallback transition type
        default_duration: fallback transition duration
    """
    if clip_count < 2:
        logger.debug("Single clip, no transitions needed")
        return ""

    if len(durations) != clip_count:
        raise ValueError(
            f"Duration count ({len(durations)}) must match clip count ({clip_count})"
        )

    # Build the per-boundary transition list
    num_boundaries = clip_count - 1
    if transitions is None:
        transition_keys = [default_transition] * num_boundaries
    else:
        # Pad or truncate to match boundary count
        transition_keys = list(transitions)
        while len(transition_keys) < num_boundaries:
            transition_keys.append(default_transition)
        transition_keys = transition_keys[:num_boundaries]

    filters: list[str] = []
    cumulative_duration = durations[0]

    for i in range(1, clip_count):
        boundary_idx = i - 1
        t_key = transition_keys[boundary_idx]

        # Look up transition info
        t_info = TRANSITION_LOOKUP.get(t_key)
        if t_info is None:
            # Unknown key — fall back to default
            t_info = TRANSITION_LOOKUP.get(default_transition, {"ffmpeg": "fade", "duration": default_duration})

        # For hard_cut (ffmpeg=None), use an ultra-short fade (essentially instant)
        if t_info.get("ffmpeg") is None:
            ffmpeg_transition = "fade"
            transition_dur = 0.01
        else:
            ffmpeg_transition = t_info["ffmpeg"]
            transition_dur = t_info.get("duration", default_duration)

        # Offset = cumulative duration of all previous clips, minus the
        # transition overlap that has already been consumed
        offset = cumulative_duration - transition_dur
        if offset < 0:
            offset = 0
            logger.warning(
                "Clip %d too short for %.1fs transition, clamping offset to 0",
                i - 1,
                transition_dur,
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
            f"{left_label}{right_label}xfade=transition={ffmpeg_transition}:"
            f"duration={transition_dur}:offset={offset:.3f}{out_label}"
        )

        # Update cumulative duration (each xfade shortens total by transition_dur)
        cumulative_duration += durations[i] - transition_dur

    result = ";".join(filters)
    logger.debug("Transition filter: %s", result)
    return result
