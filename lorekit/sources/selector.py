"""Smart source item selection — theme-based pairing for coherent videos."""

from __future__ import annotations

import random

from lorekit.models import SourceItem

THEME_FAMILIES: dict[str, list[str]] = {
    "mortality": ["mortality", "death", "time", "impermanence"],
    "discipline": ["discipline", "mastery", "practice", "effort"],
    "strategy": ["strategy", "war", "leadership", "power"],
    "mindset": ["mindset", "perception", "thoughts", "attitude"],
    "virtue": ["virtue", "courage", "honor", "duty"],
    "nature": ["nature", "flow", "water", "balance"],
    "wisdom": ["wisdom", "knowledge", "ignorance", "learning"],
}

# Reverse lookup: theme → family name
_THEME_TO_FAMILY: dict[str, str] = {}
for family, themes in THEME_FAMILIES.items():
    for theme in themes:
        _THEME_TO_FAMILY[theme] = family


def get_theme_family(theme: str) -> str | None:
    """Return the family name for a given theme, or None if unrecognized."""
    return _THEME_TO_FAMILY.get(theme)


def themes_compatible(hook_theme: str, truth_theme: str) -> bool:
    """Check if a hook and truth source item make a coherent video together.

    Two themes are compatible if they belong to the same theme family.
    Unknown themes are considered compatible with anything (fallback).
    """
    hook_family = get_theme_family(hook_theme)
    truth_family = get_theme_family(truth_theme)

    # If either theme is unrecognized, allow the pairing
    if hook_family is None or truth_family is None:
        return True

    return hook_family == truth_family


def pick_source_for_function(
    source_items: list[SourceItem],
    function: str,
    exclude_ids: set[str] | None = None,
) -> SourceItem | None:
    """Pick the best unused source item for a given emotional function.

    Filters by emotional_function, excludes already-used item texts,
    and returns a random selection from the candidates. Returns None
    if no matching source item is available.
    """
    if exclude_ids is None:
        exclude_ids = set()

    candidates = [
        q for q in source_items
        if q.emotional_function == function and q.text not in exclude_ids
    ]

    if not candidates:
        return None

    return random.choice(candidates)


def find_compatible_truth(
    hook: SourceItem,
    truth_items: list[SourceItem],
    exclude_ids: set[str] | None = None,
) -> SourceItem | None:
    """Find a truth source item that pairs thematically with the given hook.

    Tries same-family first, then falls back to any truth source item.
    """
    if exclude_ids is None:
        exclude_ids = set()

    available = [q for q in truth_items if q.text not in exclude_ids]
    if not available:
        return None

    # Prefer same theme family
    compatible = [q for q in available if themes_compatible(hook.theme, q.theme)]
    if compatible:
        return random.choice(compatible)

    # Fallback: any available truth source item
    return random.choice(available)
