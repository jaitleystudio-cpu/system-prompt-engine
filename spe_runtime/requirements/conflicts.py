"""K1 ConflictCore — deterministic conflict detection and records."""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from enum import Enum
from typing import Any

from spe_runtime.portability.canonical import canonical_dumps
from spe_runtime.provenance.models import Provenance
from spe_runtime.provenance.rules import is_protected
from spe_runtime.requirements.graph import EdgeType, RequirementGraph
from spe_runtime.requirements.models import RequirementAtom, RequirementKind


class ConflictType(str, Enum):
    MUST_MUST_NOT = "MUST_MUST_NOT"
    MUTUALLY_EXCLUSIVE = "MUTUALLY_EXCLUSIVE"
    EXPLICIT_CONFIRMED = "EXPLICIT_CONFIRMED"
    INFERENCE_CONFLICT = "INFERENCE_CONFLICT"


class ConflictSeverity(str, Enum):
    HARD = "HARD"
    SOFT = "SOFT"


class ResolutionState(str, Enum):
    UNRESOLVED = "UNRESOLVED"


@dataclass(frozen=True)
class ConflictRecord:
    conflict_id: str
    left_requirement_id: str
    right_requirement_id: str
    conflict_type: ConflictType
    severity: ConflictSeverity
    resolution_state: ResolutionState = ResolutionState.UNRESOLVED
    summary: str = ""

    def __post_init__(self) -> None:
        if not isinstance(self.conflict_type, ConflictType):
            object.__setattr__(self, "conflict_type", ConflictType(self.conflict_type))
        if not isinstance(self.severity, ConflictSeverity):
            object.__setattr__(self, "severity", ConflictSeverity(self.severity))
        if not isinstance(self.resolution_state, ResolutionState):
            object.__setattr__(
                self, "resolution_state", ResolutionState(self.resolution_state)
            )

    def to_dict(self) -> dict[str, Any]:
        return {
            "conflict_id": self.conflict_id,
            "left_requirement_id": self.left_requirement_id,
            "right_requirement_id": self.right_requirement_id,
            "conflict_type": self.conflict_type.value,
            "severity": self.severity.value,
            "resolution_state": self.resolution_state.value,
            "summary": self.summary,
        }


def _conflict_id(
    conflict_type: ConflictType,
    left_id: str,
    right_id: str,
) -> str:
    a, b = sorted((left_id, right_id))
    payload = {
        "conflict_type": conflict_type.value,
        "left": a,
        "right": b,
    }
    digest = hashlib.sha256(canonical_dumps(payload).encode("utf-8")).hexdigest()
    return f"cnf-{digest[:32]}"


def make_conflict(
    *,
    left: RequirementAtom,
    right: RequirementAtom,
    conflict_type: ConflictType,
    severity: ConflictSeverity = ConflictSeverity.HARD,
    summary: str = "",
) -> ConflictRecord:
    return ConflictRecord(
        conflict_id=_conflict_id(conflict_type, left.requirement_id, right.requirement_id),
        left_requirement_id=left.requirement_id,
        right_requirement_id=right.requirement_id,
        conflict_type=conflict_type,
        severity=severity,
        resolution_state=ResolutionState.UNRESOLVED,
        summary=summary
        or f"{conflict_type.value}:{left.requirement_id}|{right.requirement_id}",
    )


def _pair_key(a: str, b: str) -> tuple[str, str]:
    return tuple(sorted((a, b)))  # type: ignore[return-value]


def detect_conflicts(
    graph: RequirementGraph,
    *,
    extra: tuple[ConflictRecord, ...] = (),
) -> tuple[ConflictRecord, ...]:
    """Detect structured conflicts. No silent resolver.

    Rules:
    - same-key MUST vs MUST_NOT (same value) → MUST_MUST_NOT (HARD)
    - same-key two different MUST values → MUTUALLY_EXCLUSIVE (HARD)
    - USER_EXPLICIT vs USER_CONFIRMED conflicting values → EXPLICIT_CONFIRMED (HARD)
    - protected vs lower-authority different value → INFERENCE_CONFLICT (HARD)
    - equivalent duplicates (same requirement_id) are not conflicts
    - two PREFERENCE values are not a hard conflict
    """
    found: dict[str, ConflictRecord] = {c.conflict_id: c for c in extra}
    nodes = list(graph.nodes.values())

    for i, left in enumerate(nodes):
        for right in nodes[i + 1 :]:
            if left.requirement_id == right.requirement_id:
                continue
            if left.semantic_key != right.semantic_key:
                continue

            # PREFERENCE pairs are never hard conflicts in G1R-3
            if (
                left.kind is RequirementKind.PREFERENCE
                and right.kind is RequirementKind.PREFERENCE
            ):
                continue

            # MUST vs MUST_NOT same value
            kinds = {left.kind, right.kind}
            if kinds == {RequirementKind.MUST, RequirementKind.MUST_NOT}:
                if left.value == right.value:
                    rec = make_conflict(
                        left=left,
                        right=right,
                        conflict_type=ConflictType.MUST_MUST_NOT,
                        severity=ConflictSeverity.HARD,
                    )
                    found[rec.conflict_id] = rec
                    continue

            # Single-valued MUST clash (two different MUST values)
            if (
                left.kind is RequirementKind.MUST
                and right.kind is RequirementKind.MUST
                and left.value != right.value
            ):
                # Protected vs lower → INFERENCE_CONFLICT preferred
                if (is_protected(left.provenance) and not is_protected(right.provenance)) or (
                    is_protected(right.provenance) and not is_protected(left.provenance)
                ):
                    rec = make_conflict(
                        left=left,
                        right=right,
                        conflict_type=ConflictType.INFERENCE_CONFLICT,
                        severity=ConflictSeverity.HARD,
                    )
                elif (
                    {left.provenance, right.provenance}
                    >= {Provenance.USER_EXPLICIT, Provenance.USER_CONFIRMED}
                    or (
                        left.provenance is Provenance.USER_EXPLICIT
                        and right.provenance is Provenance.USER_CONFIRMED
                    )
                    or (
                        left.provenance is Provenance.USER_CONFIRMED
                        and right.provenance is Provenance.USER_EXPLICIT
                    )
                ):
                    rec = make_conflict(
                        left=left,
                        right=right,
                        conflict_type=ConflictType.EXPLICIT_CONFIRMED,
                        severity=ConflictSeverity.HARD,
                    )
                else:
                    rec = make_conflict(
                        left=left,
                        right=right,
                        conflict_type=ConflictType.MUTUALLY_EXCLUSIVE,
                        severity=ConflictSeverity.HARD,
                    )
                found[rec.conflict_id] = rec
                continue

            # Protected vs lower different values (any hard-ish kinds)
            if left.value != right.value:
                if (is_protected(left.provenance) and not is_protected(right.provenance)) or (
                    is_protected(right.provenance) and not is_protected(left.provenance)
                ):
                    # MUST_NOT vs MUST already handled; PREFERENCE vs protected still soft skip
                    if RequirementKind.PREFERENCE in (left.kind, right.kind) and (
                        left.kind is RequirementKind.PREFERENCE
                        or right.kind is RequirementKind.PREFERENCE
                    ):
                        # preference vs protected different key-value: still inference conflict
                        # only when both are binding-ish; prefer recording INFERENCE_CONFLICT
                        pass
                    rec = make_conflict(
                        left=left,
                        right=right,
                        conflict_type=ConflictType.INFERENCE_CONFLICT,
                        severity=ConflictSeverity.HARD,
                    )
                    found[rec.conflict_id] = rec

    return tuple(sorted(found.values(), key=lambda c: c.conflict_id))


def apply_conflict_edges(
    graph: RequirementGraph,
    conflicts: tuple[ConflictRecord, ...],
) -> RequirementGraph:
    """Record CONFLICTS_WITH edges for each conflict (canonical graph writer)."""
    g = graph
    for c in conflicts:
        g = g.with_edge(
            c.left_requirement_id,
            c.right_requirement_id,
            EdgeType.CONFLICTS_WITH,
            meta={"conflict_id": c.conflict_id, "conflict_type": c.conflict_type.value},
        )
    return g


def unresolved_hard_conflicts(
    conflicts: tuple[ConflictRecord, ...],
) -> tuple[ConflictRecord, ...]:
    return tuple(
        c
        for c in conflicts
        if c.severity is ConflictSeverity.HARD
        and c.resolution_state is ResolutionState.UNRESOLVED
    )


__all__ = [
    "ConflictType",
    "ConflictSeverity",
    "ResolutionState",
    "ConflictRecord",
    "make_conflict",
    "detect_conflicts",
    "apply_conflict_edges",
    "unresolved_hard_conflicts",
]
