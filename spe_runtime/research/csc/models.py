"""
SPE Ω — Counterfactual Specification Closure (CSC) Core Models & Schemas.
Formalizes evidence-compatible worlds, counterfactual challenge records,
distinguishing probes, and reusable counterexample records.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field, asdict
from enum import Enum
from typing import Dict, Any, List, Optional, Callable, Tuple

from spe_runtime.research.wdes.types import (
    PredicateValue,
    VerificationVerdict,
    NanoUSD,
    validate_nanos,
    NetworkPolicy,
    SecurityLabel,
    ConfidentialityLevel,
)
from spe_runtime.ci_gate.receipt import rfc8785_canonicalize


class WorldType(str, Enum):
    """Ontological classification of modeled worlds."""
    BENIGN_WORLD = "BENIGN_WORLD"
    FORMAL_COUNTERMODEL = "FORMAL_COUNTERMODEL"
    EMPIRICAL_FAILURE_WORLD = "EMPIRICAL_FAILURE_WORLD"
    HYPOTHESIS_WORLD = "HYPOTHESIS_WORLD"


class HypothesisStatus(str, Enum):
    """Lifecycle status of a counterfactual failure hypothesis."""
    UNVERIFIED_HYPOTHESIS = "UNVERIFIED_HYPOTHESIS"
    FORMAL_COUNTERMODEL = "FORMAL_COUNTERMODEL"
    EMPIRICAL_FAILURE = "EMPIRICAL_FAILURE"
    DISPROVED = "DISPROVED"


class OracleStatus(str, Enum):
    """Status of independent oracle qualification."""
    QUALIFIED = "QUALIFIED"
    NOT_QUALIFIED = "NOT_QUALIFIED"
    PROVISIONAL = "PROVISIONAL"


class ProbeVerdict(str, Enum):
    """Outcome of a distinguishing probe execution."""
    SUCCESS_CONFIRMED = "SUCCESS_CONFIRMED"         # Disproved w_bad; code complies with objective
    COUNTEREXAMPLE_EXPOSED = "COUNTEREXAMPLE_EXPOSED" # Exposed w_bad defect in apparent success
    INCONCLUSIVE = "INCONCLUSIVE"                     # Ambiguous observation; neither world eliminated
    UNAUTHORIZED = "UNAUTHORIZED"                     # Refused by authority/privacy gate
    BUDGET_EXCEEDED = "BUDGET_EXCEEDED"               # Refused by financial cost boundary


class QualificationMethod(str, Enum):
    """Method by which an independent oracle is qualified (Mechanism C)."""
    FORMAL_PROOF = "FORMAL_PROOF"
    AST_INVARIANT = "AST_INVARIANT"
    METAMORPHIC_RELATION = "METAMORPHIC_RELATION"
    HUMAN_AUTHORIZATION = "HUMAN_AUTHORIZATION"


@dataclass(frozen=True)
class WorldModel:
    """
    Modeled world w in W(E, R, M).
    Represents an execution environment or implementation state with:
    - satisfies_objective: K(w) in {True, False}
    - observations: Obs_e(w) for evidence keys e in E
    """
    world_id: str
    satisfies_objective: bool
    observations: Dict[str, Any] = field(default_factory=dict)
    environment_parameters: Dict[str, Any] = field(default_factory=dict)
    description: str = ""
    world_type: WorldType = WorldType.BENIGN_WORLD

    def observation_for(self, key: str) -> Any:
        return self.observations.get(key)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "world_id": self.world_id,
            "satisfies_objective": self.satisfies_objective,
            "observations": self.observations,
            "environment_parameters": self.environment_parameters,
            "description": self.description,
            "world_type": self.world_type.value if isinstance(self.world_type, WorldType) else str(self.world_type),
        }

    def canonical_hash(self) -> str:
        canonical_bytes = rfc8785_canonicalize(self.to_dict())
        return hashlib.sha256(canonical_bytes).hexdigest()


@dataclass(frozen=True)
class WorldPair:
    """
    Candidate world pair (w_good, w_bad) such that:
    K(w_good) == True and K(w_bad) == False.
    """
    w_good: WorldModel
    w_bad: WorldModel

    def are_indistinguishable_under(self, evidence_keys: List[str]) -> bool:
        """Checks if Obs_E(w_good) == Obs_E(w_bad) for all keys in E."""
        for key in evidence_keys:
            if self.w_good.observation_for(key) != self.w_bad.observation_for(key):
                return False
        return True


@dataclass
class DistinguishingProbe:
    """
    Admissible observation experiment q in Q_admissible.
    Designed to distinguish w_good from w_bad: Obs_q(w_good) != Obs_q(w_bad).
    """
    probe_id: str
    name: str
    target_obligation_ref: str
    operation: str
    delta_v: float                  # Decision-relevant uncertainty eliminated (Delta V >= 0)
    v_reuse: float                  # Amortized value for future qualification runs (V_reuse >= 0)
    cost_nanos: NanoUSD             # Total execution and risk cost in NanoUSD (>= 0)
    required_authority: List[str] = field(default_factory=lambda: ["LOCAL_TEST_EXECUTION"])
    network_policy: NetworkPolicy = NetworkPolicy.AIR_GAPPED
    expected_observation_classes: List[str] = field(default_factory=list)
    oracle_status: OracleStatus = OracleStatus.QUALIFIED
    evaluation_fn: Optional[Callable[[Any], Any]] = None

    def __post_init__(self):
        validate_nanos(self.cost_nanos, "cost_nanos")
        if self.delta_v < 0.0:
            raise ValueError(f"delta_v cannot be negative: {self.delta_v}")
        if self.v_reuse < 0.0:
            raise ValueError(f"v_reuse cannot be negative: {self.v_reuse}")

    def evaluate(self, subject: Any) -> Any:
        """Executes observation probe on a modeled world or arbitrary subject."""
        if isinstance(subject, WorldModel):
            if self.evaluation_fn is not None:
                return self.evaluation_fn(subject)
            return subject.observation_for(self.operation)
        if callable(subject):
            return subject(self.operation)
        if hasattr(subject, self.operation):
            attr = getattr(subject, self.operation)
            return attr() if callable(attr) else attr
        if self.evaluation_fn is not None:
            return self.evaluation_fn(subject)
        return None

    def can_distinguish(self, w_good: WorldModel, w_bad: WorldModel) -> bool:
        """Verifies Obs_q(w_good) != Obs_q(w_bad)."""
        obs_good = self.evaluate(w_good)
        obs_bad = self.evaluate(w_bad)
        return obs_good != obs_bad


@dataclass(frozen=True)
class CounterfactualChallengeRecord:
    """
    Counterfactual Challenge Record (CCR) formal schema per Section 5 of plan.
    Binds visible success claims against alternative failure hypotheses and distinguishing probes.
    """
    challenge_id: str
    protected_intent_ref: str
    obligation_ref: str
    evidence_snapshot_hash: str

    # Current visible success claim
    observed_success_evidence_refs: List[str]
    declared_scope: Dict[str, Any]

    # Counterfactual failure hypothesis
    alternative_world_hypothesis: str
    assumptions: List[str]
    plausibility_basis: List[str]
    hypothesis_status: str  # "UNVERIFIED_HYPOTHESIS", "FORMAL_COUNTERMODEL", etc.

    # Distinguishing observation probe
    distinguishing_probe_operation: str
    required_authority: List[str]
    required_budget_nanos: int
    expected_observation_classes: List[str]
    oracle_status: str      # "QUALIFIED", "NOT_QUALIFIED"

    # Execution verdict
    observed_result: PredicateValue  # TRUE, FALSE, UNKNOWN
    new_obligation_proposal: Optional[str]
    invalidated_evidence_refs: List[str]

    def to_dict(self) -> Dict[str, Any]:
        hyp_status = (
            self.hypothesis_status.value
            if isinstance(self.hypothesis_status, Enum)
            else str(self.hypothesis_status)
        )
        orc_status = (
            self.oracle_status.value
            if isinstance(self.oracle_status, Enum)
            else str(self.oracle_status)
        )
        obs_res = (
            self.observed_result.name
            if isinstance(self.observed_result, PredicateValue)
            else (
                self.observed_result.value
                if isinstance(self.observed_result, Enum)
                else str(self.observed_result)
            )
        )
        return {
            "challenge_id": self.challenge_id,
            "protected_intent_ref": self.protected_intent_ref,
            "obligation_ref": self.obligation_ref,
            "evidence_snapshot_hash": self.evidence_snapshot_hash,
            "observed_success_evidence_refs": list(self.observed_success_evidence_refs),
            "declared_scope": self.declared_scope,
            "alternative_world_hypothesis": self.alternative_world_hypothesis,
            "assumptions": list(self.assumptions),
            "plausibility_basis": list(self.plausibility_basis),
            "hypothesis_status": hyp_status,
            "distinguishing_probe_operation": self.distinguishing_probe_operation,
            "required_authority": list(self.required_authority),
            "required_budget_nanos": self.required_budget_nanos,
            "expected_observation_classes": list(self.expected_observation_classes),
            "oracle_status": orc_status,
            "observed_result": obs_res,
            "new_obligation_proposal": self.new_obligation_proposal,
            "invalidated_evidence_refs": list(self.invalidated_evidence_refs),
        }

    def canonical_hash(self) -> str:
        canonical_bytes = rfc8785_canonicalize(self.to_dict())
        return hashlib.sha256(canonical_bytes).hexdigest()

    def with_execution_verdict(
        self,
        observed_result: PredicateValue,
        hypothesis_status: Optional[str] = None,
        new_obligation_proposal: Optional[str] = None,
        invalidated_evidence_refs: Optional[List[str]] = None,
    ) -> "CounterfactualChallengeRecord":
        status = hypothesis_status or (
            HypothesisStatus.EMPIRICAL_FAILURE.value
            if observed_result == PredicateValue.FALSE
            else HypothesisStatus.DISPROVED.value
            if observed_result == PredicateValue.TRUE
            else self.hypothesis_status
        )
        return CounterfactualChallengeRecord(
            challenge_id=self.challenge_id,
            protected_intent_ref=self.protected_intent_ref,
            obligation_ref=self.obligation_ref,
            evidence_snapshot_hash=self.evidence_snapshot_hash,
            observed_success_evidence_refs=list(self.observed_success_evidence_refs),
            declared_scope=dict(self.declared_scope),
            alternative_world_hypothesis=self.alternative_world_hypothesis,
            assumptions=list(self.assumptions),
            plausibility_basis=list(self.plausibility_basis),
            hypothesis_status=status,
            distinguishing_probe_operation=self.distinguishing_probe_operation,
            required_authority=list(self.required_authority),
            required_budget_nanos=self.required_budget_nanos,
            expected_observation_classes=list(self.expected_observation_classes),
            oracle_status=self.oracle_status,
            observed_result=observed_result,
            new_obligation_proposal=(
                new_obligation_proposal
                if new_obligation_proposal is not None
                else self.new_obligation_proposal
            ),
            invalidated_evidence_refs=(
                list(invalidated_evidence_refs)
                if invalidated_evidence_refs is not None
                else list(self.invalidated_evidence_refs)
            ),
        )


@dataclass(frozen=True)
class CounterexampleRecord:
    """
    Mechanism A: Reusable Counterexample Record.
    Codifies exposed blind spots into reusable qualification assets.
    """
    record_id: str
    obligation_ref: str
    evidence_snapshot_hash: str
    bad_world_id: str
    bad_world_description: str
    distinguishing_probe_id: str
    distinguishing_probe_operation: str
    applicability_boundaries: Dict[str, Any]
    canonical_hash: str = ""
    provenance_hash: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "record_id": self.record_id,
            "obligation_ref": self.obligation_ref,
            "evidence_snapshot_hash": self.evidence_snapshot_hash,
            "bad_world_id": self.bad_world_id,
            "bad_world_description": self.bad_world_description,
            "distinguishing_probe_id": self.distinguishing_probe_id,
            "distinguishing_probe_operation": self.distinguishing_probe_operation,
            "applicability_boundaries": self.applicability_boundaries,
            "canonical_hash": self.canonical_hash,
            "provenance_hash": self.provenance_hash,
        }

    def compute_canonical_hash(self) -> str:
        canonical_dict = {
            "applicability_boundaries": self.applicability_boundaries,
            "bad_world_description": self.bad_world_description,
            "bad_world_id": self.bad_world_id,
            "distinguishing_probe_id": self.distinguishing_probe_id,
            "distinguishing_probe_operation": self.distinguishing_probe_operation,
            "evidence_snapshot_hash": self.evidence_snapshot_hash,
            "obligation_ref": self.obligation_ref,
            "provenance_hash": self.provenance_hash,
            "record_id": self.record_id,
        }
        canonical_bytes = rfc8785_canonicalize(canonical_dict)
        return hashlib.sha256(canonical_bytes).hexdigest()

    def matches_context(self, context: Dict[str, Any]) -> bool:
        """Verifies if this counterexample's applicability boundaries match current context."""
        for k, v in self.applicability_boundaries.items():
            ctx_val = context.get(k)
            if isinstance(v, (list, tuple, set)):
                if ctx_val not in v:
                    return False
            elif ctx_val != v:
                return False
        return True


@dataclass(frozen=True)
class ProvenanceRecord:
    """
    Mechanism B: Cryptographic provenance binding.
    Provenance = Digest(SourceCommit || ToolVersion || EnvProfile || PolicySnapshot).
    """
    source_commit: str
    tool_version: str
    env_profile: Dict[str, Any]
    policy_snapshot: Dict[str, Any]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "source_commit": self.source_commit,
            "tool_version": self.tool_version,
            "env_profile": self.env_profile,
            "policy_snapshot": self.policy_snapshot,
        }

    def compute_provenance_digest(self) -> str:
        canonical_dict = {
            "env_profile": self.env_profile,
            "policy_snapshot": self.policy_snapshot,
            "source_commit": self.source_commit,
            "tool_version": self.tool_version,
        }
        canonical_bytes = rfc8785_canonicalize(canonical_dict)
        return hashlib.sha256(canonical_bytes).hexdigest()


@dataclass(frozen=True)
class CandidateObligationProposal:
    """
    Mechanism D: Real-world feedback candidate obligation proposal.
    Proposes new formal obligations from exposed reality gaps.
    Protected intent cannot be altered without explicit human authorization.
    """
    proposal_id: str
    target_intent_ref: str
    proposed_requirement: str
    rationale: str
    evidence_source_ref: str
    status: str = "PENDING_AUTHORIZATION"  # "PENDING_AUTHORIZATION", "APPROVED", "REJECTED"
    authorized_by: Optional[str] = None
    promoted_obligation_ref: Optional[str] = None
    rejection_reason: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "proposal_id": self.proposal_id,
            "target_intent_ref": self.target_intent_ref,
            "proposed_requirement": self.proposed_requirement,
            "rationale": self.rationale,
            "evidence_source_ref": self.evidence_source_ref,
            "status": self.status,
            "authorized_by": self.authorized_by,
            "promoted_obligation_ref": self.promoted_obligation_ref,
            "rejection_reason": self.rejection_reason,
        }

    def canonical_hash(self) -> str:
        canonical_bytes = rfc8785_canonicalize(self.to_dict())
        return hashlib.sha256(canonical_bytes).hexdigest()


@dataclass(frozen=True)
class DiscriminationResult:
    """Result of evidence sufficiency analysis."""
    is_conclusive: bool
    indistinguishable_pairs: List[WorldPair]
    total_worlds_analyzed: int
    evidence_keys: List[str]
    recommendation: str
