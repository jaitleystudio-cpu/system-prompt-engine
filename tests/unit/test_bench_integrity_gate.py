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


def test_cli_bench_is_honest_about_unverified_execution(capsys):
    from argparse import Namespace
    from spe_runtime.cli.main import cmd_bench

    assert cmd_bench(Namespace()) == 0
    output = capsys.readouterr().out
    assert "SPE-BENCH Ω EXECUTION" in output
    assert "Oracle Evidence:" in output
    assert "DETERMINISTIC" in output
    assert "UNVERIFIED_RUN" in output
    assert "NOT_ADJUDICATED" in output
    assert "100% verified evidence" not in output


@pytest.mark.parametrize("payload", [
    '{"amount":1e999}',
    '{"amount":-1e999}',
    '{"amount":1e309,"approved":true}',
    '{"approved":false,"approved":true}',
    '{"user":{"role":"viewer","role":"admin"}}',
])
def test_schema_oracle_rejects_nonfinite_overflow_and_duplicate_object_keys(payload):
    schema = {"type":"object","properties":{"amount":{"type":"number"},"approved":{"type":"boolean"},"user":{"type":"object"}}}
    verdict = SchemaConformanceOracle("strict-json",schema).evaluate(payload,{})
    assert verdict.passed is False
    assert verdict.score == 0.0


def test_schema_oracle_accepts_regular_finite_fraction():
    schema = {"type":"object","required":["amount"],"properties":{"amount":{"type":"number","minimum":0}}}
    assert SchemaConformanceOracle("finite",schema).evaluate('{"amount":125.75}',{}).passed is True


def _paired_suite(prompt_input, oracle_target="OK"):
    return BenchmarkSuite("same-visible-suite", [
        BenchmarkTask(
            "stable-id",
            BenchmarkDomain.CODING,
            DatasetSplit.DEV,
            prompt_input,
            DeterministicOracle("same-visible-oracle",oracle_target),
        ),
    ])


def test_comparator_rejects_same_named_suite_with_different_task_inputs():
    a=run_benchmark_suite(_paired_suite("Task A"),"p",runner_fn=lambda p,t:"OK")
    b=run_benchmark_suite(_paired_suite("Task B"),"p",runner_fn=lambda p,t:"OK")
    assert a.suite_id==b.suite_id and a.total_tasks==b.total_tasks
    assert a.task_manifest_digest!=b.task_manifest_digest
    with pytest.raises(ValueError,match="task-manifest"):
        compare_benchmarks(a,b)


def test_comparator_rejects_changed_oracle_even_if_same_task_input():
    a=run_benchmark_suite(_paired_suite("Task A","OK"),"p",runner_fn=lambda p,t:"OK")
    b=run_benchmark_suite(_paired_suite("Task A","FAIL"),"p",runner_fn=lambda p,t:"OK")
    with pytest.raises(ValueError,match="task-manifest"):
        compare_benchmarks(a,b)


def test_runner_rejects_duplicate_task_ids_to_prevent_artificial_weighting():
    repeated=BenchmarkSuite("duplicate", [
        BenchmarkTask("duplicate",BenchmarkDomain.CODING,DatasetSplit.DEV,"A",DeterministicOracle("a","OK")),
        BenchmarkTask("duplicate",BenchmarkDomain.CODING,DatasetSplit.DEV,"B",DeterministicOracle("b","OK")),
    ])
    with pytest.raises(ValueError,match="unique"):
        run_benchmark_suite(repeated,"p",runner_fn=lambda p,t:"OK")


def test_identical_manifest_digest_allows_exploratory_comparison_without_win_claim():
    suite=_paired_suite("Task A")
    a=run_benchmark_suite(suite,"p1",runner_fn=lambda p,t:"FAIL")
    b=run_benchmark_suite(suite,"p2",runner_fn=lambda p,t:"OK")
    result=compare_benchmarks(a,b)
    assert result["task_manifest_digest"]==a.task_manifest_digest==b.task_manifest_digest
    assert result["delta"]==1.0
    assert result["competitive_verdict"]=="NOT_ADJUDICATED"
