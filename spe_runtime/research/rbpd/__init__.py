"""
SPE Ω — Reality-Bound Proof Dividend (RBPD) Research Subsystem.

Turns verified learning and proof receipts into selectively invalidatable,
Goodhart-resistant, reality-bound proof assets across iterative engineering lifecycles.
"""

from .contract import (
    AssetValidationVerdict,
    EpistemicStatus,
    InvalidationTrigger,
    ProofContractValidator,
    RealityBoundEvidenceAsset,
)
from .dividend_benchmark import (
    LifecycleBenchmarkReport,
    LifecycleCostLedger,
    NegativeControlReport,
    PortabilityVerifier,
    ProofDividendBenchmark,
    StrategyBenchmarkResult,
)
from .explain import explain_proof_dividend
from .invalidation import (
    InvalidationEvent,
    RequalificationPlan,
    SelectiveRequalificationEngine,
)
from .witness_selector import (
    CandidateEvaluationVerdict,
    DualChannelWitnessSelector,
    SealedIndependentSampler,
    SealedRealityWitness,
    WitnessSelection,
)

__all__ = [
    "AssetValidationVerdict",
    "CandidateEvaluationVerdict",
    "DualChannelWitnessSelector",
    "EpistemicStatus",
    "InvalidationEvent",
    "InvalidationTrigger",
    "LifecycleBenchmarkReport",
    "LifecycleCostLedger",
    "NegativeControlReport",
    "PortabilityVerifier",
    "ProofContractValidator",
    "ProofDividendBenchmark",
    "RealityBoundEvidenceAsset",
    "RequalificationPlan",
    "SealedIndependentSampler",
    "SealedRealityWitness",
    "SelectiveRequalificationEngine",
    "StrategyBenchmarkResult",
    "WitnessSelection",
    "explain_proof_dividend",
]
