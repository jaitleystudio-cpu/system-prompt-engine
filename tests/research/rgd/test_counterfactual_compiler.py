"""
Tests for SPE Ω PRO Counterfactual Discovery Compiler (RGD-1)
"""

import pytest
from spe_runtime.research.rgd.types import (
    ResearchMission,
    ResponseSpeedClass,
    EvidenceGraph,
    NANOS_PER_USD,
)
from spe_runtime.research.rgd.counterfactual_compiler import (
    calculate_voi_score,
    compile_competing_theories,
    generate_candidate_experiments,
    select_minimal_discriminating_set,
)


def test_voi_score_exact_formula():
    """
    Test U(e) = E[Delta R(e)] / (C(e) + lambda * T(e))
    Scaled by NANOS_PER_USD (10^9).
    """
    # Exp 1: High info gain, low cost ($0.50), fast (2s)
    # Cost = 500_000_000 nanos, time = 2.0s, lambda = 10_000_000
    # denom = 500_000_000 + 20_000_000 = 520_000_000 nanos
    # Delta R = 0.8
    # VOI = (0.8 * 1e9) / 520_000_000 = 1.538 points/$
    voi1 = calculate_voi_score(0.8, 500_000_000, 2.0, lambda_delay=10_000_000.0)

    # Exp 2: Low info gain, high cost ($5.00), slow (20s)
    # denom = 5_000_000_000 + 200_000_000 = 5_200_000_000 nanos
    # Delta R = 0.2
    # VOI = (0.2 * 1e9) / 5_200_000_000 = 0.038 points/$
    voi2 = calculate_voi_score(0.2, 5_000_000_000, 20.0, lambda_delay=10_000_000.0)

    assert voi1 > voi2
    assert abs(voi1 - 1.53846) < 0.001
    assert abs(voi2 - 0.03846) < 0.001


def test_competing_theories_formulation():
    mission = ResearchMission(
        mission_id="m1",
        objective="Invent an efficient neural audio codec",
        target_domain="AUDIO_ENGINEERING",
        measurable_constraints=["latency <= 20ms"],
        unresolved_assumptions=["sample rate 48kHz"],
        compiled_prompt="",
        execution_plan=[],
        speed_class=ResponseSpeedClass.EVIDENCE_ANSWER,
        created_at=0.0,
    )
    graph = EvidenceGraph(graph_id="g1")
    theories = compile_competing_theories(mission, graph)

    assert len(theories) == 3
    names = [t.name for t in theories]
    assert any("Theory A" in n for n in names)
    assert any("Theory B" in n for n in names)
    assert any("Theory C" in n for n in names)

    # Check prior probabilities sum to 1.0
    total_prior = sum(t.prior_probability for t in theories)
    assert abs(total_prior - 1.0) < 0.001


def test_candidate_experiments_and_minimal_set_selection():
    mission = ResearchMission(
        mission_id="m1",
        objective="Invent an efficient neural audio codec",
        target_domain="AUDIO_ENGINEERING",
        measurable_constraints=["latency <= 20ms"],
        unresolved_assumptions=["sample rate 48kHz"],
        compiled_prompt="",
        execution_plan=[],
        speed_class=ResponseSpeedClass.EVIDENCE_ANSWER,
        created_at=0.0,
    )
    graph = EvidenceGraph(graph_id="g1")
    theories = compile_competing_theories(mission, graph)
    candidates = generate_candidate_experiments(theories, mission)

    assert len(candidates) >= 2
    # Check ranked by VOI descending
    for i in range(len(candidates) - 1):
        assert candidates[i].voi_score >= candidates[i + 1].voi_score

    # Select minimal set under $1.50 budget (1_500_000_000 nanos)
    budget = 1_500_000_000
    selected = select_minimal_discriminating_set(candidates, max_budget_nanos=budget)

    total_cost = sum(e.expected_cost_nanos for e in selected)
    assert total_cost <= budget
    assert len(selected) >= 1

    # Boundary conditions: zero or negative budget returns empty list
    assert select_minimal_discriminating_set(candidates, max_budget_nanos=0) == []
    assert select_minimal_discriminating_set(candidates, max_budget_nanos=-100) == []
    assert select_minimal_discriminating_set(candidates, max_budget_nanos=budget, target_uncertainty_reduction=0.0) == []
    assert select_minimal_discriminating_set(candidates, max_budget_nanos=budget, target_uncertainty_reduction=-0.5) == []


def test_voi_score_input_clamping_and_zero_denominator():
    # Clamping negative delta R to 0
    assert calculate_voi_score(-0.5, 500_000_000, 2.0) == 0.0
    # Clamping delta R > 1 to 1.0
    voi_clamped = calculate_voi_score(2.5, 500_000_000, 2.0, lambda_delay=10_000_000.0)
    voi_one = calculate_voi_score(1.0, 500_000_000, 2.0, lambda_delay=10_000_000.0)
    assert abs(voi_clamped - voi_one) < 1e-6
    # Zero cost, zero time, zero lambda defaults denom to 1.0 without dividing by zero
    voi_zero = calculate_voi_score(1.0, 0, 0.0, lambda_delay=0.0)
    assert abs(voi_zero - float(NANOS_PER_USD)) < 1e-6


def test_materials_science_and_cryptography_theories_and_experiments():
    graph = EvidenceGraph(graph_id="g_test")

    # Materials Science
    mission_mat = ResearchMission(
        mission_id="m_mat",
        objective="Develop high energy density solid-state lithium battery",
        target_domain="MATERIALS_SCIENCE",
        measurable_constraints=[],
        unresolved_assumptions=[],
        compiled_prompt="",
        execution_plan=[],
        speed_class=ResponseSpeedClass.EVIDENCE_ANSWER,
        created_at=0.0,
    )
    theories_mat = compile_competing_theories(mission_mat, graph)
    assert len(theories_mat) == 3
    assert any("Self-Passivating" in t.name for t in theories_mat)
    assert abs(sum(t.prior_probability for t in theories_mat) - 1.0) < 0.001

    exps_mat = generate_candidate_experiments(theories_mat, mission_mat)
    assert len(exps_mat) >= 2
    assert any("exp_mat_operando_tomography" == e.experiment_id for e in exps_mat)

    # Cryptography
    mission_crypto = ResearchMission(
        mission_id="m_crypto",
        objective="Constant-time post-quantum signature verification on embedded microcontroller",
        target_domain="CRYPTOGRAPHY",
        measurable_constraints=[],
        unresolved_assumptions=[],
        compiled_prompt="",
        execution_plan=[],
        speed_class=ResponseSpeedClass.EVIDENCE_ANSWER,
        created_at=0.0,
    )
    theories_crypto = compile_competing_theories(mission_crypto, graph)
    assert len(theories_crypto) == 3
    assert any("Constant-Time Polynomial" in t.name for t in theories_crypto)
    assert abs(sum(t.prior_probability for t in theories_crypto) - 1.0) < 0.001

    exps_crypto = generate_candidate_experiments(theories_crypto, mission_crypto)
    assert len(exps_crypto) >= 2
    assert any("exp_crypto_dudect_trace_leakage" == e.experiment_id for e in exps_crypto)
