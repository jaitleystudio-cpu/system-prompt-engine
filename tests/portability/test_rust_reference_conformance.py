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


def test_all_positive_cases_are_semantically_equivalent():
    from tools.sprint5_conformance import (
        load_reference_cases,
        run_python_reference_case,
        run_rust_case,
        compare_protected,
        protected_drift,
    )

    drifts = []
    for case in load_reference_cases(kind="positive"):
        py_result = run_python_reference_case(case)
        rs_result = run_rust_case(case)
        assert rs_result["status"] == "VALID", (case["fixture_id"], rs_result)
        if not compare_protected(py_result, rs_result):
            drifts.append((case["fixture_id"], protected_drift(py_result, rs_result), py_result, rs_result))
    assert drifts == [], f"semantic drift: {[(d[0], d[1]) for d in drifts]}"
