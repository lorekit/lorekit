"""Tests for lorekit.story.templates — arc templates registry."""

from __future__ import annotations

import pytest


def test_arc_templates_registry_has_story():
    from lorekit.story.templates import ARC_TEMPLATES
    assert "story" in ARC_TEMPLATES


def test_arc_templates_registry_has_rapid_montage():
    from lorekit.story.templates import ARC_TEMPLATES
    assert "rapid_montage" in ARC_TEMPLATES


def test_arc_templates_registry_has_ugc_reaction():
    from lorekit.story.templates import ARC_TEMPLATES
    assert "ugc_reaction" in ARC_TEMPLATES


def test_ugc_reaction_constraints():
    from lorekit.story.templates import ARC_TEMPLATES
    arc = ARC_TEMPLATES["ugc_reaction"]
    assert arc.min_scenes == 1
    assert arc.max_scenes <= 4
    assert arc.min_duration == 3
    assert arc.max_duration <= 20


def test_ugc_reaction_has_reaction_beat():
    from lorekit.story.templates import ARC_TEMPLATES
    arc = ARC_TEMPLATES["ugc_reaction"]
    assert len(arc.beats) >= 1
    beat_names = [b["beat"] for b in arc.beats]
    assert "reaction" in beat_names


@pytest.mark.asyncio
async def test_get_arc_template_unknown_raises():
    from lorekit.story.templates import get_arc_template
    with pytest.raises(KeyError):
        await get_arc_template("nonexistent_template")
