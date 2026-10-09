"""
Tests for WorkflowComparisonEngine and Wilson Score Interval Calculations.
"""

import pytest

from spe_runtime.workflows.comparison_engine import (
    CandidateTrialSummary,
    WorkflowComparisonEngine,
    compute_wilson_lower_bound,
)


def test_wilson_score_lower_bound_math():
    # Empty total
    assert compute_wilson_lower_bound(0, 0) == 0.0

    # 10 out of 10 vs 95 out of 100
    w_small_perfect = compute_wilson_lower_bound(10, 10)
    w_large_realistic = compute_wilson_lower_bound(95, 100)

    # 95/100 must mathematically beat 10/10 due to sample size confidence
    assert w_large_realistic > w_small_perfect
    assert round(w_small_perfect, 3) == 0.722
    assert round(w_large_realistic, 3) == 0.888


def test_workflow_comparison_challenger_wins():
    baseline = CandidateTrialSummary(
        candidate_identifier="baseline_without_skill",
        trials_total=100,
        trials_successful=65,
        average_token_consumption=4200,
        average_retries=2.4,
        average_latency_ms=3500,
    )
    challenger = CandidateTrialSummary(
        candidate_identifier="@skill/git-pr-review",
        trials_total=100,
        trials_successful=94,
        average_token_consumption=2600,
        average_retries=0.6,
        average_latency_ms=2100,
    )

    result = WorkflowComparisonEngine.compare(
        task_slug="weekly-project-status",
        baseline=baseline,
        challenger=challenger,
    )

    assert result.winner_identifier == "@skill/git-pr-review"
    assert result.delta_success_rate == pytest.approx(0.29, abs=0.01)
    assert result.delta_wilson_lower > 0.25
    assert result.token_savings_pct > 35.0  # (4200 - 2600)/4200 = 38.1%
    assert result.retry_reduction_pct > 70.0  # (2.4 - 0.6)/2.4 = 75%
    assert "@skill/git-pr-review outperforms baseline_without_skill" in result.verdict_summary

    d = result.to_dict()
    assert d["comparison_id"].startswith("CMP-")
    assert d["winner_identifier"] == "@skill/git-pr-review"
    assert d["token_savings_pct"] == 38.1


def test_workflow_comparison_baseline_retains_lead():
    baseline = CandidateTrialSummary(
        candidate_identifier="@skill/proven-parser",
        trials_total=200,
        trials_successful=190,
        average_token_consumption=1500,
        average_retries=0.2,
        average_latency_ms=1200,
    )
    challenger = CandidateTrialSummary(
        candidate_identifier="@skill/untested-parser",
        trials_total=5,
        trials_successful=5,
        average_token_consumption=1400,
        average_retries=0.1,
        average_latency_ms=1100,
    )

    result = WorkflowComparisonEngine.compare(
        task_slug="invoice-data-extraction",
        baseline=baseline,
        challenger=challenger,
    )

    # 190/200 has a much higher Wilson lower bound than 5/5
    assert result.winner_identifier == "@skill/proven-parser"
    assert "retains superiority" in result.verdict_summary


def test_wilson_score_boundary_conditions():
    # Negative totals
    assert compute_wilson_lower_bound(-5, -10) == 0.0
    assert compute_wilson_lower_bound(5, 0) == 0.0

    # Negative successes clamped to 0
    assert compute_wilson_lower_bound(-1, 100) == compute_wilson_lower_bound(0, 100)

    # Successes exceeding total clamped to total
    assert compute_wilson_lower_bound(150, 100) == compute_wilson_lower_bound(100, 100)


def test_workflow_comparison_zero_baselines_and_tie():
    # Zero baseline consumption and retries
    b_zero = CandidateTrialSummary(
        candidate_identifier="b_zero",
        trials_total=50,
        trials_successful=40,
        average_token_consumption=0,
        average_retries=0.0,
        average_latency_ms=100,
    )
    c_zero = CandidateTrialSummary(
        candidate_identifier="c_zero",
        trials_total=50,
        trials_successful=40,
        average_token_consumption=100,
        average_retries=1.0,
        average_latency_ms=200,
    )

    res = WorkflowComparisonEngine.compare(
        task_slug="edge-task",
        baseline=b_zero,
        challenger=c_zero,
    )

    # Identical trials -> statistical tie
    assert res.winner_identifier == "STATISTICAL_TIE"
    assert "Statistical tie" in res.verdict_summary
    assert res.token_savings_pct == 0.0
    assert res.retry_reduction_pct == 0.0


def test_wilson_confidence_levels_and_zero_trials():
    # Different confidence bounds: higher confidence -> wider interval -> lower lower-bound
    w90 = compute_wilson_lower_bound(80, 100, confidence=0.90)
    w95 = compute_wilson_lower_bound(80, 100, confidence=0.95)
    w99 = compute_wilson_lower_bound(80, 100, confidence=0.99)
    assert w90 > w95 > w99

    # Candidates with zero total trials
    b_empty = CandidateTrialSummary(
        candidate_identifier="b_empty",
        trials_total=0,
        trials_successful=0,
        average_token_consumption=0,
        average_retries=0.0,
        average_latency_ms=0,
    )
    c_empty = CandidateTrialSummary(
        candidate_identifier="c_empty",
        trials_total=0,
        trials_successful=0,
        average_token_consumption=0,
        average_retries=0.0,
        average_latency_ms=0,
    )
    custom_cmd = "spe bench custom --trials 0"
    res = WorkflowComparisonEngine.compare(
        task_slug="empty-task",
        baseline=b_empty,
        challenger=c_empty,
        reproducible_command=custom_cmd,
    )
    assert res.winner_identifier == "STATISTICAL_TIE"
    assert res.reproducible_command == custom_cmd
    assert res.baseline.success_rate == 0.0
    assert res.challenger.success_rate == 0.0

