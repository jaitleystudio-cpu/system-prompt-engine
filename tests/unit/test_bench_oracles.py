"""Tests for SPE-Bench Ω and Task Oracles (M6)."""

from spe_runtime.bench.models import (
    BenchmarkDomain,
    BenchmarkSuite,
    BenchmarkTask,
    DatasetSplit,
    DeterministicOracle,
    HybridCompositeOracle,
    LlmJudgeOracle,
    ProgrammaticConstraintOracle,
    ReferenceAnswerOracle,
    SchemaConformanceOracle,
)
from spe_runtime.bench.runner import compare_benchmarks, run_benchmark_suite


def test_oracles_evaluation_and_evidence_class():
    # 1. Deterministic Oracle
    det = DeterministicOracle("det-01", "EXPECTED_ANSWER")
    v1 = det.evaluate("EXPECTED_ANSWER", {})
    assert v1.passed is True
    assert v1.evidence_class == "DETERMINISTIC"

    v2 = det.evaluate("WRONG_ANSWER", {})
    assert v2.passed is False

    # 2. Schema Conformance Oracle
    schema_oracle = SchemaConformanceOracle("schema-01", {"required": ["summary", "status"]})
    v3 = schema_oracle.evaluate('{"summary": "OK", "status": "PASS"}', {})
    assert v3.passed is True
    assert v3.evidence_class == "DETERMINISTIC"

    v4 = schema_oracle.evaluate('{"summary": "OK"}', {})
    assert v4.passed is False
    assert "Missing required field" in v4.rationale

    # 3. LLM Judge Oracle (Never claimed as objective truth)
    judge = LlmJudgeOracle("judge-01", rubric="Be helpful and polite", judge_model="gpt-4o")
    v5 = judge.evaluate("Certainly! Here is your requested code.", {})
    assert v5.evidence_class == "SIMULATED"
    assert "Non-objective evidence" in v5.rationale


def test_benchmark_suite_split_and_comparison():
    t_dev = BenchmarkTask(
        task_id="T1",
        domain=BenchmarkDomain.STRUCTURED_EXTRACTION,
        split=DatasetSplit.DEV,
        prompt_input="Extract JSON",
        oracle=DeterministicOracle("O1", "OK"),
    )
    t_held = BenchmarkTask(
        task_id="T2",
        domain=BenchmarkDomain.AGENT_AUTHORIZATION,
        split=DatasetSplit.HELD_OUT,
        prompt_input="Check permissions",
        oracle=DeterministicOracle("O2", "DENIED"),
    )
    suite = BenchmarkSuite("spe-core-bench", [t_dev, t_held])

    # Runner for prompt A (returns OK for T1)
    res_a = run_benchmark_suite(
        suite,
        target_prompt="System Prompt A",
        runner_fn=lambda p, inp: "OK" if "Extract" in inp else "DENIED",
        target_split=DatasetSplit.DEV,
    )
    assert res_a.total_tasks == 1
    assert res_a.passed_tasks == 1
    assert res_a.accuracy_score == 1.0

    # Runner for prompt B (returns FAIL for T1)
    res_b = run_benchmark_suite(
        suite,
        target_prompt="System Prompt B",
        runner_fn=lambda p, inp: "ERROR",
        target_split=DatasetSplit.DEV,
    )
    assert res_b.passed_tasks == 0

    comp = compare_benchmarks(res_a, res_b)
    assert comp["delta"] == -1.0
    assert comp["noninferior"] is False


def test_hybrid_composite_oracle():
    o1 = DeterministicOracle("d1", "exact match")
    o2 = ProgrammaticConstraintOracle("p1", lambda s: len(s) > 5, "Length > 5")
    o3 = ReferenceAnswerOracle("r1", ["match"])

    hybrid = HybridCompositeOracle("hyb-01", [(o1, 0.4), (o2, 0.3), (o3, 0.3)])
    assert hybrid.evidence_strength == "CALIBRATED_ESTIMATE"

    # Evaluates matching output
    v_pass = hybrid.evaluate("exact match", {})
    assert v_pass.passed is True
    assert v_pass.score == 1.0
    assert v_pass.evidence_class == "CALIBRATED_ESTIMATE"

    # Evaluates failing output
    v_fail = hybrid.evaluate("wrong", {})
    assert v_fail.passed is False
    assert v_fail.score < 0.75

