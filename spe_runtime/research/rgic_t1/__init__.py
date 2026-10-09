"""
RGIC-T1 — Tri-Origin Counterfactual Intelligence Harness
Part of SPE Ω Research Quarantine.
"""

from spe_runtime.research.rgic_t1.types import (
    OriginClass,
    FailureOrigin,
    Hypothesis,
    DiagnosticProbe,
    PrecommitmentLock,
    DistinguishabilityRecord,
    EpistemicNode,
    EpistemicNodeState,
)
from spe_runtime.research.rgic_t1.tri_origin_harness import (
    TriOriginDiagnoser,
    EpistemicDependencyGraph,
    EpistemicDependencyTracker,
)

__all__ = [
    "OriginClass",
    "FailureOrigin",
    "Hypothesis",
    "DiagnosticProbe",
    "PrecommitmentLock",
    "DistinguishabilityRecord",
    "EpistemicNode",
    "EpistemicNodeState",
    "TriOriginDiagnoser",
    "EpistemicDependencyGraph",
    "EpistemicDependencyTracker",
]
