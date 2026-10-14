"""
Adversarial end-to-end integration test for SpeCwcEngine.
"""

import pytest
from spe_runtime.research.cwc.engine import SpeCwcEngine
from spe_runtime.research.cwc.types import (
    IdentifiabilityStatus,
    InterventionalAction,
    ObservationWitness,
    QualificationState,
)


def test_spe_cwc_engine_end_to_end_discovery_cycle():
    engine = SpeCwcEngine(epsilon_ident=0.05, witness_tolerance=0.15)

    act1 = InterventionalAction(
        action_id="ACT-EXP-01",
        target_variable="x",
        intervention_value=2.0,
        description="Measure response at x=2.0 to separate linear vs quadratic kinetics",
        is_authorized=True,
        cost_nanos=150_000_000,  # $0.15 USD
        risk_nanos=10_000_000,
        expected_information_gain=1.2,
        expected_value_sample_info=1.5,
        falsification_potential=0.85,
    )
    act_unauth = InterventionalAction(
        action_id="ACT-EXP-UNAUTH",
        target_variable="x_extreme",
        intervention_value=100.0,
        description="Over-voltage stress test",
        is_authorized=False,
        cost_nanos=2_000_000_000,
        risk_nanos=10_000_000_000,
        expected_information_gain=2.0,
        expected_value_sample_info=2.0,
        falsification_potential=0.99,
    )

    simulated_obs = ObservationWitness(
        observation_id="OBS-EXP-01",
        action_id="ACT-EXP-01",
        measured_variable="x_intervene_2",
        observed_value=4.02,  # Close to M1's prediction of 4.0
        standard_error=0.02,
        is_negative_control=False,
        reproducible_artifact_uri="file:///measurements/run_402.json",
        timestamp_utc="2026-10-14T00:05:00Z",
    )

    ood_cases = [
        {"x": 4.0, "expected_y": 8.0, "is_negative_control": False},
        {"x": 6.0, "expected_y": 12.0, "is_negative_control": False},
        {"x": 10.0, "expected_y": 20.0, "is_negative_control": False},
        {"x": 12.0, "expected_y": 0.0, "is_negative_control": True},
    ]

    result = engine.execute_discovery_cycle(
        domain="synthetic kinetics",
        problem_description="Determine whether the reaction follows linear or quadratic rate acceleration",
        baseline_condition="x_baseline",
        candidate_actions=[act1, act_unauth],
        simulated_observation=simulated_obs,
        ood_transfer_cases=ood_cases,
    )

    # 1. Observational Equivalence verified at baseline
    assert result.identifiability_status == IdentifiabilityStatus.OBSERVATIONALLY_EQUIVALENT
    assert result.total_variation_gap < 0.05

    # 2. Decisive experiment selected with positive JSD
    assert result.selected_action is not None
    assert result.selected_action.action_id == "ACT-EXP-01"
    assert result.jensen_shannon_disagreement > 0.0

    # 3. Precommitment Digest locked
    assert result.precommitment is not None
    assert len(result.precommitment.digest_sha256) == 64

    # 4. Scientific Witness adjudicated and sealed
    assert result.scientific_witness is not None
    assert result.scientific_witness.truth_status == "SUPPORTED"
    assert result.scientific_witness.mechanism_id == "MECH-CORE-01"
    assert len(result.scientific_witness.sha256_seal) == 64

    # 5. Procedure compounded and qualified for in-distribution sanity (CWC-F09)
    assert result.reusable_procedure is not None
    assert result.reusable_procedure.qualification_state == QualificationState.IN_DISTRIBUTION_SANITY_PASS
    assert result.reusable_procedure.transfer_pass_rate == 1.0

    # 6. Reclassified cost fixture ratio (CWC-F04)
    assert result.benchmark_type == "ILLUSTRATIVE_COST_FIXTURE"
    assert result.is_100x_empirically_proven is False
    assert result.cost_ratio_fixture >= 100.0
    assert result.productivity_gain_g >= 100.0


def test_anti_harking_action_mismatch_blocks_witness():
    engine = SpeCwcEngine()
    act1 = InterventionalAction(
        action_id="ACT-EXP-01",
        target_variable="x",
        intervention_value=2.0,
        description="Probe 2",
        is_authorized=True,
        cost_nanos=100_000,
        risk_nanos=0,
        expected_information_gain=1.0,
        expected_value_sample_info=1.0,
        falsification_potential=0.8,
    )
    # Observation with different action ID (HARKing attempt)
    mismatched_obs = ObservationWitness(
        observation_id="OBS-MISMATCH",
        action_id="ACT-WRONG-99",
        measured_variable="x_intervene_2",
        observed_value=4.0,
        standard_error=0.0,
        is_negative_control=False,
        reproducible_artifact_uri="file:///measurements/run.json",
        timestamp_utc="2026-10-14T00:00:00Z",
    )

    with pytest.raises(ValueError, match="HARKing risk"):
        engine.execute_discovery_cycle(
            domain="synthetic",
            problem_description="Test mismatch",
            candidate_actions=[act1],
            simulated_observation=mismatched_obs,
        )
