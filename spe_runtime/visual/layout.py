"""Projection layout and geometric composition. Semantic columns stay UNKNOWN."""

from __future__ import annotations

from spe_runtime.visual.measure import PixelStats
from spe_runtime.visual.models import ClaimVerdict, CompositionReading, LayoutReading
from spe_runtime.visual.raster import Raster


def _find_valleys(energy: list[float], min_gap: float) -> list[int]:
    if not energy:
        return []
    peak = max(energy)
    if peak <= 0:
        return []
    threshold = peak * 0.18
    valleys: list[int] = []
    in_valley = False
    start = 0
    for index, value in enumerate(energy):
        if value < threshold:
            if not in_valley:
                in_valley = True
                start = index
        elif in_valley:
            in_valley = False
            mid = (start + index) // 2
            wide_enough = (index - start) >= min_gap * 0.5
            spaced = not valleys or mid - valleys[-1] >= min_gap
            interior = energy and (mid > len(energy) * 0.08) and (mid < len(energy) * 0.92)
            if wide_enough and spaced and interior:
                valleys.append(mid)
    return valleys[:5]


def _projection_energy(raster: Raster) -> tuple[list[float], list[float]]:
    width = raster.width
    height = raster.height
    step = 2 if min(width, height) > 64 else 1
    columns = [0.0] * width
    rows = [0.0] * height
    for y in range(1, height - 1, step):
        for x in range(1, width - 1, step):
            center = raster.luminance(x, y)
            right = raster.luminance(x + 1, y)
            down = raster.luminance(x, y + 1)
            if center is None or right is None or down is None:
                continue
            magnitude = abs(center - right) + abs(center - down)
            columns[x] += magnitude
            rows[y] += magnitude
    return columns, rows


def read_layout(raster: Raster) -> LayoutReading:
    columns, rows = _projection_energy(raster)
    gutters = _find_valleys(columns, raster.width * 0.04)
    gaps = _find_valleys(rows, raster.height * 0.04)
    column_energy = max(columns) if columns else 0.0
    row_energy = max(rows) if rows else 0.0
    if column_energy <= 0:
        projection_columns = None
        column_verdict = ClaimVerdict.UNKNOWN
        gutter_measured = False
    else:
        projection_columns = max(1, min(6, len(gutters) + 1))
        column_verdict = ClaimVerdict.PASS
        gutter_measured = True
    if row_energy <= 0:
        projection_rows = None
        row_verdict = ClaimVerdict.UNKNOWN
    else:
        projection_rows = max(1, min(8, len(gaps) + 1))
        row_verdict = ClaimVerdict.PASS
    gutter_verdict = ClaimVerdict.PASS if gutter_measured or row_energy > 0 else ClaimVerdict.UNKNOWN
    return LayoutReading(
        projection_columns=projection_columns,
        projection_columns_verdict=column_verdict,
        semantic_columns_verdict=ClaimVerdict.UNKNOWN,
        projection_rows=projection_rows,
        projection_rows_verdict=row_verdict,
        semantic_rows_verdict=ClaimVerdict.UNKNOWN,
        gutters=tuple(round(item / raster.width, 6) for item in gutters),
        row_gaps=tuple(round(item / raster.height, 6) for item in gaps),
        gutter_verdict=gutter_verdict,
        method="structure-heuristic",
    )


def _cell(stats: PixelStats, row: int, col: int) -> float | None:
    for cell_row, cell_col, mean, _count in stats.grid:
        if cell_row == row and cell_col == col:
            return mean
    return None


def _mean_of(values: list[float | None]) -> float | None:
    present = [value for value in values if value is not None]
    if not present:
        return None
    return sum(present) / len(present)


def read_composition(stats: PixelStats, source_width: int, source_height: int) -> CompositionReading:
    if stats.samples <= 0:
        return CompositionReading(
            orientation="UNKNOWN",
            orientation_verdict=ClaimVerdict.UNKNOWN,
            symmetry_score=None,
            symmetry_score_verdict=ClaimVerdict.UNKNOWN,
            symmetry_label="UNKNOWN",
            symmetry_label_verdict=ClaimVerdict.UNKNOWN,
            bias_suggestion="UNKNOWN",
            bias_verdict=ClaimVerdict.UNKNOWN,
            method="lite-pixel",
        )
    ratio = source_width / max(1, source_height)
    if ratio > 1.12:
        orientation = "landscape"
    elif ratio < 0.88:
        orientation = "portrait"
    else:
        orientation = "square"
    left = _mean_of([_cell(stats, 0, 0), _cell(stats, 1, 0), _cell(stats, 2, 0)])
    mid = _mean_of([_cell(stats, 0, 1), _cell(stats, 1, 1), _cell(stats, 2, 1)])
    right = _mean_of([_cell(stats, 0, 2), _cell(stats, 1, 2), _cell(stats, 2, 2)])
    top = _mean_of([_cell(stats, 0, 0), _cell(stats, 0, 1), _cell(stats, 0, 2)])
    bottom = _mean_of([_cell(stats, 2, 0), _cell(stats, 2, 1), _cell(stats, 2, 2)])
    if None in (left, mid, right, top, bottom):
        symmetry_score = None
        symmetry_verdict = ClaimVerdict.UNKNOWN
        bias = "UNKNOWN"
    else:
        assert left is not None and mid is not None and right is not None
        assert top is not None and bottom is not None
        lr = abs(left - right)
        tb = abs(top - bottom)
        symmetry_score = round(1 - min(1.0, (lr + tb) / 120), 6)
        symmetry_verdict = ClaimVerdict.PASS
        center_pull = abs(mid - (left + right) / 2)
        if center_pull < 12 and lr < 18:
            bias = "balanced"
        elif left < right - 20:
            bias = "left"
        elif right < left - 20:
            bias = "right"
        elif mid > left and mid > right:
            bias = "center"
        else:
            bias = "balanced"
    if symmetry_score is None:
        label = "UNKNOWN"
    elif symmetry_score > 0.7:
        label = "high"
    elif symmetry_score > 0.4:
        label = "medium"
    else:
        label = "low"
    return CompositionReading(
        orientation=orientation,
        orientation_verdict=ClaimVerdict.PASS,
        symmetry_score=symmetry_score,
        symmetry_score_verdict=symmetry_verdict,
        symmetry_label=label,
        symmetry_label_verdict=ClaimVerdict.UNKNOWN,
        bias_suggestion=bias,
        bias_verdict=ClaimVerdict.UNKNOWN,
        method="lite-pixel",
    )
