"""Multi-image comparison of measurements. Scene equivalence stays UNKNOWN."""

from __future__ import annotations

import math

from spe_runtime.visual.models import ClaimVerdict, ImageComparison, VisualObservation


def _hex_rgb(value: str) -> tuple[int, int, int]:
    return int(value[1:3], 16), int(value[3:5], 16), int(value[5:7], 16)


def _palette_distance(left: VisualObservation, right: VisualObservation) -> float | None:
    if not left.colors or not right.colors:
        return None
    lr, lg, lb = _hex_rgb(left.colors[0].hex)
    rr, rg, rb = _hex_rgb(right.colors[0].hex)
    distance = math.sqrt((lr - rr) ** 2 + (lg - rg) ** 2 + (lb - rb) ** 2)
    return round(distance / math.sqrt(3 * 255**2), 6)


def compare_observations(
    observations: tuple[VisualObservation, ...],
) -> tuple[ImageComparison, ...]:
    pairs: list[ImageComparison] = []
    for index, left in enumerate(observations):
        for right in observations[index + 1 :]:
            byte_identical = left.provenance.content_digest == right.provenance.content_digest
            same_dimensions = (
                left.source_width == right.source_width
                and left.source_height == right.source_height
            )
            if (
                left.style.brightness_mean is None
                or right.style.brightness_mean is None
            ):
                brightness_delta = None
                brightness_verdict = ClaimVerdict.UNKNOWN
            else:
                brightness_delta = round(
                    abs(left.style.brightness_mean - right.style.brightness_mean),
                    4,
                )
                brightness_verdict = ClaimVerdict.PASS
            distance = _palette_distance(left, right)
            pairs.append(
                ImageComparison(
                    left_asset_id=left.asset_id,
                    right_asset_id=right.asset_id,
                    byte_identical=byte_identical,
                    byte_identity_verdict=ClaimVerdict.PASS,
                    same_dimensions=same_dimensions,
                    dimension_verdict=ClaimVerdict.PASS,
                    brightness_delta=brightness_delta,
                    brightness_delta_verdict=brightness_verdict,
                    palette_distance=distance,
                    palette_distance_verdict=(
                        ClaimVerdict.PASS if distance is not None else ClaimVerdict.UNKNOWN
                    ),
                    semantic_equivalence_verdict=ClaimVerdict.UNKNOWN,
                    method="digest+measurement",
                )
            )
    return tuple(pairs)
