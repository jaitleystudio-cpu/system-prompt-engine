"""Bounds for a single WebRecon observation. Exceeding a bound is a gap, not a guess."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class ObservationLimits:
    """Hard caps for one capture. Defaults stay inside a local unit-test budget."""

    max_nodes: int = 2000
    max_depth: int = 32
    max_text_chars: int = 120
    max_attr_chars: int = 200
    max_css_chars: int = 200_000
    max_html_chars: int = 1_000_000
    max_assets: int = 500
    max_interactions: int = 500
    max_meta: int = 80

    def __post_init__(self) -> None:
        for name in (
            "max_nodes",
            "max_depth",
            "max_text_chars",
            "max_attr_chars",
            "max_css_chars",
            "max_html_chars",
            "max_assets",
            "max_interactions",
            "max_meta",
        ):
            value = int(getattr(self, name))
            if value < 1:
                raise ValueError(f"{name} must be >= 1")
            object.__setattr__(self, name, value)

    def to_dict(self) -> dict[str, int]:
        return {
            "max_nodes": self.max_nodes,
            "max_depth": self.max_depth,
            "max_text_chars": self.max_text_chars,
            "max_attr_chars": self.max_attr_chars,
            "max_css_chars": self.max_css_chars,
            "max_html_chars": self.max_html_chars,
            "max_assets": self.max_assets,
            "max_interactions": self.max_interactions,
            "max_meta": self.max_meta,
        }


def limits_from_dict(value: dict[str, Any] | None) -> ObservationLimits:
    if value is None:
        return ObservationLimits()
    return ObservationLimits(**{str(k): int(v) for k, v in value.items()})
