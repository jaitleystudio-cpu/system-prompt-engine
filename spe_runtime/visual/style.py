"""Style suggestions. Interpretive labels are MODEL_JUDGMENT and cannot PASS."""

from __future__ import annotations

from spe_runtime.visual.measure import PixelStats
from spe_runtime.visual.models import ClaimVerdict, StyleReading


def _lighting_word(mean: float) -> str:
    if mean < 45:
        return "low-key"
    if mean < 70:
        return "dark"
    if mean < 110:
        return "dim"
    if mean < 170:
        return "balanced"
    if mean < 210:
        return "bright"
    return "high-key"


def _kind_word(stats: PixelStats) -> str:
    edge = stats.edge_density if stats.edge_density is not None else 0.0
    count = len(stats.colors)
    top_share = stats.colors[0][1] if stats.colors else 0.0
    if edge > 0.28 and count >= 3 and top_share < 0.55:
        return "photograph"
    if edge > 0.18 and top_share > 0.35 and count <= 4:
        return "ui-screenshot"
    if edge < 0.12 and count <= 3:
        return "graphic"
    if 0.12 <= edge <= 0.28:
        return "illustration"
    return "UNKNOWN"


def read_style(stats: PixelStats) -> StyleReading:
    if stats.samples <= 0 or stats.mean_brightness is None:
        return StyleReading(
            kind_suggestion="UNKNOWN",
            kind_verdict=ClaimVerdict.UNKNOWN,
            lighting_suggestion="UNKNOWN",
            lighting_verdict=ClaimVerdict.UNKNOWN,
            brightness_mean=None,
            brightness_verdict=ClaimVerdict.UNKNOWN,
            edge_density=None,
            edge_verdict=ClaimVerdict.UNKNOWN,
            palette_mood="UNKNOWN",
            palette_mood_verdict=ClaimVerdict.UNKNOWN,
            method="structure-heuristic",
        )
    hexes = [item[0] for item in stats.colors[:3]]
    mood = f"Dominant {', '.join(hexes)}" if hexes else "UNKNOWN"
    edge_verdict = (
        ClaimVerdict.PASS if stats.edge_density is not None else ClaimVerdict.UNKNOWN
    )
    return StyleReading(
        kind_suggestion=_kind_word(stats),
        kind_verdict=ClaimVerdict.UNKNOWN,
        lighting_suggestion=_lighting_word(stats.mean_brightness),
        lighting_verdict=ClaimVerdict.UNKNOWN,
        brightness_mean=round(stats.mean_brightness, 4),
        brightness_verdict=ClaimVerdict.PASS,
        edge_density=None if stats.edge_density is None else round(stats.edge_density, 6),
        edge_verdict=edge_verdict,
        palette_mood=mood,
        palette_mood_verdict=ClaimVerdict.UNKNOWN,
        method="structure-heuristic",
    )
