"""
SPE Ω — 4-Arm Controlled Experiment Harness Tests.
Verifies synchronized 4-arm execution, metric calculations, and edge cases.
"""

from typing import Any, Dict
import pytest

from spe_runtime.research.lvt import (
    ControlledExperimentRunner,
    ExperimentProtocol,
    FourArmResults,
)


def test_four_arm_experiment_successful_run():
    """Harness runs all four arms and computes statistical metrics."""
    runner = ControlledExperimentRunner(cost_per_eval_nanos=150)
    protocol = ExperimentProtocol(
        protocol_id="PROTO-TEST-01",
        sample_size=10,
        significance_threshold_epsilon=0.10,
        generalization_tolerance_delta=0.05,
    )

    train_data = [{"id": i, "difficulty": "normal"} for i in range(10)]
    held_out_data = [{"id": i + 100, "difficulty": "hard"} for i in range(10)]

    def mock_evaluator(prompt: str, item: Dict[str, Any]) -> float:
        if "AUTHENTIC_OPTIMIZATION" in prompt:
            # Candidate prompt with authentic feedback performs well on both train and held-out
            return 0.95
        elif "SHUFFLED_CONTROL" in prompt:
            # Shuffled negative feedback control performs near baseline
            return 0.65
        else:
            # Baseline prompt
            return 0.60

    base_prompt = "You are a helpful assistant."
    refined_prompt = "You are a helpful assistant. [AUTHENTIC_OPTIMIZATION]: Follow strict JSON schema."
    shuffled_prompt = "You are a helpful assistant. [SHUFFLED_CONTROL]: Permuted irrelevant rules."

    results = runner.run_experiment(
        protocol=protocol,
        evaluator_fn=mock_evaluator,
        train_dataset=train_data,
        held_out_dataset=held_out_data,
        base_prompt=base_prompt,
        refined_prompt=refined_prompt,
        shuffled_feedback_prompt=shuffled_prompt,
    )

    assert isinstance(results, FourArmResults)
    assert results.arm_a_baseline_score == 0.60
    assert results.arm_b_authentic_score == 0.95
    assert results.arm_c_shuffled_control_score == 0.65
    assert results.arm_d_generalization_score == 0.95

    assert results.delta_improvement == pytest.approx(0.35, abs=1e-4)
    assert results.control_delta == pytest.approx(0.30, abs=1e-4)
    assert results.held_out_retention == pytest.approx(0.35, abs=1e-4)
    assert results.is_statistically_significant is True

    # Total evals: 10 * 4 = 40 evals * 150 nanos = 6000 nanos
    assert results.total_cost_nanos == 6000


def test_four_arm_experiment_empty_dataset_raises():
    """Harness rejects empty datasets fail-closed."""
    runner = ControlledExperimentRunner()
    protocol = ExperimentProtocol(protocol_id="PROTO-TEST-02")

    with pytest.raises(ValueError, match="train_dataset cannot be empty"):
        runner.run_experiment(
            protocol=protocol,
            evaluator_fn=lambda p, i: 1.0,
            train_dataset=[],
            held_out_dataset=[{"a": 1}],
            base_prompt="base",
            refined_prompt="refined",
        )

    with pytest.raises(ValueError, match="held_out_dataset cannot be empty"):
        runner.run_experiment(
            protocol=protocol,
            evaluator_fn=lambda p, i: 1.0,
            train_dataset=[{"a": 1}],
            held_out_dataset=[],
            base_prompt="base",
            refined_prompt="refined",
        )


def test_four_arm_experiment_invalid_oracle_score_raises():
    """Harness catches out-of-bound evaluator scores (<0.0 or >1.0)."""
    runner = ControlledExperimentRunner()
    protocol = ExperimentProtocol(protocol_id="PROTO-TEST-03")

    with pytest.raises(ValueError, match="out-of-bounds score"):
        runner.run_experiment(
            protocol=protocol,
            evaluator_fn=lambda p, i: 1.5,  # Invalid!
            train_dataset=[{"a": 1}],
            held_out_dataset=[{"a": 1}],
            base_prompt="base",
            refined_prompt="refined",
        )


def test_four_arm_default_shuffled_prompt_synthesis():
    """Harness synthesizes a deterministic shuffled control prompt if not provided."""
    runner = ControlledExperimentRunner()
    protocol = ExperimentProtocol(protocol_id="PROTO-TEST-04", sample_size=2)

    train_data = [{"id": 1}, {"id": 2}]
    held_out_data = [{"id": 3}, {"id": 4}]

    captured_prompts = []

    def capturing_evaluator(prompt: str, item: Dict[str, Any]) -> float:
        captured_prompts.append(prompt)
        return 0.8

    runner.run_experiment(
        protocol=protocol,
        evaluator_fn=capturing_evaluator,
        train_dataset=train_data,
        held_out_dataset=held_out_data,
        base_prompt="base_directive",
        refined_prompt="refined_directive",
        shuffled_feedback_prompt=None,
    )

    # Shuffled control directive should appear in captured prompts
    assert any("[SHUFFLED_CONTROL_DIRECTIVE]" in p for p in captured_prompts)
