"""Arc templates — the universal story structure for every video."""

from __future__ import annotations

from typing import TypedDict


class BeatTemplate(TypedDict):
    beat: str
    duration_range: list[int]
    purpose: str


UNIVERSAL_ARC: list[BeatTemplate] = [
    {
        "beat": "hook",
        "duration_range": [2, 4],
        "purpose": "Stop the scroll. Most striking quote + powerful opening image.",
    },
    {
        "beat": "world",
        "duration_range": [4, 6],
        "purpose": "Establish the ancient world. Transport the viewer. Create awe.",
    },
    {
        "beat": "conflict",
        "duration_range": [5, 8],
        "purpose": "Show chaos, war, struggle. Emotional intensity.",
    },
    {
        "beat": "stillness",
        "duration_range": [4, 7],
        "purpose": "Philosopher alone. Writing, thinking, teaching. Contrast with chaos.",
    },
    {
        "beat": "truth",
        "duration_range": [5, 8],
        "purpose": "Deepest quote over culminating visual. The payoff.",
    },
    {
        "beat": "loop",
        "duration_range": [2, 4],
        "purpose": "Return to opening image. Seamless loop point.",
    },
]

OPTIONAL_BEATS: list[BeatTemplate] = [
    {
        "beat": "conflict_peak",
        "duration_range": [3, 5],
        "purpose": (
            "Overhead/wide shot of aftermath. "
            "Transition from action to reflection."
        ),
    },
]

VALID_BEATS: set[str] = {b["beat"] for b in UNIVERSAL_ARC + OPTIONAL_BEATS}

# Quick duration lookups
BEAT_DURATION_RANGES: dict[str, tuple[int, int]] = {
    b["beat"]: (b["duration_range"][0], b["duration_range"][1])
    for b in UNIVERSAL_ARC + OPTIONAL_BEATS
}
