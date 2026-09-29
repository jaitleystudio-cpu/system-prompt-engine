"""RGBA rasters. Encoded-file decode stays outside this layer (no image codec dependency)."""

from __future__ import annotations

import hashlib
import math

from spe_runtime.visual.constants import MAX_ANALYSIS_PIXELS, MAX_ANALYSIS_SIDE
from spe_runtime.visual.errors import VisualInputError


def _as_byte(value: int, label: str) -> int:
    number = int(value)
    if number < 0 or number > 255:
        raise VisualInputError(f"{label} channel out of range: {number}")
    return number


class Raster:
    """Immutable RGBA8 buffer sized exactly width*height*4."""

    __slots__ = ("width", "height", "rgba", "_digest")

    def __init__(self, width: int, height: int, rgba: bytes) -> None:
        if isinstance(width, bool) or isinstance(height, bool):
            raise VisualInputError("raster dimensions must be integers")
        if not isinstance(width, int) or not isinstance(height, int):
            raise VisualInputError("raster dimensions must be integers")
        if width < 1 or height < 1:
            raise VisualInputError("raster dimensions must be positive")
        if width > MAX_ANALYSIS_SIDE or height > MAX_ANALYSIS_SIDE:
            raise VisualInputError("ANALYSIS_SIDE_EXCEEDED")
        if width * height > MAX_ANALYSIS_PIXELS:
            raise VisualInputError("ANALYSIS_PIXELS_EXCEEDED")
        if not isinstance(rgba, (bytes, bytearray)):
            raise VisualInputError("raster rgba must be bytes")
        expected = width * height * 4
        if len(rgba) != expected:
            raise VisualInputError(
                f"raster byte length {len(rgba)} != {expected} for {width}x{height}"
            )
        self.width = width
        self.height = height
        self.rgba = bytes(rgba)
        self._digest = "sha256:" + hashlib.sha256(self.rgba).hexdigest()

    @property
    def digest(self) -> str:
        return self._digest

    def pixel(self, x: int, y: int) -> tuple[int, int, int, int]:
        index = (y * self.width + x) * 4
        channel = self.rgba
        return (
            channel[index],
            channel[index + 1],
            channel[index + 2],
            channel[index + 3],
        )

    def luminance(self, x: int, y: int) -> float | None:
        red, green, blue, alpha = self.pixel(x, y)
        if alpha < 16:
            return None
        return (red * 299 + green * 587 + blue * 114) / 1000

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, Raster):
            return NotImplemented
        return (
            self.width == other.width
            and self.height == other.height
            and self.rgba == other.rgba
        )

    def __hash__(self) -> int:
        return hash((self.width, self.height, self._digest))


def solid_raster(
    width: int,
    height: int,
    red: int,
    green: int,
    blue: int,
    alpha: int = 255,
) -> Raster:
    """Deterministic flat field. Used by local callers and tests."""

    pixel = bytes(
        (
            _as_byte(red, "red"),
            _as_byte(green, "green"),
            _as_byte(blue, "blue"),
            _as_byte(alpha, "alpha"),
        )
    )
    return Raster(width, height, pixel * (width * height))


def raster_with_rects(
    width: int,
    height: int,
    background: tuple[int, int, int, int],
    rects: tuple[tuple[int, int, int, int, tuple[int, int, int, int]], ...],
) -> Raster:
    """Paint axis-aligned rectangles over a flat background. No resampling."""

    if len(background) != 4:
        raise VisualInputError("background must be RGBA")
    base = bytes(tuple(_as_byte(channel, "background") for channel in background))
    buffer = bytearray(base * (width * height))
    for origin_x, origin_y, rect_w, rect_h, color in rects:
        if rect_w < 0 or rect_h < 0:
            raise VisualInputError("rectangle size must be non-negative")
        paint = bytes(tuple(_as_byte(channel, "rect") for channel in color))
        x1 = min(width, max(0, origin_x + rect_w))
        y1 = min(height, max(0, origin_y + rect_h))
        x0 = min(width, max(0, origin_x))
        y0 = min(height, max(0, origin_y))
        for y in range(y0, y1):
            row = y * width * 4
            for x in range(x0, x1):
                index = row + x * 4
                buffer[index : index + 4] = paint
    return Raster(width, height, bytes(buffer))


def aspect_ratio_label(width: int, height: int) -> str:
    divisor = math.gcd(width, height) or 1
    return f"{width // divisor}:{height // divisor}"
