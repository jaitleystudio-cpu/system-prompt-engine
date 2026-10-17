"""
Unit Tests for Discovery Utility Objective Calculator
"""

import pytest
from spe_runtime.research.agi_brain.objective import DiscoveryObjectiveCalculator

def test_exact_nanousd_computation_and_cost_accounting():
    calc = DiscoveryObjectiveCalculator(lambda_weight=1.5)

    # 100,000,000 nanos = 0.10 USD
    res = calc.compute_utility(
        delta_k_verified=10.0,
        delta_t_transfer=5.0,
        compute_cost_nanos=100_000_000,
        measurement_cost_nanos=50_000_000,
        human_cost_nanos=0,
        has_false_acceptance=False,
    )

    assert res["total_cost_nanos"] == 150_000_000
    assert res["total_cost_usd"] == pytest.approx(0.15, 0.001)
    assert res["utility_score"] > 0
    assert res["penalty_applied_nanos"] == 0

def test_heavy_penalty_for_false_acceptance():
    calc = DiscoveryObjectiveCalculator(
        lambda_weight=1.0,
        false_acceptance_penalty_nanos=10_000_000_000, # $10 penalty
    )

    res_clean = calc.compute_utility(
        delta_k_verified=5.0,
        delta_t_transfer=5.0,
        compute_cost_nanos=50_000_000,
        measurement_cost_nanos=0,
        has_false_acceptance=False,
    )

    res_penalized = calc.compute_utility(
        delta_k_verified=5.0,
        delta_t_transfer=5.0,
        compute_cost_nanos=50_000_000,
        measurement_cost_nanos=0,
        has_false_acceptance=True,
    )

    assert res_penalized["utility_score"] < res_clean["utility_score"]
    assert res_penalized["penalty_applied_nanos"] == 10_000_000_000
