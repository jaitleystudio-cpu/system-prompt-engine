"""
SPE Ω — REC-0 Task 2: Policy-Constrained Cost–Risk Execution Selector.

Implements the constrained optimization:
    a* = argmin_{a in A_authorized} ExpectedCost(a)
    subject to EstimatedRiskUpperBound(a) <= tau
and all ProtectedIntent, privacy (NetworkPolicy), AuthorityGrant, and
Reality-Bound Proof Dividend (RBPD) evidence requirements being satisfied.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
import math
from typing import Dict, List, Optional, Sequence, Tuple

from spe_runtime.authority import AuthorityGrant
from spe_runtime.hybrid.models import PlacementTarget
from spe_runtime.prompt.meta_compiler import ProtectedIntent
from spe_runtime.requirements.models import RequirementAtom
from spe_runtime.research.csc.models import NetworkPolicy, validate_nanos
from spe_runtime.research.rec.envelope import (
    CalibratedRiskEstimator,
    DependencyHashes,
    DriftTrigger,
    EnvironmentBinding,
    EnvelopeEvaluationResult,
    EnvelopeValidityState,
    ReliabilityEnvelope,
    ReliabilityEnvelopeCompiler,
)


class ExecutionAction(str, Enum):
    """The 5 canonical execution decisions of the Cost–Risk Execution Selector."""

    REUSE_DETERMINISTIC_PROCEDURE = "REUSE_DETERMINISTIC_PROCEDURE"
    EXECUTE_SELECTED_MODEL = "EXECUTE_SELECTED_MODEL"
    EXECUTE_WITH_INDEPENDENT_VERIFICATION = "EXECUTE_WITH_INDEPENDENT_VERIFICATION"
    ESCALATE_TO_HUMAN = "ESCALATE_TO_HUMAN"
    ABSTAIN_INSUFFICIENT_QUALIFICATION = "ABSTAIN_INSUFFICIENT_QUALIFICATION"


@dataclass(frozen=True)
class AuthorizedStrategyCandidate:
    """An execution strategy candidate evaluated by CostRiskExecutionSelector."""

    strategy_id: str
    action: ExecutionAction
    expected_cost_nanos: int
    estimated_risk_upper_bound: Optional[float]
    placement_target: PlacementTarget = PlacementTarget.LOCAL_DETERMINISTIC
    is_deterministic_procedure: bool = False
    requires_cloud_egress: bool = False
    independent_verifier_bound: bool = False
    unverified_confidence_only: bool = False
    k_repeated_runs: int = 1
    per_run_failure_bound: Optional[float] = None
    inter_run_correlation: float = 0.0
    authority_grant: Optional[AuthorityGrant] = None


@dataclass(frozen=True)
class ExecutionSelectionDecision:
    """Deterministic decision emitted by CostRiskExecutionSelector."""

    selected_action: ExecutionAction
    selected_strategy_id: str
    expected_cost_nanos: int
    effective_risk_upper_bound: Optional[float]
    risk_tolerance_tau: float
    envelope_state: EnvelopeValidityState
    generated_verification_obligations: Tuple[str, ...]
    rejected_candidates: Dict[str, str]
    reason: str
    placement_target: PlacementTarget = PlacementTarget.LOCAL_DETERMINISTIC
    reused_obligations: Tuple[str, ...] = ()


class CostRiskExecutionSelector:
    """
    Policy-constrained component of the WHS (HybridSwitchboard) and WDIC
    execution pipeline. Never manufactures a risk estimate and never uses
    unverified multi-agent agreement as a substitute for an independent oracle.
    """

    def __init__(self, compiler: ReliabilityEnvelopeCompiler) -> None:
        self.compiler = compiler

    def _effective_candidate_risk(
        self,
        candidate: AuthorizedStrategyCandidate,
        envelope_eval: EnvelopeEvaluationResult,
    ) -> Tuple[Optional[float], str]:
        if candidate.unverified_confidence_only:
            return None, "Candidate relies on verbal confidence or unverified agreement (risk remains UNKNOWN)"

        # If candidate uses repeated runs (k > 1) and supplies per_run_failure_bound,
        # enforce correlation-aware repeated risk bound instead of naive p^k.
        if candidate.k_repeated_runs > 1 and candidate.per_run_failure_bound is not None:
            corr_bound = CalibratedRiskEstimator.correlated_repeated_risk_bound(
                per_run_failure_bound=candidate.per_run_failure_bound,
                k_runs=candidate.k_repeated_runs,
                inter_run_correlation=candidate.inter_run_correlation,
            )
            if not candidate.independent_verifier_bound:
                return None, (
                    f"Repeated sampling (k={candidate.k_repeated_runs}, rho={candidate.inter_run_correlation:.2f}) "
                    "without an independent outcome oracle cannot establish verified risk bound."
                )
            return corr_bound, "Correlation-aware repeated risk bound computed"

        # Strategies relying on the envelope without an independent runtime verifier cannot
        # claim a risk upper bound lower than the calibrated envelope's effective_risk_bound.
        relies_on_envelope_only = (
            candidate.action
            in (ExecutionAction.REUSE_DETERMINISTIC_PROCEDURE, ExecutionAction.EXECUTE_SELECTED_MODEL)
            and not candidate.independent_verifier_bound
        )
        if (
            relies_on_envelope_only
            and candidate.estimated_risk_upper_bound is None
            and envelope_eval.effective_risk_bound is not None
        ):
            return float(envelope_eval.effective_risk_bound), "Inherited calibrated envelope risk bound"

        if candidate.estimated_risk_upper_bound is None:
            return None, "Missing calibrated risk bound (UNKNOWN)"

        if (
            not isinstance(candidate.estimated_risk_upper_bound, (int, float))
            or isinstance(candidate.estimated_risk_upper_bound, bool)
            or not math.isfinite(candidate.estimated_risk_upper_bound)
            or not (0.0 <= candidate.estimated_risk_upper_bound <= 1.0)
        ):
            return None, f"Invalid risk bound value: {candidate.estimated_risk_upper_bound}"

        cand_risk = float(candidate.estimated_risk_upper_bound)
        if relies_on_envelope_only and envelope_eval.effective_risk_bound is not None:
            cand_risk = max(cand_risk, float(envelope_eval.effective_risk_bound))

        return cand_risk, "Valid calibrated risk bound"

    def select_execution_strategy(
        self,
        *,
        protected_intent: ProtectedIntent,
        requirements: Sequence[RequirementAtom],
        envelope: Optional[ReliabilityEnvelope],
        candidates: Sequence[AuthorizedStrategyCandidate],
        risk_tolerance_tau: float,
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
        human_escalation_authorized: bool = False,
        allow_synthetic_calibration_execution: bool = False,
    ) -> ExecutionSelectionDecision:
        if not (0.0 < risk_tolerance_tau < 1.0) or not math.isfinite(risk_tolerance_tau):
            raise ValueError(f"risk_tolerance_tau must be in (0, 1), got {risk_tolerance_tau}")

        env_eval = self.compiler.evaluate_envelope(
            envelope,
            protected_intent=protected_intent,
            requirements=requirements,
            current_model_digest=current_model_digest,
            current_environment=current_environment,
            current_dependency_hashes=current_dependency_hashes,
            task_category=task_category,
            task_complexity=task_complexity,
            perturbation_magnitude=perturbation_magnitude,
            current_path_stability=current_path_stability,
            current_time=current_time,
            revoked_oracles=revoked_oracles,
            upstream_envelopes=upstream_envelopes,
            allow_synthetic_calibration_execution=allow_synthetic_calibration_execution,
        )

        # Generate new verification obligations whenever evidence is STALE, UNKNOWN, or SYNTHETIC_CALIBRATION_ONLY
        obligations: List[str] = []
        if env_eval.state == EnvelopeValidityState.STALE:
            for trig in env_eval.triggered_drift_events:
                obligations.append(f"REQUALIFY_ON_{trig}")
            if env_eval.altered_obligations:
                for sem_key in env_eval.altered_obligations:
                    obligations.append(f"VERIFY_REQ:{sem_key}")
            else:
                for req in requirements:
                    obligations.append(f"VERIFY_REQ:{req.semantic_key}")
        elif env_eval.state == EnvelopeValidityState.SYNTHETIC_CALIBRATION_ONLY:
            obligations.append("REAL_WORLD_INDEPENDENT_EVIDENCE_REQUIRED")
            for req in requirements:
                obligations.append(f"VERIFY_REQ:{req.semantic_key}")
        elif env_eval.state == EnvelopeValidityState.UNKNOWN:
            obligations.append("INITIAL_INDEPENDENT_ORACLE_QUALIFICATION")
            for req in requirements:
                obligations.append(f"VERIFY_REQ:{req.semantic_key}")
        elif env_eval.state == EnvelopeValidityState.INVALID:
            # Conflicting, forged, or revoked evidence -> reject reuse immediately and fail closed
            return ExecutionSelectionDecision(
                selected_action=ExecutionAction.ABSTAIN_INSUFFICIENT_QUALIFICATION,
                selected_strategy_id="NONE_INVALID_EVIDENCE",
                expected_cost_nanos=0,
                effective_risk_upper_bound=None,
                risk_tolerance_tau=risk_tolerance_tau,
                envelope_state=EnvelopeValidityState.INVALID,
                generated_verification_obligations=("BLOCKED_ON_INVALID_OR_REVOKED_EVIDENCE",),
                rejected_candidates={c.strategy_id: env_eval.reason for c in candidates},
                reason=f"Rejected reuse due to INVALID/revoked envelope evidence: {env_eval.reason}",
                placement_target=PlacementTarget.BLOCKED,
                reused_obligations=(),
            )

        eligible: List[Tuple[int, float, str, AuthorizedStrategyCandidate]] = []
        rejected: Dict[str, str] = {}

        for cand in candidates:
            validate_nanos(cand.expected_cost_nanos, "expected_cost_nanos")

            # 1. Check budget constraint from ProtectedIntent
            if protected_intent.budget_nanos > 0 and cand.expected_cost_nanos > protected_intent.budget_nanos:
                rejected[cand.strategy_id] = (
                    f"Cost {cand.expected_cost_nanos} exceeds ProtectedIntent budget {protected_intent.budget_nanos}"
                )
                continue

            # 2. Check privacy / NetworkPolicy constraint
            if (
                protected_intent.network_policy == NetworkPolicy.AIR_GAPPED
                and cand.requires_cloud_egress
            ):
                rejected[cand.strategy_id] = "Cloud egress prohibited under AIR_GAPPED ProtectedIntent policy"
                continue

            # 3. Check optional AuthorityGrant validity
            if cand.authority_grant is not None:
                if (
                    cand.authority_grant.revocation_state != "ACTIVE"
                    or cand.authority_grant.uses_consumed >= cand.authority_grant.use_limit
                ):
                    rejected[cand.strategy_id] = f"AuthorityGrant '{cand.authority_grant.grant_id}' is inactive or exhausted"
                    continue

            # 4. Enforce envelope validity state constraints on action types
            if cand.action == ExecutionAction.REUSE_DETERMINISTIC_PROCEDURE:
                if env_eval.state != EnvelopeValidityState.VALID or not env_eval.can_reuse:
                    rejected[cand.strategy_id] = (
                        f"Cannot reuse deterministic procedure when envelope state is {env_eval.state.value}"
                    )
                    continue
                if not cand.is_deterministic_procedure:
                    rejected[cand.strategy_id] = "Strategy is not a validated deterministic procedure"
                    continue

            if cand.action == ExecutionAction.EXECUTE_SELECTED_MODEL:
                if env_eval.state != EnvelopeValidityState.VALID and not cand.independent_verifier_bound:
                    rejected[cand.strategy_id] = (
                        f"Direct model execution without independent verification prohibited when envelope is {env_eval.state.value}"
                    )
                    continue

            if cand.action == ExecutionAction.EXECUTE_WITH_INDEPENDENT_VERIFICATION:
                if not cand.independent_verifier_bound and env_eval.state != EnvelopeValidityState.VALID:
                    rejected[cand.strategy_id] = (
                        "EXECUTE_WITH_INDEPENDENT_VERIFICATION requires an independent verifier binding when envelope is not VALID"
                    )
                    continue

            # 5. Evaluate risk upper bound against preregistered tolerance tau
            eff_risk, risk_reason = self._effective_candidate_risk(cand, env_eval)
            if eff_risk is None:
                rejected[cand.strategy_id] = risk_reason
                continue
            if eff_risk > risk_tolerance_tau:
                rejected[cand.strategy_id] = (
                    f"Estimated risk upper bound {eff_risk:.4f} exceeds tolerance tau={risk_tolerance_tau:.4f}"
                )
                continue

            eligible.append((cand.expected_cost_nanos, eff_risk, cand.strategy_id, cand))

        if eligible:
            eligible.sort(key=lambda item: (item[0], item[1], item[2]))
            best_cost, best_risk, _, best_cand = eligible[0]
            return ExecutionSelectionDecision(
                selected_action=best_cand.action,
                selected_strategy_id=best_cand.strategy_id,
                expected_cost_nanos=best_cost,
                effective_risk_upper_bound=best_risk,
                risk_tolerance_tau=risk_tolerance_tau,
                envelope_state=env_eval.state,
                generated_verification_obligations=tuple(obligations),
                rejected_candidates=rejected,
                reason=(
                    f"Selected minimum-cost authorized strategy '{best_cand.strategy_id}' "
                    f"({best_cand.action.value}) at cost {best_cost} NanoUSD with risk bound "
                    f"{best_risk:.4f} <= tau ({risk_tolerance_tau:.4f})."
                ),
                placement_target=best_cand.placement_target,
                reused_obligations=env_eval.reused_obligations,
            )

        # No automated strategy satisfied the reliability contract -> escalate or abstain
        if human_escalation_authorized:
            return ExecutionSelectionDecision(
                selected_action=ExecutionAction.ESCALATE_TO_HUMAN,
                selected_strategy_id="HUMAN_AUTHORIZED_ESCALATION",
                expected_cost_nanos=0,
                effective_risk_upper_bound=None,
                risk_tolerance_tau=risk_tolerance_tau,
                envelope_state=env_eval.state,
                generated_verification_obligations=tuple(obligations),
                rejected_candidates=rejected,
                reason=(
                    f"No automated strategy satisfied risk_bound <= {risk_tolerance_tau:.4f}; "
                    "escalating to authorized human decision."
                ),
                placement_target=PlacementTarget.BLOCKED,
                reused_obligations=env_eval.reused_obligations,
            )

        return ExecutionSelectionDecision(
            selected_action=ExecutionAction.ABSTAIN_INSUFFICIENT_QUALIFICATION,
            selected_strategy_id="ABSTAIN_FAIL_CLOSED",
            expected_cost_nanos=0,
            effective_risk_upper_bound=None,
            risk_tolerance_tau=risk_tolerance_tau,
            envelope_state=env_eval.state,
            generated_verification_obligations=tuple(obligations),
            rejected_candidates=rejected,
            reason=(
                f"Abstaining fail-closed: no authorized strategy satisfied risk_bound <= {risk_tolerance_tau:.4f} "
                "and human escalation is not authorized."
            ),
            placement_target=PlacementTarget.BLOCKED,
            reused_obligations=env_eval.reused_obligations,
        )
