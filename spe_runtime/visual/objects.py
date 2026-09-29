"""Contrast regions. Class names are UNKNOWN without a local classifier."""

from __future__ import annotations

from spe_runtime.visual.constants import MAX_OBJECTS
from spe_runtime.visual.models import ClaimVerdict, NormBounds, VisualObject
from spe_runtime.visual.raster import Raster


def _downsample(raster: Raster, side: int = 48) -> tuple[list[list[float | None]], int, int]:
    grid_w = min(side, raster.width)
    grid_h = min(side, raster.height)
    cells: list[list[float | None]] = []
    for gy in range(grid_h):
        y0 = (gy * raster.height) // grid_h
        y1 = max(y0 + 1, ((gy + 1) * raster.height) // grid_h)
        y = min(raster.height - 1, (y0 + y1) // 2)
        row: list[float | None] = []
        for gx in range(grid_w):
            x0 = (gx * raster.width) // grid_w
            x1 = max(x0 + 1, ((gx + 1) * raster.width) // grid_w)
            x = min(raster.width - 1, (x0 + x1) // 2)
            row.append(raster.luminance(x, y))
        cells.append(row)
    return cells, grid_w, grid_h


def read_objects(raster: Raster, asset_id: str) -> tuple[VisualObject, ...]:
    cells, grid_w, grid_h = _downsample(raster)
    opaque = [value for row in cells for value in row if value is not None]
    if not opaque:
        return ()
    mean = sum(opaque) / len(opaque)
    mask = [
        [value is not None and abs(value - mean) > 36 for value in row]
        for row in cells
    ]
    seen = [[False] * grid_w for _ in range(grid_h)]
    components: list[list[tuple[int, int]]] = []
    minimum = max(2, int(0.004 * grid_w * grid_h))
    for y in range(grid_h):
        for x in range(grid_w):
            if seen[y][x] or not mask[y][x]:
                continue
            stack = [(x, y)]
            points: list[tuple[int, int]] = []
            while stack:
                cx, cy = stack.pop()
                if cx < 0 or cy < 0 or cx >= grid_w or cy >= grid_h:
                    continue
                if seen[cy][cx] or not mask[cy][cx]:
                    continue
                seen[cy][cx] = True
                points.append((cx, cy))
                stack.extend(((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)))
            if len(points) >= minimum:
                components.append(points)
    components.sort(key=len, reverse=True)
    objects: list[VisualObject] = []
    cell_area = grid_w * grid_h
    for index, points in enumerate(components[:MAX_OBJECTS]):
        xs = [point[0] for point in points]
        ys = [point[1] for point in points]
        x0 = min(xs) / grid_w
        y0 = min(ys) / grid_h
        x1 = (max(xs) + 1) / grid_w
        y1 = (max(ys) + 1) / grid_h
        bounds = NormBounds(
            x=round(x0, 6),
            y=round(y0, 6),
            w=round(max(0.0, min(1.0 - x0, x1 - x0)), 6),
            h=round(max(0.0, min(1.0 - y0, y1 - y0)), 6),
        )
        objects.append(
            VisualObject(
                object_id=f"{asset_id}:region:{index}",
                class_label="UNKNOWN",
                class_verdict=ClaimVerdict.UNKNOWN,
                bounds=bounds,
                area_share=round(len(points) / cell_area, 6),
                bounds_verdict=ClaimVerdict.PASS,
                method="contrast-region",
            )
        )
    return tuple(objects)
