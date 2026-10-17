"""Three.js and WebGL observation. Canvas and library names are noted. Nothing is run."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class WebGlObservation:
    status: str
    canvas_count: int
    library_hints: tuple[str, ...]
    renderer: str | None
    camera_count: int | None
    light_count: int | None
    object_count: int | None
    executed: bool
    notes: str | None

    def __post_init__(self) -> None:
        if self.status not in {"ABSENT", "DECLARED_UNEXECUTED", "STRUCTURED_OBSERVATION"}:
            raise ValueError("webgl status is not a v1 value")
        count = int(self.canvas_count)
        if count < 0:
            raise ValueError("canvas_count must be >= 0")
        object.__setattr__(self, "canvas_count", count)
        object.__setattr__(self, "executed", False)
        object.__setattr__(self, "library_hints", tuple(self.library_hints))

    def to_dict(self) -> dict[str, Any]:
        return {
            "status": self.status,
            "canvas_count": self.canvas_count,
            "library_hints": list(self.library_hints),
            "renderer": self.renderer,
            "camera_count": self.camera_count,
            "light_count": self.light_count,
            "object_count": self.object_count,
            "executed": False,
            "notes": self.notes,
        }
