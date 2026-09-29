"""Typography measurements from text-like bands. Density labels stay UNKNOWN."""

from __future__ import annotations

from spe_runtime.visual.models import ClaimVerdict, OcrBlock, TypographyReading


def read_typography(blocks: tuple[OcrBlock, ...]) -> TypographyReading:
    textlike = tuple(block for block in blocks if block.method == "ocr-textlikeness" and block.bounds)
    coverage = 0.0
    ratios: list[float] = []
    for block in textlike:
        assert block.bounds is not None
        coverage += block.bounds.h
        ratios.append(round(block.bounds.h, 6))
    coverage = round(min(1.0, coverage), 6)
    if not textlike:
        density = "UNKNOWN"
    elif coverage < 0.08:
        density = "sparse"
    elif coverage < 0.25:
        density = "comfortable"
    else:
        density = "dense"
    scale_verdict = ClaimVerdict.PASS if ratios else ClaimVerdict.UNKNOWN
    return TypographyReading(
        band_count=len(textlike),
        band_count_verdict=ClaimVerdict.PASS,
        coverage=coverage,
        coverage_verdict=ClaimVerdict.PASS,
        density_suggestion=density,
        density_verdict=ClaimVerdict.UNKNOWN,
        scale_ratios=tuple(ratios),
        scale_verdict=scale_verdict,
        method="ocr-textlikeness",
    )
