"""
RGIC-T1 — Tri-Origin Counterfactual Intelligence Harness
Part of SPE Ω Research Quarantine.
"""

from spe_runtime.research.rgic_t1.types import (
    OriginClass,
    Hypothesis,
    DiagnosticProbe,
    PrecommitmentLock,
    DistinguishabilityRecord,
    EpistemicNode,
)
from spe_runtime.research.rgic_t1.tri_origin_harness import (
    TriOriginDiagnoser,
    EpistemicDependencyGraph,
)

__all__ = [
    "OriginClass",
    "Hypothesis",
    "DiagnosticProbe",
    "PrecommitmentLock",
    "DistinguishabilityRecord",
    "EpistemicNode",
    "TriOriginDiagnoser",
    "EpistemicDependencyGraph",
]
