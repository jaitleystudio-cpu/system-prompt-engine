"""
SPE Ω — LVT Evidence Integrity Repair Tests.
Directly reproduces and verifies the resolution of the two critical defects
uncovered in the Qualification Audit:
1. Defect 1: Pseudo-statistical significance replaced with paired t-test & 95% CI.
2. Defect 2: Cross-distribution population mismatch replaced with paired held-out baseline.
3. Data contamination rejection: Strict prevention of train/held-out leakage.
"""

from typing import Any, Dict
import pytest

from spe_runtime.research.lvt import (
    ControlledExperimentRunner,
    EvaluatorType,
    ExperimentProtocol,
    LearningClaim,
    LearningValidator,
    QualificationStatus,
)


def test_auditor_counterexample_cross_distribution_rejected():
    """
    Directly reproduces the auditor's source-derived counterexample:
      - Baseline on training: 0.30
      - Refined candidate on training: 0.90
      - Baseline on held-out: 0.95
      - Refined candidate on held-out: 0.75
    
    Old flawed comparison: 0.75 - 0.30 = +0.45 (falsely passed).
    Repaired paired comparison: 0.75 - 0.95 = -0.20 (correctly rejected!).
    """
    runner = ControlledExperimentRunner()
    validator = LearningValidator()

    protocol = ExperimentProtocol(
        protocol_id="PROTO-COUNTEREXAMPLE-01",
        sample_size=10,
        significance_threshold_epsilon=0.05,
        generalization_tolerance_delta=0.02,
    )

    train_data = [{"id": f"train_{i}"} for i in range(10)]
    held_out_data = [{"id": f"held_{i}"} for i in range(10)]

    def adversarial_oracle(prompt: str, item: Dict[str, Any]) -> float:
        is_held_out = item["id"].startswith("held_")
        is_refined = "REFINED" in prompt

        if not is_held_out:
            # Training data distribution: baseline is 0.30, refined is 0.90
            return 0.90 if is_refined else 0.30
        else:
            # Held-out distribution: baseline is 0.95, refined regressed to 0.75!
            return 0.75 if is_refined else 0.95

    base_prompt = "Base prompt"
    refined_prompt = "Base prompt [REFINED]"

    results = runner.run_experiment(
        protocol=protocol,
        evaluator_fn=adversarial_oracle,
        train_dataset=train_data,
        held_out_dataset=held_out_data,
        base_prompt=base_prompt,
        refined_prompt=refined_prompt,
    )

    # 1. Verify Paired Held-Out Measurements
    assert results.arm_a_baseline_score == 0.30
    assert results.arm_b_authentic_score == 0.90
    assert results.arm_d_baseline_score == 0.95
    assert results.arm_d_generalization_score == 0.75

    # 2. Verify True Paired Held-Out Delta (-0.20, NOT +0.45!)
    assert results.held_out_retention == pytest.approx(-0.20, abs=1e-4)

    # 3. Must be REJECTED: Regression of -0.20 violates tolerance of -0.02
    assert results.is_statistically_significant is False

    # 4. Verify LVT Ledger Rejection
    claim = LearningClaim(
        claim_id="CLM-OVERFIT-01",
        domain="security",
        description="Overfitted prompt that breaks on held-out",
        generator_id="agent-optimizer",
        base_prompt_ref="prompt_v1",
        candidate_prompt_ref="prompt_v2",
        budget_nanos=10_000,
    )
    from spe_runtime.research.lvt.types import LearningValidityTransaction

    tx = LearningValidityTransaction(
        tx_id="TX-AUDIT-01",
        claim=claim,
        protocol=protocol,
        results=results,
        evaluator_id="independent-judge",
        evaluator_type=EvaluatorType.INDEPENDENT_STATIC_ORACLE,
    )

    conjuncts = validator.evaluate_conjuncts(tx)
    assert conjuncts["NoDisqualifyingRegression"] is False

    committed_tx = validator.validate_and_commit(tx)
    assert committed_tx.status == QualificationStatus.REJECTED
    assert "NoDisqualifyingRegression" in committed_tx.rejection_reason


def test_reverse_distribution_shift_passes_fairly():
    """
    Tests reverse shift where held-out task was harder than training,
    but candidate genuinely improved held-out performance:
      - Baseline on training: 0.90, Refined on training: 0.95 (+0.05)
      - Baseline on held-out: 0.30, Refined on held-out: 0.70 (+0.40!)
    """
    runner = ControlledExperimentRunner()

    protocol = ExperimentProtocol(
        protocol_id="PROTO-REVERSE-SHIFT",
        sample_size=10,
        significance_threshold_epsilon=0.04,
        generalization_tolerance_delta=0.02,
    )

    train_data = [{"id": f"train_{i}"} for i in range(10)]
    held_out_data = [{"id": f"held_{i}"} for i in range(10)]

    def oracle(prompt: str, item: Dict[str, Any]) -> float:
        is_held = item["id"].startswith("held_")
        is_refined = "REFINED" in prompt
        if not is_held:
            return 0.95 if is_refined else 0.90
        else:
            return 0.70 if is_refined else 0.30

    results = runner.run_experiment(
        protocol=protocol,
        evaluator_fn=oracle,
        train_dataset=train_data,
        held_out_dataset=held_out_data,
        base_prompt="Base",
        refined_prompt="Base [REFINED]",
    )

    assert results.arm_d_baseline_score == 0.30
    assert results.arm_d_generalization_score == 0.70
    assert results.held_out_retention == pytest.approx(0.40, abs=1e-4)
    assert results.is_statistically_significant is True


def test_high_variance_insignificant_improvement_rejected():
    """
    Defect 1 Reproduction:
    Mean improvement appears to be +0.06 (above epsilon 0.05),
    but item-level variance is high and differences are not statistically significant.
    Repaired runner must calculate p-value > 0.05 and reject.
    """
    runner = ControlledExperimentRunner()

    protocol = ExperimentProtocol(
        protocol_id="PROTO-HIGH-VARIANCE",
        sample_size=10,
        significance_threshold_epsilon=0.05,
    )

    train_data = [{"id": f"train_{i}", "idx": i} for i in range(10)]
    held_out_data = [{"id": f"held_{i}", "idx": i} for i in range(10)]

    # High-variance deltas around mean 0.06: some improved, some regressed
    # sum = 0.60, mean = 0.06 >= epsilon 0.05
    deltas = [0.20, -0.15, 0.10, -0.10, 0.15, -0.05, 0.20, -0.15, 0.15, 0.25]

    def noisy_oracle(prompt: str, item: Dict[str, Any]) -> float:
        idx = item.get("idx", 0)
        is_refined = "REFINED" in prompt
        base_score = 0.50
        if not is_refined:
            return base_score
        else:
            return max(0.0, min(1.0, base_score + deltas[idx]))

    results = runner.run_experiment(
        protocol=protocol,
        evaluator_fn=noisy_oracle,
        train_dataset=train_data,
        held_out_dataset=held_out_data,
        base_prompt="Base",
        refined_prompt="Base [REFINED]",
    )

    assert results.delta_improvement >= 0.05  # Raw mean is >= 0.05
    assert results.p_value > 0.05             # High variance p-value > 0.05
    assert results.confidence_interval_95[0] < 0.0  # 95% CI crosses zero!
    # Must reject as NOT statistically significant!
    assert results.is_statistically_significant is False


def test_low_variance_consistent_improvement_qualified():
    """
    Consistent improvement across items with low variance:
    p-value < 0.01, 95% CI strictly positive.
    Must qualify as statistically significant.
    """
    runner = ControlledExperimentRunner()

    protocol = ExperimentProtocol(
        protocol_id="PROTO-CONSISTENT-IMPROVE",
        sample_size=10,
        significance_threshold_epsilon=0.05,
    )

    train_data = [{"id": f"train_{i}", "idx": i} for i in range(10)]
    held_out_data = [{"id": f"held_{i}", "idx": i} for i in range(10)]

    # Consistent deltas: all +0.12 to +0.15
    deltas = [0.12, 0.15, 0.11, 0.14, 0.13, 0.12, 0.16, 0.11, 0.13, 0.14]

    def consistent_oracle(prompt: str, item: Dict[str, Any]) -> float:
        idx = item.get("idx", 0)
        is_refined = "REFINED" in prompt
        base_score = 0.50
        if not is_refined:
            return base_score
        else:
            return base_score + deltas[idx]

    results = runner.run_experiment(
        protocol=protocol,
        evaluator_fn=consistent_oracle,
        train_dataset=train_data,
        held_out_dataset=held_out_data,
        base_prompt="Base",
        refined_prompt="Base [REFINED]",
    )

    assert results.delta_improvement >= 0.10
    assert results.p_value < 0.001
    assert results.confidence_interval_95[0] > 0.05  # CI strictly positive!
    assert results.is_statistically_significant is True


def test_data_leakage_contamination_detection():
    """Harness detects and rejects train/held-out data overlap."""
    runner = ControlledExperimentRunner()
    protocol = ExperimentProtocol(protocol_id="PROTO-LEAK")

    train_data = [{"id": "item_1"}, {"id": "item_2"}]
    # Contaminated held-out set shares item_1
    contaminated_held_out = [{"id": "item_1"}, {"id": "item_3"}]

    with pytest.raises(ValueError, match="Data contamination detected"):
        runner.run_experiment(
            protocol=protocol,
            evaluator_fn=lambda p, i: 0.8,
            train_dataset=train_data,
            held_out_dataset=contaminated_held_out,
            base_prompt="Base",
            refined_prompt="Refined",
        )
