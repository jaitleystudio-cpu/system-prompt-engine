"""Adversarial regression tests for Promptfoo mission #156 / integrity issue #165.

All tests exercise deterministic benchmark plumbing; no model or external calls.
"""
from __future__ import annotations

import pytest

from spe_runtime.bench.corpus import run_paired_baseline
from spe_runtime.bench.models import (
    BenchmarkDomain,
    BenchmarkSuite,
    BenchmarkTask,
    DatasetSplit,
    DeterministicOracle,
    LlmJudgeOracle,
    SchemaConformanceOracle,
)
from spe_runtime.bench.runner import compare_benchmarks, run_benchmark_suite


@pytest.mark.parametrize(
    ("candidate", "schema"),
    [
        ('{"age":"not-a-number"}', {"type": "object", "required": ["age"], "properties": {"age": {"type": "integer"}}}),
        ('{"mode":"unsafe"}', {"type": "object", "properties": {"mode": {"enum": ["safe"]}}}),
        ('{"user":{"age":"old"}}', {"type": "object", "properties": {"user": {"type": "object", "required": ["age"], "properties": {"age": {"type": "integer"}}}}}),
        ('{"items":[1,"two"]}', {"type": "object", "properties": {"items": {"type": "array", "items": {"type": "integer"}}}}),
        ('{"approved":true,"secret":"leak"}', {"type": "object", "properties": {"approved": {"type": "boolean"}}, "additionalProperties": False}),
        ('{"items":[]}', {"type": "object", "properties": {"items": {"type": "array", "minItems": 1}}}),
        ('NaN', {"type": "number"}),
        ('Infinity', {"type": "number"}),
        ('{"age":', {"type": "object"}),
    ],
)
def test_schema_oracle_must_reject_invalid_json_or_schema_mismatch(candidate, schema):
    verdict = SchemaConformanceOracle("schema-strict", schema).evaluate(candidate, {})
    assert verdict.passed is False
    assert verdict.score == 0.0
    assert verdict.evidence_class == "DETERMINISTIC"


def test_schema_oracle_accepts_genuine_compliant_json():
    schema = {"type": "object", "required": ["user"], "properties": {"user": {"type": "object", "required": ["age"], "properties": {"age": {"type": "integer", "minimum": 0}}}}, "additionalProperties": False}
    verdict = SchemaConformanceOracle("schema-valid", schema).evaluate('{"user":{"age":7}}', {})
    assert verdict.passed is True
    assert verdict.score == 1.0


def test_invalid_schema_rejected_before_scoring():
    with pytest.raises(Exception):
        SchemaConformanceOracle("schema-invalid", {"type": "nonsense_type"})


def _suite(oracle=None):
    return BenchmarkSuite(
        "integrity-check",
        [
            BenchmarkTask(
                task_id="integrity-01",
                domain=BenchmarkDomain.SCHEMA_CONFORMANCE,
                split=DatasetSplit.DEV,
                prompt_input="task input",
                oracle=oracle or DeterministicOracle("det", "OK"),
            )
        ],
    )


def test_implicit_placeholder_run_is_simulated_not_real_model_evidence():
    r = run_benchmark_suite(_suite(), "prompt", runner_fn=None)
    assert r.execution_evidence_class == "SIMULATED"
    assert r.evidence_class == "SIMULATED"
    assert r.oracle_evidence_strength == "DETERMINISTIC"


def test_callable_without_verifiable_execution_receipt_is_unverified():
    r = run_benchmark_suite(_suite(), "prompt", runner_fn=lambda p, task: "OK")
    assert r.passed_tasks == 1
    assert r.execution_evidence_class == "UNVERIFIED_RUN"
    assert r.evidence_class == "UNVERIFIED_RUN"
    assert r.oracle_evidence_strength == "DETERMINISTIC"


def test_simulated_llm_judge_cannot_get_objective_grade():
    r = run_benchmark_suite(_suite(LlmJudgeOracle("mock-judge", "politeness")), "prompt", runner_fn=lambda p, task: "Please provide the correct output")
    assert r.execution_evidence_class == "UNVERIFIED_RUN"
    assert r.oracle_evidence_strength == "SIMULATED"


def test_empty_suite_cannot_count_as_superiority_evidence():
    suite = BenchmarkSuite("empty", [])
    a = run_benchmark_suite(suite, "A")
    b = run_benchmark_suite(suite, "B")
    assert a.execution_evidence_class == "NOT_RUN"
    compared = compare_benchmarks(a, b)
    assert compared["competitive_verdict"] == "NOT_ADJUDICATED"
    assert compared["noninferior"] is False


def test_paired_unverified_execution_not_promoted_to_competitive_win():
    a = run_benchmark_suite(_suite(), "A", runner_fn=lambda p, task: "ERROR")
    b = run_benchmark_suite(_suite(), "B", runner_fn=lambda p, task: "OK")
    result = compare_benchmarks(a, b)
    assert result["delta"] == 1.0
    assert result["competitive_verdict"] == "NOT_ADJUDICATED"


def test_mismatched_splits_cannot_be_compared():
    suite = BenchmarkSuite("cross-split", [
        BenchmarkTask("a", BenchmarkDomain.CODING, DatasetSplit.DEV, "a", DeterministicOracle("oa", "PASS")),
        BenchmarkTask("b", BenchmarkDomain.CODING, DatasetSplit.VAL, "b", DeterministicOracle("ob", "PASS")),
    ])
    a = run_benchmark_suite(suite, "A", target_split=DatasetSplit.DEV, runner_fn=lambda p, task: "PASS")
    b = run_benchmark_suite(suite, "B", target_split=DatasetSplit.VAL, runner_fn=lambda p, task: "PASS")
    with pytest.raises(ValueError):
        compare_benchmarks(a, b)


def test_forged_weights_receipt_does_not_create_observed_claim():
    with pytest.raises(ValueError, match="Cannot claim OBSERVED_LOCAL"):
        run_paired_baseline(
            "raw",
            "compiled",
            model_simulator_fn=lambda p, task: "PASS",
            evidence_class="OBSERVED_LOCAL",
            verified_weights_receipt={"fake": "not-an-attestation"},
        )
