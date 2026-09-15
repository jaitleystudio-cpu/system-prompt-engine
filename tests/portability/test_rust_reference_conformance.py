"""Sprint 5: Python oracle vs Rust portable kernel (RED until kernel exists)."""

from __future__ import annotations


def test_rust_runner_is_required_for_positive_cases():
    from tools.sprint5_conformance import load_reference_cases, run_rust_case

    cases = load_reference_cases(kind="positive")
    assert cases
    result = run_rust_case(cases[0])
    assert result["status"] == "VALID"


def test_rust_runner_reports_exact_negative_reason():
    from tools.sprint5_conformance import load_reference_cases, run_rust_case

    case = load_reference_cases(kind="negative")[0]
    result = run_rust_case(case)
    assert result["disposition"] == case["expected"]["disposition"]
    assert result["reason_code"] == case["expected"]["reason_code"]
