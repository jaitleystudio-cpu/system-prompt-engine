"""
Adversarial Verification of RGIC-E1 Qualification Trial 02 — AEQ 4-Arm Benchmark
Part of SPE Ω Research Quarantine.

Tests the 500-case frozen benchmark across 4 arms (Config A, B, C, D) and 5 fault families.
Verifies all 5 preregistered hypotheses and split-filtering integrity.
"""

import pytest
from spe_runtime.research.rgic_e1.trial_02_aeq_benchmark import (
    AEQBenchmarkRunner, AEQTrialSummary, TrialArm, FaultFamily, SplitType
)


def test_aeq_benchmark_case_generation_and_splits():
    runner = AEQBenchmarkRunner()
    assert len(runner.cases) == 500

    # 100 cases per family
    for fam in FaultFamily:
        fam_cases = [c for c in runner.cases if c.family == fam]
        assert len(fam_cases) == 100
        dev_cases = [c for c in fam_cases if c.split == SplitType.DEV]
        sealed_cases = [c for c in fam_cases if c.split == SplitType.SEALED_TEST]
        assert len(dev_cases) == 40
        assert len(sealed_cases) == 60

    total_dev = len([c for c in runner.cases if c.split == SplitType.DEV])
    total_sealed = len([c for c in runner.cases if c.split == SplitType.SEALED_TEST])
    assert total_dev == 200
    assert total_sealed == 300


def test_aeq_benchmark_full_run_passes_all_hypotheses():
    runner = AEQBenchmarkRunner()
    summary: AEQTrialSummary = runner.run_benchmark()

    assert summary.total_cases_evaluated == 500
    assert summary.dev_cases_count == 200
    assert summary.sealed_test_cases_count == 300
    assert summary.passed_all_hypotheses is True

    # Check Preregistered Hypotheses
    # H1: Config D detection rate >= 95%
    assert summary.overall_detection_by_arm[TrialArm.CONFIG_D.value] >= 0.95
    assert summary.overall_detection_by_arm[TrialArm.CONFIG_D.value] == 1.0

    # H2: Zero false rejections on valid payloads
    assert summary.zero_false_rejections_confirmed is True
    total_false_rej = sum(
        r.false_rejections for r in summary.arm_results[TrialArm.CONFIG_D.value]
    )
    assert total_false_rej == 0

    # H3: Statistical superiority over Config C (Wilson lower delta > 0.40)
    assert summary.config_d_superiority_confirmed is True
    c_lower = summary.overall_wilson_lower_by_arm[TrialArm.CONFIG_C.value]
    d_lower = summary.overall_wilson_lower_by_arm[TrialArm.CONFIG_D.value]
    assert (d_lower - c_lower) > 0.40

    # H4: Non-weakening invariant held
    assert summary.non_weakening_invariant_held is True

    # Arm Ordering Check: Config A <= Config B <= Config C < Config D
    rate_a = summary.overall_detection_by_arm[TrialArm.CONFIG_A.value]
    rate_b = summary.overall_detection_by_arm[TrialArm.CONFIG_B.value]
    rate_c = summary.overall_detection_by_arm[TrialArm.CONFIG_C.value]
    rate_d = summary.overall_detection_by_arm[TrialArm.CONFIG_D.value]

    assert rate_a <= rate_b <= rate_c < rate_d
    assert rate_a == 0.0   # Self-check misses all semantic mutants
    assert rate_b == 0.20  # Existing eval catches only simple boolean auth
    assert rate_c == 0.40  # RGIC Closure catches stale bindings and auth drift
    assert rate_d == 1.00  # RGIC + AEQ catches all 5 fault families


def test_aeq_benchmark_split_filtering():
    runner = AEQBenchmarkRunner()

    # Test Dev split only (200 cases)
    dev_summary = runner.run_benchmark(split_filter=SplitType.DEV)
    assert dev_summary.total_cases_evaluated == 200
    assert dev_summary.dev_cases_count == 200
    assert dev_summary.sealed_test_cases_count == 0
    assert dev_summary.passed_all_hypotheses is True
    assert dev_summary.overall_detection_by_arm[TrialArm.CONFIG_D.value] == 1.0

    # Test Sealed Test split only (300 cases)
    sealed_summary = runner.run_benchmark(split_filter=SplitType.SEALED_TEST)
    assert sealed_summary.total_cases_evaluated == 300
    assert sealed_summary.dev_cases_count == 0
    assert sealed_summary.sealed_test_cases_count == 300
    assert sealed_summary.passed_all_hypotheses is True
    assert sealed_summary.overall_detection_by_arm[TrialArm.CONFIG_D.value] == 1.0
