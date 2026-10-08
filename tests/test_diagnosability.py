"""Tests for Diagnosability Type System, Semantic Channel, and Active Decoding."""

import pytest
from spe_runtime.diagnosability import (
    ActiveSyndromeScheduler,
    BayesianSyndromeDecoder,
    DFTCoDesignEngine,
    DiagnosabilityEnvelope,
    DiagnosticResult,
    ExecutionPlanCandidate,
    FaultClass,
    SemanticChannelMatrix,
    SensorSpec,
    build_calibrated_channel_matrix,
    calculate_diagnosability_envelope,
    compute_risk_weighted_semantic_distance,
)


@pytest.fixture
def sample_channel() -> SemanticChannelMatrix:
    sensors = [
        SensorSpec("s_freshness", "Freshness Probe", sensitivity=0.96, specificity=0.98, execution_cost_usd=0.0005),
        SensorSpec("s_authority", "Authority Lease Validator", sensitivity=0.99, specificity=0.99, execution_cost_usd=0.0008),
        SensorSpec("s_schema", "Schema Conformance Validator", sensitivity=0.95, specificity=0.97, execution_cost_usd=0.0004),
    ]
    faults = [
        FaultClass("F1_STALE_DATA", "Stale Data", "Obsolescence in retrieved context", prior_probability=0.33, severity_weight=1.0),
        FaultClass("F2_REVOKED_AUTH", "Revoked Authority", "Expired or missing capability lease", prior_probability=0.33, severity_weight=3.0),
        FaultClass("F3_SCHEMA_ERROR", "Schema Error", "Malformed JSON keys", prior_probability=0.33, severity_weight=1.0),
    ]
    return build_calibrated_channel_matrix("gpt-test", "fintech", sensors, faults)


def test_channel_matrix_and_risk_weighted_distance(sample_channel):
    # Risk-Weighted Distance between Stale Data and Revoked Authority must incorporate high severity weight (3.0)
    dist_auth = compute_risk_weighted_semantic_distance(sample_channel, "F1_STALE_DATA", "F2_REVOKED_AUTH")
    dist_schema = compute_risk_weighted_semantic_distance(sample_channel, "F1_STALE_DATA", "F3_SCHEMA_ERROR")

    assert dist_auth > 0.0
    assert dist_schema > 0.0
    # Because F2 has severity_weight 3.0 vs 1.0, distance should be heavily scaled
    assert dist_auth > dist_schema


def test_diagnosability_envelope_and_observability_debt(sample_channel):
    envelope = calculate_diagnosability_envelope(sample_channel, min_separation_threshold=0.10)
    assert len(envelope.diagnosable_faults) == 3
    assert envelope.observability_debt >= 0.0
    assert envelope.minimum_semantic_distance > 0.0


def test_bayesian_decoder_correctly_identifies_fault(sample_channel):
    decoder = BayesianSyndromeDecoder()
    # Stale data activates s_freshness
    syndrome = {"s_freshness": 1.0, "s_authority": 0.0, "s_schema": 0.0}
    res: DiagnosticResult = decoder.decode(syndrome, sample_channel)

    assert res.decoded_fault == "F1_STALE_DATA"
    assert res.confidence > 0.70
    assert res.is_unknown_family is False


def test_open_world_rejection_for_unseen_anomaly(sample_channel):
    decoder = BayesianSyndromeDecoder(open_world_threshold=0.65)
    # An unseen anomaly produces an ambiguous syndrome where no sensor cleanly fires
    syndrome = {"s_freshness": 0.45, "s_authority": 0.45, "s_schema": 0.45}
    res: DiagnosticResult = decoder.decode(syndrome, sample_channel)

    # UNKNOWN FAULT FAMILY must be triggered (UNKNOWN != nearest known failure)
    assert res.is_unknown_family is True
    assert res.decoded_fault == "UNKNOWN_FAULT_FAMILY"


def test_active_syndrome_scheduler_with_voi(sample_channel):
    scheduler = ActiveSyndromeScheduler()
    # Initial ambiguous observation
    initial_syndrome = {"s_schema": 0.1}

    # Oracle evaluator function for active probes
    def mock_oracle(sensor_id: str) -> float:
        if sensor_id == "s_authority":
            return 0.99
        return 0.05

    res = scheduler.schedule_and_decode(
        initial_syndrome=initial_syndrome,
        channel=sample_channel,
        oracle_evaluator=mock_oracle,
        target_confidence=0.80,
    )

    assert res.decoded_fault == "F2_REVOKED_AUTH"
    assert res.confidence >= 0.80
    assert len(res.executed_probes) >= 2
    assert res.total_diagnostic_cost_usd > 0.0


def test_dft_co_design_selects_optimal_lifecycle_plan(sample_channel):
    engine = DFTCoDesignEngine()

    # Plan A: Cheap upfront, but minimal witnesses -> high observability debt and catastrophic recovery cost
    low_obs_sensors = [SensorSpec("s_generic", "Generic Validator", 0.5, 0.5, 0.0001)]
    plan_a_channel = build_calibrated_channel_matrix("m", "w", low_obs_sensors, sample_channel.faults)
    plan_a = ExecutionPlanCandidate(
        plan_id="plan_a_naive",
        description="Naive un-instrumented plan",
        nominal_execution_cost=0.010,
        channel_matrix=plan_a_channel,
        failure_probability=0.25,
        repair_cost_multiplier=3.0,
    )

    # Plan B: Well instrumented (Semantic DFT) -> slightly higher upfront, but low observability debt and cheap localized repair
    plan_b = ExecutionPlanCandidate(
        plan_id="plan_b_dft",
        description="Semantic DFT instrumented plan",
        nominal_execution_cost=0.012,
        channel_matrix=sample_channel,
        failure_probability=0.10,
        repair_cost_multiplier=0.5,
    )

    opt_result = engine.optimize([plan_a, plan_b])
    assert opt_result.optimal_plan_id == "plan_b_dft"
    assert opt_result.lifecycle_cost < opt_result.all_evaluated_costs["plan_a_naive"]
