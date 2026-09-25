"""K1 requirements + conflict core."""

from spe_runtime.requirements.conflicts import (
    ConflictRecord,
    ConflictSeverity,
    ConflictType,
    ResolutionState,
    apply_conflict_edges,
    detect_conflicts,
    make_conflict,
    unresolved_hard_conflicts,
)
from spe_runtime.requirements.graph import EdgeType, RequirementEdge, RequirementGraph
from spe_runtime.requirements.models import (
    RequirementAtom,
    RequirementKind,
    coerce_kind,
    requirement_identity,
)

__all__ = [
    "RequirementKind",
    "RequirementAtom",
    "coerce_kind",
    "requirement_identity",
    "EdgeType",
    "RequirementEdge",
    "RequirementGraph",
    "ConflictType",
    "ConflictSeverity",
    "ResolutionState",
    "ConflictRecord",
    "make_conflict",
    "detect_conflicts",
    "apply_conflict_edges",
    "unresolved_hard_conflicts",
]
