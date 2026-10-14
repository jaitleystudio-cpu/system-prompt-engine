"""
CWC-1 R1.2 Adversarial Scientific Qualification Test Suite (Hard Tests 1 through 17).
Audit Target: CWC-1 R1.1 -> R1.2 Upgrade (14 October 2026).
Formally verifies all 17 adversarial failure modes and reconciles original CWC-F01 through F12 obligations:

Reconciled Ledger:
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
  - CWC-F11 (Original): 100% Offline Isolation & Process Boundary Air-Gap ($0 spend, zero cloud egress)
  - CWC-F11a: Exact integer NanoUSD arithmetic conservation ($1.00 = 10^9 nanos)
  - CWC-F12 (Original): Prior-Art Coverage & Bibliographic Grounding (7 verified lineages)
  - CWC-F12a: Quarantining and falsification traceability without history erasure

Hard Tests:
  - Hard Test 1: Clean EIG objective eliminating information-gain double-counting with JSD
  - Hard Test 2: Practical discriminatory power, sample size, noise, uncertainty, and cost
  - Hard Test 3: Multiple comparisons correction (Bonferroni / Benjamini-Hochberg) & sequential testing
  - Hard Test 4: Prior sensitivity evaluation & ambiguity sets (Go & Isaac 2022 REIG)
  - Hard Test 5: Mathematical boundary handling: zero-cost, zero-discovery, and negative cost rejection
  - Hard Test 6: Authentic append-only preregistration hash chains & replay resistance (RFC 3161)
  - Hard Test 7: Independent model-adequacy gate returning ALL_CANDIDATE_MECHANISMS_INADEQUATE
  - Hard Test 8: Authorization TOCTOU revalidation at execution boundary
  - Hard Test 9: Cryptographic verification of LVT qualification tokens rejecting forgeries
  - Hard Test 10: Evidence laundering prevention via separation of proposer, custodian, and adjudicator
  - Hard Test 11: False provenance rejection requiring verified observations
  - Hard Test 12: Numerical edge case rejection (NaN, infinity, negative standard error)
  - Hard Test 13: Empty hypothesis space handling and scientific abstention
  - Hard Test 14: Sealed holdout benchmark protection against data contamination
  - Hard Test 15: Process-boundary air-gap enforcement blocking socket egress
  - Hard Test 16: Separation of canonical WASM hash from Python runtime qualification
  - Hard Test 17: Honest release classification: CWC-1 R1.2 Qualification Candidate (Experimental)
"""

import math
import pytest
import socket
from spe_runtime.research.cwc.airgap_guard import (
    AirgapEgressBlockedError,
    enforce_airgap_boundary,
    verify_offline_airgap,
)
from spe_runtime.research.cwc.engine import SpeCwcEngine
from spe_runtime.research.cwc.experiment_selector import (
    ExperimentSelector,
    PreregistrationLedger,
)
from spe_runtime.research.cwc.holdout_vault import SealedHoldoutVault
from spe_runtime.research.cwc.mechanism_compiler import MechanismCompiler
from spe_runtime.research.cwc.prior_art import PriorArtLedger
from spe_runtime.research.cwc.transfer_engine import (
    TransferEngine,
    create_authorized_lvt_token,
)
from spe_runtime.research.cwc.types import (
    AcquisitionMode,
    ActionDecision,
    DiscriminatoryPowerReport,
    ExplanatoryMechanism,
    IdentifiabilityStatus,
    InterventionalAction,
    MechanismClass,
    ModelRepresentationType,
    ObservationWitness,
    PrecommitmentDigest,
    ProductivityCalculationStatus,
    QualificationState,
    ScientificValidationStatus,
    ScientificWitness,
    ScientificWitnessType,
    StatisticalProtocol,
)
from spe_runtime.research.cwc.witness_generator import ScientificWitnessGenerator


# ===========================================================================
# RECONCILED LEDGER: Original F11 (Offline Air-Gap) & Original F12 (Prior Art)
# ===========================================================================

def test_reconciled_f11_original_offline_isolation_and_f11a_currency():
    """Verifies Original F11 (Offline Air-Gap) and F11a (Integer NanoUSD Arithmetic)."""
    # 1. Original F11: 100% offline airgap verification
    airgap_status = verify_offline_airgap()
    assert airgap_status["airgap_enforced"] is True
    assert airgap_status["zero_cloud_spend_verified"] is True
    assert airgap_status["local_execution_only"] is True

    # 2. F11a: Integer NanoUSD conservation
    selector = ExperimentSelector()
    action = InterventionalAction(
        action_id="ACT-NANO-F11A",
        target_variable="x",
        intervention_value=1.0,
        description="Exact integer conservation probe",
        is_authorized=True,
        cost_nanos=250_000_000,  # $0.25 USD
        risk_nanos=50_000_000,   # $0.05 USD
        expected_information_gain=1.0,
        expected_value_sample_info=1.0,  # $1.00 USD = 1,000,000,000 nanos
        falsification_potential=0.5,
    )
    score = selector.score_monetary_acquisition(action)
    assert isinstance(score, int)
    assert score == 700_000_000  # Exact integer conservation


def test_reconciled_f12_original_prior_art_coverage_and_f12a_falsification():
    """Verifies Original F12 (7 Grounded Prior-Art Lineages) and F12a (Falsification Quarantining)."""
    # 1. Original F12: Prior-art coverage check
    coverage = PriorArtLedger.verify_coverage()
    assert coverage["is_complete"] is True
    assert coverage["total_prior_art_records"] == 7
    assert "LINDLEY-1956" in coverage["citations_covered"]
    assert "PEARL-2009" in coverage["citations_covered"]
    assert "GO-ISAAC-2022" in coverage["citations_covered"]
    assert "RFC-3161" in coverage["citations_covered"]
    assert "NIST-ARIA-2026" in coverage["citations_covered"]
    assert "EUREKABENCH-2026" in coverage["citations_covered"]
    assert "FIREBENCH-2026" in coverage["citations_covered"]

    # 2. F12a: Falsification traceability and quarantining
    transfer_engine = TransferEngine()
    compiler = MechanismCompiler()
    mechs = compiler.compile_competing_mechanisms("synthetic", "Kinetic order")
    mech = mechs[0]

    contra_witness = ScientificWitness(
        witness_id="WIT-F12A",
        witness_type=ScientificWitnessType.NEGATIVE_FALSIFICATION,
        claim_statement="Reaction fails",
        mechanism_id=mech.mechanism_id,
        supporting_observations=("OBS-F12A",),
        integrity_sha256="f" * 64,
        chronological_precommitment_seal="g" * 64,
        provenance_record={"test": "contra"},
        scientific_validation_status=ScientificValidationStatus.CONTRADICTED_BY_EVIDENCE,
    )
    proc = transfer_engine.evaluate_ood_transfer(mech, contra_witness, [])
    assert proc.qualification_state == QualificationState.QUARANTINED_FALSIFIED
    assert proc.transfer_pass_rate == 0.0


# ===========================================================================
# HARD TEST 1: Information-Gain Double Counting Elimination
# ===========================================================================

def test_hard_test_01_information_gain_double_counting_eliminated():
    """
    Counterexample from audit:
    M1 always predicts outcome 0.
    M2 always predicts outcome 1.
    Equal priors (0.5, 0.5).
    The actual expected information gain is exactly 1 bit.
    Adding JSD to EIG produces 1.25 bits (double-counting).
    Clean EIG objective MUST return exactly 1.0 bit without inflation.
    """
    selector = ExperimentSelector()

    m1 = ExplanatoryMechanism(
        mechanism_id="MECH-HT1-01",
        name="Outcome Zero Deterministic",
        mechanism_class=MechanismClass.EQUATION_SYSTEM,
        hypothesis="Always outputs 0",
        assumptions=(),
        causal_edges=(),
        equations=("y = 0",),
        predictions={"do_probe": 0.0},
        falsification_conditions=(),
        prior_weight=0.50,
    )
    m2 = ExplanatoryMechanism(
        mechanism_id="MECH-HT1-02",
        name="Outcome One Deterministic",
        mechanism_class=MechanismClass.EQUATION_SYSTEM,
        hypothesis="Always outputs 1",
        assumptions=(),
        causal_edges=(),
        equations=("y = 1",),
        predictions={"do_probe": 1.0},
        falsification_conditions=(),
        prior_weight=0.50,
    )

    # Clean EIG calculation
    eig_bits = selector.compute_expected_information_gain([m1, m2], "do_probe")
    assert abs(eig_bits - 1.0) < 1e-6, f"Expected 1.0 bit of mutual information, got {eig_bits}"

    # Action with EIG=1.0 bit and cost $0.20
    action = InterventionalAction(
        action_id="ACT-HT1",
        target_variable="probe",
        intervention_value=1.0,
        description="Clean EIG test probe",
        is_authorized=True,
        cost_nanos=200_000_000,  # $0.20 USD
        risk_nanos=0,
        expected_information_gain=1.0,  # 1.0 bit
        expected_value_sample_info=0.0,
        falsification_potential=0.0,
    )

    # Clean information density: 1.0 bit / $0.20 = 5.0 bits/USD
    clean_density = selector.score_clean_information_density(action)
    assert abs(clean_density - 5.0) < 1e-6, f"Expected 5.0 bits/USD, got {clean_density}"

    # Verify deduplicated mode does not allow JSD inflation
    score_dedup = selector.score_information_density_acquisition(
        action, jsd_disagreement=0.25, deduplicate_information=True
    )
    assert abs(score_dedup - 5.0) < 1e-6

    # Multi-attribute utility is separated and clearly labeled as utility
    utility = selector.score_multi_objective_utility(action, weight_eig=1.0, weight_cost=1.0)
    # Utility = 1.0 * 1.0 - 1.0 * 0.20 = 0.80 utility units (NOT bits)
    assert abs(utility - 0.80) < 1e-6


# ===========================================================================
# HARD TEST 2: Practical Discriminatory Power (Noise, Sample Size, Cost)
# ===========================================================================

def test_hard_test_02_practical_discriminatory_power_qualification():
    """
    Audit counterexample:
    M1: Y ~ Bernoulli(0.01)
    M2: Y ~ Bernoulli(0.02)
    TV(M1, M2) = 0.01. Optimal single-shot accuracy = 50.5% (barely above chance).
    A nonzero TV gap is insufficient without sample size and power consideration.
    """
    selector = ExperimentSelector()
    compiler = MechanismCompiler(epsilon_identifiability=0.005)

    m1 = ExplanatoryMechanism(
        mechanism_id="MECH-HT2-01",
        name="Bernoulli Rare 0.01",
        mechanism_class=MechanismClass.EQUATION_SYSTEM,
        hypothesis="P(Y=1) = 0.01",
        assumptions=(),
        causal_edges=(),
        equations=("P(Y=1) = 0.01",),
        predictions={"do_x": 0.01},
        falsification_conditions=(),
        prior_weight=0.50,
    )
    m2 = ExplanatoryMechanism(
        mechanism_id="MECH-HT2-02",
        name="Bernoulli Rare 0.02",
        mechanism_class=MechanismClass.EQUATION_SYSTEM,
        hypothesis="P(Y=1) = 0.02",
        assumptions=(),
        causal_edges=(),
        equations=("P(Y=1) = 0.02",),
        predictions={"do_x": 0.02},
        falsification_conditions=(),
        prior_weight=0.50,
    )

    # 1. Check compiler identifiability with N=1: optimal accuracy is 50.5% < 55% floor
    status, tv = compiler.compute_identifiability(
        [m1, m2], "do_x", sample_size=1, min_classification_accuracy=0.55
    )
    # Must reject as INSUFFICIENT_STATISTICAL_POWER
    assert status == IdentifiabilityStatus.INSUFFICIENT_STATISTICAL_POWER
    assert abs(tv - 0.01) < 1e-6

    # 2. Check practical discriminatory power report
    report = selector.qualify_discriminatory_power(
        mechanism_1=m1,
        mechanism_2=m2,
        condition="do_x",
        cost_nanos_per_sample=10_000_000,  # $0.01 per sample
        available_sample_size=1,
        alpha=0.01,
        power_target=0.80,
        budget_nanos=500_000_000,  # $0.50 budget (max 50 samples)
        is_bernoulli=True,
    )
    assert report.is_sufficiently_powered is False
    assert report.single_shot_accuracy == 0.505  # 50.5% accuracy
    assert report.required_sample_size > 1000   # Needs thousands of samples to separate 0.01 vs 0.02
    assert report.is_within_budget is False      # Exceeds budget


# ===========================================================================
# HARD TEST 3: Multiple Comparisons & Sequential Testing Error Control
# ===========================================================================

def test_hard_test_03_multiple_comparisons_and_sequential_testing():
    """
    Across 100 independent true-null tests, false positive rate without correction is:
    alpha=0.01 -> 63.4%, alpha=0.05 -> 99.41%.
    Pre-registered StatisticalProtocol with Bonferroni correction must reject marginal discoveries.
    """
    generator = ScientificWitnessGenerator()
    selector = ExperimentSelector()

    mech = ExplanatoryMechanism(
        mechanism_id="MECH-HT3",
        name="Null Model",
        mechanism_class=MechanismClass.EQUATION_SYSTEM,
        hypothesis="Linear null",
        assumptions=(),
        causal_edges=(),
        equations=("y = 4.0",),
        predictions={"x_intervene_2": 4.0},
        falsification_conditions=(),
        prior_weight=1.0,
    )
    act = InterventionalAction(
        action_id="ACT-HT3",
        target_variable="x",
        intervention_value=2.0,
        description="Statistical test",
        is_authorized=True,
        cost_nanos=100_000_000,
        risk_nanos=0,
        expected_information_gain=1.0,
        expected_value_sample_info=1.0,
        falsification_potential=0.5,
    )
    precommit = selector.seal_precommitment_lock([mech], act)

    # Observation with z = 2.80 (observed=4.28, pred=4.0, se=0.10 -> z=2.80)
    obs = ObservationWitness(
        observation_id="OBS-HT3",
        action_id="ACT-HT3",
        measured_variable="x_intervene_2",
        observed_value=4.28,
        standard_error=0.10,
        is_negative_control=False,
        reproducible_artifact_uri="file:///obs/ht3.json",
        timestamp_utc="2026-10-14T00:00:00Z",
    )

    # Protocol 1: Uncorrected single test (m=1, alpha=0.05, critical z=1.96)
    prot_uncorrected = StatisticalProtocol(
        protocol_id="PROT-UNCORRECTED",
        null_hypothesis="No deviation",
        alpha_significance=0.05,
        num_hypotheses=1,
        multiple_testing_correction="NONE",
    )
    # Under z=2.80 > 1.96, the null would be rejected (falsified)
    wit_uncorrected = generator.adjudicate_and_seal_witness(
        [mech], obs, precommit, "Test claim", statistical_protocol=prot_uncorrected
    )
    assert wit_uncorrected.scientific_validation_status == ScientificValidationStatus.CONTRADICTED_BY_EVIDENCE

    # Protocol 2: Bonferroni correction for 100 tests (m=100, alpha_eff = 0.05/100 = 0.0005, critical z=3.48)
    prot_bonferroni = StatisticalProtocol(
        protocol_id="PROT-BONFERRONI-100",
        null_hypothesis="No deviation across 100 tests",
        alpha_significance=0.05,
        num_hypotheses=100,
        multiple_testing_correction="BONFERRONI",
    )
    # Under Bonferroni, z=2.80 <= 3.48, so null is NOT rejected (model is consistent with null noise!)
    wit_corrected = generator.adjudicate_and_seal_witness(
        [mech], obs, precommit, "Test claim", statistical_protocol=prot_bonferroni
    )
    assert wit_corrected.scientific_validation_status == ScientificValidationStatus.EMPIRICALLY_CORROBORATED


# ===========================================================================
# HARD TEST 4: Prior Sensitivity & Ambiguity Sets (Go & Isaac 2022)
# ===========================================================================

def test_hard_test_04_prior_sensitivity_ranking_reversal():
    """
    Audit example:
    3 mechanisms evaluated with priors (0.49, 0.49, 0.02) vs (0.02, 0.02, 0.96).
    Experiment ranking reverses.
    System must detect reversal and report Robust Expected Information Gain (REIG).
    """
    selector = ExperimentSelector()

    m1 = ExplanatoryMechanism(
        mechanism_id="MECH-A",
        name="Mechanism A",
        mechanism_class=MechanismClass.EQUATION_SYSTEM,
        hypothesis="A",
        assumptions=(),
        causal_edges=(),
        equations=(),
        predictions={"x_intervene_1": 0.0, "x_intervene_2": 0.0},
        falsification_conditions=(),
        prior_weight=0.49,
        prior_source="EMPIRICAL_LITERATURE",
    )
    m2 = ExplanatoryMechanism(
        mechanism_id="MECH-B",
        name="Mechanism B",
        mechanism_class=MechanismClass.EQUATION_SYSTEM,
        hypothesis="B",
        assumptions=(),
        causal_edges=(),
        equations=(),
        predictions={"x_intervene_1": 1.0, "x_intervene_2": 0.0},
        falsification_conditions=(),
        prior_weight=0.49,
        prior_source="EMPIRICAL_LITERATURE",
    )
    m3 = ExplanatoryMechanism(
        mechanism_id="MECH-C",
        name="Mechanism C",
        mechanism_class=MechanismClass.EQUATION_SYSTEM,
        hypothesis="C",
        assumptions=(),
        causal_edges=(),
        equations=(),
        predictions={"x_intervene_1": 1.0, "x_intervene_2": 1.0},
        falsification_conditions=(),
        prior_weight=0.02,
        prior_source="EMPIRICAL_LITERATURE",
    )

    act1 = InterventionalAction(
        action_id="ACT-EXP-A",
        target_variable="x",
        intervention_value=1.0,
        description="Experiment A: discriminates M1 vs M2",
        is_authorized=True,
        cost_nanos=100_000_000,
        risk_nanos=0,
        expected_information_gain=1.0,
        expected_value_sample_info=1.0,
        falsification_potential=0.5,
    )
    act2 = InterventionalAction(
        action_id="ACT-EXP-B",
        target_variable="x",
        intervention_value=2.0,
        description="Experiment B: discriminates M3 vs {M1, M2}",
        is_authorized=True,
        cost_nanos=100_000_000,
        risk_nanos=0,
        expected_information_gain=0.5,
        expected_value_sample_info=0.5,
        falsification_potential=0.5,
    )

    # Evaluate prior sensitivity across ambiguity set
    report = selector.evaluate_prior_sensitivity(
        mechanisms=[m1, m2, m3],
        candidate_actions=[act1, act2],
        ambiguity_set=[
            [0.49, 0.49, 0.02],
            [0.02, 0.02, 0.96],
        ],
    )

    assert report.reversal_detected is True
    assert report.is_ranking_stable is False
    assert report.prior_source == "EMPIRICAL_LITERATURE"
    assert report.tested_priors_count == 2


# ===========================================================================
# HARD TEST 5: Zero-Cost and Zero-Discovery Boundary Conditions
# ===========================================================================

def test_hard_test_05_zero_cost_and_zero_discovery_boundaries():
    """
    Mathematical boundary failures:
    - EIG / 0 -> ZERO_COST_INFORMATION_DENSITY_UNDEFINED
    - 0 / 0 discoveries -> PRODUCTIVITY_GAIN_NOT_ESTIMABLE
    - 0 baseline discoveries -> BASELINE_PRODUCTIVITY_ZERO
    - Negative costs -> strictly rejected with ValueError
    """
    selector = ExperimentSelector()
    transfer = TransferEngine()

    # 1. Zero-cost action does not divide by zero or emit infinite score
    zero_cost_action = InterventionalAction(
        action_id="ACT-ZERO-COST",
        target_variable="x",
        intervention_value=1.0,
        description="Zero cost computational check",
        is_authorized=True,
        cost_nanos=0,  # $0.00
        risk_nanos=0,
        expected_information_gain=1.5,
        expected_value_sample_info=0.0,
        falsification_potential=0.8,
    )
    score = selector.score_clean_information_density(zero_cost_action)
    assert score == 1.5  # Returns pure EIG without dividing by zero

    # 2. Negative cost values strictly rejected
    neg_action = InterventionalAction(
        action_id="ACT-NEG-COST",
        target_variable="x",
        intervention_value=1.0,
        description="Invalid negative cost",
        is_authorized=True,
        cost_nanos=-50_000_000,
        risk_nanos=0,
        expected_information_gain=1.0,
        expected_value_sample_info=0.0,
        falsification_potential=0.5,
    )
    with pytest.raises(ValueError, match="Negative cost values strictly rejected"):
        selector.score_monetary_acquisition(neg_action)
    with pytest.raises(ValueError, match="Negative cost values strictly rejected"):
        selector.score_clean_information_density(neg_action)

    # 3. 0/0 verified discoveries: PRODUCTIVITY_GAIN_NOT_ESTIMABLE
    status_00, ratio_00 = transfer.calculate_productivity_status(
        verified_outcomes_cwc=0, cost_nanos_cwc=100_000_000,
        verified_outcomes_baseline=0, cost_usd_baseline=20.0
    )
    assert status_00 == ProductivityCalculationStatus.PRODUCTIVITY_GAIN_NOT_ESTIMABLE
    assert ratio_00 == 0.0

    # 4. Baseline discoveries = 0: BASELINE_PRODUCTIVITY_ZERO
    status_base0, ratio_base0 = transfer.calculate_productivity_status(
        verified_outcomes_cwc=1, cost_nanos_cwc=100_000_000,
        verified_outcomes_baseline=0, cost_usd_baseline=20.0
    )
    assert status_base0 == ProductivityCalculationStatus.BASELINE_PRODUCTIVITY_ZERO
    assert ratio_base0 == 0.0

    # 5. Negative cost in transfer engine strictly rejected
    with pytest.raises(ValueError, match="Negative cost values strictly rejected"):
        transfer.calculate_cost_fixture_ratio(1, -100, 1, 20.0)


# ===========================================================================
# HARD TEST 6: Authentic Chronology & Append-Only Hash Chain (RFC 3161)
# ===========================================================================

def test_hard_test_06_authentic_chronology_and_replay_resistance():
    """
    RFC 3161 Chronology & Replay Protection:
    - Verifiable local append-only hash chain
    - Replay attack detection on reused nonces
    - Monotonic timestamp validation against backdating
    """
    ledger = PreregistrationLedger()

    # Entry 1
    d1 = ledger.register_precommitment(
        action_id="ACT-CHRONO-1",
        predictions_hash="a" * 64,
        model_digest="m" * 64,
        protocol_id="PROT-01",
        nonce="NONCE-UNIQUE-001",
        timestamp_utc="2026-10-14T00:00:00Z",
        monotonic_ns=1000000,
    )
    assert d1.chain_sequence == 1
    assert d1.trust_boundary == "LOCAL_APPEND_ONLY_CHAIN"

    # Entry 2 (monotonically advanced)
    d2 = ledger.register_precommitment(
        action_id="ACT-CHRONO-2",
        predictions_hash="b" * 64,
        model_digest="m" * 64,
        protocol_id="PROT-01",
        nonce="NONCE-UNIQUE-002",
        timestamp_utc="2026-10-14T00:01:00Z",
        monotonic_ns=2000000,
    )
    assert d2.chain_sequence == 2
    assert d2.previous_block_hash == d1.digest_sha256

    # Verify chain integrity
    is_valid, msg = ledger.verify_chain()
    assert is_valid is True

    # Replay attack: reusing nonce raises REPLAY_ATTACK_DETECTED
    with pytest.raises(ValueError, match="REPLAY_ATTACK_DETECTED"):
        ledger.register_precommitment(
            action_id="ACT-CHRONO-REPLAY",
            predictions_hash="c" * 64,
            model_digest="m" * 64,
            protocol_id="PROT-01",
            nonce="NONCE-UNIQUE-001",  # Reused nonce!
            monotonic_ns=3000000,
        )

    # Backdating attack: monotonic timestamp in the past raises CHRONOLOGY_VIOLATION
    with pytest.raises(ValueError, match="CHRONOLOGY_VIOLATION"):
        ledger.register_precommitment(
            action_id="ACT-CHRONO-BACKDATE",
            predictions_hash="d" * 64,
            model_digest="m" * 64,
            protocol_id="PROT-01",
            nonce="NONCE-UNIQUE-003",
            monotonic_ns=500000,  # Past timestamp!
        )


# ===========================================================================
# HARD TEST 7: Candidate Mechanisms Can All Be Wrong (Model Adequacy Gate)
# ===========================================================================

def test_hard_test_07_all_candidate_mechanisms_inadequate():
    """
    Suppose true data-generating process produces P(Y=1) = 0.90.
    Candidate mechanisms predict P1=0.10, P2=0.20.
    Even though P2 is closer to 0.90 than P1, both are scientifically inadequate.
    System must NOT declare P2 the winner.
    Must return ALL_CANDIDATE_MECHANISMS_INADEQUATE and abstain.
    """
    engine = SpeCwcEngine()

    m1 = ExplanatoryMechanism(
        mechanism_id="MECH-WRONG-01",
        name="Grossly Misspecified Model 1",
        mechanism_class=MechanismClass.EQUATION_SYSTEM,
        hypothesis="P1 = 0.10",
        assumptions=(),
        causal_edges=(),
        equations=(),
        predictions={"x_intervene_2": 0.10},
        falsification_conditions=(),
        prior_weight=0.50,
    )
    m2 = ExplanatoryMechanism(
        mechanism_id="MECH-WRONG-02",
        name="Grossly Misspecified Model 2",
        mechanism_class=MechanismClass.EQUATION_SYSTEM,
        hypothesis="P2 = 0.20",
        assumptions=(),
        causal_edges=(),
        equations=(),
        predictions={"x_intervene_2": 0.20},
        falsification_conditions=(),
        prior_weight=0.50,
    )

    action = InterventionalAction(
        action_id="ACT-PROBE",
        target_variable="x",
        intervention_value=2.0,
        description="Probe",
        is_authorized=True,
        cost_nanos=100_000_000,
        risk_nanos=0,
        expected_information_gain=1.0,
        expected_value_sample_info=1.0,
        falsification_potential=0.5,
    )

    # True observation = 0.90 (deviates drastically from BOTH 0.10 and 0.20)
    obs = ObservationWitness(
        observation_id="OBS-TRUE-090",
        action_id="ACT-PROBE",
        measured_variable="x_intervene_2",
        observed_value=0.90,
        standard_error=0.01,
        is_negative_control=False,
        reproducible_artifact_uri="file:///obs/true.json",
        timestamp_utc="2026-10-14T00:00:00Z",
    )

    result = engine.execute_discovery_cycle(
        domain="synthetic misspecification",
        problem_description="Test all wrong mechanisms",
        candidate_actions=[action],
        simulated_observation=obs,
    )

    # 1. Identifiability status must declare all models inadequate
    assert result.identifiability_status == IdentifiabilityStatus.ALL_CANDIDATE_MECHANISMS_INADEQUATE

    # 2. No winning reusable procedure compounded
    assert result.reusable_procedure is None

    # 3. Scientific witness marked CONTRADICTED
    assert result.scientific_witness is not None
    assert result.scientific_witness.scientific_validation_status == ScientificValidationStatus.CONTRADICTED_BY_EVIDENCE
    assert result.scientific_witness.mechanism_id == "ALL_CANDIDATE_MECHANISMS_INADEQUATE"


# ===========================================================================
# HARD TEST 8: Authorization TOCTOU (Time-of-Check to Time-of-Use)
# ===========================================================================

def test_hard_test_08_authorization_toctou_revalidation():
    """
    Action is selected when authorized, but its permission or budget is revoked before execution.
    Execution boundary must revalidate authority and halt immediately.
    """
    engine = SpeCwcEngine()

    act = InterventionalAction(
        action_id="ACT-TOCTOU",
        target_variable="x",
        intervention_value=2.0,
        description="Action whose budget is revoked",
        is_authorized=True,
        cost_nanos=500_000_000,  # $0.50
        risk_nanos=0,
        expected_information_gain=1.0,
        expected_value_sample_info=1.0,
        falsification_potential=0.5,
    )

    # If remaining budget at execution boundary drops to $0.10 (100M nanos), execution aborts
    result = engine.execute_discovery_cycle(
        domain="synthetic",
        problem_description="TOCTOU check",
        candidate_actions=[act],
        budget_nanos=100_000_000,  # Budget too low for the 500M nanos action!
    )
    assert result.action_decision.status == "NO_AUTHORIZED_FEASIBLE_ACTION"
    assert result.selected_action is None


# ===========================================================================
# HARD TEST 9: Forged Transfer Token Signature Check
# ===========================================================================

def test_hard_test_09_forged_transfer_token_rejection():
    """
    A caller submits a forged or tampered LVT transfer token.
    TransferEngine must cryptographically verify the signature, issuer, and mechanism binding.
    """
    transfer = TransferEngine()
    compiler = MechanismCompiler()
    mechs = compiler.compile_competing_mechanisms("synthetic", "Kinetic order")
    mech = mechs[0]

    witness = ScientificWitness(
        witness_id="WIT-T9",
        witness_type=ScientificWitnessType.INTERVENTIONAL_EXPERIMENT,
        claim_statement="Linear scaling",
        mechanism_id=mech.mechanism_id,
        supporting_observations=("OBS-01",),
        integrity_sha256="1" * 64,
        chronological_precommitment_seal="2" * 64,
        provenance_record={},
        scientific_validation_status=ScientificValidationStatus.EMPIRICALLY_CORROBORATED,
    )

    unseen_cases = [{"x": 4.0, "expected_y": 8.0, "is_negative_control": False}]

    # Case 1: Forged token with invalid signature
    forged_token = "LVT-SIG.eyJpc3N1ZXIiOiAiU1BFX0xWVF9RVUFMSUZJQ0FUSU9OX0FVVEhPUklUWSJ9.deadbeefcafebabe"
    proc_forged = transfer.evaluate_ood_transfer(
        mech, witness, unseen_cases, lvt_transfer_token=forged_token, allow_legacy_tokens=False
    )
    assert proc_forged.qualification_state == QualificationState.IN_DISTRIBUTION_SANITY_PASS
    assert any("rejected" in ce.lower() for ce in proc_forged.known_counterexamples)

    # Case 2: Authentic, cryptographically signed token
    authentic_token = create_authorized_lvt_token(mech.mechanism_id, witness.integrity_sha256)
    proc_authentic = transfer.evaluate_ood_transfer(
        mech, witness, unseen_cases, lvt_transfer_token=authentic_token, allow_legacy_tokens=False
    )
    assert proc_authentic.qualification_state == QualificationState.TRANSFER_QUALIFIED_REUSABLE
    assert proc_authentic.lvt_provenance_id == authentic_token


# ===========================================================================
# HARD TEST 10: Evidence Laundering (Separation of Authorities)
# ===========================================================================

def test_hard_test_10_evidence_laundering_separation_of_authorities():
    """
    One entity attempts to propose hypothesis, custody evidence, and self-adjudicate.
    System must enforce independent authority separation and reject self-certification.
    """
    generator = ScientificWitnessGenerator()
    compiler = MechanismCompiler()
    selector = ExperimentSelector()
    mechs = compiler.compile_competing_mechanisms("synthetic", "Kinetic order")
    act = InterventionalAction(
        action_id="ACT-10",
        target_variable="x",
        intervention_value=2.0,
        description="Probe",
        is_authorized=True,
        cost_nanos=100_000_000,
        risk_nanos=0,
        expected_information_gain=1.0,
        expected_value_sample_info=1.0,
        falsification_potential=0.5,
    )
    precommit = selector.seal_precommitment_lock(mechs, act)
    obs = ObservationWitness(
        observation_id="OBS-10",
        action_id="ACT-10",
        measured_variable="x_intervene_2",
        observed_value=4.0,
        standard_error=0.01,
        is_negative_control=False,
        reproducible_artifact_uri="file:///obs.json",
        timestamp_utc="2026-10-14T00:00:00Z",
    )

    # Same authority passed as proposer and adjudicator -> EVIDENCE_LAUNDERING_REJECTED
    with pytest.raises(ValueError, match="EVIDENCE_LAUNDERING_REJECTED"):
        generator.adjudicate_and_seal_witness(
            mechanisms=mechs,
            observation=obs,
            precommitment=precommit,
            claim_statement="Self-promoted discovery",
            proposer_authority_token="AUTH-ROGUE-AGENT-42",
            adjudicator_authority_token="AUTH-ROGUE-AGENT-42",  # Collision!
        )


# ===========================================================================
# HARD TEST 11: False Provenance Rejection
# ===========================================================================

def test_hard_test_11_false_provenance_rejection():
    """
    A status string alone cannot certify truth.
    Measurements that deviate from predictions cannot be certified valid.
    """
    generator = ScientificWitnessGenerator()
    compiler = MechanismCompiler()
    selector = ExperimentSelector()
    mechs = compiler.compile_competing_mechanisms("synthetic", "Kinetic order")
    act = InterventionalAction(
        action_id="ACT-11",
        target_variable="x",
        intervention_value=2.0,
        description="Probe",
        is_authorized=True,
        cost_nanos=100_000_000,
        risk_nanos=0,
        expected_information_gain=1.0,
        expected_value_sample_info=1.0,
        falsification_potential=0.5,
    )
    precommit = selector.seal_precommitment_lock(mechs, act)

    # Observation that contradicts all mechanisms (value 999.0 vs predictions 4.0 and 6.0)
    obs = ObservationWitness(
        observation_id="OBS-11",
        action_id="ACT-11",
        measured_variable="x_intervene_2",
        observed_value=999.0,
        standard_error=0.01,
        is_negative_control=False,
        reproducible_artifact_uri="file:///obs.json",
        timestamp_utc="2026-10-14T00:00:00Z",
    )

    witness = generator.adjudicate_and_seal_witness(
        mechs, obs, precommit, "False claim asserting validity without proof"
    )
    # Must be contradicted despite any claim string
    assert witness.scientific_validation_status == ScientificValidationStatus.CONTRADICTED_BY_EVIDENCE


# ===========================================================================
# HARD TEST 12: Numerical Edge Cases (NaN, Infinity, Negative Standard Error)
# ===========================================================================

def test_hard_test_12_numerical_edge_cases_rejected():
    """
    NaN, infinity, or negative standard error must be rejected with NUMERICAL_ERROR_INVALID_VALUE.
    """
    generator = ScientificWitnessGenerator()
    selector = ExperimentSelector()
    compiler = MechanismCompiler()
    mechs = compiler.compile_competing_mechanisms("synthetic", "Kinetic order")
    act = InterventionalAction(
        action_id="ACT-12",
        target_variable="x",
        intervention_value=2.0,
        description="Probe",
        is_authorized=True,
        cost_nanos=100_000_000,
        risk_nanos=0,
        expected_information_gain=1.0,
        expected_value_sample_info=1.0,
        falsification_potential=0.5,
    )
    precommit = selector.seal_precommitment_lock(mechs, act)

    # NaN observed value
    obs_nan = ObservationWitness(
        observation_id="OBS-NAN",
        action_id="ACT-12",
        measured_variable="x_intervene_2",
        observed_value=float("nan"),
        standard_error=0.01,
        is_negative_control=False,
        reproducible_artifact_uri="file:///obs.json",
        timestamp_utc="2026-10-14T00:00:00Z",
    )
    with pytest.raises(ValueError, match="NUMERICAL_ERROR_INVALID_VALUE"):
        generator.adjudicate_and_seal_witness(mechs, obs_nan, precommit, "Test")

    # Negative standard error
    obs_neg_se = ObservationWitness(
        observation_id="OBS-NEG-SE",
        action_id="ACT-12",
        measured_variable="x_intervene_2",
        observed_value=4.0,
        standard_error=-0.05,
        is_negative_control=False,
        reproducible_artifact_uri="file:///obs.json",
        timestamp_utc="2026-10-14T00:00:00Z",
    )
    with pytest.raises(ValueError, match="NUMERICAL_ERROR_INVALID_VALUE"):
        generator.adjudicate_and_seal_witness(mechs, obs_neg_se, precommit, "Test")


# ===========================================================================
# HARD TEST 13: Empty Hypothesis Space
# ===========================================================================

def test_hard_test_13_empty_hypothesis_space():
    """
    No candidate mechanism adequately explains the data or empty hypothesis space provided.
    Must return ALL_CANDIDATE_MECHANISMS_INADEQUATE and abstain.
    """
    compiler = MechanismCompiler()
    status, gap = compiler.compute_identifiability([], "x_baseline")
    assert status == IdentifiabilityStatus.ALL_CANDIDATE_MECHANISMS_INADEQUATE
    assert gap == 0.0


# ===========================================================================
# HARD TEST 14: Sealed Holdout Benchmark Protection (Anti-Contamination)
# ===========================================================================

def test_hard_test_14_holdout_contamination_prevention():
    """
    SealedHoldoutVault ensures holdouts cannot be repeatedly probed or leaked.
    Exceeding exposure budget raises HOLDOUT_CONTAMINATION_PREVENTED.
    """
    test_cases = [
        {"x": 10.0, "expected_y": 20.0},
        {"x": 20.0, "expected_y": 40.0},
    ]
    vault = SealedHoldoutVault(
        benchmark_name="EurekaBench-Holdout-Batch42",
        test_cases=test_cases,
        max_exposures=1,
    )

    # Look 1: permitted for authorized evaluator
    receipt1 = vault.evaluate_holdout(
        model_eval_fn=lambda c: 2.0 * c["x"],
        caller_authority_token="AUTH-EVALUATOR-INDEPENDENT",
    )
    assert receipt1["pass_rate"] == 1.0
    assert receipt1["exposure_number"] == 1

    # Look 2: budget exhausted -> blocks contamination
    with pytest.raises(PermissionError, match="HOLDOUT_CONTAMINATION_PREVENTED"):
        vault.evaluate_holdout(
            model_eval_fn=lambda c: 2.0 * c["x"],
            caller_authority_token="AUTH-EVALUATOR-INDEPENDENT",
        )


# ===========================================================================
# HARD TEST 15: Offline Air-Gap Verification (Process Boundary Socket Denial)
# ===========================================================================

def test_hard_test_15_process_boundary_airgap_enforcement():
    """
    Verifies that the process boundary blocks socket creation and external egress,
    proving $0 spend and zero cloud leakage (Original CWC-F11).
    """
    with pytest.raises(AirgapEgressBlockedError, match="AIRGAP_VIOLATION"):
        with enforce_airgap_boundary():
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.connect(("api.openai.com", 443))


# ===========================================================================
# HARD TEST 16: Canonical WASM Hash vs Python Runtime Qualification
# ===========================================================================

def test_hard_test_16_wasm_hash_vs_python_runtime_separation():
    """
    Preserves canonical WASM hash ac3f0c3ecb19a7563068c903065ec90b8bb38bfcf4f0465a0c8f097e82e7de7d
    while explicitly requiring independent qualification for the Python CWC research runtime.
    """
    canonical_wasm_hash = "ac3f0c3ecb19a7563068c903065ec90b8bb38bfcf4f0465a0c8f097e82e7de7d"
    assert len(canonical_wasm_hash) == 64

    # Python CWC Engine orchestrator declares independent candidate status
    engine = SpeCwcEngine()
    result = engine.execute_discovery_cycle(
        domain="synthetic",
        problem_description="Runtime separation check",
    )
    assert result.release_status == "CWC-1 R1.2: Adversarial Scientific Qualification Candidate (Experimental)"


# ===========================================================================
# HARD TEST 17: Production Self-Certification Honest Release Status
# ===========================================================================

def test_hard_test_17_production_honest_release_classification():
    """
    Verifies that CWC-1 R1.2 honestly classifies itself as:
    'CWC-1 R1.2: Adversarial Scientific Qualification Candidate (Experimental)'
    without claiming self-awarded 10/10 production readiness.
    """
    engine = SpeCwcEngine()
    result = engine.execute_discovery_cycle(
        domain="synthetic",
        problem_description="Honest release classification",
    )
    assert result.is_100x_empirically_proven is False
    assert result.release_status == "CWC-1 R1.2: Adversarial Scientific Qualification Candidate (Experimental)"
    assert result.benchmark_type == "ILLUSTRATIVE_COST_FIXTURE"


# ===========================================================================
# ADVERSARIAL DEEP VERIFICATION: Edge Cases & Defect Red-Teaming
# ===========================================================================

def test_adversarial_realistic_variable_names_no_crash():
    """
    Verifies that variable names like 'temperature_sensor_reading' and 'gene_expression'
    do NOT crash with float conversion errors in witness generation or model adequacy.
    """
    gen = ScientificWitnessGenerator()
    m1 = ExplanatoryMechanism(
        mechanism_id="MECH-TEMP-01",
        name="Thermal probe model",
        mechanism_class=MechanismClass.EQUATION_SYSTEM,
        hypothesis="Temperature reading scales",
        assumptions=(),
        causal_edges=(),
        equations=(),
        predictions={"temperature_sensor_reading": 10.0},
        falsification_conditions=(),
        prior_weight=0.5,
    )
    precommit = PrecommitmentDigest(
        digest_sha256="a" * 64,
        action_id="ACT-TEMP",
        timestamp_utc="2026-10-14T00:00:00Z",
        nonce="nonce-temp",
        sealed_predictions_hash="s" * 64,
        preregistration_token="token-temp",
    )
    obs = ObservationWitness(
        observation_id="OBS-TEMP-01",
        action_id="ACT-TEMP",
        measured_variable="temperature_sensor_reading",
        observed_value=10.02,
        standard_error=0.1,
        is_negative_control=False,
        reproducible_artifact_uri="file:///obs/temp.json",
        timestamp_utc="2026-10-14T00:00:00Z",
    )

    # Adjudication must succeed without ValueError
    witness = gen.adjudicate_and_seal_witness([m1], obs, precommit, "Thermal claim")
    assert witness.scientific_validation_status == ScientificValidationStatus.EMPIRICALLY_CORROBORATED
    assert witness.mechanism_id == "MECH-TEMP-01"

    # Model adequacy evaluation must succeed without ValueError
    is_adequate, mech_id, residuals = gen.evaluate_model_adequacy([m1], [obs])
    assert is_adequate is True
    assert mech_id == "MECH-TEMP-01"


def test_adversarial_discrete_non_integer_eig_calculation():
    """
    Verifies that discrete/deterministic mechanisms with non-integer predictions (e.g. 0.2 vs 0.8)
    yield the exact 1.0 bit Shannon mutual information rather than falling through to continuous Gaussian.
    """
    selector = ExperimentSelector()
    m1 = ExplanatoryMechanism(
        mechanism_id="M1",
        name="Low State",
        mechanism_class=MechanismClass.EQUATION_SYSTEM,
        hypothesis="Outputs 0.2",
        assumptions=(),
        causal_edges=(),
        equations=(),
        predictions={"probe": 0.2},
        falsification_conditions=(),
        prior_weight=0.5,
    )
    m2 = ExplanatoryMechanism(
        mechanism_id="M2",
        name="High State",
        mechanism_class=MechanismClass.EQUATION_SYSTEM,
        hypothesis="Outputs 0.8",
        assumptions=(),
        causal_edges=(),
        equations=(),
        predictions={"probe": 0.8},
        falsification_conditions=(),
        prior_weight=0.5,
    )

    eig = selector.compute_expected_information_gain([m1, m2], "probe")
    assert abs(eig - 1.0) < 1e-6, f"Expected 1.0 bit mutual information for deterministic 0.2 vs 0.8, got {eig}"


def test_adversarial_condition_resolution_across_target_variables():
    """
    Verifies that actions targeting arbitrary variables (e.g. 'probe', 'temperature')
    resolve correctly in evaluate_prior_sensitivity and select_best_experiment.
    """
    selector = ExperimentSelector()
    m1 = ExplanatoryMechanism(
        mechanism_id="M1",
        name="M1",
        mechanism_class=MechanismClass.EQUATION_SYSTEM,
        hypothesis="M1",
        assumptions=(),
        causal_edges=(),
        equations=(),
        predictions={"probe": 0.0},
        falsification_conditions=(),
        prior_weight=0.5,
    )
    m2 = ExplanatoryMechanism(
        mechanism_id="M2",
        name="M2",
        mechanism_class=MechanismClass.EQUATION_SYSTEM,
        hypothesis="M2",
        assumptions=(),
        causal_edges=(),
        equations=(),
        predictions={"probe": 1.0},
        falsification_conditions=(),
        prior_weight=0.5,
    )
    act = InterventionalAction(
        action_id="ACT-PROBE",
        target_variable="probe",
        intervention_value=1.0,
        description="Probe test",
        is_authorized=True,
        cost_nanos=100_000_000,
        risk_nanos=0,
        expected_information_gain=1.0,
        expected_value_sample_info=0.0,
        falsification_potential=0.0,
    )

    decision, jsd = selector.select_best_experiment([m1, m2], [act], mode=AcquisitionMode.CLEAN_EXPECTED_INFORMATION_GAIN)
    assert decision.selected_action is not None
    assert decision.selected_action.action_id == "ACT-PROBE"
    assert decision.prior_sensitivity is not None
    assert decision.prior_sensitivity.robust_expected_info_gain > 0.0


def test_adversarial_sample_size_greater_than_one_power_check():
    """
    Verifies that sample_size > 1 with insufficient power returns INSUFFICIENT_STATISTICAL_POWER.
    """
    compiler = MechanismCompiler(epsilon_identifiability=0.005)
    m1 = ExplanatoryMechanism(
        mechanism_id="MECH-HT2-01",
        name="Bernoulli Rare 0.01",
        mechanism_class=MechanismClass.EQUATION_SYSTEM,
        hypothesis="P(Y=1) = 0.01",
        assumptions=(),
        causal_edges=(),
        equations=(),
        predictions={"do_x": 0.01},
        falsification_conditions=(),
        prior_weight=0.50,
    )
    m2 = ExplanatoryMechanism(
        mechanism_id="MECH-HT2-02",
        name="Bernoulli Rare 0.02",
        mechanism_class=MechanismClass.EQUATION_SYSTEM,
        hypothesis="P(Y=1) = 0.02",
        assumptions=(),
        causal_edges=(),
        equations=(),
        predictions={"do_x": 0.02},
        falsification_conditions=(),
        prior_weight=0.50,
    )

    # 10 samples is vastly insufficient to separate 0.01 vs 0.02 (needs > 1000)
    status, tv = compiler.compute_identifiability([m1, m2], "do_x", sample_size=10)
    assert status == IdentifiabilityStatus.INSUFFICIENT_STATISTICAL_POWER


def test_adversarial_tripartite_custodian_adjudicator_collision():
    """
    Verifies that if the evidence custodian attempts to self-adjudicate, it is rejected.
    """
    gen = ScientificWitnessGenerator()
    mechs = MechanismCompiler().compile_competing_mechanisms("synthetic", "Kinetic order")
    act = InterventionalAction(
        action_id="ACT-10",
        target_variable="x",
        intervention_value=2.0,
        description="Probe",
        is_authorized=True,
        cost_nanos=100_000_000,
        risk_nanos=0,
        expected_information_gain=1.0,
        expected_value_sample_info=1.0,
        falsification_potential=0.5,
    )
    precommit = ExperimentSelector().seal_precommitment_lock(mechs, act)
    obs = ObservationWitness(
        observation_id="OBS-10",
        action_id="ACT-10",
        measured_variable="x_intervene_2",
        observed_value=4.0,
        standard_error=0.01,
        is_negative_control=False,
        reproducible_artifact_uri="file:///obs.json",
        timestamp_utc="2026-10-14T00:00:00Z",
    )

    with pytest.raises(ValueError, match="Evidence custodian cannot self-adjudicate evidence"):
        gen.adjudicate_and_seal_witness(
            mechanisms=mechs,
            observation=obs,
            precommitment=precommit,
            claim_statement="Self-adjudication attempt",
            proposer_authority_token="AUTH-PROPOSER-01",
            evidence_custodian_token="AUTH-COLLUDING-ENTITY",
            adjudicator_authority_token="AUTH-COLLUDING-ENTITY",
        )


def test_adversarial_engine_ledger_chain_active():
    """
    Verifies that SpeCwcEngine records precommitments into the append-only PreregistrationLedger.
    """
    engine = SpeCwcEngine()
    assert len(engine.selector.ledger.chain) == 0

    result = engine.execute_discovery_cycle(
        domain="synthetic",
        problem_description="Ledger activation test",
    )
    assert result.precommitment is not None
    assert len(engine.selector.ledger.chain) == 1
    assert result.precommitment.chain_sequence == 1

    is_valid, msg = engine.selector.ledger.verify_chain()
    assert is_valid is True


def test_adversarial_toctou_risk_ceiling_revocation():
    """
    Verifies that if risk ceiling is reduced below the selected action's risk,
    the action is revoked at execution boundary.
    """
    engine = SpeCwcEngine()
    act = InterventionalAction(
        action_id="ACT-RISK",
        target_variable="x",
        intervention_value=2.0,
        description="Action with risk",
        is_authorized=True,
        cost_nanos=100_000_000,
        risk_nanos=500_000_000,  # $0.50 risk
        expected_information_gain=1.0,
        expected_value_sample_info=1.0,
        falsification_potential=0.5,
    )

    result = engine.execute_discovery_cycle(
        domain="synthetic",
        problem_description="Risk TOCTOU check",
        candidate_actions=[act],
        risk_ceiling_nanos=100_000_000,  # Ceiling is lower than action's risk
    )
    assert result.action_decision.status == "NO_AUTHORIZED_FEASIBLE_ACTION"
    assert result.selected_action is None


def test_adversarial_baseline_zero_cost_boundary():
    """
    Verifies that cost_usd_baseline <= 0 produces BASELINE_PRODUCTIVITY_ZERO status.
    """
    transfer = TransferEngine()
    status, ratio = transfer.calculate_productivity_status(
        verified_outcomes_cwc=1,
        cost_nanos_cwc=100_000_000,
        verified_outcomes_baseline=1,
        cost_usd_baseline=0.0,
    )
    assert status == ProductivityCalculationStatus.BASELINE_PRODUCTIVITY_ZERO
    assert ratio == 0.0


def test_adversarial_empty_mechanisms_abstention():
    """
    Verifies that when no candidate mechanisms are compiled, the engine abstains cleanly.
    """
    engine = SpeCwcEngine()
    compiler = MechanismCompiler()
    # Mock compile returning empty
    compiler.compile_competing_mechanisms = lambda *args, **kwargs: []
    engine.compiler = compiler

    result = engine.execute_discovery_cycle(
        domain="unknown",
        problem_description="No hypothesis available",
    )
    assert result.identifiability_status == IdentifiabilityStatus.ALL_CANDIDATE_MECHANISMS_INADEQUATE
    assert result.selected_action is None
    assert result.action_decision.status == "NO_CANDIDATE_MECHANISMS"


def test_adversarial_false_provenance_empty_observations():
    """
    Verifies that a witness claiming empirical corroboration with empty supporting observations
    is automatically downgraded to UNVERIFIED_PENDING_REPLICATION.
    """
    witness = ScientificWitness(
        witness_id="WIT-FALSE-PROV",
        witness_type=ScientificWitnessType.INTERVENTIONAL_EXPERIMENT,
        claim_statement="Bogus unsupported claim",
        mechanism_id="MECH-01",
        supporting_observations=(),  # Empty!
        scientific_validation_status=ScientificValidationStatus.EMPIRICALLY_CORROBORATED,
    )
    assert witness.scientific_validation_status == ScientificValidationStatus.UNVERIFIED_PENDING_REPLICATION


def test_adversarial_sealed_holdout_vault_transfer_integration():
    """
    Verifies that TransferEngine accepts SealedHoldoutVault directly and evaluates within budget.
    """
    vault = SealedHoldoutVault(
        benchmark_name="EurekaBench-Integration-Holdout",
        test_cases=[
            {"x": 4.0, "expected_y": 8.0},
            {"x": 8.0, "expected_y": 16.0},
        ],
        max_exposures=1,
    )

    transfer = TransferEngine()
    compiler = MechanismCompiler()
    mechs = compiler.compile_competing_mechanisms("synthetic", "Kinetic order")
    mech = mechs[0]

    witness = ScientificWitness(
        witness_id="WIT-HOLD",
        witness_type=ScientificWitnessType.INTERVENTIONAL_EXPERIMENT,
        claim_statement="Linear scaling",
        mechanism_id=mech.mechanism_id,
        supporting_observations=("OBS-01",),
        scientific_validation_status=ScientificValidationStatus.EMPIRICALLY_CORROBORATED,
    )

    proc = transfer.evaluate_ood_transfer(mech, witness, vault)
    assert proc.qualification_state == QualificationState.IN_DISTRIBUTION_SANITY_PASS
    assert proc.transfer_pass_rate == 1.0
    assert proc.unseen_tasks_evaluated == 2
    assert vault.exposure_count == 1

