"""K1 ConflictCore — deterministic conflict detection. No silent resolver."""

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


def conflict_id(conflict_type: ConflictType, left_id: str, right_id: str) -> str:
    a, b = sorted((left_id, right_id))
    payload = {"conflict_type": conflict_type.value, "left": a, "right": b}
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
    ordered = sorted((left, right), key=lambda atom: atom.requirement_id)
    first, second = ordered
    return ConflictRecord(
        conflict_id=conflict_id(conflict_type, first.requirement_id, second.requirement_id),
        left_requirement_id=first.requirement_id,
        right_requirement_id=second.requirement_id,
        conflict_type=conflict_type,
        severity=severity,
        resolution_state=ResolutionState.UNRESOLVED,
        summary=summary
        or f"{conflict_type.value}:{first.requirement_id}|{second.requirement_id}",
    )


def detect_conflicts(
    graph: RequirementGraph,
    *,
    extra: tuple[ConflictRecord, ...] = (),
) -> tuple[ConflictRecord, ...]:
    """Detect structured same-key conflicts. Does not pick a winner.

    Pair order is requirement_id order so summaries match across runtimes.
    """
    found: dict[str, ConflictRecord] = {record.conflict_id: record for record in extra}
    nodes = sorted(graph.nodes.values(), key=lambda atom: atom.requirement_id)

    for index, left in enumerate(nodes):
        for right in nodes[index + 1 :]:
            if left.requirement_id == right.requirement_id:
                continue
            if left.semantic_key != right.semantic_key:
                continue
            if (
                left.kind is RequirementKind.PREFERENCE
                and right.kind is RequirementKind.PREFERENCE
            ):
                continue

            kinds = {left.kind, right.kind}
            if kinds == {RequirementKind.MUST, RequirementKind.MUST_NOT}:
                if left.value == right.value:
                    record = make_conflict(
                        left=left,
                        right=right,
                        conflict_type=ConflictType.MUST_MUST_NOT,
                        severity=ConflictSeverity.HARD,
                    )
                    found[record.conflict_id] = record
                    continue

            if (
                left.kind is RequirementKind.MUST
                and right.kind is RequirementKind.MUST
                and left.value != right.value
            ):
                if (is_protected(left.provenance) and not is_protected(right.provenance)) or (
                    is_protected(right.provenance) and not is_protected(left.provenance)
                ):
                    conflict_type = ConflictType.INFERENCE_CONFLICT
                elif {left.provenance, right.provenance} == {
                    Provenance.USER_EXPLICIT,
                    Provenance.USER_CONFIRMED,
                }:
                    conflict_type = ConflictType.EXPLICIT_CONFIRMED
                else:
                    conflict_type = ConflictType.MUTUALLY_EXCLUSIVE
                record = make_conflict(
                    left=left,
                    right=right,
                    conflict_type=conflict_type,
                    severity=ConflictSeverity.HARD,
                )
                found[record.conflict_id] = record
                continue

            if left.value != right.value and (
                (is_protected(left.provenance) and not is_protected(right.provenance))
                or (is_protected(right.provenance) and not is_protected(left.provenance))
            ):
                record = make_conflict(
                    left=left,
                    right=right,
                    conflict_type=ConflictType.INFERENCE_CONFLICT,
                    severity=ConflictSeverity.HARD,
                )
                found[record.conflict_id] = record

    return tuple(sorted(found.values(), key=lambda record: record.conflict_id))


def apply_conflict_edges(
    graph: RequirementGraph,
    conflicts: tuple[ConflictRecord, ...],
) -> RequirementGraph:
    current = graph
    for record in conflicts:
        current = current.with_edge(
            record.left_requirement_id,
            record.right_requirement_id,
            EdgeType.CONFLICTS_WITH,
            meta={
                "conflict_id": record.conflict_id,
                "conflict_type": record.conflict_type.value,
            },
        )
    return current


def unresolved_hard_conflicts(
    conflicts: tuple[ConflictRecord, ...],
) -> tuple[ConflictRecord, ...]:
    return tuple(
        record
        for record in conflicts
        if record.severity is ConflictSeverity.HARD
        and record.resolution_state is ResolutionState.UNRESOLVED
    )


__all__ = [
    "ConflictType",
    "ConflictSeverity",
    "ResolutionState",
    "ConflictRecord",
    "conflict_id",
    "make_conflict",
    "detect_conflicts",
    "apply_conflict_edges",
    "unresolved_hard_conflicts",
]
