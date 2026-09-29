"""Geometric relationships between contrast regions. Semantic roles stay out."""

from __future__ import annotations

from spe_runtime.visual.constants import MAX_RELATIONSHIPS
from spe_runtime.visual.models import (
    ClaimVerdict,
    EpistemicStatus,
    NormBounds,
    VisualObject,
    VisualRelationship,
)


def _center(bounds: NormBounds) -> tuple[float, float]:
    return bounds.x + bounds.w / 2, bounds.y + bounds.h / 2


def _contains(outer: NormBounds, inner: NormBounds) -> bool:
    covers = (
        outer.x <= inner.x + 0.01
        and outer.y <= inner.y + 0.01
        and outer.x + outer.w >= inner.x + inner.w - 0.01
        and outer.y + outer.h >= inner.y + inner.h - 0.01
    )
    larger = outer.w * outer.h > inner.w * inner.h * 1.05
    return covers and larger


def _overlaps(left: NormBounds, right: NormBounds) -> bool:
    separated = (
        left.x + left.w < right.x
        or right.x + right.w < left.x
        or left.y + left.h < right.y
        or right.y + right.h < left.y
    )
    return not separated


def read_relationships(
    objects: tuple[VisualObject, ...],
    asset_id: str,
) -> tuple[VisualRelationship, ...]:
    found: list[VisualRelationship] = []
    limited = objects[:12]
    for index, subject in enumerate(limited):
        for other in limited[index + 1 :]:
            if len(found) >= MAX_RELATIONSHIPS:
                return tuple(found)
            sx, sy = _center(subject.bounds)
            ox, oy = _center(other.bounds)
            dx = ox - sx
            dy = oy - sy
            if _contains(subject.bounds, other.bounds):
                predicate = "contains"
                verdict = ClaimVerdict.PASS
                status = EpistemicStatus.OBSERVATION
                source = subject.object_id
                target = other.object_id
            elif _contains(other.bounds, subject.bounds):
                predicate = "contains"
                verdict = ClaimVerdict.PASS
                status = EpistemicStatus.OBSERVATION
                source = other.object_id
                target = subject.object_id
            elif abs(dx) <= 0.05 and abs(dy) <= 0.05:
                predicate = "near"
                verdict = ClaimVerdict.UNKNOWN
                status = EpistemicStatus.MODEL_JUDGMENT
                source = subject.object_id
                target = other.object_id
            elif _overlaps(subject.bounds, other.bounds) and abs(dx) <= 0.05 and abs(dy) <= 0.05:
                predicate = "overlaps"
                verdict = ClaimVerdict.PASS
                status = EpistemicStatus.OBSERVATION
                source = subject.object_id
                target = other.object_id
            elif abs(dx) >= abs(dy) and abs(dx) > 0.05:
                predicate = "right-of" if dx > 0 else "left-of"
                verdict = ClaimVerdict.PASS
                status = EpistemicStatus.OBSERVATION
                source = other.object_id
                target = subject.object_id
            elif abs(dy) > 0.05:
                predicate = "below" if dy > 0 else "above"
                verdict = ClaimVerdict.PASS
                status = EpistemicStatus.OBSERVATION
                source = other.object_id
                target = subject.object_id
            else:
                predicate = "overlaps" if _overlaps(subject.bounds, other.bounds) else "near"
                verdict = ClaimVerdict.PASS if predicate == "overlaps" else ClaimVerdict.UNKNOWN
                status = (
                    EpistemicStatus.OBSERVATION
                    if verdict is ClaimVerdict.PASS
                    else EpistemicStatus.MODEL_JUDGMENT
                )
                source = subject.object_id
                target = other.object_id
            found.append(
                VisualRelationship(
                    relationship_id=f"{asset_id}:rel:{len(found)}",
                    subject_id=source,
                    object_id=target,
                    predicate=predicate,
                    verdict=verdict,
                    epistemic_status=status,
                    method="bounds-geometry",
                )
            )
    return tuple(found)
