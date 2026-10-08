"""SPE Ω Quantum Cost Supercompiler (QCS) Package."""

from spe_runtime.cost_engine.cost_optimizer import QuantumCostOptimizer
from spe_runtime.cost_engine.deterministic_offloader import DeterministicOffloader
from spe_runtime.cost_engine.kv_aligner import PagedAttentionKVAligner
from spe_runtime.cost_engine.models import (
    CostTier,
    DeterministicOffloadResult,
    KVPrefixLayout,
    SpeculativeCascadeResult,
    TotalSavingsReport,
)
from spe_runtime.cost_engine.speculative_cascade import EpistemicSpeculativeCascade
from spe_runtime.cost_engine.telemetry import (
    CostSource,
    PINNED_LOCAL_PRICE_TABLE,
    TelemetryEvidence,
    compute_pinned_cost,
)

__all__ = [
    "QuantumCostOptimizer",
    "PagedAttentionKVAligner",
    "DeterministicOffloader",
    "EpistemicSpeculativeCascade",
    "CostTier",
    "KVPrefixLayout",
    "DeterministicOffloadResult",
    "SpeculativeCascadeResult",
    "TotalSavingsReport",
    "TelemetryEvidence",
    "CostSource",
    "PINNED_LOCAL_PRICE_TABLE",
    "compute_pinned_cost",
]

