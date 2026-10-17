"""
Tests for VSOD Calculator.
"""

import pytest
from spe_runtime.research.egac.types import NANOS_PER_USD
from spe_runtime.research.egac.vsod_calculator import VsodCalculator

def test_vsod_calculation_formula():
    calc = VsodCalculator()

    # 100 verified successes, cost = $5.00 (5,000,000,000 nanos)
    # VSOD = 100 / 5 = 20.0 successes per dollar
    metrics = calc.calculate_vsod(
        n_verified_successes=100,
        total_cost_nanos=5_000_000_000,
        tokens_saved=12000,
        latency_p95_ms=350,
        critical_failures=0,
    )

    assert metrics.vsod_score == 20.0
    assert metrics.total_cost_usd == 5.0
    assert metrics.n_verified_successes == 100
    assert metrics.critical_failures == 0

def test_system_a_vs_system_b_scenario():
    """
    Scenario from Section 10 of Research Brief:
    System A: 65 verified successes, $10 cost (10*10^9 nanos) -> VSOD = 6.5
    System B: 85 verified successes, $8 cost (8*10^9 nanos) -> VSOD = 10.625
    """
    calc = VsodCalculator()

    sys_a = calc.calculate_vsod(n_verified_successes=65, total_cost_nanos=10 * NANOS_PER_USD)
    sys_b = calc.calculate_vsod(n_verified_successes=85, total_cost_nanos=8 * NANOS_PER_USD)

    assert sys_a.vsod_score == 6.5
    assert sys_b.vsod_score == 10.625

    comparison = calc.compare_systems(baseline=sys_a, treatment=sys_b)
    assert comparison["is_superior"] is True
    assert comparison["vsod_gain_pct"] > 60.0  # (10.625 - 6.5) / 6.5 = +63.46%
    assert comparison["cost_savings_nanos"] == 2 * NANOS_PER_USD
