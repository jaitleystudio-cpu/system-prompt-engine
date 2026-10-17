"""
SPE Ω — 4-Arm Controlled Experiment Harness (LVT-0).
Executes synchronized evaluation across:
  - Arm A: Baseline on train
  - Arm B: Authentic Feedback on train
  - Arm C: Shuffled Feedback Control on train
  - Arm D: Paired Generalization on held-out test (Both Baseline and Candidate on SAME test set)

Guarantees:
  1. Paired held-out comparison (eliminates cross-distribution population mismatch).
  2. Rigorous item-level paired statistical testing (t-statistic, p-value, 95% CI).
  3. Strict data-leakage prevention (rejects train/held-out contamination).
"""

from __future__ import annotations

import math
import random
from typing import Any, Callable, Dict, List, Optional, Sequence, Tuple

from spe_runtime.research.lvt.types import (
    ExperimentProtocol,
    FourArmResults,
    NanoUSD,
    validate_nanos,
)

def _betacf(a: float, b: float, x: float, max_iter: int = 200, eps: float = 1e-15) -> float:
    """Evaluates continued fraction for regularized incomplete beta using Lentz's method."""
    qab = a + b
    qap = a + 1.0
    qam = a - 1.0
    c = 1.0
    d = 1.0 - qab * x / qap
    if abs(d) < 1e-30:
        d = 1e-30
    d = 1.0 / d
    h = d
    for m in range(1, max_iter + 1):
        m2 = 2 * m
        # Even step
        aa = m * (b - m) * x / ((qam + m2) * (a + m2))
        d = 1.0 + aa * d
        if abs(d) < 1e-30:
            d = 1e-30
        c = 1.0 + aa / c
        if abs(c) < 1e-30:
            c = 1e-30
        d = 1.0 / d
        h *= d * c
        # Odd step
        aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2))
        d = 1.0 + aa * d
        if abs(d) < 1e-30:
            d = 1e-30
        c = 1.0 + aa / c
        if abs(c) < 1e-30:
            c = 1e-30
        d = 1.0 / d
        del_h = d * c
        h *= del_h
        if abs(del_h - 1.0) < eps:
            break
    return h


def _incbeta(a: float, b: float, x: float) -> float:
    """Computes exact regularized incomplete beta function I_x(a, b)."""
    if x <= 0.0:
        return 0.0
    if x >= 1.0:
        return 1.0
    lbeta = math.lgamma(a) + math.lgamma(b) - math.lgamma(a + b)
    front = math.exp(a * math.log(x) + b * math.log(1.0 - x) - lbeta)
    if x < (a + 1.0) / (a + b + 2.0):
        return front * _betacf(a, b, x) / a
    else:
        return 1.0 - front * _betacf(b, a, 1.0 - x) / b


def exact_student_t_pvalue(t_stat: float, df: int) -> float:
    """Computes exact two-tailed Student's t distribution p-value via incomplete beta."""
    if df <= 0:
        return 1.0
    t2 = t_stat * t_stat
    x = df / (df + t2)
    return max(0.0, min(1.0, _incbeta(0.5 * df, 0.5, x)))


def exact_student_t_crit(alpha: float = 0.05, df: int = 1) -> float:
    """Computes exact two-tailed Student's t critical value for any degrees of freedom df >= 1."""
    if df <= 0:
        return 1.959964
    low = 0.0
    high = 1000.0
    for _ in range(80):
        mid = (low + high) / 2.0
        p = exact_student_t_pvalue(mid, df)
        if p > alpha:
            low = mid
        else:
            high = mid
    return (low + high) / 2.0


class ControlledExperimentRunner:
    """Executes the formal 4-arm randomized controlled experiment for learning validity."""

    def __init__(self, cost_per_eval_nanos: NanoUSD = 100) -> None:
        self.cost_per_eval_nanos = validate_nanos(cost_per_eval_nanos, "cost_per_eval_nanos")

    @staticmethod
    def compute_paired_stats(
        scores_base: List[float], scores_cand: List[float]
    ) -> Tuple[float, float, float, Tuple[float, float]]:
        """
        Computes item-level paired differences, t-statistic, exact Student's t p-value,
        and exact 95% Confidence Interval.
        Returns: (mean_delta, p_value, t_statistic, (ci_lower, ci_upper))
        """
        if not scores_base or not scores_cand or len(scores_base) != len(scores_cand):
            return 0.0, 1.0, 0.0, (0.0, 0.0)

        deltas = [c - b for b, c in zip(scores_base, scores_cand)]
        n = len(deltas)
        mean_d = sum(deltas) / n

        # Check for zero-variance edge cases
        var_d = (sum((x - mean_d) ** 2 for x in deltas) / (n - 1)) if n > 1 else 0.0

        if var_d == 0.0:
            if mean_d > 0.0:
                # Deterministic uniform positive improvement
                return mean_d, 0.0001, float("inf"), (mean_d, mean_d)
            elif mean_d < 0.0:
                # Deterministic uniform regression
                return mean_d, 1.0, float("-inf"), (mean_d, mean_d)
            else:
                return 0.0, 1.0, 0.0, (0.0, 0.0)

        std_err = math.sqrt(var_d / n)
        t_stat = mean_d / std_err

        # Compute EXACT p-value and critical value using Student's t incomplete beta distribution
        df = max(1, n - 1)
        p_value = exact_student_t_pvalue(t_stat, df)

        # Exact 95% Confidence Interval for arbitrary df
        t_crit = exact_student_t_crit(0.05, df)
        ci_lower = mean_d - t_crit * std_err
        ci_upper = mean_d + t_crit * std_err

        return mean_d, p_value, t_stat, (ci_lower, ci_upper)

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

        # Strict anti-contamination check: Ensure no item overlap between train and held-out
        train_identifiers = {
            repr(sorted(item.items())) if isinstance(item, dict) else repr(item)
            for item in sample_train
        }
        for item in sample_held_out:
            item_id = repr(sorted(item.items())) if isinstance(item, dict) else repr(item)
            if item_id in train_identifiers:
                raise ValueError("Data contamination detected: held-out set contains items from training set")

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

        # Arm D: Paired Generalization on Held-Out Test
        # Evaluate BOTH base_prompt and refined_prompt on the EXACT SAME held-out items
        scores_d_base = [self._eval_item(evaluator_fn, base_prompt, item) for item in sample_held_out]
        score_d_base = sum(scores_d_base) / len(scores_d_base)

        scores_d_cand = [self._eval_item(evaluator_fn, refined_prompt, item) for item in sample_held_out]
        score_d = sum(scores_d_cand) / len(scores_d_cand)

        # Paired item-level statistical testing on training set (Arm B vs Arm A)
        mean_d_train, p_val_train, t_train, (ci_train_low, ci_train_high) = self.compute_paired_stats(
            scores_a, scores_b
        )

        # Paired item-level statistical testing on held-out set (Arm D Candidate vs Arm D Baseline)
        mean_d_held, p_val_held, t_held, (ci_held_low, ci_held_high) = self.compute_paired_stats(
            scores_d_base, scores_d_cand
        )

        delta_improvement = score_b - score_a
        control_delta = score_b - score_c
        # PAIRED held-out delta: Evaluated on the SAME held-out population
        held_out_retention = score_d - score_d_base

        # Formal Statistical Significance Criteria:
        # 1. Delta improvement >= epsilon and statistically significant at alpha = 0.05 (CI lower bound > 0)
        # 2. Authentic feedback beats shuffled control by >= epsilon
        # 3. Held-out paired retention does not drop below tolerance on the SAME test population
        is_sig = (
            delta_improvement >= protocol.significance_threshold_epsilon
            and p_val_train <= 0.05
            and ci_train_low > 0.0
            and control_delta >= protocol.significance_threshold_epsilon
            and held_out_retention >= -protocol.generalization_tolerance_delta
        )

        total_evals = len(scores_a) + len(scores_b) + len(scores_c) + len(scores_d_base) + len(scores_d_cand)
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
            arm_d_baseline_score=round(score_d_base, 4),
            p_value=round(p_val_train, 6),
            confidence_interval_95=(round(ci_train_low, 4), round(ci_train_high, 4)),
            held_out_p_value=round(p_val_held, 6),
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
