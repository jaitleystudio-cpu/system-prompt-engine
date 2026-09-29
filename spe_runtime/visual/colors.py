"""Quantized palette. Swatches are samples, not a calibrated profile."""

from __future__ import annotations

from spe_runtime.visual.measure import PixelStats
from spe_runtime.visual.models import ClaimVerdict, ColorSwatch, EpistemicStatus


def read_colors(stats: PixelStats) -> tuple[ColorSwatch, ...]:
    if stats.samples <= 0:
        return ()
    swatches: list[ColorSwatch] = []
    for hex_color, share in stats.colors:
        swatches.append(
            ColorSwatch(
                hex=hex_color,
                share=round(share, 6),
                verdict=ClaimVerdict.PASS,
                epistemic_status=EpistemicStatus.OBSERVATION,
                method="lite-pixel",
            )
        )
    return tuple(swatches)
