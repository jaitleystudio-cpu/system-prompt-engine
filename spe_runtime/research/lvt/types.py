"""
SPE Ω — Learning-Validity Transactions (LVT-0) Core Types.
Formal data models for 4-arm experiment protocols, independent verification,
NanoUSD escrow accounting, and qualification life-cycles.
"""

from __future__ import annotations

import math
import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple

from spe_runtime.research.wdes.types import NanoUSD, validate_nanos


class QualificationStatus(str, Enum):
    """Lifecycle qualification status of an AI learning claim."""
    PENDING = "PENDING"
    QUALIFIED = "QUALIFIED"
    REJECTED = "REJECTED"
    REVOKED = "REVOKED"
    RESEARCH_SUPPORTED = "RESEARCH_SUPPORTED"
    RESEARCH_UNQUALIFIED = "RESEARCH_UNQUALIFIED"
    INCONCLUSIVE = "INCONCLUSIVE"


class RequalificationTrigger(str, Enum):
    """Triggers mandating re-execution of the 4-arm verification protocol."""
    DISTRIBUTION_DRIFT = "DISTRIBUTION_DRIFT"
    COUNTEREXAMPLE_DISCOVERED = "COUNTEREXAMPLE_DISCOVERED"
    ENVIRONMENT_CHANGE = "ENVIRONMENT_CHANGE"
    MANUAL_AUDIT = "MANUAL_AUDIT"


class RevocationReason(str, Enum):
    """Explicit cause for revoking a previously admitted transaction."""
    COUNTEREXAMPLE_OBSERVED = "COUNTEREXAMPLE_OBSERVED"
    HELD_OUT_REGRESSION = "HELD_OUT_REGRESSION"
    SHUFFLED_FEEDBACK_FAILURE = "SHUFFLED_FEEDBACK_FAILURE"
    SELF_CERTIFICATION_DETECTED = "SELF_CERTIFICATION_DETECTED"
    DISTRIBUTION_DRIFT_EXCEEDED = "DISTRIBUTION_DRIFT_EXCEEDED"


class EvaluatorType(str, Enum):
    """Classification of verification oracle for independence auditing."""
    INDEPENDENT_STATIC_ORACLE = "INDEPENDENT_STATIC_ORACLE"
    DIFFERENT_MODEL_JUDGE = "DIFFERENT_MODEL_JUDGE"
    FORMAL_TEST_RUNNER = "FORMAL_TEST_RUNNER"
    GENERATING_MODEL_SELF = "GENERATING_MODEL_SELF"


class GeneratingModelSelfCertificationError(Exception):
    """Raised when the generating agent or model attempts to certify its own learning claim."""


class LearningValidityRuleViolation(Exception):
    """Raised when an LVT transaction fails the formal conjuncts of the admission rule."""


class TransactionRevokedError(Exception):
    """Raised when invoking a transaction that has been revoked."""


@dataclass(frozen=True)
class LearningClaim:
    """A normative claim that a prompt refinement improves capabilities or preserves invariants."""
    claim_id: str
    domain: str
    description: str
    generator_id: str
    base_prompt_ref: str
    candidate_prompt_ref: str
    expected_delta_score: float = 0.05
    budget_nanos: NanoUSD = 0

    def __post_init__(self) -> None:
        validate_nanos(self.budget_nanos, "budget_nanos")


@dataclass(frozen=True)
class ExperimentProtocol:
    """Configures the formal 4-arm randomized controlled experiment."""
    protocol_id: str
    sample_size: int = 100
    significance_threshold_epsilon: float = 0.05
    generalization_tolerance_delta: float = 0.02
    max_cost_nanos: NanoUSD = 10_000_000  # $0.01 USD
    allow_self_certification: bool = False

    def __post_init__(self) -> None:
        validate_nanos(self.max_cost_nanos, "max_cost_nanos")
        if self.allow_self_certification:
            raise ValueError("LVT Invariant: allow_self_certification can NEVER be True")
        if not isinstance(self.protocol_id, str) or not self.protocol_id.strip():
            raise ValueError("protocol_id must be a non-empty string")
        if type(self.sample_size) is bool or not isinstance(self.sample_size, int) or self.sample_size < 2:
            raise ValueError("sample_size must be an integer >= 2")
        if (
            type(self.significance_threshold_epsilon) is bool
            or not isinstance(self.significance_threshold_epsilon, (int, float))
            or not math.isfinite(self.significance_threshold_epsilon)
            or self.significance_threshold_epsilon <= 0.0
            or self.significance_threshold_epsilon > 1.0
        ):
            raise ValueError("significance_threshold_epsilon must be a finite float in (0.0, 1.0]")
        if (
            type(self.generalization_tolerance_delta) is bool
            or not isinstance(self.generalization_tolerance_delta, (int, float))
            or not math.isfinite(self.generalization_tolerance_delta)
            or self.generalization_tolerance_delta < 0.0
            or self.generalization_tolerance_delta > 1.0
        ):
            raise ValueError("generalization_tolerance_delta must be a finite float in [0.0, 1.0]")


@dataclass(frozen=True)
class FourArmResults:
    """Empirical outcomes across the four experimental arms."""
    arm_a_baseline_score: float       # Original prompt on train
    arm_b_authentic_score: float      # Refined prompt on authentic feedback
    arm_c_shuffled_control_score: float # Refined prompt on shuffled feedback
    arm_d_generalization_score: float # Refined prompt on held-out test
    delta_improvement: float          # arm_b - arm_a
    control_delta: float              # arm_b - arm_c
    held_out_retention: float         # arm_d - arm_d_baseline (paired held-out delta)
    is_statistically_significant: bool
    total_cost_nanos: NanoUSD = 0
    arm_d_baseline_score: float = 0.0 # Baseline prompt on held-out test
    p_value: float = 0.0              # Paired t-test p-value on training improvement
    confidence_interval_95: Tuple[float, float] = (0.0, 0.0) # 95% CI of delta improvement
    held_out_p_value: float = 0.0     # Paired p-value on held-out test

    def __post_init__(self) -> None:
        validate_nanos(self.total_cost_nanos, "total_cost_nanos")
        scores = [
            self.arm_a_baseline_score,
            self.arm_b_authentic_score,
            self.arm_c_shuffled_control_score,
            self.arm_d_generalization_score,
            self.arm_d_baseline_score,
        ]
        for s in scores:
            if type(s) is bool or not isinstance(s, (int, float)) or not math.isfinite(s) or s < 0.0 or s > 1.0:
                raise ValueError(f"Score {s} out of bounds (must be finite in [0.0, 1.0])")


@dataclass(frozen=True)
class OracleAttestation:
    """Cryptographically verifiable attestation from an independent oracle."""
    oracle_id: str
    oracle_public_key: str
    evidence_hash: str
    timestamp: float
    verdict: str  # e.g. "APPROVED"
    signature: str  # Ed25519 hex signature over canonical attestation dictionary


@dataclass
class LearningValidityTransaction:
    """Ledger transaction recording the formal qualification of a learning claim."""
    tx_id: str
    claim: LearningClaim
    protocol: ExperimentProtocol
    results: Optional[FourArmResults] = None
    evaluator_id: str = ""
    evaluator_type: EvaluatorType = EvaluatorType.INDEPENDENT_STATIC_ORACLE
    status: QualificationStatus = QualificationStatus.PENDING
    rejection_reason: Optional[str] = None
    revocation_reason: Optional[RevocationReason] = None
    artifact_hash: str = ""
    canonical_receipt_signature: str = ""
    created_timestamp: float = field(default_factory=time.time)
    committed_timestamp: Optional[float] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    protocol_version: str = "LVT-1"
    lvt2_study_result: Optional[Any] = None
    is_attested_oracle: bool = False
    oracle_attestation: Optional[OracleAttestation] = None
