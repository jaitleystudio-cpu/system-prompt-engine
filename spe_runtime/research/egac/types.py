"""
SPE Ω — Evidence-Gated Adaptive Compute (EGAC-1) Core Types
October 12, 2026 | Research Quarantine Track
"""

from __future__ import annotations
from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Optional, Any

# Exact Integer NanoUSD Conservation: 1 USD = 1,000,000,000 nanos
NANOS_PER_USD: int = 1_000_000_000

class InformationClass(str, Enum):
    """5 Information Classes governing semantic conservation."""
    PROTECTED_REQUIREMENTS = "PROTECTED_REQUIREMENTS"
    EXACT_BYTE_MATERIAL = "EXACT_BYTE_MATERIAL"
    EVIDENCE_BEARING_MATERIAL = "EVIDENCE_BEARING_MATERIAL"
    REPLACEABLE_CONTEXT = "REPLACEABLE_CONTEXT"
    VOLATILE_INFORMATION = "VOLATILE_INFORMATION"

class TechniqueType(str, Enum):
    """The 8 inference optimization techniques."""
    JSON_MINIFICATION = "JSON_MINIFICATION"
    OUTPUT_TOKEN_BUDGET_2048 = "OUTPUT_TOKEN_BUDGET_2048"
    WHITESPACE_NORMALIZATION = "WHITESPACE_NORMALIZATION"
    CONTEXT_WINDOW_TRIM = "CONTEXT_WINDOW_TRIM"
    DUPLICATE_MESSAGE_COLLAPSE = "DUPLICATE_MESSAGE_COLLAPSE"
    EXACT_MATCH_RESPONSE_CACHE = "EXACT_MATCH_RESPONSE_CACHE"
    CONCISE_OUTPUT_INSTRUCTION = "CONCISE_OUTPUT_INSTRUCTION"
    SIMPLE_QUERY_MODEL_ROUTING = "SIMPLE_QUERY_MODEL_ROUTING"

class TechniqueSetting(str, Enum):
    FORCE_OFF = "FORCE_OFF"
    FORCE_ON = "FORCE_ON"
    AUTO = "AUTO"
    DEFAULT = "DEFAULT"

class ExperienceLevel(str, Enum):
    """Three operational experience levels."""
    IMMEDIATE = "IMMEDIATE"
    EXPERT = "EXPERT"
    DISCOVERY = "DISCOVERY"

class ConservationStatus(str, Enum):
    CONSERVED = "CONSERVED"
    DEGRADED = "DEGRADED"
    VIOLATED = "VIOLATED"
    UNKNOWN = "UNKNOWN"

@dataclass
class InformationNode:
    """A semantic atomic node with strict classification."""
    node_id: str
    classification: InformationClass
    content: str
    byte_hash: str
    invariants: List[str] = field(default_factory=list)
    freshness_timestamp: Optional[float] = None
    invalidation_conditions: List[str] = field(default_factory=list)
    is_valid: bool = True
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class SemanticDiff:
    """Detailed structural difference across candidate optimization."""
    added_tokens: int = 0
    removed_tokens: int = 0
    preserved_invariants: List[str] = field(default_factory=list)
    violated_invariants: List[str] = field(default_factory=list)
    information_loss_score: float = 0.0
    is_conservative: bool = True
    explanation: str = ""

@dataclass
class OptimizationCandidate:
    """A proposed transformation under a specific technique."""
    candidate_id: str
    technique: TechniqueType
    source_content: str
    transformed_content: str
    affected_nodes: List[str]
    diff: SemanticDiff
    status: ConservationStatus
    rejection_reason: Optional[str] = None

@dataclass
class ComputationalAction:
    """A candidate computational action for VOI calculation."""
    action_id: str
    name: str
    expected_delta_q: float  # Expected verified quality gain in [0.0, 1.0]
    expected_cost_nanos: int  # Expected cost in integer NanoUSD
    expected_latency_ms: int  # Additional latency in milliseconds
    action_type: str = "INFERENCE"

@dataclass
class ExecutionStrategy:
    """Calibrated execution strategy synthesized by planner."""
    strategy_id: str
    experience_level: ExperienceLevel
    model_name: str
    reasoning_budget: int
    techniques_enabled: Dict[TechniqueType, TechniqueSetting]
    cache_policy: str
    context_strategy: str
    verification_depth: str
    estimated_cost_nanos: int
    estimated_latency_ms: int
    predicted_success_prob: float
    is_feasible: bool = True
    infeasibility_reason: Optional[str] = None

@dataclass
class CounterfactualScenario:
    """CSC adversarial scenario challenging candidate optimizations."""
    scenario_id: str
    name: str
    adversarial_test: str
    test_type: str
    expected_passed: bool
    passed: bool = False
    details: str = ""

@dataclass
class VsodMetrics:
    """Verified Successful Outcomes per Dollar research metric."""
    n_verified_successes: int
    total_cost_nanos: int
    total_cost_usd: float
    vsod_score: float
    tokens_saved: int
    latency_p95_ms: int
    critical_failures: int

@dataclass
class EGACE01Task:
    """A single workload task in EGAC-E01 JSON Minification experiment."""
    task_id: str
    task_type: str
    raw_input: str
    is_canary: bool = False
    expected_valid: bool = True

@dataclass
class EGACE01Result:
    """Controlled experiment result for EGAC-E01."""
    experiment_name: str
    n_trials: int
    control_tokens: int
    treatment_tokens: int
    token_reduction_pct: float
    control_cost_nanos: int
    treatment_cost_nanos: int
    net_savings_nanos: int
    control_latency_ms: float
    treatment_latency_ms: float
    json_parse_equality_rate: float
    canary_failures: int
    passed_promotion_gate: bool
    p_value: float
    category_stats: Dict[str, Dict[str, Any]] = field(default_factory=dict)

