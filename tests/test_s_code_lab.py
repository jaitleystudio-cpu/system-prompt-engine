"""Tests for S-CODE Lab v0 Empirical Benchmark Suite."""

import pytest
from spe_runtime.s_code_lab import (
    ArmEvaluationResult,
    SCodeLabReport,
    SeededFault,
    TaskFamily,
    get_canonical_seeded_faults,
    run_s_code_lab_v0,
)


def test_seeded_faults_inventory():
    faults = get_canonical_seeded_faults()
    assert len(faults) == 10
    # Must include both closed-world and open-world faults
    known_faults = [f for f in faults if not f.is_open_world_unseen]
    unseen_faults = [f for f in faults if f.is_open_world_unseen]
    assert len(known_faults) == 8
    assert len(unseen_faults) == 2


def test_s_code_lab_v0_benchmark_execution():
    report: SCodeLabReport = run_s_code_lab_v0(evidence_class="SIMULATED")

    assert report.evaluated_faults_count == 10
    assert report.evidence_class == "SIMULATED"
    assert len(report.arm_results) == 4

    arm_a = report.arm_results["Baseline A: Manual Prompt"]
    arm_b = report.arm_results["Baseline B: Prompt Optimizer (DSPy style)"]
    arm_c = report.arm_results["Baseline C: GraphTracer (Post-Hoc Tracing)"]
    arm_d = report.arm_results["Baseline D: SPE Dual Supercompiler + ESSA"]

    # SPE must achieve superior metrics:
    # 1. Higher accuracy
    assert arm_d.fault_localization_accuracy >= 0.85
    assert arm_d.fault_localization_accuracy > arm_c.fault_localization_accuracy
    assert arm_d.fault_localization_accuracy > arm_a.fault_localization_accuracy

    # 2. Lower Cost of Dependable Intelligence (CDI)
    assert arm_d.cdi_score < arm_c.cdi_score
    assert arm_d.cdi_score < arm_b.cdi_score
    assert arm_d.cdi_score < arm_a.cdi_score

    # 3. Strict 100% rejection of open-world unseen faults
    assert arm_d.unknown_rejection_accuracy == 1.00
    assert arm_c.unknown_rejection_accuracy < 0.50

    # 4. Formatted summary validation
    summary = report.to_summary()
    assert "S-CODE Lab v0 Benchmark Report" in summary
    assert "Baseline D: SPE Dual Supercompiler + ESSA" in summary
