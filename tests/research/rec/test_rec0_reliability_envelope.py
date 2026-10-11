"""
SPE Ω — REC-0: Reliability Envelope Compiler Comprehensive TDD Test Suite.

Covers:
- Task 1: 12-field ReliabilityEnvelope schema, 4-state ValidityStateMachine, CalibratedRiskEstimator.
- Task 2: CostRiskExecutionSelector constrained optimization across 5 ExecutionActions.
- Task 3: All 7 mandatory adversarial qualification fixtures.
- Task 4: Preregistered 5-stage experiment across 5 required baselines, 8 qualification gates,
  mandatory global-shift negative control, Stage 5 deterministic reproduction, and
  cross-runtime conformance (Python / Rust / WASM).
- Task 5: 7-view differentiating user experience interface (3D scrolling website + animation delta)
  and CLI runner.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Tuple
import pytest

from spe_runtime.authority import AuthorityGrant
from spe_runtime.ci_gate.receipt import generate_keypair
from spe_runtime.prompt.meta_compiler import ProtectedIntent
from spe_runtime.provenance.models import Provenance
from spe_runtime.requirements.models import RequirementAtom, RequirementKind
from spe_runtime.research.csc.models import NetworkPolicy
from spe_runtime.research.lvt.learning_validator import (
    LearningValidator,
    create_owner_validator_attestation,
)
from spe_runtime.research.rec import (
    AdversarialQualificationSuite,
    AuthorizedStrategyCandidate,
    CalibratedRiskEstimator,
    CostRiskExecutionSelector,
    CoverageScope,
    DatasetCommitment,
    DependencyHashes,
    DriftTrigger,
    EnvironmentBinding,
    EnvelopeValidityState,
    EvaluatorBinding,
    ExecutionAction,
    IndependentOutcomeEvaluator,
    ModelRevisionBinding,
    ObservedSuccessMetrics,
    PreregisteredExperimentProtocol,
    REC0ExperimentRunner,
    ReliabilityEnvelope,
    ReliabilityEnvelopeCompiler,
    explain_rec0_audit_and_ux,
    reproduce_rec0_experiment,
)
from spe_runtime.research.rec.cli import run_rec0_cli


@pytest.fixture()
def rec_crypto_context(tmp_path: Path):
    """Provides a clean owner-attested LearningValidator and independent oracle keypair."""
    LearningValidator.clear_owner_registries()
    tombstone_file = tmp_path / "rec0_tombstones.jsonl"
    LearningValidator.set_tombstone_store_path(tombstone_file)

    owner_sk, owner_pk = generate_keypair()
    val_sk, val_pk = generate_keypair()
    oracle_sk, oracle_pk = generate_keypair()

    LearningValidator.register_owner_root_key(owner_pk)
    owner_att = create_owner_validator_attestation(
        owner_signing_key=owner_sk,
        owner_public_key=owner_pk,
        validator_public_key=val_pk,
    )
    validator = LearningValidator(
        default_signing_key=val_sk,
        default_public_key=val_pk,
        trusted_oracles={"oracle-rec0-independent": oracle_pk.hex()},
        owner_root_public_key=owner_pk,
        owner_attestation=owner_att,
        require_cryptographic_owner_authority=True,
    )
    yield {
        "validator": validator,
        "owner_sk": owner_sk,
        "owner_pk": owner_pk,
        "val_sk": val_sk,
        "val_pk": val_pk,
        "oracle_sk": oracle_sk,
        "oracle_pk": oracle_pk,
        "tombstone_file": tombstone_file,
    }
    LearningValidator.set_tombstone_store_path(None)
    LearningValidator.clear_owner_registries()


def _sample_protected_intent_and_reqs() -> Tuple[ProtectedIntent, Tuple[RequirementAtom, ...]]:
    intent = ProtectedIntent(
        raw_prompt="Build a premium 3D scrolling website from reference URL with mobile, keyboard nav, and fast load.",
        objective="Build verified 3D scrolling web experience with responsive mobile fallback and keyboard navigation",
        invariants=("preserve_keyboard_focus_order", "enforce_mobile_single_column_fallback", "respect_prefers_reduced_motion"),
        forbidden_actions=("unapproved_external_network_egress", "mutate_protected_intent"),
        domain="web_3d_interactive",
        budget_nanos=50_000_000,
        network_policy=NetworkPolicy.AIR_GAPPED,
    )
    reqs = (
        RequirementAtom.create(
            semantic_key="responsive.mobile_viewport",
            kind=RequirementKind.MUST,
            value="100dvh_single_column_fallback",
            provenance=Provenance.USER_EXPLICIT,
        ),
        RequirementAtom.create(
            semantic_key="a11y.keyboard_navigation",
            kind=RequirementKind.MUST,
            value="wcag_2_1_aa_focus_ring_and_tab_order",
            provenance=Provenance.USER_EXPLICIT,
        ),
        RequirementAtom.create(
            semantic_key="perf.frame_budget",
            kind=RequirementKind.MUST,
            value="gpu_transform_opacity_60fps",
            provenance=Provenance.USER_EXPLICIT,
        ),
    )
    return intent, reqs


# ============================================================================
# TASK 1: Reliability Envelope Schema, Validity-State Machine & Risk Estimator
# ============================================================================


def test_task1_reliability_envelope_12_mandatory_fields_and_cryptographic_custody(rec_crypto_context):
    compiler = ReliabilityEnvelopeCompiler(validator=rec_crypto_context["validator"])
    intent, reqs = _sample_protected_intent_and_reqs()

    envelope = compiler.compile_envelope(
        envelope_id="ENV-REC0-3D-WEB-001",
        protected_intent=intent,
        requirements=reqs,
        model_id="spe-verified-coder-v2",
        model_or_runtime_digest=hashlib.sha256(b"verified-weights-manifest-2026-10-11-rc1").hexdigest(),
        model_digest_type="VERIFIED_MODEL_REVISION",
        environment_binding=EnvironmentBinding(
            runtime_id="spe-local-deterministic-v1",
            tool_permissions=("ast_verify", "layout_check"),
            network_policy=NetworkPolicy.AIR_GAPPED.value,
            schema_version="spe.rec.v0",
            assumption_predicates={"dom_api": "v2", "webgl_fallback": True},
        ),
        oracle_id="oracle-rec0-independent",
        oracle_class="independent_reality_witness",
        oracle_signing_key=rec_crypto_context["oracle_sk"],
        oracle_public_key=rec_crypto_context["oracle_pk"],
        dataset_commitment=DatasetCommitment.create_verified(
            dataset_id="DATASET-3D-WEB-CALIB-V1",
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
            task_category="web_3d_interactive",
            domain="web_3d_interactive",
            max_complexity_score=0.85,
            supported_perturbation_radius=0.15,
            eligible_input_predicates=("responsive_layout", "keyboard_nav", "scroll_animation"),
        ),
        dependency_hashes=DependencyHashes(
            rbpd_asset_hashes=(hashlib.sha256(b"rbpd-asset-01").hexdigest(),),
            causal_proof_slice_digest=hashlib.sha256(b"proof-slice-01").hexdigest(),
            obligation_hypergraph_digest=hashlib.sha256(b"hypergraph-01").hexdigest(),
        ),
        alpha=0.10,
        committed_timestamp=1_760_000_000.0,
        validity_horizon=1_765_000_000.0,
    )

    payload = envelope.to_dict()
    mandatory_12_fields = (
        "intent_digest",
        "requirement_set_digest",
        "model_revision_binding",
        "environment_binding",
        "evaluator_binding",
        "dataset_commitment",
        "observed_success",
        "risk_bound",
        "coverage_scope",
        "dependency_hashes",
        "drift_triggers",
        "revocation_reference",
    )
    for field_name in mandatory_12_fields:
        assert field_name in payload, f"Missing mandatory envelope field: {field_name}"

    assert envelope.intent_digest == intent.intent_digest
    assert envelope.risk_bound is not None and 0.0 < envelope.risk_bound < 0.10
    assert envelope.revocation_reference == "tx:ENV-REC0-3D-WEB-001"

    eval_res = compiler.evaluate_envelope(
        envelope,
        protected_intent=intent,
        requirements=reqs,
        current_model_digest=envelope.model_revision_binding.model_or_runtime_digest,
        current_environment=envelope.environment_binding,
        current_dependency_hashes=envelope.dependency_hashes,
        task_category="web_3d_interactive",
        task_complexity=0.70,
        perturbation_magnitude=0.05,
        current_time=1_760_001_000.0,
    )
    assert eval_res.state == EnvelopeValidityState.VALID
    assert eval_res.can_reuse is True


def test_task1_missing_risk_bound_or_verbal_confidence_remains_unknown(rec_crypto_context):
    # Verbal confidence or unverified agreement must never manufacture a numeric risk bound
    est_verbal = CalibratedRiskEstimator.estimate_risk_bound(
        observed_success=ObservedSuccessMetrics(
            n_tasks=25,
            k_runs_per_task=5,
            n_all_runs_passed_tasks=25,
            per_run_pass_rate=1.0,
            all_runs_pass_rate=1.0,
            execution_path_stability=0.95,
            inter_run_correlation=0.0,
            independent_oracle_verified=False,  # NOT independently verified!
            verbal_confidence=0.999,
            multi_agent_agreement_rate=1.0,
        ),
        dataset_commitment=DatasetCommitment.create_verified("DS-UNVERIFIED", 25, 1),
        alpha=0.05,
    )
    assert est_verbal.risk_bound is None
    assert est_verbal.epistemic_state == EnvelopeValidityState.UNKNOWN
    assert "independent" in est_verbal.reason.lower() or "verbal" in est_verbal.reason.lower()


def test_task1_clopper_pearson_and_correlation_aware_risk_bounds():
    # With 24 independent families and 0 failures at alpha=0.10:
    # Exact Clopper-Pearson UCB = 1 - 0.10^(1/24) = 0.09148...
    ucb_zero_fail = CalibratedRiskEstimator.clopper_pearson_upper_bound(
        failures=0, n_families=24, alpha=0.10
    )
    assert 0.091 < ucb_zero_fail < 0.092

    # With 5 failures out of 24 families at alpha=0.05, UCB > 0.38
    ucb_five_fail = CalibratedRiskEstimator.clopper_pearson_upper_bound(
        failures=5, n_families=24, alpha=0.05
    )
    assert ucb_five_fail > 0.38

    # Correlation-aware repeated risk:
    # If p1 = 0.20, k = 5, and correlation rho = 0.90 (common-mode bias),
    # naive independence gives 0.20^5 = 0.00032, whereas correlation-aware gives >= 0.18!
    corr_risk = CalibratedRiskEstimator.correlated_repeated_risk_bound(
        per_run_failure_bound=0.20,
        k_runs=5,
        inter_run_correlation=0.90,
    )
    assert corr_risk > 0.18


# ============================================================================
# TASK 2: Cost–Risk Execution Selector
# ============================================================================


def test_task2_selector_reuses_deterministic_procedure_without_multi_model_debate(rec_crypto_context):
    compiler = ReliabilityEnvelopeCompiler(validator=rec_crypto_context["validator"])
    intent, reqs = _sample_protected_intent_and_reqs()
    envelope = compiler.compile_default_valid_envelope(
        envelope_id="ENV-DET-01",
        protected_intent=intent,
        requirements=reqs,
        oracle_signing_key=rec_crypto_context["oracle_sk"],
        oracle_public_key=rec_crypto_context["oracle_pk"],
    )

    selector = CostRiskExecutionSelector(compiler=compiler)
    candidates = (
        AuthorizedStrategyCandidate(
            strategy_id="strat-deterministic-reuse",
            action=ExecutionAction.REUSE_DETERMINISTIC_PROCEDURE,
            expected_cost_nanos=200,
            estimated_risk_upper_bound=envelope.risk_bound,
            is_deterministic_procedure=True,
            requires_cloud_egress=False,
        ),
        AuthorizedStrategyCandidate(
            strategy_id="strat-single-model",
            action=ExecutionAction.EXECUTE_SELECTED_MODEL,
            expected_cost_nanos=50_000,
            estimated_risk_upper_bound=0.095,
            is_deterministic_procedure=False,
            requires_cloud_egress=False,
        ),
        AuthorizedStrategyCandidate(
            strategy_id="strat-multi-agent-debate",
            action=ExecutionAction.EXECUTE_WITH_INDEPENDENT_VERIFICATION,
            expected_cost_nanos=250_000,
            estimated_risk_upper_bound=0.08,
            is_deterministic_procedure=False,
            requires_cloud_egress=False,
        ),
    )

    decision = selector.select_execution_strategy(
        protected_intent=intent,
        requirements=reqs,
        envelope=envelope,
        candidates=candidates,
        risk_tolerance_tau=0.10,
        current_model_digest=envelope.model_revision_binding.model_or_runtime_digest,
        current_environment=envelope.environment_binding,
        current_dependency_hashes=envelope.dependency_hashes,
        task_category="web_3d_interactive",
        task_complexity=0.65,
        perturbation_magnitude=0.02,
        current_time=1_760_001_000.0,
    )

    assert decision.selected_action == ExecutionAction.REUSE_DETERMINISTIC_PROCEDURE
    assert decision.selected_strategy_id == "strat-deterministic-reuse"
    assert decision.expected_cost_nanos == 200
    assert decision.envelope_state == EnvelopeValidityState.VALID


def test_task2_selector_adds_independent_verification_or_escalates_or_abstains(rec_crypto_context):
    compiler = ReliabilityEnvelopeCompiler(validator=rec_crypto_context["validator"])
    intent, reqs = _sample_protected_intent_and_reqs()
    envelope = compiler.compile_default_valid_envelope(
        envelope_id="ENV-MOD-02",
        protected_intent=intent,
        requirements=reqs,
        oracle_signing_key=rec_crypto_context["oracle_sk"],
        oracle_public_key=rec_crypto_context["oracle_pk"],
    )
    selector = CostRiskExecutionSelector(compiler=compiler)

    # Mutate dependency hash to simulate a localized animation edit -> envelope becomes STALE
    mutated_deps = DependencyHashes(
        rbpd_asset_hashes=envelope.dependency_hashes.rbpd_asset_hashes,
        causal_proof_slice_digest=hashlib.sha256(b"mutated-animation-slice").hexdigest(),
        obligation_hypergraph_digest=envelope.dependency_hashes.obligation_hypergraph_digest,
    )

    candidates = (
        AuthorizedStrategyCandidate(
            strategy_id="strat-reuse-stale-det",
            action=ExecutionAction.REUSE_DETERMINISTIC_PROCEDURE,
            expected_cost_nanos=200,
            estimated_risk_upper_bound=0.05,
            is_deterministic_procedure=True,
        ),
        AuthorizedStrategyCandidate(
            strategy_id="strat-unverified-model",
            action=ExecutionAction.EXECUTE_SELECTED_MODEL,
            expected_cost_nanos=40_000,
            estimated_risk_upper_bound=0.18,  # Exceeds tau=0.10
        ),
        AuthorizedStrategyCandidate(
            strategy_id="strat-verified-selective-recheck",
            action=ExecutionAction.EXECUTE_WITH_INDEPENDENT_VERIFICATION,
            expected_cost_nanos=75_000,
            estimated_risk_upper_bound=0.04,  # Satisfies tau=0.10 via independent oracle check
            independent_verifier_bound=True,
        ),
    )

    decision_stale = selector.select_execution_strategy(
        protected_intent=intent,
        requirements=reqs,
        envelope=envelope,
        candidates=candidates,
        risk_tolerance_tau=0.10,
        current_model_digest=envelope.model_revision_binding.model_or_runtime_digest,
        current_environment=envelope.environment_binding,
        current_dependency_hashes=mutated_deps,
        task_category="web_3d_interactive",
        task_complexity=0.65,
        perturbation_magnitude=0.05,
        current_time=1_760_001_000.0,
    )
    # Because envelope is STALE, direct reuse is forbidden; selector chooses EXECUTE_WITH_INDEPENDENT_VERIFICATION
    assert decision_stale.envelope_state == EnvelopeValidityState.STALE
    assert decision_stale.selected_action == ExecutionAction.EXECUTE_WITH_INDEPENDENT_VERIFICATION
    assert len(decision_stale.generated_verification_obligations) > 0

    # Now test when NO automated strategy satisfies tau=0.01:
    # With human escalation authorized -> ESCALATE_TO_HUMAN
    decision_escalate = selector.select_execution_strategy(
        protected_intent=intent,
        requirements=reqs,
        envelope=envelope,
        candidates=candidates,
        risk_tolerance_tau=0.01,
        current_model_digest=envelope.model_revision_binding.model_or_runtime_digest,
        current_environment=envelope.environment_binding,
        current_dependency_hashes=mutated_deps,
        task_category="web_3d_interactive",
        task_complexity=0.65,
        perturbation_magnitude=0.05,
        current_time=1_760_001_000.0,
        human_escalation_authorized=True,
    )
    assert decision_escalate.selected_action == ExecutionAction.ESCALATE_TO_HUMAN

    # Without human escalation authorized -> ABSTAIN_INSUFFICIENT_QUALIFICATION
    decision_abstain = selector.select_execution_strategy(
        protected_intent=intent,
        requirements=reqs,
        envelope=envelope,
        candidates=candidates,
        risk_tolerance_tau=0.01,
        current_model_digest=envelope.model_revision_binding.model_or_runtime_digest,
        current_environment=envelope.environment_binding,
        current_dependency_hashes=mutated_deps,
        task_category="web_3d_interactive",
        task_complexity=0.65,
        perturbation_magnitude=0.05,
        current_time=1_760_001_000.0,
        human_escalation_authorized=False,
    )
    assert decision_abstain.selected_action == ExecutionAction.ABSTAIN_INSUFFICIENT_QUALIFICATION


# ============================================================================
# TASK 3: The 7 Mandatory Adversarial Qualification Fixtures
# ============================================================================


def test_task3_all_seven_adversarial_fixtures_pass_suite(rec_crypto_context):
    suite = AdversarialQualificationSuite(
        validator=rec_crypto_context["validator"],
        oracle_signing_key=rec_crypto_context["oracle_sk"],
        oracle_public_key=rec_crypto_context["oracle_pk"],
        tombstone_path=rec_crypto_context["tombstone_file"],
    )
    results = suite.run_all_fixtures()
    assert len(results) == 7

    expected_fixture_ids = {
        "ADV-REC0-01-CONSISTENT-BUT-WRONG",
        "ADV-REC0-02-CORRELATED-REPEATED-RUNS",
        "ADV-REC0-03-MODEL-REVISION-SUBSTITUTION",
        "ADV-REC0-04-CONTAMINATED-CALIBRATION",
        "ADV-REC0-05-REVOKED-EVIDENCE-REPLAY",
        "ADV-REC0-06-ENVIRONMENT-DRIFT",
        "ADV-REC0-07-INCORRECT-EVIDENCE-REUSE",
    }
    assert set(results.keys()) == expected_fixture_ids
    for fid, res in results.items():
        assert res.attack_blocked is True, f"Adversarial fixture {fid} failed to block attack: {res.reason}"
        assert res.unauthorized_effect_occurred is False


# ============================================================================
# TASK 4: 5-Stage Experiment, 5 Baselines, 8 Gates, Negative Control & Reproduction
# ============================================================================


def test_task4_five_baselines_comparison_and_eight_qualification_gates(rec_crypto_context):
    runner = REC0ExperimentRunner(
        validator=rec_crypto_context["validator"],
        oracle_signing_key=rec_crypto_context["oracle_sk"],
        oracle_public_key=rec_crypto_context["oracle_pk"],
    )
    report = runner.run_full_experiment()

    # Verify all 5 required baselines + SPE_REC0_ENVELOPE_COMPILER are evaluated
    required_systems = {
        "DIRECT_EXECUTION",
        "PROMPT_OPTIMIZED_GEPA",
        "REPEATED_MAJORITY_UNANIMOUS",
        "INDEPENDENT_VERIFIER_NO_REUSE",
        "FULL_REEXECUTION_NO_REUSE",
        "SPE_REC0_ENVELOPE_COMPILER",
    }
    assert set(report.baseline_metrics.keys()) == required_systems

    rec_metrics = report.baseline_metrics["SPE_REC0_ENVELOPE_COMPILER"]
    full_metrics = report.baseline_metrics["FULL_REEXECUTION_NO_REUSE"]
    unanimous_metrics = report.baseline_metrics["REPEATED_MAJORITY_UNANIMOUS"]
    direct_metrics = report.baseline_metrics["DIRECT_EXECUTION"]

    # 1. Quality & Repeatability: REC-0 all_runs_pass_rate (pass^5) is non-inferior to FULL_REEXECUTION_NO_REUSE
    # and strictly exceeds DIRECT_EXECUTION and REPEATED_MAJORITY_UNANIMOUS
    assert rec_metrics.verified_all_runs_pass_rate >= full_metrics.verified_all_runs_pass_rate - 1e-9
    assert rec_metrics.verified_all_runs_pass_rate > direct_metrics.verified_all_runs_pass_rate
    assert rec_metrics.verified_all_runs_pass_rate > unanimous_metrics.verified_all_runs_pass_rate

    # 2. Consistent-but-wrong trap: REPEATED_MAJORITY_UNANIMOUS and DIRECT_EXECUTION suffer false acceptances,
    # while SPE_REC0_ENVELOPE_COMPILER has 0.0 false acceptance rate
    assert unanimous_metrics.false_acceptance_rate > 0.0
    assert direct_metrics.false_acceptance_rate > 0.0
    assert rec_metrics.false_acceptance_rate == 0.0
    assert rec_metrics.false_stale_acceptances == 0

    # 3. Cost: >= 10x reduction in cost per verified outcome on eligible iterative workload (including lower 95% CI)
    # and point estimate must lie strictly within its 95% confidence interval
    assert report.cost_reduction_vs_full_reexecution >= 10.0
    assert report.cost_reduction_ci95_lower >= 10.0
    assert (
        report.cost_reduction_ci95_lower
        <= report.cost_reduction_vs_full_reexecution
        <= report.cost_reduction_ci95_upper
    )

    # 4. Coverage: abstentions and rejected tasks are counted in the denominator
    assert rec_metrics.total_submitted_tasks == full_metrics.total_submitted_tasks
    assert 0.0 <= rec_metrics.abstention_rate < 0.20

    # 5. All 8 qualification gates evaluated and passed in research simulator
    for gate_name in (
        "Quality",
        "Cost",
        "Repeatability",
        "Coverage",
        "Security",
        "Requalification",
        "Portability",
        "Independence",
    ):
        assert report.qualification_gates[gate_name]["passed"] is True, f"Gate {gate_name} failed"


def test_task4_mandatory_negative_control_global_shift_refuses_10x_claim(rec_crypto_context):
    runner = REC0ExperimentRunner(
        validator=rec_crypto_context["validator"],
        oracle_signing_key=rec_crypto_context["oracle_sk"],
        oracle_public_key=rec_crypto_context["oracle_pk"],
    )
    neg = runner.run_global_shift_negative_control()
    assert neg.reused_envelopes_count == 0
    assert neg.net_cost_advantage_claimed is False
    assert neg.claim_status == "NO_10X_CLAIMED_OUTSIDE_ELIGIBLE_ENVELOPE"


def test_task4_stage5_independent_reproduction_and_cross_runtime_conformance(rec_crypto_context):
    runner = REC0ExperimentRunner(
        validator=rec_crypto_context["validator"],
        oracle_signing_key=rec_crypto_context["oracle_sk"],
        oracle_public_key=rec_crypto_context["oracle_pk"],
    )
    report = runner.run_full_experiment()
    repro = reproduce_rec0_experiment(
        original_report=report,
        validator=rec_crypto_context["validator"],
        oracle_signing_key=rec_crypto_context["oracle_sk"],
        oracle_public_key=rec_crypto_context["oracle_pk"],
    )
    assert repro["reproduced_exact"] is True
    assert repro["evidence_commitment_match"] is True
    assert report.portability_report["all_runtimes_conform"] is True


# ============================================================================
# TASK 5: 7-View User Experience Interface & CLI
# ============================================================================


def test_task5_seven_view_user_experience_3d_website_and_animation_delta(rec_crypto_context):
    runner = REC0ExperimentRunner(
        validator=rec_crypto_context["validator"],
        oracle_signing_key=rec_crypto_context["oracle_sk"],
        oracle_public_key=rec_crypto_context["oracle_pk"],
    )
    report = runner.run_full_experiment()
    ux = explain_rec0_audit_and_ux(report)

    views = ux["spe_views"]
    for required_view in (
        "Intent",
        "Execution",
        "Validation",
        "Reliability",
        "Unresolved",
        "Recovery",
        "Cost",
    ):
        assert required_view in views, f"Missing required SPE UX view: {required_view}"

    # Verify selective slice reuse in Recovery view: only perf.frame_budget is re-verified
    assert views["Recovery"]["generated_verification_obligations"] == [
        "REQUALIFY_ON_DEPENDENCY_SLICE_CHANGED",
        "VERIFY_REQ:perf.frame_budget",
    ]
    assert len(views["Recovery"]["reused_proof_obligations"]) == 2

    # Verify separate PASS / FAIL / UNKNOWN reporting and held release gates
    epistemic_ledger = ux["epistemic_ledger"]
    assert "PASS" in epistemic_ledger
    assert "FAIL" in epistemic_ledger
    assert "UNKNOWN" in epistemic_ledger
    assert epistemic_ledger["UNKNOWN"]["G6_H_REAL_HUMAN_STUDY"] == "BLOCKED_HOLD"
    assert epistemic_ledger["UNKNOWN"]["PRODUCTION_QUALIFICATION"] == "HOLD"


def test_task5_cli_human_and_json_modes(monkeypatch):
    import sys

    human_out = run_rec0_cli([])
    assert "SPE Ω — RELIABILITY ENVELOPE COMPILER (REC-0)" in human_out
    assert "Intent" in human_out and "Reliability" in human_out and "Recovery" in human_out

    json_out = run_rec0_cli(["--json"])
    parsed = json.loads(json_out)
    assert "spe_views" in parsed
    assert "epistemic_ledger" in parsed
    assert parsed["experiment_summary"]["cost_reduction_vs_full_reexecution"] >= 10.0

    # Verify CLI also parses sys.argv[1:] when called as __main__ with argv=None
    monkeypatch.setattr(sys, "argv", ["spe-rec0", "--json"])
    parsed_main = json.loads(run_rec0_cli())
    assert parsed_main["experiment_summary"]["evidence_commitment_hash"] == parsed["experiment_summary"]["evidence_commitment_hash"]


# ============================================================================
# EXPLICIT EDGE-CASE & BOUNDARY TESTS
# ============================================================================


def test_edge_cases_clopper_pearson_and_risk_estimator_boundaries():
    assert CalibratedRiskEstimator.clopper_pearson_upper_bound(failures=20, n_families=20, alpha=0.05) == 1.0

    with pytest.raises(ValueError):
        CalibratedRiskEstimator.clopper_pearson_upper_bound(failures=-1, n_families=20, alpha=0.05)
    with pytest.raises(ValueError):
        CalibratedRiskEstimator.clopper_pearson_upper_bound(failures=21, n_families=20, alpha=0.05)
    with pytest.raises(ValueError):
        CalibratedRiskEstimator.clopper_pearson_upper_bound(failures=0, n_families=0, alpha=0.05)
    with pytest.raises(ValueError):
        CalibratedRiskEstimator.clopper_pearson_upper_bound(failures=0, n_families=20, alpha=0.0)
    with pytest.raises(ValueError):
        CalibratedRiskEstimator.clopper_pearson_upper_bound(failures=0, n_families=20, alpha=1.0)
    with pytest.raises(ValueError):
        CalibratedRiskEstimator.correlated_repeated_risk_bound(
            per_run_failure_bound=1.5, k_runs=5, inter_run_correlation=0.5
        )
    with pytest.raises(ValueError):
        CalibratedRiskEstimator.correlated_repeated_risk_bound(
            per_run_failure_bound=0.2, k_runs=0, inter_run_correlation=0.5
        )
    with pytest.raises(ValueError):
        CalibratedRiskEstimator.correlated_repeated_risk_bound(
            per_run_failure_bound=0.2, k_runs=5, inter_run_correlation=-0.1
        )

    # Insufficient calibrated tasks (< 20) -> UNKNOWN
    ds_valid = DatasetCommitment.create_verified("DS-EDGE", 24, 1)
    est_few = CalibratedRiskEstimator.estimate_risk_bound(
        observed_success=ObservedSuccessMetrics(
            n_tasks=12,
            k_runs_per_task=5,
            n_all_runs_passed_tasks=12,
            per_run_pass_rate=1.0,
            all_runs_pass_rate=1.0,
            execution_path_stability=0.95,
            inter_run_correlation=0.0,
            independent_oracle_verified=True,
        ),
        dataset_commitment=ds_valid,
    )
    assert est_few.epistemic_state == EnvelopeValidityState.UNKNOWN
    assert est_few.risk_bound is None

    # Proportional failure scaling when n_tasks (100) > n_families (24) and 76/100 tasks fail:
    # Must NOT clamp n_passed to 24 (0 failures); must reflect ~76% failure rate (UCB > 0.85)
    est_many_tasks_failed = CalibratedRiskEstimator.estimate_risk_bound(
        observed_success=ObservedSuccessMetrics(
            n_tasks=100,
            k_runs_per_task=5,
            n_all_runs_passed_tasks=24,
            per_run_pass_rate=0.35,
            all_runs_pass_rate=0.24,
            execution_path_stability=0.95,
            inter_run_correlation=0.1,
            independent_oracle_verified=True,
        ),
        dataset_commitment=ds_valid,
        alpha=0.10,
    )
    assert est_many_tasks_failed.epistemic_state == EnvelopeValidityState.VALID
    assert est_many_tasks_failed.risk_bound is not None and est_many_tasks_failed.risk_bound > 0.85

    # Contradictory metrics (all_runs_pass_rate > per_run_pass_rate) -> INVALID
    est_contradictory = CalibratedRiskEstimator.estimate_risk_bound(
        observed_success=ObservedSuccessMetrics(
            n_tasks=24,
            k_runs_per_task=5,
            n_all_runs_passed_tasks=24,
            per_run_pass_rate=0.20,
            all_runs_pass_rate=1.0,
            execution_path_stability=0.95,
            inter_run_correlation=0.1,
            independent_oracle_verified=True,
        ),
        dataset_commitment=ds_valid,
    )
    assert est_contradictory.epistemic_state == EnvelopeValidityState.INVALID
    assert est_contradictory.risk_bound is None


def test_edge_cases_envelope_tamper_self_certification_and_horizon(rec_crypto_context):
    compiler = ReliabilityEnvelopeCompiler(validator=rec_crypto_context["validator"])
    intent, reqs = _sample_protected_intent_and_reqs()

    with pytest.raises(ValueError):
        compiler.compute_requirement_set_digest(())

    # Self-certifying oracle_id == model_id rejected at compile time
    with pytest.raises(ValueError, match="Self-certification"):
        compiler.compile_default_valid_envelope(
            envelope_id="ENV-SELF-CERT",
            protected_intent=intent,
            requirements=reqs,
            oracle_signing_key=rec_crypto_context["oracle_sk"],
            oracle_public_key=rec_crypto_context["oracle_pk"],
            model_id="same-id",
            oracle_id="same-id",
        )

    env = compiler.compile_default_valid_envelope(
        envelope_id="ENV-TAMPER-TEST",
        protected_intent=intent,
        requirements=reqs,
        oracle_signing_key=rec_crypto_context["oracle_sk"],
        oracle_public_key=rec_crypto_context["oracle_pk"],
    )

    # Expired validity horizon -> STALE (HORIZON_EXPIRED)
    res_expired = compiler.evaluate_envelope(
        env,
        protected_intent=intent,
        requirements=reqs,
        current_model_digest=env.model_revision_binding.model_or_runtime_digest,
        current_environment=env.environment_binding,
        current_dependency_hashes=env.dependency_hashes,
        task_category="web_3d_interactive",
        task_complexity=0.50,
        current_time=env.validity_horizon + 10.0,
    )
    assert res_expired.state == EnvelopeValidityState.STALE
    assert DriftTrigger.HORIZON_EXPIRED.value in res_expired.triggered_drift_events

    # Tampered signature -> INVALID
    tampered_sig_env = ReliabilityEnvelope(
        **{
            **env.__dict__,
            "signature": "0" * 128,
        }
    )
    res_tampered = compiler.evaluate_envelope(
        tampered_sig_env,
        protected_intent=intent,
        requirements=reqs,
        current_model_digest=env.model_revision_binding.model_or_runtime_digest,
        current_environment=env.environment_binding,
        current_dependency_hashes=env.dependency_hashes,
        task_category="web_3d_interactive",
        task_complexity=0.50,
        current_time=1_760_001_000.0,
    )
    assert res_tampered.state == EnvelopeValidityState.INVALID


def test_edge_cases_selector_budget_privacy_authority_grant_and_revoked_envelope(rec_crypto_context):
    compiler = ReliabilityEnvelopeCompiler(validator=rec_crypto_context["validator"])
    selector = CostRiskExecutionSelector(compiler=compiler)
    intent, reqs = _sample_protected_intent_and_reqs()
    env = compiler.compile_default_valid_envelope(
        envelope_id="ENV-SEL-EDGE",
        protected_intent=intent,
        requirements=reqs,
        oracle_signing_key=rec_crypto_context["oracle_sk"],
        oracle_public_key=rec_crypto_context["oracle_pk"],
    )

    revoked_grant = AuthorityGrant(
        grant_id="GRANT-REVOKED-01",
        principal="validator:test",
        capability="EXEC",
        target="spe",
        argument_constraints={},
        purpose="test",
        issued_at="2026-10-11T00:00:00Z",
        expires_at="2027-10-11T00:00:00Z",
        use_limit=10,
        revocation_state="REVOKED",
    )

    candidates = (
        AuthorizedStrategyCandidate(
            strategy_id="over-budget",
            action=ExecutionAction.EXECUTE_SELECTED_MODEL,
            expected_cost_nanos=intent.budget_nanos + 1,
            estimated_risk_upper_bound=0.01,
        ),
        AuthorizedStrategyCandidate(
            strategy_id="cloud-egress-on-airgapped",
            action=ExecutionAction.EXECUTE_SELECTED_MODEL,
            expected_cost_nanos=1_000,
            estimated_risk_upper_bound=0.01,
            requires_cloud_egress=True,
        ),
        AuthorizedStrategyCandidate(
            strategy_id="revoked-grant-cand",
            action=ExecutionAction.EXECUTE_SELECTED_MODEL,
            expected_cost_nanos=1_000,
            estimated_risk_upper_bound=0.01,
            authority_grant=revoked_grant,
        ),
    )

    decision = selector.select_execution_strategy(
        protected_intent=intent,
        requirements=reqs,
        envelope=env,
        candidates=candidates,
        risk_tolerance_tau=0.10,
        current_model_digest=env.model_revision_binding.model_or_runtime_digest,
        current_environment=env.environment_binding,
        current_dependency_hashes=env.dependency_hashes,
        task_category="web_3d_interactive",
        task_complexity=0.50,
        current_time=1_760_001_000.0,
        human_escalation_authorized=False,
    )
    assert decision.selected_action == ExecutionAction.ABSTAIN_INSUFFICIENT_QUALIFICATION
    assert "over-budget" in decision.rejected_candidates
    assert "cloud-egress-on-airgapped" in decision.rejected_candidates
    assert "revoked-grant-cand" in decision.rejected_candidates


def test_edge_cases_untrusted_validator_key_risk_floor_and_compositional_envelopes(rec_crypto_context):
    from spe_runtime.ci_gate.receipt import ed25519_sign, rfc8785_canonicalize

    compiler = ReliabilityEnvelopeCompiler(validator=rec_crypto_context["validator"])
    selector = CostRiskExecutionSelector(compiler=compiler)
    intent, reqs = _sample_protected_intent_and_reqs()

    env = compiler.compile_default_valid_envelope(
        envelope_id="ENV-TRUST-ROOT-01",
        protected_intent=intent,
        requirements=reqs,
        oracle_signing_key=rec_crypto_context["oracle_sk"],
        oracle_public_key=rec_crypto_context["oracle_pk"],
    )

    # 1. Forged envelope signed by an arbitrary unattested attacker Ed25519 keypair must be rejected as INVALID
    attacker_sk, attacker_pk = generate_keypair()
    unsigned_forged = ReliabilityEnvelope(
        **{
            **env.__dict__,
            "validator_public_key": attacker_pk.hex(),
            "receipt_hash": "",
            "signature": "",
        }
    )
    forged_bytes = rfc8785_canonicalize(unsigned_forged.canonical_payload_dict())
    forged_hash = hashlib.sha256(forged_bytes).hexdigest()
    forged_sig = ed25519_sign(attacker_sk, attacker_pk, forged_bytes).hex()
    forged_env = ReliabilityEnvelope(
        **{
            **unsigned_forged.__dict__,
            "receipt_hash": forged_hash,
            "signature": forged_sig,
        }
    )
    res_forged = compiler.evaluate_envelope(
        forged_env,
        protected_intent=intent,
        requirements=reqs,
        current_model_digest=env.model_revision_binding.model_or_runtime_digest,
        current_environment=env.environment_binding,
        current_dependency_hashes=env.dependency_hashes,
        task_category="web_3d_interactive",
        task_complexity=0.50,
        current_time=1_760_001_000.0,
    )
    assert res_forged.state == EnvelopeValidityState.INVALID
    assert res_forged.can_reuse is False

    # 2. Envelope with tampered risk_bound (even if re-signed by valid validator) must be rejected as INVALID
    unsigned_bad_risk = ReliabilityEnvelope(
        **{
            **env.__dict__,
            "risk_bound": 0.0001,
            "receipt_hash": "",
            "signature": "",
        }
    )
    bad_risk_bytes = rfc8785_canonicalize(unsigned_bad_risk.canonical_payload_dict())
    bad_risk_env = ReliabilityEnvelope(
        **{
            **unsigned_bad_risk.__dict__,
            "receipt_hash": hashlib.sha256(bad_risk_bytes).hexdigest(),
            "signature": ed25519_sign(
                rec_crypto_context["val_sk"], rec_crypto_context["val_pk"], bad_risk_bytes
            ).hex(),
        }
    )
    res_bad_risk = compiler.evaluate_envelope(
        bad_risk_env,
        protected_intent=intent,
        requirements=reqs,
        current_model_digest=env.model_revision_binding.model_or_runtime_digest,
        current_environment=env.environment_binding,
        current_dependency_hashes=env.dependency_hashes,
        task_category="web_3d_interactive",
        task_complexity=0.50,
        current_time=1_760_001_000.0,
    )
    assert res_bad_risk.state == EnvelopeValidityState.INVALID

    # 3. Candidate relying on envelope cannot fabricate risk_bound=0.01 lower than envelope.risk_bound (0.091483)
    # when tau=0.05 < envelope.risk_bound
    decision_floor = selector.select_execution_strategy(
        protected_intent=intent,
        requirements=reqs,
        envelope=env,
        candidates=(
            AuthorizedStrategyCandidate(
                strategy_id="fabricated-low-risk-reuse",
                action=ExecutionAction.REUSE_DETERMINISTIC_PROCEDURE,
                expected_cost_nanos=500,
                estimated_risk_upper_bound=0.01,  # Lower than env.risk_bound = 0.091483!
                is_deterministic_procedure=True,
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
    assert decision_floor.selected_action == ExecutionAction.ABSTAIN_INSUFFICIENT_QUALIFICATION
    assert "fabricated-low-risk-reuse" in decision_floor.rejected_candidates

    # 4. Compositional multi-hop envelope chain: downstream envelope transitions to STALE when upstream expires,
    # and INVALID when upstream is revoked
    downstream_deps = DependencyHashes(
        rbpd_asset_hashes=env.dependency_hashes.rbpd_asset_hashes,
        causal_proof_slice_digest=env.dependency_hashes.causal_proof_slice_digest,
        obligation_hypergraph_digest=env.dependency_hashes.obligation_hypergraph_digest,
        requirement_slice_hashes=env.dependency_hashes.requirement_slice_hashes,
        parent_envelope_hashes=(env.receipt_hash,),
    )
    downstream_env = compiler.compile_envelope(
        envelope_id="ENV-DOWNSTREAM-01",
        protected_intent=intent,
        requirements=reqs,
        model_id=env.model_revision_binding.model_id,
        model_or_runtime_digest=env.model_revision_binding.model_or_runtime_digest,
        model_digest_type="VERIFIED_MODEL_REVISION",
        environment_binding=env.environment_binding,
        oracle_id=env.evaluator_binding.oracle_id,
        oracle_class=env.evaluator_binding.oracle_class,
        oracle_signing_key=rec_crypto_context["oracle_sk"],
        oracle_public_key=rec_crypto_context["oracle_pk"],
        dataset_commitment=env.dataset_commitment,
        observed_success=env.observed_success,
        coverage_scope=env.coverage_scope,
        dependency_hashes=downstream_deps,
        committed_timestamp=1_760_000_000.0,
        validity_horizon=1_770_000_000.0,
    )
    # Valid when upstream is valid at current_time=1_760_001_000.0
    res_chain_valid = compiler.evaluate_envelope(
        downstream_env,
        protected_intent=intent,
        requirements=reqs,
        current_model_digest=downstream_env.model_revision_binding.model_or_runtime_digest,
        current_environment=downstream_env.environment_binding,
        current_dependency_hashes=downstream_deps,
        task_category="web_3d_interactive",
        task_complexity=0.50,
        current_time=1_760_001_000.0,
        upstream_envelopes=(env,),
    )
    assert res_chain_valid.state == EnvelopeValidityState.VALID

    # STALE when upstream horizon (1_765_000_000.0) has expired even though downstream horizon (1_770_000_000.0) has not
    res_chain_stale = compiler.evaluate_envelope(
        downstream_env,
        protected_intent=intent,
        requirements=reqs,
        current_model_digest=downstream_env.model_revision_binding.model_or_runtime_digest,
        current_environment=downstream_env.environment_binding,
        current_dependency_hashes=downstream_deps,
        task_category="web_3d_interactive",
        task_complexity=0.50,
        current_time=1_766_000_000.0,
        upstream_envelopes=(env,),
    )
    assert res_chain_stale.state == EnvelopeValidityState.STALE
    assert DriftTrigger.DEPENDENCY_SLICE_CHANGED.value in res_chain_stale.triggered_drift_events

    # INVALID when upstream envelope is tombstoned
    compiler.revoke_envelope(env, reason="UPSTREAM_REVOKED")
    res_chain_revoked = compiler.evaluate_envelope(
        downstream_env,
        protected_intent=intent,
        requirements=reqs,
        current_model_digest=downstream_env.model_revision_binding.model_or_runtime_digest,
        current_environment=downstream_env.environment_binding,
        current_dependency_hashes=downstream_deps,
        task_category="web_3d_interactive",
        task_complexity=0.50,
        current_time=1_760_001_000.0,
        upstream_envelopes=(env,),
    )
    assert res_chain_revoked.state == EnvelopeValidityState.INVALID
    assert DriftTrigger.TOMBSTONE_REVOKED.value in res_chain_revoked.triggered_drift_events


