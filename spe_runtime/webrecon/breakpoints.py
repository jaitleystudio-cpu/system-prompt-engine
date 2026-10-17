"""Breakpoint model. Queries stay as observed CSS. No device class is assigned."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class Breakpoint:
    query: str
    min_width_px: int | None
    max_width_px: int | None
    features: tuple[str, ...]
    source: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "query": self.query,
            "min_width_px": self.min_width_px,
            "max_width_px": self.max_width_px,
            "features": list(self.features),
            "source": self.source,
        }
