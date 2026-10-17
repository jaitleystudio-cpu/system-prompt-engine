"""Scroll, motion, and camera description.

CSS perspective is motion, not a camera. A camera is recorded only when the
capture declares one. Nothing here is executed.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class ScrollObservation:
    property: str
    value: str
    source: str

    def to_dict(self) -> dict[str, str]:
        return {"property": self.property, "value": self.value, "source": self.source}


@dataclass(frozen=True)
class AnimationObservation:
    name: str
    duration: str | None
    source: str

    def to_dict(self) -> dict[str, Any]:
        return {"name": self.name, "duration": self.duration, "source": self.source}


@dataclass(frozen=True)
class TransitionObservation:
    property_name: str | None
    duration: str | None
    source: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "property_name": self.property_name,
            "duration": self.duration,
            "source": self.source,
        }


@dataclass(frozen=True)
class CameraObservation:
    status: str
    kind: str | None
    position: tuple[str, ...]
    target: tuple[str, ...]
    fov: str | None
    near: str | None
    far: str | None
    notes: str | None

    def __post_init__(self) -> None:
        if self.status not in {"UNOBSERVED", "DECLARED"}:
            raise ValueError("camera status must be UNOBSERVED or DECLARED")

    def to_dict(self) -> dict[str, Any]:
        return {
            "status": self.status,
            "kind": self.kind,
            "position": list(self.position),
            "target": list(self.target),
            "fov": self.fov,
            "near": self.near,
            "far": self.far,
            "notes": self.notes,
        }


@dataclass(frozen=True)
class MotionDescription:
    scroll: tuple[ScrollObservation, ...]
    animations: tuple[AnimationObservation, ...]
    transitions: tuple[TransitionObservation, ...]
    camera: CameraObservation

    def to_dict(self) -> dict[str, Any]:
        return {
            "scroll": [item.to_dict() for item in self.scroll],
            "animations": [item.to_dict() for item in self.animations],
            "transitions": [item.to_dict() for item in self.transitions],
            "camera": self.camera.to_dict(),
        }


def unobserved_camera() -> CameraObservation:
    return CameraObservation(
        status="UNOBSERVED",
        kind=None,
        position=(),
        target=(),
        fov=None,
        near=None,
        far=None,
        notes=None,
    )
