"""Benchmark Suite runner and comparative evaluator."""

from __future__ import annotations

import hashlib
import json
from typing import Any, Callable

from .models import BenchmarkResult, BenchmarkSuite, DatasetSplit, OracleVerdict


def _task_manifest_digest(suite: BenchmarkSuite) -> str:
    """Hash ordered task identity, test inputs and visible oracle specifications.

    This binds two arithmetic benchmark runs to comparable fixtures, but does not
    authenticate fixture custody or opaque programmatic predicate implementations.
    """
    manifest = []
    for task in suite.tasks:
        oracle = task.oracle
        spec = {
            "id": oracle.oracle_id,
            "method": oracle.method,
            "class": type(oracle).__name__,
            "config": {
                key: getattr(oracle, key)
                for key in (
                    "schema", "exact_target", "references", "rubric",
                    "judge_model", "description", "pass_threshold",
                )
                if hasattr(oracle, key)
            },
        }
        manifest.append({
            "task_id": task.task_id,
            "split": task.split.value,
            "domain": task.domain.value,
            "prompt_input": task.prompt_input,
            "oracle": spec,
        })
    serialized = json.dumps(manifest, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()


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
    task_ids = [task.task_id for task in scoped_suite.tasks]
    if any(not task_id for task_id in task_ids) or len(task_ids) != len(set(task_ids)):
        raise ValueError("Benchmark task IDs must be nonempty and unique within a split")
    manifest_digest = _task_manifest_digest(scoped_suite)
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

    # The oracle's scoring method never establishes where its candidate output came from.
    # Callable runners may themselves be fakes. External model evidence must be
    # independently authenticated by a separate qualification process.
    if not verdicts:
        oracle_evidence_strength = "UNKNOWN"
        execution_evidence_class = "NOT_RUN"
    else:
        levels = {v.evidence_class for v in verdicts}
        oracle_evidence_strength = (
            "SIMULATED" if "SIMULATED" in levels
            else "CALIBRATED_ESTIMATE" if "CALIBRATED_ESTIMATE" in levels
            else "DETERMINISTIC" if levels == {"DETERMINISTIC"}
            else "UNKNOWN"
        )
        execution_evidence_class = (
            "SIMULATED" if runner_fn is None else "UNVERIFIED_RUN"
        )

    return BenchmarkResult(
        suite_id=scoped_suite.suite_id,
        split=target_split,
        total_tasks=total_count,
        passed_tasks=passed_count,
        accuracy_score=round(avg_score, 3),
        domain_breakdown=domain_breakdown,
        verdicts=verdicts,
        evidence_class=execution_evidence_class,
        oracle_evidence_strength=oracle_evidence_strength,
        execution_evidence_class=execution_evidence_class,
        task_manifest_digest=manifest_digest,
    )


def compare_benchmarks(res_a: BenchmarkResult, res_b: BenchmarkResult) -> dict[str, Any]:
    if res_a.split != res_b.split or res_a.suite_id != res_b.suite_id or res_a.total_tasks != res_b.total_tasks:
        raise ValueError("Paired comparison requires the same suite, split and task count")
    if not res_a.task_manifest_digest or res_a.task_manifest_digest != res_b.task_manifest_digest:
        raise ValueError("Paired comparison requires matching nonempty task-manifest digests")
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
        "noninferior": res_a.total_tasks > 0 and score_delta >= -0.02,
        # Arithmetic comparisons are exploratory; proof of competitive superiority
        # requires independent held-out evaluation and authenticated model receipts.
        "competitive_verdict": "NOT_ADJUDICATED",
        "execution_evidence_a": res_a.execution_evidence_class,
        "execution_evidence_b": res_b.execution_evidence_class,
        "oracle_evidence_strength_a": res_a.oracle_evidence_strength,
        "oracle_evidence_strength_b": res_b.oracle_evidence_strength,
        "task_manifest_digest": res_a.task_manifest_digest,
        "domain_deltas": domain_deltas,
    }
