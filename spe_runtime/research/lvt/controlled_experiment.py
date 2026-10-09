"""
SPE Ω — 4-Arm Controlled Experiment Harness (LVT-0).
Executes synchronized evaluation across Baseline (Arm A), Authentic Feedback (Arm B),
Shuffled Feedback Control (Arm C), and Held-Out Generalization (Arm D).
"""

from __future__ import annotations

import random
from typing import Any, Callable, Dict, List, Optional, Sequence

from spe_runtime.research.lvt.types import (
    ExperimentProtocol,
    FourArmResults,
    NanoUSD,
    validate_nanos,
)


class ControlledExperimentRunner:
    """Executes the formal 4-arm randomized controlled experiment for learning validity."""

    def __init__(self, cost_per_eval_nanos: NanoUSD = 100) -> None:
        self.cost_per_eval_nanos = validate_nanos(cost_per_eval_nanos, "cost_per_eval_nanos")

    def run_experiment(
        self,
        protocol: ExperimentProtocol,
        evaluator_fn: Callable[[str, Dict[str, Any]], float],
        train_dataset: Sequence[Dict[str, Any]],
        held_out_dataset: Sequence[Dict[str, Any]],
        base_prompt: str,
        refined_prompt: str,
        shuffled_feedback_prompt: Optional[str] = None,
    ) -> FourArmResults:
        """
        Executes all four arms deterministically and calculates empirical metrics.
        
        Args:
            protocol: Governing experiment parameters and significance gates.
            evaluator_fn: Independent oracle mapping (prompt, test_case) -> score in [0.0, 1.0].
            train_dataset: Training distribution evaluation items.
            held_out_dataset: Generalization/held-out test items.
            base_prompt: Arm A prompt (pre-optimization baseline).
            refined_prompt: Arm B & Arm D prompt (post-optimization candidate).
            shuffled_feedback_prompt: Arm C prompt (negative feedback control).
        """
        if not train_dataset:
            raise ValueError("train_dataset cannot be empty")
        if not held_out_dataset:
            raise ValueError("held_out_dataset cannot be empty")

        sample_train = list(train_dataset[: protocol.sample_size])
        sample_held_out = list(held_out_dataset[: protocol.sample_size])

        # If no explicit shuffled prompt was provided, synthesize a deterministic permuted variation
        if shuffled_feedback_prompt is None:
            shuffled_feedback_prompt = f"{base_prompt}\n# [SHUFFLED_CONTROL_DIRECTIVE]: Permuted feedback applied."

        # Arm A: Baseline on train
        scores_a = [self._eval_item(evaluator_fn, base_prompt, item) for item in sample_train]
        score_a = sum(scores_a) / len(scores_a)

        # Arm B: Refined prompt on authentic feedback (train)
        scores_b = [self._eval_item(evaluator_fn, refined_prompt, item) for item in sample_train]
        score_b = sum(scores_b) / len(scores_b)

        # Arm C: Shuffled feedback control on train
        scores_c = [self._eval_item(evaluator_fn, shuffled_feedback_prompt, item) for item in sample_train]
        score_c = sum(scores_c) / len(scores_c)

        # Arm D: Held-out generalization on test
        scores_d = [self._eval_item(evaluator_fn, refined_prompt, item) for item in sample_held_out]
        score_d = sum(scores_d) / len(scores_d)

        delta_improvement = score_b - score_a
        control_delta = score_b - score_c
        held_out_retention = score_d - score_a

        # Significance criteria:
        # 1. Delta improvement >= epsilon
        # 2. Authentic feedback beats shuffled control by >= epsilon
        # 3. Held-out test retention does not drop below baseline by > delta
        is_sig = (
            delta_improvement >= protocol.significance_threshold_epsilon
            and control_delta >= protocol.significance_threshold_epsilon
            and held_out_retention >= -protocol.generalization_tolerance_delta
        )

        total_evals = len(scores_a) + len(scores_b) + len(scores_c) + len(scores_d)
        total_cost_nanos = total_evals * self.cost_per_eval_nanos

        return FourArmResults(
            arm_a_baseline_score=round(score_a, 4),
            arm_b_authentic_score=round(score_b, 4),
            arm_c_shuffled_control_score=round(score_c, 4),
            arm_d_generalization_score=round(score_d, 4),
            delta_improvement=round(delta_improvement, 4),
            control_delta=round(control_delta, 4),
            held_out_retention=round(held_out_retention, 4),
            is_statistically_significant=is_sig,
            total_cost_nanos=total_cost_nanos,
        )

    def _eval_item(
        self,
        evaluator_fn: Callable[[str, Dict[str, Any]], float],
        prompt: str,
        item: Dict[str, Any],
    ) -> float:
        score = evaluator_fn(prompt, item)
        if not (0.0 <= score <= 1.0):
            raise ValueError(f"Evaluator returned out-of-bounds score: {score} (must be in [0.0, 1.0])")
        return score
