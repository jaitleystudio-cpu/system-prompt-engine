"""
SPE Ω — REC-1: Counterfactual Reality Transfer & Statistical Soundness TDD Suite.

Covers:
1. P0 Mathematical Counterexample (Defect REC-F01):
   Pairwise correlation rho = 0 does NOT imply mutual independence for k >= 3.
   Ternary counterexample: (1,1,1), (1,0,0), (0,1,0), (0,0,1) with p=0.5, rho=0,
   where true joint failure P(all fail) = 0.25 vs mixture formula (1-rho)*p^k + rho*p = 0.125.
   Estimator MUST compute sound Fréchet copula bounds or empirical joint Clopper-Pearson bounds.

2. P0 Evidence-Origin Firewall (Defect REC-F02):
   Synthetic datasets (prefix 'synth-', is_synthetic=True, or EvidenceOrigin.SYNTHETIC_FIXTURE)
   MUST NOT acquire EnvelopeValidityState.VALID for production execution;
   MUST evaluate to EnvelopeValidityState.SYNTHETIC_CALIBRATION_ONLY.

3. P0 Selector Firewall (Defect REC-F03):
   CostRiskExecutionSelector MUST reject deterministic procedure reuse or model execution
   for SYNTHETIC_FIXTURE envelopes in production mode (allow_synthetic_calibration_execution=False).

4. P1 Counterfactual Reality Transfer:
   Detects target reality drift via counterfactual witness search and transitions
   envelope to STALE.

5. P1 Metric Separation:
   Joint failure P(all fail) vs pass^k (all succeed) vs pass@k (at least one succeeds)
   are explicitly separated and bounded.
"""

from __future__ import annotations

import hashlib
from pathlib import Path
from typing import Tuple
import pytest

from spe_runtime.ci_gate.receipt import generate_keypair
from spe_runtime.prompt.meta_compiler import ProtectedIntent
from spe_runtime.provenance.models import Provenance
from spe_runtime.requirements.models import RequirementAtom, RequirementKind
from spe_runtime.research.csc.models import NetworkPolicy
from spe_runtime.research.lvt.learning_validator import (
    LearningValidator,
    create_owner_validator_attestation,
)
from spe_runtime.research.rec.envelope import (
    CalibratedRiskEstimator,
    CoverageScope,
    DatasetCommitment,
    DependencyHashes,
    EnvironmentBinding,
    EnvelopeValidityState,
    EvidenceOrigin,
    ObservedSuccessMetrics,
    ReliabilityEnvelopeCompiler,
)
from spe_runtime.research.rec.selector import (
    AuthorizedStrategyCandidate,
    CostRiskExecutionSelector,
    ExecutionAction,
)


@pytest.fixture()
def rec1_crypto_context(tmp_path: Path):
    LearningValidator.clear_owner_registries()
    tombstone_path = tmp_path / "rec1_tombstones.jsonl"
    LearningValidator.set_tombstone_store_path(tombstone_path)

    owner_sk, owner_pk = generate_keypair()
    validator_sk, validator_pk = generate_keypair()
    oracle_sk, oracle_pk = generate_keypair()

    LearningValidator.register_owner_root_key(owner_pk)
    owner_att = create_owner_validator_attestation(
        owner_signing_key=owner_sk,
        owner_public_key=owner_pk,
        validator_public_key=validator_pk,
    )

    validator = LearningValidator(
        default_signing_key=validator_sk,
        default_public_key=validator_pk,
        trusted_oracles={"oracle-rec0-independent": oracle_pk.hex()},
        owner_root_public_key=owner_pk,
        owner_attestation=owner_att,
        require_cryptographic_owner_authority=True,
    )
    compiler = ReliabilityEnvelopeCompiler(validator=validator)

    intent = ProtectedIntent(
        raw_prompt="Execute counterfactual reality transfer with sound risk bounds",
        objective="Execute counterfactual reality transfer with sound risk bounds",
        invariants=("zero_data_loss", "air_gapped_local"),
        forbidden_actions=("cloud_egress",),
        domain="research_rec",
        budget_nanos=100_000_000,
        network_policy=NetworkPolicy.AIR_GAPPED,
    )
    reqs = (
        RequirementAtom.create(
            semantic_key="transfer.soundness",
            kind=RequirementKind.MUST,
            value="frechet_copula_verified",
            provenance=Provenance.USER_EXPLICIT,
        ),
    )
    yield {
        "owner_sk": owner_sk,
        "owner_pk": owner_pk,
        "validator_sk": validator_sk,
        "validator_pk": validator_pk,
        "oracle_sk": oracle_sk,
        "oracle_pk": oracle_pk,
        "validator": validator,
        "compiler": compiler,
        "intent": intent,
        "reqs": reqs,
        "tmp_path": tmp_path,
    }
    LearningValidator.set_tombstone_store_path(None)
    LearningValidator.clear_owner_registries()


def test_pairwise_independent_ternary_counterexample_fails_mixture_formula_and_requires_sound_bounds():
    """
    P0 DEFECT REC-F01 REPRODUCTION:
    Under 4 ternary patterns: (1,1,1), (1,0,0), (0,1,0), (0,0,1) with equal probability 0.25:
    - Marginal single-run failure: p = 0.5 for all runs.
    - Pairwise covariance: Cov(F_i, F_j) = 0.25 - (0.5 * 0.5) = 0.0 => rho = 0.0.
    - Naive mixture formula predicts: (1 - 0) * (0.5)^3 + 0 * 0.5 = 0.125.
    - True joint failure probability: P(F_1=1, F_2=1, F_3=1) = 0.25 (EXACTLY 2x higher!).

    The estimator MUST NOT return 0.125 as a valid upper bound.
    It MUST compute a sound distribution-free upper bound (Fréchet bound = min(p_i) = 0.5)
    or empirical joint Clopper-Pearson bound (>= 0.25) when joint samples are available.
    """
    estimator = CalibratedRiskEstimator()

    p1 = 0.5
    k = 3
    rho = 0.0

    # 1. Test sound repeated risk calculation with empirical joint samples
    empirical_joint_failures = 10  # 10 / 40 = 0.25
    n_families = 40

    sound_risk_bound = estimator.estimate_repeated_execution_risk(
        per_run_failure_bound=p1,
        k_runs=k,
        inter_run_correlation=rho,
        empirical_joint_failures=empirical_joint_failures,
        n_families=n_families,
        confidence=0.95,
    )

    assert sound_risk_bound >= 0.25, (
        f"Unsound risk bound: {sound_risk_bound} < 0.25 true failure rate! Mixture model underestimated risk!"
    )
    assert sound_risk_bound > 0.125, "Estimator falsely used naive mixture formula (0.125)!"

    # 2. When empirical joint samples are NOT available, distribution-free Fréchet upper bound
    # for joint failure P(F1=1 and F2=1 and F3=1) is min(p1, p2, p3) = 0.5.
    distribution_free_bound = estimator.estimate_repeated_execution_risk(
        per_run_failure_bound=p1,
        k_runs=k,
        inter_run_correlation=rho,
        empirical_joint_failures=None,
        n_families=None,
        confidence=0.95,
    )
    assert distribution_free_bound >= 0.5, (
        f"Distribution-free bound {distribution_free_bound} violated Fréchet upper copula bound (0.5)"
    )


def test_evidence_origin_firewall_blocks_synthetic_fixtures_from_production_valid_state(rec1_crypto_context):
    """
    P0 DEFECT REC-F02 REPRODUCTION:
    Synthetic datasets and fixtures MUST NOT produce EnvelopeValidityState.VALID
    for production execution. They must evaluate to SYNTHETIC_CALIBRATION_ONLY.
    """
    ctx = rec1_crypto_context
    compiler = ctx["compiler"]
    intent = ctx["intent"]
    reqs = ctx["reqs"]

    synthetic_dataset = DatasetCommitment.create_verified(
        dataset_id="synth-rec0-iterative-24fam",
        num_independent_families=24,
        items_per_family=2,
    )
    assert synthetic_dataset.is_synthetic is True
    assert synthetic_dataset.evidence_origin == EvidenceOrigin.SYNTHETIC_FIXTURE

    envelope = compiler.compile_envelope(
        envelope_id="ENV-SYNTH-001",
        protected_intent=intent,
        requirements=reqs,
        model_id="spe-verified-coder-v2",
        model_or_runtime_digest=hashlib.sha256(b"verified-weights-manifest-2026-10-11-rc1").hexdigest(),
        model_digest_type="VERIFIED_MODEL_REVISION",
        environment_binding=EnvironmentBinding(
            runtime_id="spe-local-deterministic-v1",
            tool_permissions=("ast_verify",),
            network_policy=NetworkPolicy.AIR_GAPPED.value,
            schema_version="spe.rec.v0",
            assumption_predicates={"local": True},
        ),
        oracle_id="oracle-rec0-independent",
        oracle_class="independent_reality_witness",
        oracle_signing_key=ctx["oracle_sk"],
        oracle_public_key=ctx["oracle_pk"],
        dataset_commitment=synthetic_dataset,
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
            task_category="research_rec",
            domain="research_rec",
            max_complexity_score=0.9,
            supported_perturbation_radius=0.15,
            eligible_input_predicates=("frechet_copula_verified",),
        ),
        dependency_hashes=DependencyHashes(
            rbpd_asset_hashes=(hashlib.sha256(b"rbpd-01").hexdigest(),),
            causal_proof_slice_digest=hashlib.sha256(b"slice-01").hexdigest(),
            obligation_hypergraph_digest=hashlib.sha256(b"hg-01").hexdigest(),
        ),
        alpha=0.10,
        committed_timestamp=1_760_000_000.0,
        validity_horizon=1_765_000_000.0,
    )

    eval_result = compiler.evaluate_envelope(
        envelope,
        protected_intent=intent,
        requirements=reqs,
        current_model_digest=envelope.model_revision_binding.model_or_runtime_digest,
        current_environment=envelope.environment_binding,
        current_dependency_hashes=envelope.dependency_hashes,
        task_category="research_rec",
        task_complexity=0.5,
        perturbation_magnitude=0.01,
        current_time=1_760_001_000.0,
    )
    assert eval_result.state == EnvelopeValidityState.SYNTHETIC_CALIBRATION_ONLY, (
        f"Expected SYNTHETIC_CALIBRATION_ONLY for synthetic dataset, got {eval_result.state}"
    )
    assert not eval_result.can_reuse, "Synthetic fixture envelope must not be marked reusable for production!"


def test_selector_rejects_synthetic_fixture_reuse_in_production_mode(rec1_crypto_context):
    """
    CostRiskExecutionSelector MUST reject deterministic procedure reuse
    when supported by a SYNTHETIC_FIXTURE envelope in production mode.
    """
    ctx = rec1_crypto_context
    compiler = ctx["compiler"]
    intent = ctx["intent"]
    reqs = ctx["reqs"]

    synthetic_dataset = DatasetCommitment.create_verified(
        dataset_id="synth-fixture-1",
        num_independent_families=24,
        items_per_family=2,
    )

    envelope = compiler.compile_envelope(
        envelope_id="ENV-SYNTH-002",
        protected_intent=intent,
        requirements=reqs,
        model_id="spe-verified-coder-v2",
        model_or_runtime_digest=hashlib.sha256(b"verified-weights-manifest-2026-10-11-rc1").hexdigest(),
        model_digest_type="VERIFIED_MODEL_REVISION",
        environment_binding=EnvironmentBinding(
            runtime_id="spe-local-deterministic-v1",
            tool_permissions=(),
            network_policy=NetworkPolicy.AIR_GAPPED.value,
            schema_version="spe.rec.v0",
            assumption_predicates={},
        ),
        oracle_id="oracle-rec0-independent",
        oracle_class="independent_reality_witness",
        oracle_signing_key=ctx["oracle_sk"],
        oracle_public_key=ctx["oracle_pk"],
        dataset_commitment=synthetic_dataset,
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
            task_category="research_rec",
            domain="research_rec",
            max_complexity_score=0.9,
            supported_perturbation_radius=0.15,
            eligible_input_predicates=("frechet_copula_verified",),
        ),
        dependency_hashes=DependencyHashes(
            rbpd_asset_hashes=(hashlib.sha256(b"rbpd-02").hexdigest(),),
            causal_proof_slice_digest=hashlib.sha256(b"slice-02").hexdigest(),
            obligation_hypergraph_digest=hashlib.sha256(b"hg-02").hexdigest(),
        ),
        alpha=0.10,
        committed_timestamp=1_760_000_000.0,
        validity_horizon=1_765_000_000.0,
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
        task_category="research_rec",
        task_complexity=0.5,
        perturbation_magnitude=0.01,
        current_time=1_760_001_000.0,
    )

    assert decision.selected_action != ExecutionAction.REUSE_DETERMINISTIC_PROCEDURE, (
        "Security violation: Selector allowed production deterministic reuse of SYNTHETIC_FIXTURE!"
    )
    assert decision.selected_action == ExecutionAction.ABSTAIN_INSUFFICIENT_QUALIFICATION


def test_metric_separation_joint_failure_vs_pass_hat_k_vs_pass_at_k():
    """
    P1 METRIC SEPARATION:
    Proves that simultaneous joint failure P(cap F_i), pass^k (all succeed),
    and pass@k (at least one succeeds) are formally distinct random events
    bounded by Fréchet-Hoeffding copula inequalities.
    """
    # Consider k = 3 attempts with per-run failure probability p_i = 0.20 (so per-run pass = 0.80)
    probs = [0.20, 0.20, 0.20]

    jf_low, jf_high = CalibratedRiskEstimator.frechet_joint_failure_bounds(probs)
    pass_hat_low, pass_hat_high = CalibratedRiskEstimator.frechet_pass_hat_k_bounds(probs)
    pass_at_low, pass_at_high = CalibratedRiskEstimator.frechet_pass_at_k_bounds(probs)

    # 1. Joint failure P(F1=1, F2=1, F3=1):
    # Lower Fréchet bound = max(0, 0.60 - 2) = 0.0
    # Upper Fréchet bound = min(0.20, 0.20, 0.20) = 0.20
    assert jf_low == pytest.approx(0.0)
    assert jf_high == pytest.approx(0.20)

    # 2. pass^3 = P(S1=1, S2=1, S3=1) where P(S_i=1) = 0.80:
    # Lower Fréchet bound = max(0, 0.80*3 - 2) = max(0, 2.40 - 2) = 0.40
    # Upper Fréchet bound = min(0.80, 0.80, 0.80) = 0.80
    assert pass_hat_low == pytest.approx(0.40)
    assert pass_hat_high == pytest.approx(0.80)

    # 3. pass@3 = 1 - P(all fail):
    # Lower Fréchet bound = 1 - 0.20 = 0.80
    # Upper Fréchet bound = 1 - 0.0 = 1.00
    assert pass_at_low == pytest.approx(0.80)
    assert pass_at_high == pytest.approx(1.00)

    # Verify pass@3 lower bound (0.80) >= pass^3 upper bound (0.80), proving metric non-conflation
    assert pass_at_low >= pass_hat_high


def test_reality_transfer_counterfactual_witness_detects_drift_and_invalidates_envelope(rec1_crypto_context):
    """
    P1 COUNTERFACTUAL REALITY TRANSFER:
    Verifies that RealityTransferEngine searches for discriminating counterfactual witnesses
    when transferring an envelope to a target reality, and transitions the envelope to STALE
    when witness divergence exceeds tolerance.
    """
    from spe_runtime.research.rec.reality_transfer import (
        CounterfactualWitnessSearch,
        RealityTransferEngine,
        TargetRealitySpec,
    )

    ctx = rec1_crypto_context
    compiler = ctx["compiler"]
    intent = ctx["intent"]
    reqs = ctx["reqs"]

    envelope = compiler.compile_default_valid_envelope(
        envelope_id="ENV-TRANSFER-001",
        protected_intent=intent,
        requirements=reqs,
        oracle_signing_key=ctx["oracle_sk"],
        oracle_public_key=ctx["oracle_pk"],
    )

    transfer_engine = RealityTransferEngine(compiler=compiler)
    searcher = CounterfactualWitnessSearch()

    # Target reality has a perturbed tool schema and different runtime
    target_reality = TargetRealitySpec(
        target_model_id="spe-verified-coder-v2",
        target_model_digest=envelope.model_revision_binding.model_or_runtime_digest,
        target_environment=EnvironmentBinding(
            runtime_id="spe-local-deterministic-v2-perturbed",
            tool_permissions=("ast_verify", "layout_check", "mutated_dom_parser"),
            network_policy=intent.network_policy.value,
            schema_version="spe.rec.v1",
            assumption_predicates={"dom_api": "v3_breaking", "webgl_fallback": False},
        ),
        perturbation_magnitude=0.35,
    )

    probes = searcher.synthesize_discriminating_witnesses(
        source_envelope=envelope,
        target_reality=target_reality,
    )
    assert len(probes) >= 2
    assert any(p.expected_information_gain > 0.20 for p in probes)

    # Simulate counterfactual probe execution showing divergence on target reality
    transfer_result = transfer_engine.evaluate_reality_transfer(
        source_envelope=envelope,
        protected_intent=intent,
        requirements=reqs,
        target_reality=target_reality,
        witness_outcomes={probes[0].probe_id: False, probes[1].probe_id: True},
    )

    assert transfer_result.transfer_state == EnvelopeValidityState.STALE
    assert transfer_result.transfer_authorized is False
    assert len(transfer_result.failed_witness_ids) >= 1
    assert len(transfer_result.requalification_obligations) >= 1


def test_experiment_runner_reports_synthetic_simulation_benchmark_and_blocks_competitor_claim(rec1_crypto_context):
    """
    P0 EVIDENCE-ORIGIN REPORT FIREWALL:
    Verifies that REC0ExperimentRunner explicitly labels the 35.34x result as
    SYNTHETIC_SIMULATION_BENCHMARK and sets competitor_qualification = 'NOT_PROVEN'.
    """
    from spe_runtime.research.rec.experiment import REC0ExperimentRunner

    runner = REC0ExperimentRunner(validator=rec1_crypto_context["validator"])
    report = runner.get_epistemic_qualification_metadata()

    assert report["benchmark_evidence_origin"] == EvidenceOrigin.SYNTHETIC_FIXTURE.value
    assert report["benchmark_classification"] == "SYNTHETIC_SIMULATION_BENCHMARK"
    assert report["real_competitor_10x_advantage"] == "NOT_PROVEN"
    assert report["external_model_qualification"] == "BLOCKED_HOLD"
    assert report["g6_h_blinded_human_evaluation"] == "BLOCKED_HOLD"
    assert report["production_release_authorization"] == "HOLD"

