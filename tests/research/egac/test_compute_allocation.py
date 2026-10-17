"""
Tests for Mechanism B: Compute Allocation based on Value of Additional Reasoning.
"""

import pytest
from spe_runtime.research.egac.types import (
    NANOS_PER_USD,
    ComputationalAction,
    ExperienceLevel,
    TechniqueType,
    TechniqueSetting,
)
from spe_runtime.research.egac.compute_allocation import ValueOfInformationAllocator

def test_exact_integer_nanousd_invariant():
    assert NANOS_PER_USD == 1_000_000_000

def test_voi_score_calculation():
    allocator = ValueOfInformationAllocator(default_lambda_latency=0.0)

    # Action 1: High quality gain (0.8), low cost ($0.05 = 50M nanos), 100ms
    act1 = ComputationalAction(
        action_id="act-01",
        name="Lean 4 Verification",
        expected_delta_q=0.8,
        expected_cost_nanos=50_000_000,
        expected_latency_ms=100,
    )
    # Action 2: Low quality gain (0.2), high cost ($0.50 = 500M nanos), 5000ms
    act2 = ComputationalAction(
        action_id="act-02",
        name="Speculative Rerank",
        expected_delta_q=0.2,
        expected_cost_nanos=500_000_000,
        expected_latency_ms=5000,
    )

    voi1 = allocator.compute_voi(act1)
    voi2 = allocator.compute_voi(act2)

    # VOI 1 = 0.8 * 10^9 / 50*10^6 = 16.0 quality pts / USD
    # VOI 2 = 0.2 * 10^9 / 500*10^6 = 0.4 quality pts / USD
    assert voi1 == pytest.approx(16.0, rel=1e-3)
    assert voi2 == pytest.approx(0.4, rel=1e-3)
    assert voi1 > voi2

def test_ranking_actions_by_voi():
    allocator = ValueOfInformationAllocator(default_lambda_latency=10_000.0)
    actions = [
        ComputationalAction("a1", "Cheap Quick Check", expected_delta_q=0.4, expected_cost_nanos=10_000_000, expected_latency_ms=100),
        ComputationalAction("a2", "Deep Search", expected_delta_q=0.5, expected_cost_nanos=400_000_000, expected_latency_ms=4000),
        ComputationalAction("a3", "Zero Gain Run", expected_delta_q=0.0, expected_cost_nanos=1_000_000, expected_latency_ms=50),
    ]
    ranked = allocator.rank_actions(actions)
    assert ranked[0][0].action_id == "a1"
    assert ranked[-1][0].action_id == "a3"

def test_planning_immediate_level():
    allocator = ValueOfInformationAllocator()
    strat = allocator.plan_strategy("What is the capital of France?", ExperienceLevel.IMMEDIATE)

    assert strat.experience_level == ExperienceLevel.IMMEDIATE
    assert strat.reasoning_budget == 1
    assert strat.estimated_cost_nanos <= 15_000_000
    assert strat.estimated_latency_ms <= 500
    assert strat.techniques_enabled[TechniqueType.EXACT_MATCH_RESPONSE_CACHE] == TechniqueSetting.FORCE_ON

def test_planning_discovery_level_protects_output_budget():
    allocator = ValueOfInformationAllocator()
    strat = allocator.plan_strategy(
        "Derive a novel formulation of non-equilibrium thermodynamics with full Lean 4 proofs.",
        ExperienceLevel.DISCOVERY,
    )

    assert strat.experience_level == ExperienceLevel.DISCOVERY
    assert strat.reasoning_budget >= 10
    # Strictly forbid output token budget truncation
    assert strat.techniques_enabled[TechniqueType.OUTPUT_TOKEN_BUDGET_2048] == TechniqueSetting.FORCE_OFF
    assert strat.techniques_enabled[TechniqueType.CONCISE_OUTPUT_INSTRUCTION] == TechniqueSetting.FORCE_OFF
    assert strat.verification_depth == "DEEP_FORMAL_AND_COUNTERFACTUAL"

def test_planning_expert_level_difficulty_escalation():
    allocator = ValueOfInformationAllocator()
    # High difficulty prompt
    strat_hard = allocator.plan_strategy("Audit cryptographic zero-knowledge proof.", ExperienceLevel.EXPERT, difficulty_score=0.85)
    # Low difficulty prompt
    strat_easy = allocator.plan_strategy("Convert CSV to JSON schema.", ExperienceLevel.EXPERT, difficulty_score=0.30)

    assert strat_hard.reasoning_budget > strat_easy.reasoning_budget
    assert strat_hard.estimated_cost_nanos > strat_easy.estimated_cost_nanos

def test_constrained_optimization_infeasibility_fallback():
    allocator = ValueOfInformationAllocator()
    # Impossible constraint: 99.9% success required within 50ms
    strat = allocator.plan_strategy(
        "Complex theorem verification",
        experience_level=ExperienceLevel.EXPERT,
        difficulty_score=0.9,
        q_min=0.999,
        max_latency_ms=50,
    )
    assert not strat.is_feasible
    assert "cannot be jointly met" in (strat.infeasibility_reason or "")
    # Must retain qualified baseline
    assert strat.model_name in {"spe-expert-pro", "spe-frontier-reasoner-omega"}

def test_planning_protects_word_count_output_budgets():
    allocator = ValueOfInformationAllocator()
    variations = [
        "Write a 100,000-word novel on neural computation.",
        "Generate a 50k dissertation.",
        "Produce a complete treatise on cosmology.",
    ]
    for prompt in variations:
        strat = allocator.plan_strategy(prompt, ExperienceLevel.IMMEDIATE)
        # In all long-form variations, 2048 token cap must NEVER be enabled
        assert strat.techniques_enabled[TechniqueType.OUTPUT_TOKEN_BUDGET_2048] == TechniqueSetting.FORCE_OFF

