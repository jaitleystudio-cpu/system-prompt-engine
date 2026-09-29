"""Shared pixel measurements. Numbers are observations; names are not."""

from __future__ import annotations

import math
from dataclasses import dataclass

from spe_runtime.visual.raster import Raster


def quantize_channel(value: int) -> int:
    """Half-up bucket, matching the browser lane's Math.round(v/32)*32."""

    return int(math.floor(value / 32 + 0.5)) * 32


def to_hex(red: float, green: float, blue: float) -> str:
    def channel(value: float) -> int:
        rounded = int(math.floor(value + 0.5))
        return max(0, min(255, rounded))

    return "#{:02x}{:02x}{:02x}".format(channel(red), channel(green), channel(blue))


@dataclass(frozen=True)
class PixelStats:
    samples: int
    transparent_checks: int
    mean_brightness: float | None
    dark_share: float
    light_share: float
    edge_density: float | None
    colors: tuple[tuple[str, float], ...]
    grid: tuple[tuple[int, int, float | None, int], ...]


def measure_pixels(raster: Raster) -> PixelStats:
    """Sample color, brightness, edges, and a 3×3 brightness grid."""

    width = raster.width
    height = raster.height
    total = width * height
    step = max(1, int(math.floor(math.sqrt(total / 12000))))
    votes: dict[tuple[int, int, int], list[int]] = {}
    brightness_sum = 0.0
    dark = 0
    light = 0
    samples = 0
    transparent = 0
    checks = 0
    for y in range(0, height, step):
        for x in range(0, width, step):
            red, green, blue, alpha = raster.pixel(x, y)
            checks += 1
            if alpha < 16:
                transparent += 1
                continue
            bright = (red * 299 + green * 587 + blue * 114) / 1000
            brightness_sum += bright
            if bright < 64:
                dark += 1
            if bright > 200:
                light += 1
            samples += 1
            key = (
                quantize_channel(red),
                quantize_channel(green),
                quantize_channel(blue),
            )
            bucket = votes.get(key)
            if bucket is None:
                votes[key] = [1, red, green, blue]
            else:
                bucket[0] += 1
                bucket[1] += red
                bucket[2] += green
                bucket[3] += blue

    ranked = sorted(votes.values(), key=lambda item: item[0], reverse=True)[:5]
    colors: list[tuple[str, float]] = []
    for count, red_sum, green_sum, blue_sum in ranked:
        colors.append(
            (
                to_hex(red_sum / count, green_sum / count, blue_sum / count),
                (count / samples) if samples else 0.0,
            )
        )

    edge_hits = 0
    edge_checks = 0
    edge_step = max(2, step)
    for y in range(1, height - 1, edge_step):
        for x in range(1, width - 1, edge_step):
            red, green, blue, alpha = raster.pixel(x, y)
            if alpha < 16:
                continue
            right = raster.pixel(x + 1, y)
            down = raster.pixel(x, y + 1)
            if right[3] < 16 or down[3] < 16:
                continue
            center = (red + green + blue) / 3
            right_luma = (right[0] + right[1] + right[2]) / 3
            down_luma = (down[0] + down[1] + down[2]) / 3
            edge_checks += 1
            if abs(center - right_luma) + abs(center - down_luma) > 48:
                edge_hits += 1
    edge_density = (edge_hits / edge_checks) if edge_checks else None

    grid: list[tuple[int, int, float | None, int]] = []
    for row in range(3):
        for col in range(3):
            x0 = (col * width) // 3
            x1 = ((col + 1) * width) // 3
            y0 = (row * height) // 3
            y1 = ((row + 1) * height) // 3
            cell_sum = 0.0
            cell_n = 0
            for y in range(y0, y1, step):
                for x in range(x0, x1, step):
                    luma = raster.luminance(x, y)
                    if luma is None:
                        continue
                    cell_sum += luma
                    cell_n += 1
            mean = (cell_sum / cell_n) if cell_n else None
            grid.append((row, col, mean, cell_n))

    mean_brightness = (brightness_sum / samples) if samples else None
    return PixelStats(
        samples=samples,
        transparent_checks=checks,
        mean_brightness=mean_brightness,
        dark_share=(dark / samples) if samples else 0.0,
        light_share=(light / samples) if samples else 0.0,
        edge_density=edge_density,
        colors=tuple(colors),
        grid=tuple(grid),
    )
