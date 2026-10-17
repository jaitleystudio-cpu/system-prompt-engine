"""Data models for Diagnosability Type System, Semantic Channel, and DFT."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple


@dataclass(frozen=True)
class FaultClass:
    """A distinct failure mode with associated prior probability and risk severity."""
    fault_id: str
    name: str
    description: str
    prior_probability: float
    severity_weight: float = 1.0  # Consequence multiplier for Risk-Weighted Semantic Distance


@dataclass(frozen=True)
class SensorSpec:
    """An observable diagnostic witness or validator with error channel parameters."""
    sensor_id: str
    name: str
    sensitivity: float  # True Positive Rate: P(S=1 | F=1)
    specificity: float  # True Negative Rate: P(S=0 | F=0)
    execution_cost_usd: float = 0.001
    latency_ms: float = 10.0


@dataclass
class SemanticChannelMatrix:
    """Probabilistic channel model P(S | F, M, W) mapping fault classes to observation likelihoods."""
    model_id: str
    workload_type: str
    sensors: List[SensorSpec]
    faults: List[FaultClass]
    # table: fault_id -> {sensor_id: P(S=1 | F)}
    likelihood_table: Dict[str, Dict[str, float]] = field(default_factory=dict)


@dataclass
class DiagnosabilityEnvelope:
    """Compile-time boundary of system observability and uncovered fault risks."""
    diagnosable_faults: List[str]
    ambiguous_pairs: List[Tuple[str, str]]
    undiagnosable_faults: List[str]
    observability_debt: float
    minimum_semantic_distance: float


@dataclass
class DiagnosticResult:
    """Outcome of Bayesian active syndrome decoding."""
    decoded_fault: Optional[str]
    confidence: float
    is_unknown_family: bool
    posterior_probabilities: Dict[str, float]
    multi_fault_set: Optional[List[str]] = None
    executed_probes: List[str] = field(default_factory=list)
    total_diagnostic_cost_usd: float = 0.0
