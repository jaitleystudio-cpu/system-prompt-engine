"""Corpus loader and Paired Baseline Evaluator for SPE-Bench Ω."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Callable

from .models import (
    BenchmarkDomain,
    BenchmarkResult,
    BenchmarkSuite,
    BenchmarkTask,
    DatasetSplit,
    DeterministicOracle,
    ProgrammaticConstraintOracle,
    SchemaConformanceOracle,
)
from .runner import compare_benchmarks, run_benchmark_suite

CORPUS_PATH = Path(__file__).resolve().parent.parent.parent / "benchmarks" / "spe_core_tasks.json"


def load_corpus_suite(corpus_path: Path = CORPUS_PATH) -> BenchmarkSuite:
    if not corpus_path.exists():
        raise FileNotFoundError(f"Benchmark corpus file missing: {corpus_path}")

    data = json.loads(corpus_path.read_text(encoding="utf-8"))
    tasks: list[BenchmarkTask] = []

    for item in data.get("tasks", []):
        d_val = item["domain"]
        domain = BenchmarkDomain[d_val] if d_val in BenchmarkDomain.__members__ else BenchmarkDomain.STRUCTURED_EXTRACTION
        split = DatasetSplit[item["split"]]
        o_type = item.get("oracle_type", "DETERMINISTIC")

        if o_type == "SCHEMA":
            schema = item.get("target_schema", {"type": "object", "required": []})
            oracle = SchemaConformanceOracle(f"schema-{item['task_id']}", schema)
        elif o_type == "PROGRAMMATIC":
            req_sub = item.get("required_substring")
            forb_sub = item.get("forbidden_substring")
            if req_sub:
                oracle = ProgrammaticConstraintOracle(
                    f"prog-{item['task_id']}",
                    lambda out, s=req_sub: s in out,
                    f"Must contain required substring: '{req_sub}'"
                )
            elif forb_sub:
                oracle = ProgrammaticConstraintOracle(
                    f"prog-{item['task_id']}",
                    lambda out, s=forb_sub: s not in out,
                    f"Must NOT contain forbidden substring: '{forb_sub}'"
                )
            else:
                oracle = DeterministicOracle(f"det-{item['task_id']}", "PASS")
        else:
            target = item.get("exact_target", item.get("expected_output_substring", "PASS"))
            oracle = DeterministicOracle(f"det-{item['task_id']}", target)

        task = BenchmarkTask(
            task_id=item["task_id"],
            domain=domain,
            split=split,
            prompt_input=item["prompt_input"],
            oracle=oracle,
            metadata=item
        )
        tasks.append(task)

    return BenchmarkSuite(suite_id=data.get("suite_id", "spe.bench.corpus-v1"), tasks=tasks)


def run_paired_baseline(
    raw_prompt: str,
    spe_prompt: str,
    model_simulator_fn: Callable[[str, str], str],
    split: DatasetSplit = DatasetSplit.HELD_OUT,
    output_report_path: Path | None = None,
) -> dict[str, Any]:
    """Runs rigorous paired evaluation on the exact same model & task inputs."""
    suite = load_corpus_suite()

    # 1. Run raw uncompiled prompt
    raw_res = run_benchmark_suite(suite, raw_prompt, model_simulator_fn, target_split=split)

    # 2. Run SPE compiled prompt
    spe_res = run_benchmark_suite(suite, spe_prompt, model_simulator_fn, target_split=split)

    # 3. Compute paired delta
    comparison = compare_benchmarks(raw_res, spe_res)

    report = {
        "suite_id": suite.suite_id,
        "split": split.value,
        "total_tasks_evaluated": len(suite.filter_split(split).tasks),
        "raw_prompt_accuracy": raw_res.accuracy_score,
        "spe_compiled_accuracy": spe_res.accuracy_score,
        "delta": comparison["delta"],
        "noninferior": comparison["noninferior"],
        "domain_deltas": comparison["domain_deltas"],
        "evidence_class": "OBSERVED_LOCAL",
        "raw_domain_breakdown": raw_res.domain_breakdown,
        "spe_domain_breakdown": spe_res.domain_breakdown,
    }

    if output_report_path:
        output_report_path.parent.mkdir(parents=True, exist_ok=True)
        output_report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")

    return report
