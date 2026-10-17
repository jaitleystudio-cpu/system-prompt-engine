"""Diagnosability Type System & Semantic Channel Package."""

from spe_runtime.diagnosability.active_scheduler import ActiveSyndromeScheduler
from spe_runtime.diagnosability.channel_matrix import (
    build_calibrated_channel_matrix,
    calculate_diagnosability_envelope,
    compute_risk_weighted_semantic_distance,
)
from spe_runtime.diagnosability.decoder import BayesianSyndromeDecoder
from spe_runtime.diagnosability.dft_co_design import (
    DFTCoDesignEngine,
    ExecutionPlanCandidate,
)
from spe_runtime.diagnosability.models import (
    DiagnosabilityEnvelope,
    DiagnosticResult,
    FaultClass,
    SemanticChannelMatrix,
    SensorSpec,
)

__all__ = [
    "FaultClass",
    "SensorSpec",
    "SemanticChannelMatrix",
    "DiagnosabilityEnvelope",
    "DiagnosticResult",
    "build_calibrated_channel_matrix",
    "compute_risk_weighted_semantic_distance",
    "calculate_diagnosability_envelope",
    "BayesianSyndromeDecoder",
    "ActiveSyndromeScheduler",
    "DFTCoDesignEngine",
    "ExecutionPlanCandidate",
]
