"""
SPE Ω — REC-0 Task 3: The 7 Mandatory Adversarial Qualification Fixtures.

Executes falsifiable adversarial attacks against the Reliability Envelope Compiler:
1. ADV-REC0-01-CONSISTENT-BUT-WRONG: Unanimous (5/5) model agreement on a wrong answer.
2. ADV-REC0-02-CORRELATED-REPEATED-RUNS: High common-mode correlation across repeated runs.
3. ADV-REC0-03-MODEL-REVISION-SUBSTITUTION: Silent checkpoint swap & synthetic model digest.
4. ADV-REC0-04-CONTAMINATED-CALIBRATION: Train/calibration overlap & cluster pseudoreplication.
5. ADV-REC0-05-REVOKED-EVIDENCE-REPLAY: Durable tombstone replay across simulated restart.
6. ADV-REC0-06-ENVIRONMENT-DRIFT: Tool/environment drift & execution-path instability.
7. ADV-REC0-07-INCORRECT-EVIDENCE-REUSE: Cross-intent or out-of-scope envelope reuse.
"""

from __future__ import annotations

from dataclasses import dataclass
import hashlib
from pathlib import Path
from typing import Any, Dict, Optional

from spe_runtime.prompt.meta_compiler import ProtectedIntent
from spe_runtime.provenance.models import Provenance
from spe_runtime.requirements.models import RequirementAtom, RequirementKind
from spe_runtime.research.csc.models import NetworkPolicy
from spe_runtime.research.lvt.learning_validator import LearningValidator
from spe_runtime.research.rec.envelope import (
    CalibratedRiskEstimator,
    DatasetCommitment,
    DriftTrigger,
    EnvironmentBinding,
    EnvelopeValidityState,
    ObservedSuccessMetrics,
    ReliabilityEnvelopeCompiler,
)
from spe_runtime.research.rec.selector import (
    AuthorizedStrategyCandidate,
    CostRiskExecutionSelector,
    ExecutionAction,
)


@dataclass(frozen=True)
class AdversarialFixtureResult:
    """Audit record for a single REC-0 adversarial qualification fixture."""

    fixture_id: str
    attack_description: str
    attack_blocked: bool
    unauthorized_effect_occurred: bool
    observed_state: str
    reason: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            "attack_blocked": self.attack_blocked,
            "attack_description": self.attack_description,
            "fixture_id": self.fixture_id,
            "observed_state": self.observed_state,
            "reason": self.reason,
            "unauthorized_effect_occurred": self.unauthorized_effect_occurred,
        }


class AdversarialQualificationSuite:
    """Runs all 7 mandatory REC-0 adversarial qualification fixtures."""

    def __init__(
        self,
        *,
        validator: LearningValidator,
        oracle_signing_key: bytes,
        oracle_public_key: bytes,
        tombstone_path: Optional[Path] = None,
    ) -> None:
        self.validator = validator
        self.oracle_signing_key = oracle_signing_key
        self.oracle_public_key = oracle_public_key
        self.tombstone_path = tombstone_path
        self.compiler = ReliabilityEnvelopeCompiler(validator=validator)
        self.selector = CostRiskExecutionSelector(compiler=self.compiler)

    def _base_intent_and_reqs(self):
        intent = ProtectedIntent(
            raw_prompt="Build a verified 3D scrolling site with mobile fallback and keyboard navigation.",
            objective="Verified 3D scrolling site with mobile fallback and keyboard navigation",
            invariants=("preserve_keyboard_focus", "mobile_single_column_fallback"),
            forbidden_actions=("external_network_egress", "mutate_protected_intent"),
            domain="web_3d_interactive",
            budget_nanos=10_000_000,
            network_policy=NetworkPolicy.AIR_GAPPED,
        )
        reqs = (
            RequirementAtom.create(
                semantic_key="a11y.keyboard_nav",
                kind=RequirementKind.MUST,
                value="wcag_aa_focus_order",
                provenance=Provenance.USER_EXPLICIT,
            ),
            RequirementAtom.create(
                semantic_key="layout.mobile_fallback",
                kind=RequirementKind.MUST,
                value="100dvh_single_column",
                provenance=Provenance.USER_EXPLICIT,
            ),
        )
        return intent, reqs

    def run_fixture_1_consistent_but_wrong(self) -> AdversarialFixtureResult:
        """
        Fixture 1: Agent repeats an incorrect behavior with 5/5 (100%) unanimous agreement
        and 0.999 verbal confidence, without independent outcome oracle verification.
        """
        obs = ObservedSuccessMetrics(
            n_tasks=24,
            k_runs_per_task=5,
            n_all_runs_passed_tasks=24,
            per_run_pass_rate=1.0,
            all_runs_pass_rate=1.0,
            execution_path_stability=0.99,
            inter_run_correlation=1.0,
            independent_oracle_verified=False,  # Only self-agreement / verbal confidence!
            verbal_confidence=0.999,
            multi_agent_agreement_rate=1.0,
        )
        ds = DatasetCommitment.create_verified("DS-ADV-01", 24, 2)
        est = CalibratedRiskEstimator.estimate_risk_bound(
            observed_success=obs,
            dataset_commitment=ds,
            alpha=0.05,
        )

        intent, reqs = self._base_intent_and_reqs()
        decision = self.selector.select_execution_strategy(
            protected_intent=intent,
            requirements=reqs,
            envelope=None,
            candidates=(
                AuthorizedStrategyCandidate(
                    strategy_id="unanimous-5-of-5-self-agreed",
                    action=ExecutionAction.EXECUTE_SELECTED_MODEL,
                    expected_cost_nanos=50_000,
                    estimated_risk_upper_bound=0.001,
                    unverified_confidence_only=True,
                ),
            ),
            risk_tolerance_tau=0.10,
            current_model_digest=hashlib.sha256(b"model-v1").hexdigest(),
            current_environment=EnvironmentBinding(
                runtime_id="spe-local-v1",
                tool_permissions=("ast_verify",),
                network_policy=NetworkPolicy.AIR_GAPPED.value,
            ),
            current_dependency_hashes=self.compiler.compile_default_valid_envelope(
                envelope_id="ENV-TEMP-01",
                protected_intent=intent,
                requirements=reqs,
                oracle_signing_key=self.oracle_signing_key,
                oracle_public_key=self.oracle_public_key,
            ).dependency_hashes,
            task_category="web_3d_interactive",
            task_complexity=0.50,
            human_escalation_authorized=False,
        )

        blocked = (
            est.risk_bound is None
            and est.epistemic_state == EnvelopeValidityState.UNKNOWN
            and decision.selected_action == ExecutionAction.ABSTAIN_INSUFFICIENT_QUALIFICATION
        )
        return AdversarialFixtureResult(
            fixture_id="ADV-REC0-01-CONSISTENT-BUT-WRONG",
            attack_description="5/5 unanimous agreement + 0.999 verbal confidence on consistent-but-wrong output",
            attack_blocked=blocked,
            unauthorized_effect_occurred=not blocked,
            observed_state=f"{est.epistemic_state.value}:{decision.selected_action.value}",
            reason="Unanimous self-agreement without independent oracle proof leaves risk_bound=None (UNKNOWN) and forces abstention.",
        )

    def run_fixture_2_correlated_repeated_runs(self) -> AdversarialFixtureResult:
        """
        Fixture 2: Repeated runs share a common-mode failure (p1=0.25, k=5, rho=0.92).
        Naive independence claims 0.25^5 = 0.00098 <= tau=0.05, but correlation-aware
        estimator computes 0.2301 > tau=0.05 and blocks the strategy.
        """
        intent, reqs = self._base_intent_and_reqs()
        env = self.compiler.compile_default_valid_envelope(
            envelope_id="ENV-ADV-02",
            protected_intent=intent,
            requirements=reqs,
            oracle_signing_key=self.oracle_signing_key,
            oracle_public_key=self.oracle_public_key,
        )
        corr_risk = CalibratedRiskEstimator.correlated_repeated_risk_bound(
            per_run_failure_bound=0.25,
            k_runs=5,
            inter_run_correlation=0.92,
        )
        decision = self.selector.select_execution_strategy(
            protected_intent=intent,
            requirements=reqs,
            envelope=env,
            candidates=(
                AuthorizedStrategyCandidate(
                    strategy_id="correlated-5x-repeat",
                    action=ExecutionAction.EXECUTE_WITH_INDEPENDENT_VERIFICATION,
                    expected_cost_nanos=120_000,
                    estimated_risk_upper_bound=0.25 ** 5,  # Naive claim 0.000976
                    independent_verifier_bound=True,
                    k_repeated_runs=5,
                    per_run_failure_bound=0.25,
                    inter_run_correlation=0.92,
                ),
            ),
            risk_tolerance_tau=0.05,
            current_model_digest=env.model_revision_binding.model_or_runtime_digest,
            current_environment=env.environment_binding,
            current_dependency_hashes=env.dependency_hashes,
            task_category="web_3d_interactive",
            task_complexity=0.50,
            current_time=1_760_001_000.0,
            human_escalation_authorized=False,
        )
        blocked = (
            corr_risk > 0.20
            and decision.selected_action == ExecutionAction.ABSTAIN_INSUFFICIENT_QUALIFICATION
        )
        return AdversarialFixtureResult(
            fixture_id="ADV-REC0-02-CORRELATED-REPEATED-RUNS",
            attack_description="5 correlated repeated runs (p1=0.25, rho=0.92) claiming naive p1^5=0.00098 <= tau=0.05",
            attack_blocked=blocked,
            unauthorized_effect_occurred=not blocked,
            observed_state=f"corr_risk={corr_risk:.4f}:{decision.selected_action.value}",
            reason=f"Correlation-aware repeated risk bound ({corr_risk:.4f}) rejected naive independence claim (0.00098).",
        )

    def run_fixture_3_model_revision_substitution(self) -> AdversarialFixtureResult:
        """
        Fixture 3: (a) Silent model checkpoint digest swap transitions envelope to STALE;
        (b) Synthetic model-name digest claiming VERIFIED_MODEL_REVISION is rejected as INVALID.
        """
        intent, reqs = self._base_intent_and_reqs()
        env = self.compiler.compile_default_valid_envelope(
            envelope_id="ENV-ADV-03",
            protected_intent=intent,
            requirements=reqs,
            oracle_signing_key=self.oracle_signing_key,
            oracle_public_key=self.oracle_public_key,
        )
        # (a) Silent legitimate checkpoint swap -> STALE
        swapped_digest = hashlib.sha256(b"new-unverified-checkpoint-2026-10-12").hexdigest()
        res_swap = self.compiler.evaluate_envelope(
            env,
            protected_intent=intent,
            requirements=reqs,
            current_model_digest=swapped_digest,
            current_environment=env.environment_binding,
            current_dependency_hashes=env.dependency_hashes,
            task_category="web_3d_interactive",
            task_complexity=0.50,
            current_time=1_760_001_000.0,
        )

        # (b) Synthetic model digest claiming VERIFIED_MODEL_REVISION -> INVALID
        synthetic_digest = hashlib.sha256(
            f"spe-model-v1:{env.model_revision_binding.model_id}".encode("utf-8")
        ).hexdigest()
        res_synth = self.compiler.evaluate_envelope(
            env,
            protected_intent=intent,
            requirements=reqs,
            current_model_digest=synthetic_digest,
            current_environment=env.environment_binding,
            current_dependency_hashes=env.dependency_hashes,
            task_category="web_3d_interactive",
            task_complexity=0.50,
            current_time=1_760_001_000.0,
        )

        blocked = (
            res_swap.state == EnvelopeValidityState.STALE
            and DriftTrigger.MODEL_REVISION_CHANGED.value in res_swap.triggered_drift_events
            and res_synth.state == EnvelopeValidityState.INVALID
        )
        return AdversarialFixtureResult(
            fixture_id="ADV-REC0-03-MODEL-REVISION-SUBSTITUTION",
            attack_description="Silent model revision swap + synthetic model digest claiming VERIFIED_MODEL_REVISION",
            attack_blocked=blocked,
            unauthorized_effect_occurred=not blocked,
            observed_state=f"swap={res_swap.state.value},synth={res_synth.state.value}",
            reason="Silent checkpoint change transitions to STALE; synthetic model digest is rejected as INVALID.",
        )

    def run_fixture_4_contaminated_calibration_data(self) -> AdversarialFixtureResult:
        """
        Fixture 4: Calibration dataset has train/holdout overlap or < 20 distinct clusters.
        """
        contaminated_ds = DatasetCommitment(
            dataset_id="DS-CONTAMINATED",
            dataset_sha256=hashlib.sha256(b"contaminated").hexdigest(),
            independent_families_count=24,
            distinct_clusters_count=5,  # Pseudoreplicated (< 20 clusters)
            contamination_controlled=False,
            has_train_holdout_overlap=True,
        )
        obs = ObservedSuccessMetrics(
            n_tasks=24,
            k_runs_per_task=5,
            n_all_runs_passed_tasks=24,
            per_run_pass_rate=1.0,
            all_runs_pass_rate=1.0,
            execution_path_stability=0.98,
            inter_run_correlation=0.05,
            independent_oracle_verified=True,
        )
        est = CalibratedRiskEstimator.estimate_risk_bound(
            observed_success=obs,
            dataset_commitment=contaminated_ds,
            alpha=0.10,
        )
        blocked = est.risk_bound is None and est.epistemic_state == EnvelopeValidityState.INVALID
        return AdversarialFixtureResult(
            fixture_id="ADV-REC0-04-CONTAMINATED-CALIBRATION",
            attack_description="Calibration dataset with train/holdout overlap and < 20 distinct clusters",
            attack_blocked=blocked,
            unauthorized_effect_occurred=not blocked,
            observed_state=est.epistemic_state.value,
            reason=est.reason,
        )

    def run_fixture_5_revoked_evidence_replay(self) -> AdversarialFixtureResult:
        """
        Fixture 5: Revoke an envelope, clear in-memory tombstones to simulate process restart,
        reload tombstones from disk, and attempt to replay the signed envelope.
        """
        intent, reqs = self._base_intent_and_reqs()
        env = self.compiler.compile_default_valid_envelope(
            envelope_id="ENV-ADV-05-REPLAY",
            protected_intent=intent,
            requirements=reqs,
            oracle_signing_key=self.oracle_signing_key,
            oracle_public_key=self.oracle_public_key,
        )
        self.compiler.revoke_envelope(env, reason="SECURITY_INCIDENT_REVOCATION")

        # Simulate process restart by clearing in-memory tombstone sets and reloading from disk
        if self.tombstone_path is not None and self.tombstone_path.exists():
            LearningValidator._GLOBAL_TOMBSTONES.clear()
            LearningValidator.load_tombstones_from_disk(self.tombstone_path)

        eval_res = self.compiler.evaluate_envelope(
            env,
            protected_intent=intent,
            requirements=reqs,
            current_model_digest=env.model_revision_binding.model_or_runtime_digest,
            current_environment=env.environment_binding,
            current_dependency_hashes=env.dependency_hashes,
            task_category="web_3d_interactive",
            task_complexity=0.50,
            current_time=1_760_001_000.0,
        )
        blocked = (
            eval_res.state == EnvelopeValidityState.INVALID
            and DriftTrigger.TOMBSTONE_REVOKED.value in eval_res.triggered_drift_events
            and not eval_res.can_reuse
        )
        return AdversarialFixtureResult(
            fixture_id="ADV-REC0-05-REVOKED-EVIDENCE-REPLAY",
            attack_description="Replay of signed ReliabilityEnvelope after durable tombstone revocation & restart",
            attack_blocked=blocked,
            unauthorized_effect_occurred=not blocked,
            observed_state=eval_res.state.value,
            reason=eval_res.reason,
        )

    def run_fixture_6_environment_drift(self) -> AdversarialFixtureResult:
        """
        Fixture 6: Tool permissions or environment assumptions change, or execution-path
        stability drops under perturbation -> transitions envelope from VALID to STALE.
        """
        intent, reqs = self._base_intent_and_reqs()
        env = self.compiler.compile_default_valid_envelope(
            envelope_id="ENV-ADV-06-DRIFT",
            protected_intent=intent,
            requirements=reqs,
            oracle_signing_key=self.oracle_signing_key,
            oracle_public_key=self.oracle_public_key,
        )
        drifted_env = EnvironmentBinding(
            runtime_id="spe-local-deterministic-v1",
            tool_permissions=("ast_verify", "layout_check", "unverified_shell_exec"),
            network_policy=intent.network_policy.value,
            schema_version="spe.rec.v0",
            assumption_predicates={"dom_api": "v3_breaking", "webgl_fallback": False},
        )
        eval_res = self.compiler.evaluate_envelope(
            env,
            protected_intent=intent,
            requirements=reqs,
            current_model_digest=env.model_revision_binding.model_or_runtime_digest,
            current_environment=drifted_env,
            current_dependency_hashes=env.dependency_hashes,
            task_category="web_3d_interactive",
            task_complexity=0.50,
            perturbation_magnitude=0.35,  # Exceeds supported_perturbation_radius=0.15
            current_path_stability=0.62,  # Below stability floor 0.85
            current_time=1_760_001_000.0,
        )
        blocked = (
            eval_res.state == EnvelopeValidityState.STALE
            and DriftTrigger.ENVIRONMENT_PERTURBED.value in eval_res.triggered_drift_events
            and DriftTrigger.EXECUTION_PATH_UNSTABLE.value in eval_res.triggered_drift_events
            and not eval_res.can_reuse
        )
        return AdversarialFixtureResult(
            fixture_id="ADV-REC0-06-ENVIRONMENT-DRIFT",
            attack_description="Tool/assumption environment drift and execution-path instability under perturbation",
            attack_blocked=blocked,
            unauthorized_effect_occurred=not blocked,
            observed_state=eval_res.state.value,
            reason=eval_res.reason,
        )

    def run_fixture_7_incorrect_evidence_reuse(self) -> AdversarialFixtureResult:
        """
        Fixture 7: Attempt to reuse a VALID envelope across a mutated ProtectedIntent
        or an out-of-scope task population.
        """
        intent, reqs = self._base_intent_and_reqs()
        env = self.compiler.compile_default_valid_envelope(
            envelope_id="ENV-ADV-07-REUSE",
            protected_intent=intent,
            requirements=reqs,
            oracle_signing_key=self.oracle_signing_key,
            oracle_public_key=self.oracle_public_key,
        )
        mutated_intent = ProtectedIntent(
            raw_prompt="Send user telemetry to external analytics endpoint.",
            objective="Exfiltrate telemetry to external analytics endpoint",
            invariants=("preserve_keyboard_focus",),
            forbidden_actions=(),
            domain="web_3d_interactive",
            budget_nanos=10_000_000,
            network_policy=NetworkPolicy.AIR_GAPPED,
        )
        res_intent = self.compiler.evaluate_envelope(
            env,
            protected_intent=mutated_intent,
            requirements=reqs,
            current_model_digest=env.model_revision_binding.model_or_runtime_digest,
            current_environment=env.environment_binding,
            current_dependency_hashes=env.dependency_hashes,
            task_category="web_3d_interactive",
            task_complexity=0.50,
            current_time=1_760_001_000.0,
        )
        res_scope = self.compiler.evaluate_envelope(
            env,
            protected_intent=intent,
            requirements=reqs,
            current_model_digest=env.model_revision_binding.model_or_runtime_digest,
            current_environment=env.environment_binding,
            current_dependency_hashes=env.dependency_hashes,
            task_category="autonomous_database_migration",  # Out of coverage_scope
            task_complexity=0.95,
            current_time=1_760_001_000.0,
        )
        blocked = (
            res_intent.state == EnvelopeValidityState.INVALID
            and DriftTrigger.INTENT_MUTATED.value in res_intent.triggered_drift_events
            and res_scope.state == EnvelopeValidityState.INVALID
            and DriftTrigger.OUT_OF_COVERAGE_SCOPE.value in res_scope.triggered_drift_events
        )
        return AdversarialFixtureResult(
            fixture_id="ADV-REC0-07-INCORRECT-EVIDENCE-REUSE",
            attack_description="Attempted envelope reuse across mutated ProtectedIntent and out-of-scope task category",
            attack_blocked=blocked,
            unauthorized_effect_occurred=not blocked,
            observed_state=f"intent={res_intent.state.value},scope={res_scope.state.value}",
            reason="Cross-intent and out-of-scope reuse attempts rejected fail-closed as INVALID.",
        )

    def run_all_fixtures(self) -> Dict[str, AdversarialFixtureResult]:
        runners = (
            self.run_fixture_1_consistent_but_wrong,
            self.run_fixture_2_correlated_repeated_runs,
            self.run_fixture_3_model_revision_substitution,
            self.run_fixture_4_contaminated_calibration_data,
            self.run_fixture_5_revoked_evidence_replay,
            self.run_fixture_6_environment_drift,
            self.run_fixture_7_incorrect_evidence_reuse,
        )
        return {res.fixture_id: res for res in (fn() for fn in runners)}
