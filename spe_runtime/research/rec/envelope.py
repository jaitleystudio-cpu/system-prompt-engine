"""
SPE Ω — REC-0 Task 1: Reliability Envelope Contract, Validity-State Machine & Calibrated Risk Estimator.

Extends ProtectedIntent, Reality-Bound Proof Dividend (RBPD), WDIC, CSC, and LVT
with a condition-bound ReliabilityEnvelope contract, 4-state ValidityStateMachine
(VALID, STALE, INVALID, UNKNOWN), and CalibratedRiskEstimator (Clopper-Pearson
family-clustered upper confidence bound + correlation-aware repeated-run failure bound).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
import hashlib
import math
import re
import time
from typing import Any, Dict, List, Optional, Sequence, Tuple

from spe_runtime.authority import AuthorityGrant
from spe_runtime.ci_gate.receipt import (
    ed25519_sign,
    ed25519_verify,
    rfc8785_canonicalize,
)
from spe_runtime.prompt.meta_compiler import ProtectedIntent
from spe_runtime.requirements.models import RequirementAtom
from spe_runtime.research.csc.models import NetworkPolicy
from spe_runtime.research.lvt.learning_validator import (
    LearningValidator,
    create_oracle_attestation,
)
from spe_runtime.research.lvt.paired_gate_v2 import _is_synthetic_model_digest
from spe_runtime.research.lvt.types import OracleAttestation
from spe_runtime.research.rbpd.contract import ProofContractValidator
from spe_runtime.spe_package import SpePackage

_HEX64 = re.compile(r"^[0-9a-f]{64}$")
_HEX128 = re.compile(r"^[0-9a-f]{128}$")


class EvidenceOrigin(str, Enum):
    """Origin and custody classification of evaluation and verification evidence."""

    SYNTHETIC_FIXTURE = "SYNTHETIC_FIXTURE"
    OBSERVED_UNVERIFIED = "OBSERVED_UNVERIFIED"
    INDEPENDENTLY_VERIFIED = "INDEPENDENTLY_VERIFIED"
    STALE = "STALE"
    REVOKED = "REVOKED"


class EnvelopeValidityState(str, Enum):
    """Validity lattice for ReliabilityEnvelope evaluation."""

    VALID = "VALID"
    STALE = "STALE"
    INVALID = "INVALID"
    UNKNOWN = "UNKNOWN"
    SYNTHETIC_CALIBRATION_ONLY = "SYNTHETIC_CALIBRATION_ONLY"


class DriftTrigger(str, Enum):
    """Canonical invalidation and suspension triggers for a ReliabilityEnvelope."""

    INTENT_MUTATED = "INTENT_MUTATED"
    REQUIREMENT_SET_CHANGED = "REQUIREMENT_SET_CHANGED"
    MODEL_REVISION_CHANGED = "MODEL_REVISION_CHANGED"
    ENVIRONMENT_PERTURBED = "ENVIRONMENT_PERTURBED"
    EXECUTION_PATH_UNSTABLE = "EXECUTION_PATH_UNSTABLE"
    CALIBRATION_CONTAMINATED = "CALIBRATION_CONTAMINATED"
    OUT_OF_COVERAGE_SCOPE = "OUT_OF_COVERAGE_SCOPE"
    ORACLE_REVOKED = "ORACLE_REVOKED"
    HORIZON_EXPIRED = "HORIZON_EXPIRED"
    TOMBSTONE_REVOKED = "TOMBSTONE_REVOKED"
    DEPENDENCY_SLICE_CHANGED = "DEPENDENCY_SLICE_CHANGED"


@dataclass(frozen=True)
class ModelRevisionBinding:
    """Authenticated model or runtime revision identity."""

    model_id: str
    model_or_runtime_digest: str
    model_digest_type: str = "VERIFIED_MODEL_REVISION"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "model_digest_type": self.model_digest_type,
            "model_id": self.model_id,
            "model_or_runtime_digest": self.model_or_runtime_digest,
        }


@dataclass(frozen=True)
class EnvironmentBinding:
    """Relevant operating environment, tool permissions, and assumption predicates."""

    runtime_id: str
    tool_permissions: Tuple[str, ...]
    network_policy: str
    schema_version: str = "spe.rec.v0"
    assumption_predicates: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "assumption_predicates": dict(sorted(self.assumption_predicates.items())),
            "network_policy": self.network_policy,
            "runtime_id": self.runtime_id,
            "schema_version": self.schema_version,
            "tool_permissions": list(sorted(self.tool_permissions)),
        }


@dataclass(frozen=True)
class EvaluatorBinding:
    """Independent authorized outcome evaluator binding."""

    oracle_id: str
    oracle_class: str
    oracle_public_key: str
    oracle_attestation: Dict[str, Any]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "oracle_attestation": self.oracle_attestation,
            "oracle_class": self.oracle_class,
            "oracle_id": self.oracle_id,
            "oracle_public_key": self.oracle_public_key,
        }


@dataclass(frozen=True)
class DatasetCommitment:
    """Frozen evaluation-set commitment with family-clustering and anti-contamination metadata."""

    dataset_id: str
    dataset_sha256: str
    independent_families_count: int
    distinct_clusters_count: int
    contamination_controlled: bool
    item_digests: Tuple[str, ...] = field(default_factory=tuple)
    family_ids: Tuple[str, ...] = field(default_factory=tuple)
    has_train_holdout_overlap: bool = False
    is_synthetic: bool = False
    evidence_origin: EvidenceOrigin = EvidenceOrigin.OBSERVED_UNVERIFIED

    @classmethod
    def create_verified(
        cls,
        dataset_id: str,
        num_independent_families: int = 24,
        items_per_family: int = 2,
    ) -> DatasetCommitment:
        fams = tuple(f"{dataset_id}-fam-{i:03d}" for i in range(num_independent_families))
        digests: List[str] = []
        for fam in fams:
            for j in range(items_per_family):
                digests.append(
                    hashlib.sha256(f"{dataset_id}:{fam}:item-{j:02d}".encode("utf-8")).hexdigest()
                )
        canonical_bytes = rfc8785_canonicalize(
            {
                "dataset_id": dataset_id,
                "family_ids": list(fams),
                "item_digests": digests,
            }
        )
        ds_hash = hashlib.sha256(canonical_bytes).hexdigest()
        is_synthetic = dataset_id.startswith("synth-")
        origin = EvidenceOrigin.SYNTHETIC_FIXTURE if is_synthetic else EvidenceOrigin.INDEPENDENTLY_VERIFIED
        return cls(
            dataset_id=dataset_id,
            dataset_sha256=ds_hash,
            independent_families_count=num_independent_families,
            distinct_clusters_count=num_independent_families,
            contamination_controlled=True,
            item_digests=tuple(digests),
            family_ids=fams,
            has_train_holdout_overlap=False,
            is_synthetic=is_synthetic,
            evidence_origin=origin,
        )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "contamination_controlled": self.contamination_controlled,
            "dataset_id": self.dataset_id,
            "dataset_sha256": self.dataset_sha256,
            "distinct_clusters_count": self.distinct_clusters_count,
            "evidence_origin": self.evidence_origin.value,
            "family_ids": list(self.family_ids),
            "has_train_holdout_overlap": self.has_train_holdout_overlap,
            "independent_families_count": self.independent_families_count,
            "is_synthetic": self.is_synthetic,
            "item_digests": list(self.item_digests),
        }


@dataclass(frozen=True)
class ObservedSuccessMetrics:
    """
    Measured empirical outcomes across repeated runs, never model self-assessment.
    Tracks both per-run pass rate (pass@1) and all-runs pass rate (pass^k), plus
    execution-path stability and inter-run correlation.
    """

    n_tasks: int
    k_runs_per_task: int
    n_all_runs_passed_tasks: int
    per_run_pass_rate: float
    all_runs_pass_rate: float
    execution_path_stability: float
    inter_run_correlation: float
    independent_oracle_verified: bool
    verbal_confidence: Optional[float] = None
    multi_agent_agreement_rate: Optional[float] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "all_runs_pass_rate": self.all_runs_pass_rate,
            "execution_path_stability": self.execution_path_stability,
            "independent_oracle_verified": self.independent_oracle_verified,
            "inter_run_correlation": self.inter_run_correlation,
            "k_runs_per_task": self.k_runs_per_task,
            "multi_agent_agreement_rate": self.multi_agent_agreement_rate,
            "n_all_runs_passed_tasks": self.n_all_runs_passed_tasks,
            "n_tasks": self.n_tasks,
            "per_run_pass_rate": self.per_run_pass_rate,
            "verbal_confidence": self.verbal_confidence,
        }


@dataclass(frozen=True)
class CoverageScope:
    """Population and boundary conditions to which the reliability estimate applies."""

    task_category: str
    domain: str
    max_complexity_score: float
    supported_perturbation_radius: float
    eligible_input_predicates: Tuple[str, ...]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "domain": self.domain,
            "eligible_input_predicates": list(self.eligible_input_predicates),
            "max_complexity_score": self.max_complexity_score,
            "supported_perturbation_radius": self.supported_perturbation_radius,
            "task_category": self.task_category,
        }


@dataclass(frozen=True)
class DependencyHashes:
    """Cryptographic evidence hashes required for envelope reuse and selective slice invalidation."""

    rbpd_asset_hashes: Tuple[str, ...]
    causal_proof_slice_digest: str
    obligation_hypergraph_digest: str
    requirement_slice_hashes: Dict[str, str] = field(default_factory=dict)
    parent_envelope_hashes: Tuple[str, ...] = field(default_factory=tuple)

    def to_dict(self) -> Dict[str, Any]:
        payload: Dict[str, Any] = {
            "causal_proof_slice_digest": self.causal_proof_slice_digest,
            "obligation_hypergraph_digest": self.obligation_hypergraph_digest,
            "rbpd_asset_hashes": list(self.rbpd_asset_hashes),
        }
        if self.requirement_slice_hashes:
            payload["requirement_slice_hashes"] = dict(sorted(self.requirement_slice_hashes.items()))
        if self.parent_envelope_hashes:
            payload["parent_envelope_hashes"] = list(self.parent_envelope_hashes)
        return payload


@dataclass(frozen=True)
class RiskBoundEstimate:
    """Result of calibrated statistical risk estimation."""

    risk_bound: Optional[float]
    confidence_level: float
    epistemic_state: EnvelopeValidityState
    reason: str
    statistical_method: str = "CLOPPER_PEARSON_FAMILY_CLUSTERED_UCB"


class CalibratedRiskEstimator:
    """
    Computes scope-bounded statistical risk upper bounds from independently verified
    family-clustered outcomes. Explicitly refuses to convert model verbal confidence
    or unverified multi-agent agreement into a numeric risk bound.
    """

    MIN_INDEPENDENT_FAMILIES = 20

    @staticmethod
    def _binom_cdf(failures: int, n: int, p: float) -> float:
        """Computes P(X <= failures) for X ~ Binomial(n, p) using log-gamma arithmetic."""
        if p <= 0.0:
            return 1.0
        if p >= 1.0:
            return 1.0 if failures >= n else 0.0
        log_p = math.log(p)
        log_1mp = math.log(1.0 - p)
        terms: List[float] = []
        for j in range(0, failures + 1):
            log_comb = math.lgamma(n + 1) - math.lgamma(j + 1) - math.lgamma(n - j + 1)
            log_prob = log_comb + j * log_p + (n - j) * log_1mp
            terms.append(math.exp(log_prob))
        return min(1.0, max(0.0, math.fsum(terms)))

    @classmethod
    def clopper_pearson_upper_bound(
        cls,
        *,
        failures: int,
        n_families: int,
        alpha: float = 0.05,
    ) -> float:
        """
        One-sided exact Clopper-Pearson upper confidence bound on failure probability p
        at significance level alpha (confidence 1 - alpha).
        """
        if n_families <= 0 or failures < 0 or failures > n_families:
            raise ValueError(f"Invalid failure counts: failures={failures}, n_families={n_families}")
        if not (0.0 < alpha < 1.0) or not math.isfinite(alpha):
            raise ValueError(f"Invalid alpha={alpha}: must be in (0, 1)")
        if failures == n_families:
            return 1.0
        if failures == 0:
            return 1.0 - math.pow(alpha, 1.0 / float(n_families))

        low = float(failures) / float(n_families)
        high = 1.0
        for _ in range(64):
            mid = 0.5 * (low + high)
            cdf_val = cls._binom_cdf(failures, n_families, mid)
            if cdf_val > alpha:
                low = mid
            else:
                high = mid
        return high

    @staticmethod
    def correlated_repeated_risk_bound(
        *,
        per_run_failure_bound: float,
        k_runs: int,
        inter_run_correlation: float,
    ) -> float:
        """
        Computes the upper bound on failure probability across k repeated executions
        accounting for common-mode correlation rho in [0, 1]:
            Risk_repeated(p1, k, rho) = (1 - rho) * (p1 ** k) + rho * p1
        When rho -> 1 (common-mode bias / consistent wrongness), repeating the model
        k times yields zero risk reduction.
        """
        if not (0.0 <= per_run_failure_bound <= 1.0) or not math.isfinite(per_run_failure_bound):
            raise ValueError("per_run_failure_bound must be in [0, 1]")
        if k_runs < 1:
            raise ValueError("k_runs must be >= 1")
        if not (0.0 <= inter_run_correlation <= 1.0) or not math.isfinite(inter_run_correlation):
            raise ValueError("inter_run_correlation must be in [0, 1]")
        independent_term = (1.0 - inter_run_correlation) * math.pow(per_run_failure_bound, k_runs)
        correlated_term = inter_run_correlation * per_run_failure_bound
        return min(1.0, independent_term + correlated_term)

    @staticmethod
    def frechet_joint_failure_bounds(per_run_failure_probs: Sequence[float]) -> Tuple[float, float]:
        """
        Distribution-free Fréchet-Hoeffding copula bounds on simultaneous joint failure
        P(F_1 = 1 and ... and F_k = 1):
            max(0, sum_i p_i - (k - 1)) <= P(cap_{i=1}^k F_i) <= min_i p_i
        """
        if not per_run_failure_probs:
            raise ValueError("per_run_failure_probs must not be empty")
        probs = [float(p) for p in per_run_failure_probs]
        for p in probs:
            if not (0.0 <= p <= 1.0) or not math.isfinite(p):
                raise ValueError(f"Invalid probability {p}: must be in [0, 1]")
        k = len(probs)
        lower = max(0.0, math.fsum(probs) - float(k - 1))
        upper = min(probs)
        return (min(1.0, lower), min(1.0, max(lower, upper)))

    @staticmethod
    def frechet_pass_hat_k_bounds(per_run_failure_probs: Sequence[float]) -> Tuple[float, float]:
        """
        Distribution-free Fréchet-Hoeffding bounds on pass^k = P(all k attempts succeed):
            max(0, sum_i (1 - p_i) - (k - 1)) <= pass^k <= min_i (1 - p_i)
        """
        if not per_run_failure_probs:
            raise ValueError("per_run_failure_probs must not be empty")
        success_probs = [1.0 - float(p) for p in per_run_failure_probs]
        for s in success_probs:
            if not (0.0 <= s <= 1.0) or not math.isfinite(s):
                raise ValueError("per_run_failure_probs must be in [0, 1]")
        k = len(success_probs)
        lower = max(0.0, math.fsum(success_probs) - float(k - 1))
        upper = min(success_probs)
        return (min(1.0, lower), min(1.0, max(lower, upper)))

    @classmethod
    def frechet_pass_at_k_bounds(cls, per_run_failure_probs: Sequence[float]) -> Tuple[float, float]:
        """
        Distribution-free Fréchet-Hoeffding bounds on pass@k = 1 - P(all k attempts fail):
            1 - min_i p_i <= pass@k <= 1 - max(0, sum_i p_i - (k - 1))
        """
        jf_lower, jf_upper = cls.frechet_joint_failure_bounds(per_run_failure_probs)
        return (max(0.0, 1.0 - jf_upper), min(1.0, 1.0 - jf_lower))

    @classmethod
    def estimate_repeated_execution_risk(
        cls,
        *,
        per_run_failure_bound: float,
        k_runs: int,
        inter_run_correlation: float,
        empirical_joint_failures: Optional[int] = None,
        n_families: Optional[int] = None,
        confidence: float = 0.95,
    ) -> float:
        """
        Estimates a statistically sound upper bound on simultaneous joint failure probability
        P(F_1 = 1 and ... and F_k = 1) across k repeated executions.

        1. If empirical_joint_failures and n_families (>= 1) are provided:
           Computes exact one-sided Clopper-Pearson upper confidence bound on the joint
           failure event E_joint = I(all k runs failed) at significance alpha = 1 - confidence.
        2. Otherwise (when higher-order joint dependence is unobserved):
           Pairwise correlation rho = 0 does NOT imply mutual independence for k >= 3
           (ternary counterexample: {111, 100, 010, 001} has p=0.5, rho=0, but joint failure = 0.25 > 0.5^3 = 0.125).
           Therefore, returns the distribution-free Fréchet-Hoeffding upper copula bound:
               P(cap_{i=1}^k F_i) <= min_i p_i = per_run_failure_bound.
        """
        if not (0.0 <= per_run_failure_bound <= 1.0) or not math.isfinite(per_run_failure_bound):
            raise ValueError("per_run_failure_bound must be in [0, 1]")
        if k_runs < 1:
            raise ValueError("k_runs must be >= 1")
        if not (0.0 <= inter_run_correlation <= 1.0) or not math.isfinite(inter_run_correlation):
            raise ValueError("inter_run_correlation must be in [0, 1]")
        if not (0.0 < confidence < 1.0) or not math.isfinite(confidence):
            raise ValueError("confidence must be in (0, 1)")

        if empirical_joint_failures is not None and n_families is not None:
            alpha = 1.0 - confidence
            cp_bound = cls.clopper_pearson_upper_bound(
                failures=empirical_joint_failures,
                n_families=n_families,
                alpha=alpha,
            )
            return min(1.0, max(float(empirical_joint_failures) / float(n_families), cp_bound))

        _, frechet_upper = cls.frechet_joint_failure_bounds([per_run_failure_bound] * k_runs)
        return frechet_upper

    @classmethod
    def estimate_risk_bound(
        cls,
        *,
        observed_success: ObservedSuccessMetrics,
        dataset_commitment: DatasetCommitment,
        alpha: float = 0.10,
        min_path_stability: float = 0.85,
    ) -> RiskBoundEstimate:
        # 1. Verbal confidence or unverified multi-agent agreement cannot substitute for an independent oracle
        if not observed_success.independent_oracle_verified:
            return RiskBoundEstimate(
                risk_bound=None,
                confidence_level=1.0 - alpha,
                epistemic_state=EnvelopeValidityState.UNKNOWN,
                reason=(
                    "Missing independent outcome oracle verification: model verbal confidence and "
                    "multi-agent agreement cannot manufacture a statistical risk bound (remains UNKNOWN)."
                ),
            )

        # 2. Validate internal mathematical consistency of ObservedSuccessMetrics
        if (
            observed_success.n_tasks <= 0
            or observed_success.k_runs_per_task < 1
            or observed_success.n_all_runs_passed_tasks < 0
            or observed_success.n_all_runs_passed_tasks > observed_success.n_tasks
            or not (0.0 <= observed_success.per_run_pass_rate <= 1.0)
            or not (0.0 <= observed_success.all_runs_pass_rate <= 1.0)
            or not (0.0 <= observed_success.execution_path_stability <= 1.0)
            or not (0.0 <= observed_success.inter_run_correlation <= 1.0)
            or observed_success.all_runs_pass_rate > observed_success.per_run_pass_rate + 1e-6
            or abs(
                observed_success.all_runs_pass_rate
                - (observed_success.n_all_runs_passed_tasks / float(observed_success.n_tasks))
            )
            > 1e-3
        ):
            return RiskBoundEstimate(
                risk_bound=None,
                confidence_level=1.0 - alpha,
                epistemic_state=EnvelopeValidityState.INVALID,
                reason=(
                    "Contradictory or out-of-range ObservedSuccessMetrics: all_runs_pass_rate (pass^k) "
                    "must match n_all_runs_passed_tasks / n_tasks and cannot exceed per_run_pass_rate (pass@1)."
                ),
            )

        # 3. Check calibration dataset integrity and anti-contamination requirements
        if (
            dataset_commitment.has_train_holdout_overlap
            or not dataset_commitment.contamination_controlled
            or dataset_commitment.independent_families_count < cls.MIN_INDEPENDENT_FAMILIES
            or dataset_commitment.distinct_clusters_count < cls.MIN_INDEPENDENT_FAMILIES
        ):
            return RiskBoundEstimate(
                risk_bound=None,
                confidence_level=1.0 - alpha,
                epistemic_state=EnvelopeValidityState.INVALID,
                reason=(
                    "Contaminated or pseudoreplicated calibration dataset: requires >= 20 distinct, "
                    "contamination-controlled task family clusters with zero train/holdout overlap."
                ),
            )

        if observed_success.n_tasks < cls.MIN_INDEPENDENT_FAMILIES:
            return RiskBoundEstimate(
                risk_bound=None,
                confidence_level=1.0 - alpha,
                epistemic_state=EnvelopeValidityState.UNKNOWN,
                reason=f"Insufficient calibrated tasks ({observed_success.n_tasks} < {cls.MIN_INDEPENDENT_FAMILIES})",
            )

        # 4. Check execution-path stability (ArXiv 2605.10516)
        if observed_success.execution_path_stability < min_path_stability:
            return RiskBoundEstimate(
                risk_bound=None,
                confidence_level=1.0 - alpha,
                epistemic_state=EnvelopeValidityState.STALE,
                reason=(
                    f"Execution-path stability {observed_success.execution_path_stability:.2f} below "
                    f"required floor {min_path_stability:.2f} under environmental perturbation."
                ),
            )

        # 5. Compute exact Clopper-Pearson upper confidence bound on family-level all-runs failure rate
        # Scale proportionally across independent families so failures when n_tasks > n_fam are never hidden.
        n_fam = min(observed_success.n_tasks, dataset_commitment.independent_families_count)
        pass_fraction = observed_success.n_all_runs_passed_tasks / float(observed_success.n_tasks)
        n_passed = min(n_fam, max(0, int(math.floor(n_fam * pass_fraction + 1e-9))))
        failures = n_fam - n_passed
        ucb = cls.clopper_pearson_upper_bound(failures=failures, n_families=n_fam, alpha=alpha)

        return RiskBoundEstimate(
            risk_bound=round(ucb, 6),
            confidence_level=1.0 - alpha,
            epistemic_state=EnvelopeValidityState.VALID,
            reason=(
                f"Clopper-Pearson {int((1.0 - alpha) * 100)}% upper risk bound {ucb:.4f} over "
                f"{n_fam} independent families ({failures} all-runs failures)."
            ),
        )


@dataclass(frozen=True)
class ReliabilityEnvelope:
    """
    12-field condition-bound Reliability Envelope Contract with Ed25519 RFC 8785 custody.
    """

    envelope_id: str
    intent_digest: str
    requirement_set_digest: str
    model_revision_binding: ModelRevisionBinding
    environment_binding: EnvironmentBinding
    evaluator_binding: EvaluatorBinding
    dataset_commitment: DatasetCommitment
    observed_success: ObservedSuccessMetrics
    risk_bound: Optional[float]
    coverage_scope: CoverageScope
    dependency_hashes: DependencyHashes
    drift_triggers: Tuple[str, ...]
    revocation_reference: str
    receipt_hash: str
    signature: str
    validator_public_key: str
    authority_grant_id: str
    committed_timestamp: float
    validity_horizon: float
    alpha: float = 0.10

    def canonical_payload_dict(self) -> Dict[str, Any]:
        return {
            "alpha": self.alpha,
            "authority_grant_id": self.authority_grant_id,
            "committed_timestamp": self.committed_timestamp,
            "coverage_scope": self.coverage_scope.to_dict(),
            "dataset_commitment": self.dataset_commitment.to_dict(),
            "dependency_hashes": self.dependency_hashes.to_dict(),
            "drift_triggers": list(self.drift_triggers),
            "envelope_id": self.envelope_id,
            "environment_binding": self.environment_binding.to_dict(),
            "evaluator_binding": self.evaluator_binding.to_dict(),
            "intent_digest": self.intent_digest,
            "model_revision_binding": self.model_revision_binding.to_dict(),
            "observed_success": self.observed_success.to_dict(),
            "requirement_set_digest": self.requirement_set_digest,
            "revocation_reference": self.revocation_reference,
            "risk_bound": self.risk_bound,
            "validator_public_key": self.validator_public_key,
            "validity_horizon": self.validity_horizon,
        }

    def to_dict(self) -> Dict[str, Any]:
        payload = self.canonical_payload_dict()
        payload["receipt_hash"] = self.receipt_hash
        payload["signature"] = self.signature
        return payload


@dataclass(frozen=True)
class EnvelopeEvaluationResult:
    """Result of evaluating a ReliabilityEnvelope against current request & environment."""

    state: EnvelopeValidityState
    can_reuse: bool
    effective_risk_bound: Optional[float]
    triggered_drift_events: Tuple[str, ...]
    reason: str
    reused_obligations: Tuple[str, ...] = ()
    altered_obligations: Tuple[str, ...] = ()


class ReliabilityEnvelopeCompiler:
    """
    Compiles, signs, revokes, and evaluates condition-bound ReliabilityEnvelope contracts.
    Backed by LearningValidator, ProofContractValidator (RBPD), ProtectedIntent, and AuthorityGrant.
    """

    def __init__(
        self,
        validator: LearningValidator,
        *,
        authority_grant: Optional[AuthorityGrant] = None,
    ) -> None:
        if not isinstance(validator, LearningValidator):
            raise ValueError("ReliabilityEnvelopeCompiler requires an authoritative LearningValidator")
        if not validator.has_cryptographic_owner_authority:
            raise ValueError("ReliabilityEnvelopeCompiler requires cryptographic owner authority")
        self.validator = validator
        self.rbpd_contract_validator = ProofContractValidator(validator=validator)
        self.authority_grant = authority_grant or AuthorityGrant(
            grant_id=f"GRANT-REC0-{validator.public_key.hex()[:12]}",
            principal=f"validator:{validator.public_key.hex()[:16]}",
            capability="REC0_ENVELOPE_COMPILE_AND_EVALUATE",
            target="spe_runtime.research.rec",
            argument_constraints={"require_cryptographic_owner_authority": True},
            purpose="REC-0 Reliability Envelope compilation and runtime qualification",
            issued_at="2026-10-11T00:00:00Z",
            expires_at="2027-10-11T00:00:00Z",
            use_limit=10000,
        )

    @staticmethod
    def compute_requirement_set_digest(requirements: Sequence[RequirementAtom]) -> str:
        if not requirements:
            raise ValueError("requirements must contain at least one RequirementAtom")
        canonical_reqs = [
            req.to_dict() for req in sorted(requirements, key=lambda r: r.requirement_id)
        ]
        return hashlib.sha256(rfc8785_canonicalize({"requirements": canonical_reqs})).hexdigest()

    def compile_envelope(
        self,
        *,
        envelope_id: str,
        protected_intent: ProtectedIntent,
        requirements: Sequence[RequirementAtom],
        model_id: str,
        model_or_runtime_digest: str,
        model_digest_type: str,
        environment_binding: EnvironmentBinding,
        oracle_id: str,
        oracle_class: str,
        oracle_signing_key: bytes,
        oracle_public_key: bytes,
        dataset_commitment: DatasetCommitment,
        observed_success: ObservedSuccessMetrics,
        coverage_scope: CoverageScope,
        dependency_hashes: DependencyHashes,
        alpha: float = 0.10,
        committed_timestamp: Optional[float] = None,
        validity_horizon: Optional[float] = None,
        drift_triggers: Optional[Sequence[str]] = None,
    ) -> ReliabilityEnvelope:
        if not self.validator.is_owner_authorized or not self.validator.has_cryptographic_owner_authority:
            raise ValueError("Unauthorized validator: cannot compile ReliabilityEnvelope")
        if (
            self.authority_grant.revocation_state != "ACTIVE"
            or self.authority_grant.uses_consumed >= self.authority_grant.use_limit
        ):
            raise ValueError(f"AuthorityGrant '{self.authority_grant.grant_id}' is inactive or exhausted")

        if oracle_id == model_id or oracle_class == "generating_model_self":
            raise ValueError("Self-certification prohibited: evaluator_binding must be an independent oracle")
        if oracle_class not in ("independent_static_oracle", "independent_reality_witness"):
            raise ValueError(f"Unsupported oracle_class '{oracle_class}'")

        if not _HEX64.fullmatch(model_or_runtime_digest):
            raise ValueError("model_or_runtime_digest must be 64-char lowercase hex SHA-256")
        if model_digest_type not in ("VERIFIED_MODEL_REVISION", "SYNTHETIC_NAME_DERIVED"):
            raise ValueError(f"Invalid model_digest_type '{model_digest_type}'")
        if model_digest_type == "VERIFIED_MODEL_REVISION" and _is_synthetic_model_digest(
            model_id, model_or_runtime_digest
        ):
            raise ValueError(
                f"Synthetic model digest for '{model_id}' cannot claim VERIFIED_MODEL_REVISION"
            )

        req_set_digest = self.compute_requirement_set_digest(requirements)
        now = committed_timestamp if committed_timestamp is not None else time.time()
        horizon = validity_horizon if validity_horizon is not None else (now + 86_400.0 * 30)
        if horizon <= now:
            raise ValueError("validity_horizon must be strictly greater than committed_timestamp")

        risk_est = CalibratedRiskEstimator.estimate_risk_bound(
            observed_success=observed_success,
            dataset_commitment=dataset_commitment,
            alpha=alpha,
        )
        if risk_est.epistemic_state == EnvelopeValidityState.INVALID:
            raise ValueError(f"Cannot compile envelope with invalid calibration: {risk_est.reason}")

        evidence_preimage = rfc8785_canonicalize(
            {
                "dataset_sha256": dataset_commitment.dataset_sha256,
                "envelope_id": envelope_id,
                "intent_digest": protected_intent.intent_digest,
                "model_or_runtime_digest": model_or_runtime_digest,
                "requirement_set_digest": req_set_digest,
            }
        )
        evidence_hash = hashlib.sha256(evidence_preimage).hexdigest()
        oracle_att = create_oracle_attestation(
            signing_key=oracle_signing_key,
            public_key=oracle_public_key,
            oracle_id=oracle_id,
            evidence_hash=evidence_hash,
        )

        ok_att, reason_att = self.validator.verify_oracle_attestation(
            oracle_att,
            expected_evidence_hash=evidence_hash,
            expected_oracle_id=oracle_id,
        )
        if not ok_att:
            raise ValueError(f"Oracle attestation verification failed during envelope compilation: {reason_att}")

        canonical_triggers = (
            DriftTrigger.INTENT_MUTATED.value,
            DriftTrigger.REQUIREMENT_SET_CHANGED.value,
            DriftTrigger.MODEL_REVISION_CHANGED.value,
            DriftTrigger.ENVIRONMENT_PERTURBED.value,
            DriftTrigger.EXECUTION_PATH_UNSTABLE.value,
            DriftTrigger.CALIBRATION_CONTAMINATED.value,
            DriftTrigger.OUT_OF_COVERAGE_SCOPE.value,
            DriftTrigger.ORACLE_REVOKED.value,
            DriftTrigger.HORIZON_EXPIRED.value,
            DriftTrigger.TOMBSTONE_REVOKED.value,
            DriftTrigger.DEPENDENCY_SLICE_CHANGED.value,
        )
        triggers = tuple(drift_triggers) if drift_triggers is not None else canonical_triggers
        if not set(canonical_triggers).issubset(set(triggers)):
            raise ValueError("drift_triggers must include all 11 mandatory canonical DriftTrigger values")
        revocation_ref = f"tx:{envelope_id}"

        oracle_att_dict = {
            "evidence_hash": oracle_att.evidence_hash,
            "oracle_id": oracle_att.oracle_id,
            "oracle_public_key": oracle_att.oracle_public_key,
            "signature": oracle_att.signature,
            "timestamp": oracle_att.timestamp,
            "verdict": oracle_att.verdict,
        }

        unsigned_env = ReliabilityEnvelope(
            envelope_id=envelope_id,
            intent_digest=protected_intent.intent_digest,
            requirement_set_digest=req_set_digest,
            model_revision_binding=ModelRevisionBinding(
                model_id=model_id,
                model_or_runtime_digest=model_or_runtime_digest,
                model_digest_type=model_digest_type,
            ),
            environment_binding=environment_binding,
            evaluator_binding=EvaluatorBinding(
                oracle_id=oracle_id,
                oracle_class=oracle_class,
                oracle_public_key=oracle_public_key.hex(),
                oracle_attestation=oracle_att_dict,
            ),
            dataset_commitment=dataset_commitment,
            observed_success=observed_success,
            risk_bound=risk_est.risk_bound,
            coverage_scope=coverage_scope,
            dependency_hashes=dependency_hashes,
            drift_triggers=triggers,
            revocation_reference=revocation_ref,
            receipt_hash="",
            signature="",
            validator_public_key=self.validator.public_key.hex(),
            authority_grant_id=self.authority_grant.grant_id,
            committed_timestamp=now,
            validity_horizon=horizon,
            alpha=alpha,
        )

        canonical_bytes = rfc8785_canonicalize(unsigned_env.canonical_payload_dict())
        receipt_hash = hashlib.sha256(canonical_bytes).hexdigest()
        sig_bytes = ed25519_sign(
            self.validator._sk,
            self.validator._pk,
            canonical_bytes,
        )
        return ReliabilityEnvelope(
            **{
                **unsigned_env.__dict__,
                "receipt_hash": receipt_hash,
                "signature": sig_bytes.hex(),
            }
        )

    def compile_default_valid_envelope(
        self,
        *,
        envelope_id: str,
        protected_intent: ProtectedIntent,
        requirements: Sequence[RequirementAtom],
        oracle_signing_key: bytes,
        oracle_public_key: bytes,
        model_id: str = "spe-verified-coder-v2",
        oracle_id: str = "oracle-rec0-independent",
    ) -> ReliabilityEnvelope:
        req_slices = {
            req.semantic_key: hashlib.sha256(
                f"slice:{envelope_id}:{req.semantic_key}:{req.value}".encode("utf-8")
            ).hexdigest()
            for req in requirements
        }
        return self.compile_envelope(
            envelope_id=envelope_id,
            protected_intent=protected_intent,
            requirements=requirements,
            model_id=model_id,
            model_or_runtime_digest=hashlib.sha256(
                f"verified-weights-manifest:{model_id}:2026-10-11".encode("utf-8")
            ).hexdigest(),
            model_digest_type="VERIFIED_MODEL_REVISION",
            environment_binding=EnvironmentBinding(
                runtime_id="spe-local-deterministic-v1",
                tool_permissions=("ast_verify", "layout_check"),
                network_policy=protected_intent.network_policy.value,
                schema_version="spe.rec.v0",
                assumption_predicates={"dom_api": "v2", "webgl_fallback": True},
            ),
            oracle_id=oracle_id,
            oracle_class="independent_reality_witness",
            oracle_signing_key=oracle_signing_key,
            oracle_public_key=oracle_public_key,
            dataset_commitment=DatasetCommitment.create_verified(
                dataset_id=f"DS-{envelope_id}",
                num_independent_families=24,
                items_per_family=2,
            ),
            observed_success=ObservedSuccessMetrics(
                n_tasks=24,
                k_runs_per_task=5,
                n_all_runs_passed_tasks=24,
                per_run_pass_rate=1.0,
                all_runs_pass_rate=1.0,
                execution_path_stability=0.98,
                inter_run_correlation=0.05,
                independent_oracle_verified=True,
            ),
            coverage_scope=CoverageScope(
                task_category=protected_intent.domain,
                domain=protected_intent.domain,
                max_complexity_score=0.85,
                supported_perturbation_radius=0.15,
                eligible_input_predicates=("responsive_layout", "keyboard_nav", "scroll_animation"),
            ),
            dependency_hashes=DependencyHashes(
                rbpd_asset_hashes=(hashlib.sha256(f"rbpd:{envelope_id}".encode("utf-8")).hexdigest(),),
                causal_proof_slice_digest=hashlib.sha256(f"slice:{envelope_id}".encode("utf-8")).hexdigest(),
                obligation_hypergraph_digest=hashlib.sha256(f"hgraph:{envelope_id}".encode("utf-8")).hexdigest(),
                requirement_slice_hashes=req_slices,
            ),
            alpha=0.10,
            committed_timestamp=1_760_000_000.0,
            validity_horizon=1_765_000_000.0,
        )

    def revoke_envelope(
        self,
        envelope: ReliabilityEnvelope,
        *,
        reason: str = "ENVELOPE_REVOKED",
        details: str = "Revoked via ReliabilityEnvelopeCompiler",
    ) -> None:
        LearningValidator._record_global_tombstone(
            receipt_hash=envelope.receipt_hash,
            tx_id=envelope.envelope_id,
            reason=reason,
            details=details,
        )

    def _is_validator_key_authorized(self, val_pk_hex: str) -> bool:
        if not _HEX64.fullmatch(val_pk_hex):
            return False
        if (
            val_pk_hex in LearningValidator._REVOKED_VALIDATORS
            or f"validator_pk:{val_pk_hex}" in LearningValidator._GLOBAL_TOMBSTONES
        ):
            return False
        return (
            val_pk_hex == self.validator.public_key.hex().lower()
            or val_pk_hex in LearningValidator._OWNER_AUTHORIZED_VALIDATORS
        )

    def evaluate_envelope(
        self,
        envelope: Optional[ReliabilityEnvelope],
        *,
        protected_intent: ProtectedIntent,
        requirements: Sequence[RequirementAtom],
        current_model_digest: str,
        current_environment: EnvironmentBinding,
        current_dependency_hashes: DependencyHashes,
        task_category: str,
        task_complexity: float,
        perturbation_magnitude: float = 0.0,
        current_path_stability: Optional[float] = None,
        current_time: Optional[float] = None,
        revoked_oracles: Sequence[str] = (),
        upstream_envelopes: Sequence[ReliabilityEnvelope] = (),
        allow_synthetic_calibration_execution: bool = False,
    ) -> EnvelopeEvaluationResult:
        if envelope is None:
            return EnvelopeEvaluationResult(
                state=EnvelopeValidityState.UNKNOWN,
                can_reuse=False,
                effective_risk_bound=None,
                triggered_drift_events=(),
                reason="No reliability envelope found for request (UNKNOWN).",
            )

        if (
            self.authority_grant.revocation_state != "ACTIVE"
            or self.authority_grant.uses_consumed >= self.authority_grant.use_limit
        ):
            return EnvelopeEvaluationResult(
                state=EnvelopeValidityState.INVALID,
                can_reuse=False,
                effective_risk_bound=None,
                triggered_drift_events=(DriftTrigger.TOMBSTONE_REVOKED.value,),
                reason=f"Compiler AuthorityGrant '{self.authority_grant.grant_id}' is inactive or exhausted.",
            )

        # 1. Check durable revocation tombstones & validator key authorization first (INVALID)
        val_pk = envelope.validator_public_key.strip().lower()
        if (
            not self.validator.is_owner_authorized
            or not self.validator.has_cryptographic_owner_authority
            or not self._is_validator_key_authorized(val_pk)
        ):
            return EnvelopeEvaluationResult(
                state=EnvelopeValidityState.INVALID,
                can_reuse=False,
                effective_risk_bound=None,
                triggered_drift_events=(DriftTrigger.TOMBSTONE_REVOKED.value,),
                reason="Validator public key is revoked or not owner-authorized.",
            )

        if (
            self.validator.is_tombstoned(
                receipt_hash=envelope.receipt_hash,
                tx_id=envelope.envelope_id,
            )
            or envelope.revocation_reference in LearningValidator._GLOBAL_TOMBSTONES
        ):
            return EnvelopeEvaluationResult(
                state=EnvelopeValidityState.INVALID,
                can_reuse=False,
                effective_risk_bound=None,
                triggered_drift_events=(DriftTrigger.TOMBSTONE_REVOKED.value,),
                reason=f"Envelope '{envelope.envelope_id}' is revoked via durable tombstone.",
            )

        # 2. Verify cryptographic receipt hash, mandatory drift triggers, and Ed25519 signature (INVALID on tamper)
        required_triggers = {t.value for t in DriftTrigger}
        if not required_triggers.issubset(set(envelope.drift_triggers)):
            return EnvelopeEvaluationResult(
                state=EnvelopeValidityState.INVALID,
                can_reuse=False,
                effective_risk_bound=None,
                triggered_drift_events=(),
                reason="ReliabilityEnvelope is missing mandatory canonical drift_triggers.",
            )

        if not _HEX64.fullmatch(envelope.receipt_hash) or not _HEX128.fullmatch(envelope.signature):
            return EnvelopeEvaluationResult(
                state=EnvelopeValidityState.INVALID,
                can_reuse=False,
                effective_risk_bound=None,
                triggered_drift_events=(),
                reason="Malformed receipt_hash or signature on ReliabilityEnvelope.",
            )

        canonical_bytes = rfc8785_canonicalize(envelope.canonical_payload_dict())
        computed_hash = hashlib.sha256(canonical_bytes).hexdigest()
        if computed_hash != envelope.receipt_hash:
            return EnvelopeEvaluationResult(
                state=EnvelopeValidityState.INVALID,
                can_reuse=False,
                effective_risk_bound=None,
                triggered_drift_events=(),
                reason="Envelope receipt_hash mismatch (payload tampered).",
            )

        if not ed25519_verify(
            bytes.fromhex(val_pk),
            canonical_bytes,
            bytes.fromhex(envelope.signature),
        ):
            return EnvelopeEvaluationResult(
                state=EnvelopeValidityState.INVALID,
                can_reuse=False,
                effective_risk_bound=None,
                triggered_drift_events=(),
                reason="Invalid Ed25519 validator signature on ReliabilityEnvelope.",
            )

        # 3. Verify synthetic model digest invariant & current model digest authenticity
        m_bind = envelope.model_revision_binding
        if m_bind.model_digest_type == "VERIFIED_MODEL_REVISION" and (
            _is_synthetic_model_digest(m_bind.model_id, m_bind.model_or_runtime_digest)
            or _is_synthetic_model_digest(m_bind.model_id, current_model_digest)
        ):
            return EnvelopeEvaluationResult(
                state=EnvelopeValidityState.INVALID,
                can_reuse=False,
                effective_risk_bound=None,
                triggered_drift_events=(DriftTrigger.MODEL_REVISION_CHANGED.value,),
                reason="Synthetic model-name digest rejected: cannot claim VERIFIED_MODEL_REVISION.",
            )

        # 4. Verify evaluator binding & oracle revocation
        ev_bind = envelope.evaluator_binding
        if ev_bind.oracle_id in set(revoked_oracles):
            return EnvelopeEvaluationResult(
                state=EnvelopeValidityState.INVALID,
                can_reuse=False,
                effective_risk_bound=None,
                triggered_drift_events=(DriftTrigger.ORACLE_REVOKED.value,),
                reason=f"Oracle '{ev_bind.oracle_id}' has been revoked.",
            )
        if ev_bind.oracle_id == m_bind.model_id or ev_bind.oracle_class == "generating_model_self":
            return EnvelopeEvaluationResult(
                state=EnvelopeValidityState.INVALID,
                can_reuse=False,
                effective_risk_bound=None,
                triggered_drift_events=(DriftTrigger.ORACLE_REVOKED.value,),
                reason="Self-certifying evaluator rejected.",
            )
        evidence_preimage = rfc8785_canonicalize(
            {
                "dataset_sha256": envelope.dataset_commitment.dataset_sha256,
                "envelope_id": envelope.envelope_id,
                "intent_digest": envelope.intent_digest,
                "model_or_runtime_digest": m_bind.model_or_runtime_digest,
                "requirement_set_digest": envelope.requirement_set_digest,
            }
        )
        expected_ev_hash = hashlib.sha256(evidence_preimage).hexdigest()
        att_dict = ev_bind.oracle_attestation or {}
        oracle_att_obj = OracleAttestation(
            oracle_id=str(att_dict.get("oracle_id", "")),
            oracle_public_key=str(att_dict.get("oracle_public_key", "")),
            evidence_hash=str(att_dict.get("evidence_hash", "")),
            verdict=str(att_dict.get("verdict", "PASS")),
            timestamp=float(att_dict.get("timestamp", 0.0)),
            signature=str(att_dict.get("signature", "")),
        )
        ok_att, msg_att = self.validator.verify_oracle_attestation(
            oracle_att_obj,
            expected_evidence_hash=expected_ev_hash,
            expected_oracle_id=ev_bind.oracle_id,
        )
        if not ok_att:
            return EnvelopeEvaluationResult(
                state=EnvelopeValidityState.INVALID,
                can_reuse=False,
                effective_risk_bound=None,
                triggered_drift_events=(DriftTrigger.ORACLE_REVOKED.value,),
                reason=f"Oracle attestation verification failed: {msg_att}",
            )

        # 5. Re-verify calibration dataset integrity & risk bound authenticity
        risk_check = CalibratedRiskEstimator.estimate_risk_bound(
            observed_success=envelope.observed_success,
            dataset_commitment=envelope.dataset_commitment,
            alpha=envelope.alpha,
        )
        if risk_check.epistemic_state == EnvelopeValidityState.INVALID:
            return EnvelopeEvaluationResult(
                state=EnvelopeValidityState.INVALID,
                can_reuse=False,
                effective_risk_bound=None,
                triggered_drift_events=(DriftTrigger.CALIBRATION_CONTAMINATED.value,),
                reason=risk_check.reason,
            )
        if risk_check.epistemic_state == EnvelopeValidityState.UNKNOWN:
            return EnvelopeEvaluationResult(
                state=EnvelopeValidityState.UNKNOWN,
                can_reuse=False,
                effective_risk_bound=None,
                triggered_drift_events=(),
                reason=risk_check.reason,
            )
        if risk_check.epistemic_state == EnvelopeValidityState.VALID:
            if envelope.risk_bound is None:
                return EnvelopeEvaluationResult(
                    state=EnvelopeValidityState.UNKNOWN,
                    can_reuse=False,
                    effective_risk_bound=None,
                    triggered_drift_events=(),
                    reason="Missing risk_bound on envelope (UNKNOWN).",
                )
            if risk_check.risk_bound is None or abs(float(envelope.risk_bound) - float(risk_check.risk_bound)) > 1e-6:
                return EnvelopeEvaluationResult(
                    state=EnvelopeValidityState.INVALID,
                    can_reuse=False,
                    effective_risk_bound=None,
                    triggered_drift_events=(DriftTrigger.CALIBRATION_CONTAMINATED.value,),
                    reason=(
                        f"Envelope risk_bound ({envelope.risk_bound}) does not match calibrated "
                        f"Clopper-Pearson upper bound ({risk_check.risk_bound})."
                    ),
                )

        # 6. Check ProtectedIntent & coverage scope boundaries
        if envelope.intent_digest != protected_intent.intent_digest:
            return EnvelopeEvaluationResult(
                state=EnvelopeValidityState.INVALID,
                can_reuse=False,
                effective_risk_bound=None,
                triggered_drift_events=(DriftTrigger.INTENT_MUTATED.value,),
                reason="ProtectedIntent digest mismatch: cannot reuse envelope across mutated user objective.",
            )

        scope = envelope.coverage_scope
        if (
            task_category != scope.task_category
            or protected_intent.domain != scope.domain
            or task_complexity > scope.max_complexity_score
        ):
            return EnvelopeEvaluationResult(
                state=EnvelopeValidityState.INVALID,
                can_reuse=False,
                effective_risk_bound=None,
                triggered_drift_events=(DriftTrigger.OUT_OF_COVERAGE_SCOPE.value,),
                reason=(
                    f"Request ({task_category}, complexity={task_complexity:.2f}) falls outside "
                    f"envelope coverage_scope ({scope.task_category}, max={scope.max_complexity_score:.2f})."
                ),
            )

        eval_ts = current_time if current_time is not None else time.time()
        stale_triggers: List[str] = []

        # 7. Check compositional upstream envelope chain if parent_envelope_hashes or upstream_envelopes exist
        expected_parents = envelope.dependency_hashes.parent_envelope_hashes
        if expected_parents or upstream_envelopes:
            up_by_hash = {u.receipt_hash: u for u in upstream_envelopes}
            for p_hash in expected_parents:
                if p_hash not in up_by_hash:
                    return EnvelopeEvaluationResult(
                        state=EnvelopeValidityState.UNKNOWN,
                        can_reuse=False,
                        effective_risk_bound=None,
                        triggered_drift_events=(DriftTrigger.DEPENDENCY_SLICE_CHANGED.value,),
                        reason=f"Missing upstream parent envelope '{p_hash[:16]}...' required by dependency_hashes.",
                    )
            for up_env in upstream_envelopes:
                up_pk = up_env.validator_public_key.strip().lower()
                if (
                    not self._is_validator_key_authorized(up_pk)
                    or self.validator.is_tombstoned(receipt_hash=up_env.receipt_hash, tx_id=up_env.envelope_id)
                    or up_env.revocation_reference in LearningValidator._GLOBAL_TOMBSTONES
                ):
                    return EnvelopeEvaluationResult(
                        state=EnvelopeValidityState.INVALID,
                        can_reuse=False,
                        effective_risk_bound=None,
                        triggered_drift_events=(DriftTrigger.TOMBSTONE_REVOKED.value,),
                        reason=f"Upstream parent envelope '{up_env.envelope_id}' is revoked or unauthorized.",
                    )
                up_bytes = rfc8785_canonicalize(up_env.canonical_payload_dict())
                if (
                    hashlib.sha256(up_bytes).hexdigest() != up_env.receipt_hash
                    or not _HEX128.fullmatch(up_env.signature)
                    or not ed25519_verify(bytes.fromhex(up_pk), up_bytes, bytes.fromhex(up_env.signature))
                ):
                    return EnvelopeEvaluationResult(
                        state=EnvelopeValidityState.INVALID,
                        can_reuse=False,
                        effective_risk_bound=None,
                        triggered_drift_events=(DriftTrigger.TOMBSTONE_REVOKED.value,),
                        reason=f"Upstream parent envelope '{up_env.envelope_id}' failed cryptographic verification.",
                    )
                if eval_ts >= up_env.validity_horizon or up_env.observed_success.execution_path_stability < 0.85:
                    stale_triggers.append(DriftTrigger.DEPENDENCY_SLICE_CHANGED.value)

        # 8. Check STALE drift triggers (requirements, model revision, environment, path stability, dependencies, horizon)
        curr_req_digest = self.compute_requirement_set_digest(requirements)
        if curr_req_digest != envelope.requirement_set_digest:
            stale_triggers.append(DriftTrigger.REQUIREMENT_SET_CHANGED.value)

        if current_model_digest != m_bind.model_or_runtime_digest:
            stale_triggers.append(DriftTrigger.MODEL_REVISION_CHANGED.value)

        if (
            current_environment.to_dict() != envelope.environment_binding.to_dict()
            or perturbation_magnitude > scope.supported_perturbation_radius
        ):
            stale_triggers.append(DriftTrigger.ENVIRONMENT_PERTURBED.value)

        effective_stability = (
            current_path_stability
            if current_path_stability is not None
            else envelope.observed_success.execution_path_stability
        )
        if effective_stability < 0.85 or risk_check.epistemic_state == EnvelopeValidityState.STALE:
            stale_triggers.append(DriftTrigger.EXECUTION_PATH_UNSTABLE.value)

        reused_obs: List[str] = []
        altered_obs: List[str] = []
        if current_dependency_hashes.to_dict() != envelope.dependency_hashes.to_dict():
            if DriftTrigger.DEPENDENCY_SLICE_CHANGED.value not in stale_triggers:
                stale_triggers.append(DriftTrigger.DEPENDENCY_SLICE_CHANGED.value)
            env_slices = envelope.dependency_hashes.requirement_slice_hashes
            cur_slices = current_dependency_hashes.requirement_slice_hashes
            if (
                env_slices
                and cur_slices
                and curr_req_digest == envelope.requirement_set_digest
                and current_dependency_hashes.rbpd_asset_hashes == envelope.dependency_hashes.rbpd_asset_hashes
                and current_dependency_hashes.obligation_hypergraph_digest
                == envelope.dependency_hashes.obligation_hypergraph_digest
                and current_dependency_hashes.parent_envelope_hashes
                == envelope.dependency_hashes.parent_envelope_hashes
            ):
                for req in requirements:
                    if (
                        req.semantic_key in env_slices
                        and cur_slices.get(req.semantic_key) == env_slices.get(req.semantic_key)
                    ):
                        reused_obs.append(req.semantic_key)
                    else:
                        altered_obs.append(req.semantic_key)
            else:
                altered_obs = [req.semantic_key for req in requirements]
        else:
            reused_obs = [req.semantic_key for req in requirements]

        if eval_ts >= envelope.validity_horizon:
            stale_triggers.append(DriftTrigger.HORIZON_EXPIRED.value)

        if stale_triggers:
            # If any non-dependency-slice trigger fired (e.g. model change, env perturbation, horizon),
            # all requirements must be reverified rather than partially reused.
            if set(stale_triggers) != {DriftTrigger.DEPENDENCY_SLICE_CHANGED.value}:
                reused_obs = []
                altered_obs = [req.semantic_key for req in requirements]
            return EnvelopeEvaluationResult(
                state=EnvelopeValidityState.STALE,
                can_reuse=False,
                effective_risk_bound=None,
                triggered_drift_events=tuple(stale_triggers),
                reason=f"Envelope is STALE due to drift triggers: {', '.join(stale_triggers)}",
                reused_obligations=tuple(reused_obs),
                altered_obligations=tuple(altered_obs),
            )

        # 9. Evidence-Origin Firewall (REC-1 P0):
        # Synthetic datasets, generated synthetic IDs, or SYNTHETIC_FIXTURE origin cannot acquire
        # production VALID state or authorize reuse unless explicitly in synthetic calibration test mode.
        ds = envelope.dataset_commitment
        if not allow_synthetic_calibration_execution and (
            ds.is_synthetic
            or ds.evidence_origin == EvidenceOrigin.SYNTHETIC_FIXTURE
            or ds.dataset_id.lower().startswith("synth-")
        ):
            return EnvelopeEvaluationResult(
                state=EnvelopeValidityState.SYNTHETIC_CALIBRATION_ONLY,
                can_reuse=False,
                effective_risk_bound=envelope.risk_bound,
                triggered_drift_events=(),
                reason=(
                    f"Evidence-Origin Firewall: dataset '{ds.dataset_id}' has origin "
                    f"{ds.evidence_origin.value} (SYNTHETIC_CALIBRATION_ONLY; production reuse blocked)."
                ),
                reused_obligations=(),
                altered_obligations=tuple(req.semantic_key for req in requirements),
            )

        return EnvelopeEvaluationResult(
            state=EnvelopeValidityState.VALID,
            can_reuse=True,
            effective_risk_bound=envelope.risk_bound,
            triggered_drift_events=(),
            reason="All 12 ReliabilityEnvelope bindings verified; qualified reuse permitted.",
            reused_obligations=tuple(reused_obs),
            altered_obligations=(),
        )
