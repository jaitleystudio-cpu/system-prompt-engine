"""Benchmark Suite runner and comparative evaluator."""

from __future__ import annotations

from typing import Any, Callable

from .models import BenchmarkResult, BenchmarkSuite, DatasetSplit, OracleVerdict


def run_benchmark_suite(
    suite: BenchmarkSuite,
    target_prompt: str,
    runner_fn: Callable[[str, str], str] | None = None,
    target_split: DatasetSplit = DatasetSplit.DEV,
) -> BenchmarkResult:
    """Executes a benchmark suite against a target prompt.
    runner_fn takes (system_prompt, task_input) -> model_output.
    """
    scoped_suite = suite.filter_split(target_split)
    verdicts: list[OracleVerdict] = []
    domain_scores: dict[str, list[float]] = {}

    for task in scoped_suite.tasks:
        if runner_fn is not None:
            output = runner_fn(target_prompt, task.prompt_input)
        else:
            # Deterministic simulation runner for mock / offline execution
            output = f"Executed task {task.task_id}: {task.prompt_input[:60]}"

        verdict = task.oracle.evaluate(output, {"system_prompt": target_prompt, "input": task.prompt_input})
        verdicts.append(verdict)

        d_name = task.domain.value
        domain_scores.setdefault(d_name, []).append(verdict.score)

    passed_count = sum(1 for v in verdicts if v.passed)
    total_count = len(verdicts)
    avg_score = (sum(v.score for v in verdicts) / total_count) if total_count else 0.0

    domain_breakdown = {
        d: round(sum(scores) / len(scores), 3) for d, scores in domain_scores.items()
    }

    evidence_class = "DETERMINISTIC" if all(v.evidence_class == "DETERMINISTIC" for v in verdicts) else "OBSERVED_LOCAL"

    return BenchmarkResult(
        suite_id=scoped_suite.suite_id,
        split=target_split,
        total_tasks=total_count,
        passed_tasks=passed_count,
        accuracy_score=round(avg_score, 3),
        domain_breakdown=domain_breakdown,
        verdicts=verdicts,
        evidence_class=evidence_class,
    )


def compare_benchmarks(res_a: BenchmarkResult, res_b: BenchmarkResult) -> dict[str, Any]:
    score_delta = round(res_b.accuracy_score - res_a.accuracy_score, 3)
    domain_deltas: dict[str, float] = {}

    all_domains = set(res_a.domain_breakdown.keys()).union(set(res_b.domain_breakdown.keys()))
    for d in all_domains:
        score_a = res_a.domain_breakdown.get(d, 0.0)
        score_b = res_b.domain_breakdown.get(d, 0.0)
        domain_deltas[d] = round(score_b - score_a, 3)

    return {
        "suite_a": res_a.suite_id,
        "suite_b": res_b.suite_id,
        "split": res_a.split.value,
        "accuracy_a": res_a.accuracy_score,
        "accuracy_b": res_b.accuracy_score,
        "delta": score_delta,
        "noninferior": score_delta >= -0.02,  # 2% noninferiority margin
        "domain_deltas": domain_deltas,
    }
