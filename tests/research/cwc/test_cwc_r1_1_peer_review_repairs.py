"""
CWC-1 R1.1 Peer-Review Repair Test Suite (CWC-F01 through CWC-F12).
Formally verifies all 12 defects identified during independent review:
  - CWC-F01: Scoped identifiability verdicts replacing unproven global claims
  - CWC-F02: Dimensionally consistent acquisition objectives (Monetary vs Information Density)
  - CWC-F03: Structural pre-filtering of unauthorized actions before optimization
  - CWC-F04: Reclassification of 133.33x as an illustrative cost fixture
  - CWC-F05: 4 independent evidence dimensions (Integrity, Chronology, Provenance, Validity)
  - CWC-F06: Chronological pre-registration token with anti-HARKing cryptographic lock
  - CWC-F07: Structural execution boundary authority check rejecting tainted inputs
  - CWC-F08: Pre-registered StatisticalProtocol evaluating significance criteria
  - CWC-F09: Honest LVT transfer boundaries (In-Distribution Sanity vs LVT Qualified)
  - CWC-F10: Support for non-DAG systems (Differential Equations, Oscillators, Cyclic Networks)
  - CWC-F11: Exact integer NanoUSD arithmetic conservation ($1.00 = 10^9 nanos)
  - CWC-F12: Quarantining and falsification traceability without history erasure
"""

import hashlib
import json
import pytest
from spe_runtime.research.cwc.engine import SpeCwcEngine
from spe_runtime.research.cwc.experiment_selector import ExperimentSelector
from spe_runtime.research.cwc.mechanism_compiler import MechanismCompiler
from spe_runtime.research.cwc.transfer_engine import TransferEngine
from spe_runtime.research.cwc.types import (
    AcquisitionMode,
    IdentifiabilityStatus,
    InterventionalAction,
    ModelRepresentationType,
    ObservationWitness,
    QualificationState,
    ScientificValidationStatus,
    ScientificWitness,
    ScientificWitnessType,
    StatisticalProtocol,
)
from spe_runtime.research.cwc.witness_generator import ScientificWitnessGenerator


# ---------------------------------------------------------------------------
# CWC-F01: Scoped Identifiability Verdicts
# ---------------------------------------------------------------------------
def test_cwc_f01_scoped_identifiability_verdicts():
    compiler = MechanismCompiler(epsilon_identifiability=0.05)
    mechs = compiler.compile_competing_mechanisms("synthetic", "Reaction kinetics")

    # When actions can discriminate, verdict is DISTINGUISHABLE_ACTION_FOUND
    status, gap = compiler.compute_identifiability(mechs, "x_intervene_2")
    assert status == IdentifiabilityStatus.DISTINGUISHABLE_ACTION_FOUND
    assert gap >= 0.05

    # At baseline condition, observations are equivalent for the tested action
    status_base, gap_base = compiler.compute_identifiability(mechs, "x_baseline")
    assert status_base == IdentifiabilityStatus.NO_DISCRIMINATING_ACTION_ESTABLISHED
    assert gap_base < 0.05

    # Single mechanism or empty list must return MODEL_SET_INADEQUATE
    status_single, _ = compiler.compute_identifiability([mechs[0]], "x_intervene_2")
    assert status_single == IdentifiabilityStatus.MODEL_SET_INADEQUATE


# ---------------------------------------------------------------------------
# CWC-F02: Dimensionally Consistent Acquisition Objectives
# ---------------------------------------------------------------------------
def test_cwc_f02_dimensional_consistency_monetary_vs_information():
    selector = ExperimentSelector(lambda_evsi=1.0, mu_fr=1.5)

    action = InterventionalAction(
        action_id="ACT-DIM-01",
        target_variable="v",
        intervention_value=5.0,
        description="Dimensional test probe",
        is_authorized=True,
        cost_nanos=200_000_000,  # $0.20
        risk_nanos=10_000_000,   # $0.01
        expected_information_gain=1.5,  # bits
        expected_value_sample_info=0.80, # $0.80 EVSI in USD
        falsification_potential=0.9,     # dimensionless
    )

    # 1. Monetary mode: EVSI ($0.80 = 800M nanos) - Cost (200M nanos) - Risk (10M nanos) = 590M nanos
    score_monetary = selector.score_monetary_acquisition(action)
    assert isinstance(score_monetary, int)
    assert score_monetary == 590_000_000  # Exact integer NanoUSD conservation

    # 2. Information Density mode: (EIG + mu*FR + JSD) / Cost_USD -> bits per USD
    score_density = selector.score_information_density_acquisition(action, jsd_disagreement=0.25)
    assert isinstance(score_density, float)
    # EIG (1.5) + mu*FR (1.5 * 0.9 = 1.35) + JSD (0.25) = 3.10 bits
    # Cost = $0.20 USD -> Density = 3.10 / 0.20 = 15.5 bits/USD
    assert abs(score_density - 15.5) < 0.01


# ---------------------------------------------------------------------------
# CWC-F03: Structural Pre-filtering of Unauthorized Actions
# ---------------------------------------------------------------------------
def test_cwc_f03_structural_prefiltering_guarantee():
    selector = ExperimentSelector()
    compiler = MechanismCompiler()
    mechs = compiler.compile_competing_mechanisms("synthetic", "Reaction kinetics")

    # Set where ALL actions are unauthorized
    unauthorized_actions = [
        InterventionalAction(
            action_id="ACT-UNAUTH-1",
            target_variable="x",
            intervention_value=10.0,
            description="Unauthorized high dose",
            is_authorized=False,
            cost_nanos=100_000_000,
            risk_nanos=100_000_000,
            expected_information_gain=2.0,
            expected_value_sample_info=5.0,
            falsification_potential=1.0,
        ),
        InterventionalAction(
            action_id="ACT-UNAUTH-2",
            target_variable="x",
            intervention_value=20.0,
            description="Unauthorized lethal dose",
            is_authorized=False,
            cost_nanos=100_000_000,
            risk_nanos=500_000_000,
            expected_information_gain=3.0,
            expected_value_sample_info=10.0,
            falsification_potential=1.0,
        ),
    ]

    decision, jsd = selector.select_best_experiment(mechs, unauthorized_actions)
    # Must structurally refuse to select any action
    assert decision.status == "NO_AUTHORIZED_FEASIBLE_ACTION"
    assert decision.selected_action is None
    assert decision.feasible_action_count == 0
    assert decision.filtered_unauthorized_count == 2


# ---------------------------------------------------------------------------
# CWC-F04: Honest Cost Fixture Reclassification
# ---------------------------------------------------------------------------
def test_cwc_f04_cost_fixture_reclassification():
    transfer_engine = TransferEngine()
    ratio = transfer_engine.calculate_cost_fixture_ratio(
        verified_outcomes_cwc=1,
        cost_nanos_cwc=150_000_000,
        verified_outcomes_baseline=1,
        cost_usd_baseline=20.0,
    )
    assert ratio == 133.33

    engine = SpeCwcEngine()
    act = InterventionalAction(
        action_id="ACT-EXP-01",
        target_variable="x",
        intervention_value=2.0,
        description="Probe 2",
        is_authorized=True,
        cost_nanos=150_000_000,
        risk_nanos=10_000_000,
        expected_information_gain=1.2,
        expected_value_sample_info=2.0,
        falsification_potential=0.85,
    )
    result = engine.execute_discovery_cycle(
        domain="synthetic",
        problem_description="Fixture test",
        candidate_actions=[act],
        simulated_observation=ObservationWitness(
            observation_id="OBS-FIX",
            action_id="ACT-EXP-01",
            measured_variable="x_intervene_2",
            observed_value=4.0,
            standard_error=0.01,
            is_negative_control=False,
            reproducible_artifact_uri="file:///measurements/run.json",
            timestamp_utc="2026-10-14T00:00:00Z",
        ),
    )
    # Must declare benchmark type as ILLUSTRATIVE_COST_FIXTURE and false empirical proof
    assert result.benchmark_type == "ILLUSTRATIVE_COST_FIXTURE"
    assert result.is_100x_empirically_proven is False
    assert result.empirical_discovery_gain == "UNMEASURED_PENDING_INDEPENDENT_BENCHMARK"


# ---------------------------------------------------------------------------
# CWC-F05: 4 Independent Evidence Dimensions
# ---------------------------------------------------------------------------
def test_cwc_f05_four_evidence_dimensions_separation():
    generator = ScientificWitnessGenerator()
    compiler = MechanismCompiler()
    selector = ExperimentSelector()
    mechs = compiler.compile_competing_mechanisms("synthetic", "Kinetic order")

    act = InterventionalAction(
        action_id="ACT-01",
        target_variable="x",
        intervention_value=2.0,
        description="Probe 2",
        is_authorized=True,
        cost_nanos=100_000_000,
        risk_nanos=0,
        expected_information_gain=1.0,
        expected_value_sample_info=1.0,
        falsification_potential=0.8,
    )
    precommit = selector.seal_precommitment_lock(mechs, act)

    obs = ObservationWitness(
        observation_id="OBS-01",
        action_id="ACT-01",
        measured_variable="x_intervene_2",
        observed_value=4.01,
        standard_error=0.01,
        is_negative_control=False,
        reproducible_artifact_uri="file:///runs/obs1.json",
        timestamp_utc="2026-10-14T00:01:00Z",
    )

    witness = generator.adjudicate_and_seal_witness(
        mechanisms=mechs,
        observation=obs,
        precommitment=precommit,
        claim_statement="Linear scaling kinetics",
    )

    # 1. Integrity dimension
    assert len(witness.integrity_sha256) == 64
    # 2. Chronology dimension (preregistration seal token)
    assert witness.chronological_precommitment_seal.startswith("PREREG-SHA256:")
    # 3. Provenance dimension
    assert witness.provenance_record["action_id"] == "ACT-01"
    assert witness.provenance_record["artifact_uri"] == "file:///runs/obs1.json"
    # 4. Scientific validity dimension
    assert witness.scientific_validation_status == ScientificValidationStatus.EMPIRICALLY_CORROBORATED


# ---------------------------------------------------------------------------
# CWC-F06: Chronological Preregistration Token
# ---------------------------------------------------------------------------
def test_cwc_f06_preregistration_token():
    selector = ExperimentSelector()
    compiler = MechanismCompiler()
    mechs = compiler.compile_competing_mechanisms("synthetic", "Kinetic order")

    act = InterventionalAction(
        action_id="ACT-PREREG-01",
        target_variable="x",
        intervention_value=2.0,
        description="Probe 2",
        is_authorized=True,
        cost_nanos=100_000_000,
        risk_nanos=0,
        expected_information_gain=1.0,
        expected_value_sample_info=1.0,
        falsification_potential=0.8,
    )

    digest = selector.seal_precommitment_lock(
        mechs, act, timestamp_utc="2026-10-14T10:00:00Z", protocol_id="STAT-PROT-ALPHA"
    )
    assert digest.preregistration_token.startswith("PREREG-SHA256:")
    assert "PROT:STAT-PROT-ALPHA" in digest.preregistration_token
    assert "2026-10-14T10:00:00Z" in digest.preregistration_token


# ---------------------------------------------------------------------------
# CWC-F07: Execution Boundary Authority Verification
# ---------------------------------------------------------------------------
def test_cwc_f07_execution_boundary_authority_rejection():
    generator = ScientificWitnessGenerator()

    # Valid authenticated caller
    assert generator.verify_execution_boundary_authority("AUTH-TOKEN-ADMIN-42", is_data_tainted=False) is True

    # Untrusted data taint blocks authority immediately
    assert generator.verify_execution_boundary_authority("AUTH-TOKEN-ADMIN-42", is_data_tainted=True) is False

    # Empty or unauthenticated caller blocked
    assert generator.verify_execution_boundary_authority("", is_data_tainted=False) is False
    assert generator.verify_execution_boundary_authority("ANONYMOUS_PROMPT", is_data_tainted=False) is False


# ---------------------------------------------------------------------------
# CWC-F08: Pre-registered Statistical Protocol Evaluation
# ---------------------------------------------------------------------------
def test_cwc_f08_statistical_protocol_evaluation():
    generator = ScientificWitnessGenerator()
    compiler = MechanismCompiler()
    selector = ExperimentSelector()
    mechs = compiler.compile_competing_mechanisms("synthetic", "Kinetic order")

    act = InterventionalAction(
        action_id="ACT-01",
        target_variable="x",
        intervention_value=2.0,
        description="Probe 2",
        is_authorized=True,
        cost_nanos=100_000_000,
        risk_nanos=0,
        expected_information_gain=1.0,
        expected_value_sample_info=1.0,
        falsification_potential=0.8,
    )
    precommit = selector.seal_precommitment_lock(mechs, act)

    protocol = StatisticalProtocol(
        protocol_id="STAT-PROT-ZSCORE-01",
        null_hypothesis="Reaction rate residual exceeds 2.576 standard errors (alpha=0.01)",
        alpha_significance=0.01,
        power_target=0.80,
    )

    # Observation within 1 standard error of 4.0
    obs_pass = ObservationWitness(
        observation_id="OBS-PASS",
        action_id="ACT-01",
        measured_variable="x_intervene_2",
        observed_value=4.02,
        standard_error=0.02,
        is_negative_control=False,
        reproducible_artifact_uri="file:///runs/obs_pass.json",
        timestamp_utc="2026-10-14T00:00:00Z",
    )
    witness_pass = generator.adjudicate_and_seal_witness(
        mechanisms=mechs,
        observation=obs_pass,
        precommitment=precommit,
        claim_statement="Linear scaling confirmed under statistical protocol",
        statistical_protocol=protocol,
    )
    assert witness_pass.scientific_validation_status == ScientificValidationStatus.EMPIRICALLY_CORROBORATED

    # Observation 5 standard errors away (residual = 0.20, se = 0.02 -> z = 10 > 2.576)
    obs_fail = ObservationWitness(
        observation_id="OBS-FAIL",
        action_id="ACT-01",
        measured_variable="x_intervene_2",
        observed_value=4.20,
        standard_error=0.02,
        is_negative_control=False,
        reproducible_artifact_uri="file:///runs/obs_fail.json",
        timestamp_utc="2026-10-14T00:00:00Z",
    )
    witness_fail = generator.adjudicate_and_seal_witness(
        mechanisms=mechs,
        observation=obs_fail,
        precommitment=precommit,
        claim_statement="Linear scaling test",
        statistical_protocol=protocol,
    )
    assert witness_fail.scientific_validation_status == ScientificValidationStatus.CONTRADICTED_BY_EVIDENCE


# ---------------------------------------------------------------------------
# CWC-F09: Honest LVT Transfer Qualification Boundaries
# ---------------------------------------------------------------------------
def test_cwc_f09_honest_lvt_transfer_boundaries():
    transfer_engine = TransferEngine()
    compiler = MechanismCompiler()
    mechs = compiler.compile_competing_mechanisms("synthetic", "Kinetic order")
    mech = mechs[0]

    witness = ScientificWitness(
        witness_id="WIT-01",
        witness_type=ScientificWitnessType.INTERVENTIONAL_EXPERIMENT,
        claim_statement="Linear scaling",
        mechanism_id=mech.mechanism_id,
        supporting_observations=("OBS-01",),
        integrity_sha256="b" * 64,
        chronological_precommitment_seal="c" * 64,
        provenance_record={"test": "pass"},
        scientific_validation_status=ScientificValidationStatus.EMPIRICALLY_CORROBORATED,
        is_reproducible=True,
        biosecurity_screen_passed=True,
    )

    unseen_cases = [
        {"x": 4.0, "expected_y": 8.0, "is_negative_control": False},
        {"x": 6.0, "expected_y": 12.0, "is_negative_control": False},
    ]

    # Without LVT token -> In-Distribution Sanity Pass only
    proc_local = transfer_engine.evaluate_ood_transfer(mech, witness, unseen_cases)
    assert proc_local.qualification_state == QualificationState.IN_DISTRIBUTION_SANITY_PASS

    # With authorized LVT token -> Promotes to Reusable
    proc_lvt = transfer_engine.evaluate_ood_transfer(
        mech, witness, unseen_cases, lvt_transfer_token="LVT-TRANSFER-VERIFIED-BATCH9"
    )
    assert proc_lvt.qualification_state == QualificationState.TRANSFER_QUALIFIED_REUSABLE
    assert proc_lvt.lvt_provenance_id == "LVT-TRANSFER-VERIFIED-BATCH9"


# ---------------------------------------------------------------------------
# CWC-F10: Support for Non-DAG Oscillatory & Differential Equation Systems
# ---------------------------------------------------------------------------
def test_cwc_f10_non_dag_differential_and_cyclic_systems():
    compiler = MechanismCompiler()

    # Biological oscillation (Lotka-Volterra / FitzHugh-Nagumo limit cycles)
    osc_mechs = compiler.compile_competing_mechanisms(
        domain="biological oscillator",
        problem_description="Periodic neural spiking dynamics",
    )
    assert len(osc_mechs) >= 2

    # Check non-DAG representation and cyclic flag
    has_differential = any(
        m.model_representation == ModelRepresentationType.DIFFERENTIAL_EQUATION_SYSTEM for m in osc_mechs
    )
    assert has_differential
    has_cyclic = any(m.is_cyclic for m in osc_mechs)
    assert has_cyclic


# ---------------------------------------------------------------------------
# CWC-F11: Exact Integer NanoUSD Conservation
# ---------------------------------------------------------------------------
def test_cwc_f11_exact_integer_nanousd_conservation():
    action = InterventionalAction(
        action_id="ACT-NANO-01",
        target_variable="x",
        intervention_value=1.0,
        description="Exact integer conservation probe",
        is_authorized=True,
        cost_nanos=150_000_000,  # $0.15 USD
        risk_nanos=25_000_000,   # $0.025 USD
        expected_information_gain=1.0,
        expected_value_sample_info=1.0,  # $1.00 USD = 1,000,000,000 nanos
        falsification_potential=0.5,
    )
    selector = ExperimentSelector()
    score = selector.score_monetary_acquisition(action)

    assert isinstance(score, int)
    # Expected: 1,000,000,000 - 150,000,000 - 25,000,000 = 825,000,000 nanos
    assert score == 825_000_000


# ---------------------------------------------------------------------------
# CWC-F12: Quarantining and Falsification Monotonicity
# ---------------------------------------------------------------------------
def test_cwc_f12_falsification_quarantine_traceability():
    transfer_engine = TransferEngine()
    compiler = MechanismCompiler()
    mechs = compiler.compile_competing_mechanisms("synthetic", "Kinetic order")
    mech = mechs[0]

    # Contradicted witness
    contradicted_witness = ScientificWitness(
        witness_id="WIT-CONTRA-01",
        witness_type=ScientificWitnessType.NEGATIVE_FALSIFICATION,
        claim_statement="Reaction fails hypothesis",
        mechanism_id=mech.mechanism_id,
        supporting_observations=("OBS-FAIL",),
        integrity_sha256="d" * 64,
        chronological_precommitment_seal="e" * 64,
        provenance_record={"status": "contradicted"},
        scientific_validation_status=ScientificValidationStatus.CONTRADICTED_BY_EVIDENCE,
        is_reproducible=True,
        biosecurity_screen_passed=True,
    )

    proc = transfer_engine.evaluate_ood_transfer(mech, contradicted_witness, [])
    # Immediately quarantined
    assert proc.qualification_state == QualificationState.QUARANTINED_FALSIFIED
    assert "Failed empirical witness verification" in proc.known_counterexamples
    assert proc.transfer_pass_rate == 0.0
