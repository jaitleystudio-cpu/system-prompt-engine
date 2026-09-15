"""Cross-process and 10-cycle Python↔Rust determinism. Zero protected drift."""

from __future__ import annotations

import copy
import json

from tools.sprint5_conformance import (
    compare_protected,
    extract_protected,
    load_reference_cases,
    protected_drift,
    run_python_reference_case,
    run_rust_case,
)


def _canon(obj) -> str:
    return json.dumps(obj, sort_keys=True, ensure_ascii=False, separators=(",", ":"))


def _positive_cases():
    cases = load_reference_cases(kind="positive")
    # representative: first, middle, last, plus any with analysis
    picks = [cases[0], cases[len(cases) // 2], cases[-1]]
    seen = {c["fixture_id"] for c in picks}
    for c in cases:
        rec = (c.get("payload") or {}).get("recommendation")
        if rec and c["fixture_id"] not in seen:
            picks.append(c)
            break
    return picks


def test_rust_fresh_processes_stable_canonical_output():
    case = load_reference_cases(kind="positive")[0]
    outputs = []
    for _ in range(5):
        result = run_rust_case(case)
        assert result["status"] == "VALID"
        outputs.append(_canon(result["output"]))
    assert len(set(outputs)) == 1, outputs


def test_ten_cycle_python_rust_python_zero_protected_drift():
    for case in _positive_cases():
        current_payload = copy.deepcopy(case["payload"])
        original = extract_protected(current_payload)
        for cycle in range(10):
            cycle_case = {
                **case,
                "payload": current_payload,
                "raw": {**case["raw"], "payload": current_payload},
            }
            py = run_python_reference_case(cycle_case)
            rs = run_rust_case(cycle_case)
            assert py["status"] == "VALID", (case["fixture_id"], cycle, py)
            assert rs["status"] == "VALID", (case["fixture_id"], cycle, rs)
            assert compare_protected(py, rs), (case["fixture_id"], cycle)
            current_payload = rs["output"]
            # Python oracle re-import of Rust output
            py2 = run_python_reference_case(
                {
                    **case,
                    "payload": current_payload,
                    "raw": {**case["raw"], "payload": current_payload},
                }
            )
            assert compare_protected(rs, py2), (case["fixture_id"], cycle, "rs→py")
        final = extract_protected(current_payload)
        drift = protected_drift({"output": original}, {"output": final})
        assert all(v == 0 for v in drift.values()), (case["fixture_id"], drift)
        for field in (
            "provenance",
            "authority_state",
            "sensitivity_labels",
            "taint_labels",
            "uncertainties",
            "recommendation",
            "operation_id",
            "outcome",
        ):
            if field in original or field in final:
                assert original.get(field) == final.get(field), (
                    case["fixture_id"],
                    field,
                    original.get(field),
                    final.get(field),
                )


def _mut_base():
    return {
        "envelope_id": "det-env",
        "goal_identity": "det-goal",
        "facts": [{"fact_id": "f", "statement": "s", "provenance_ids": ["p"]}],
        "provenance": [{"provenance_id": "p", "source": "src", "origin": "research"}],
        "uncertainties": [
            {"uncertainty_id": "u", "description": "maybe", "status": "UNKNOWN"}
        ],
        "hard_constraints": [
            {"constraint_id": "c", "statement": "must", "strength": "HARD"}
        ],
        "user_preferences": [{"preference_id": "pref", "statement": "concise"}],
        "recommendation": {"option": "A", "conditional": True, "status": "READY"},
        "authority_state": {"level": 0, "status": "DENIED", "grants": []},
        "execution_grants": [
            {"grant_id": "g1", "target": "file:/tmp/x", "arguments": {"path": "/tmp/x"}}
        ],
        "failures": [{"failure_id": "f1", "status": "UNKNOWN", "message": ""}],
        "taint_labels": ["external_untrusted"],
        "sensitivity_labels": ["USER_PRIVATE"],
        "operation_id": "op-det",
        "outcome": "PARTIAL",
    }


def test_explicit_mutation_controls_do_not_escape():
    from spe_runtime.portability.conformance import detect_attack, semantic_equivalent

    b = _mut_base()
    controls = [
        ("provenance", {**b, "provenance": []}, "P_PROVENANCE_REMOVED"),
        (
            "authority",
            {**b, "authority_state": {"level": 1, "status": "GRANTED", "grants": ["x"]}},
            "P_DENIED_TO_GRANTED",
        ),
        (
            "privacy",
            {**b, "sensitivity_labels": ["PUBLIC"]},
            "P_PRIVACY_ESCALATION",
        ),
        ("uncertainty", {**b, "uncertainties": []}, "X03_UNCERTAINTY_ERASED"),
        (
            "recommendation_conditionality",
            {
                **b,
                "recommendation": {"option": "A", "conditional": False, "status": "READY"},
            },
            "P_SEMANTIC_NONEQUIVALENT",
        ),
        ("operation_id", {**b, "operation_id": "op-OTHER"}, "P_OPERATION_ID_MUTATION"),
        ("outcome", {**b, "outcome": "SUCCESS"}, "P_OUTCOME_ESCALATION"),
    ]
    escapes = []
    for name, after, expect in controls:
        reason = detect_attack(b, after)
        noneq = semantic_equivalent(b, after) is False
        raw = {
            "id": name,
            "kind": "negative",
            "attack": name.upper() if name != "outcome" else "OUTCOME_ESCALATION",
            "expect_reason": expect,
            "before": b,
            "after": after,
        }
        # Use frozen attack names where required for kernel dispatch
        attack_map = {
            "provenance": "PROVENANCE_REMOVED",
            "authority": "DENIED_TO_GRANTED",
            "privacy": "PRIVACY_ESCALATION",
            "uncertainty": "UNCERTAINTY_ERASED",
            "recommendation_conditionality": "SEMANTIC_NONEQUIVALENT",
            "operation_id": "OPERATION_ID_MUTATION",
            "outcome": "OUTCOME_ESCALATION",
        }
        raw["attack"] = attack_map[name]
        rs = run_rust_case({"raw": raw, "expected": {"reason_code": expect, "disposition": "INVALID"}})
        if reason != expect or not noneq or rs.get("reason_code") != expect:
            escapes.append((name, reason, rs.get("reason_code")))
    assert escapes == [], f"mutation_escapes={escapes}"
