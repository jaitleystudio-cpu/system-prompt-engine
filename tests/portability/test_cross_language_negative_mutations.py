"""Cross-language negative mutations: exact detector attribution, zero escapes."""

from __future__ import annotations

import copy

import pytest

from tools.sprint5_conformance import load_reference_cases, run_python_reference_case, run_rust_case

NEGATIVES = load_reference_cases(kind="negative")


@pytest.mark.parametrize("case", NEGATIVES, ids=lambda c: c["fixture_id"])
def test_rust_reports_exact_frozen_negative_reason(case):
    py = run_python_reference_case(case)
    rs = run_rust_case(case)
    assert py["reason_code"] == case["expected"]["reason_code"], case["fixture_id"]
    assert rs["disposition"] == case["expected"]["disposition"]
    assert rs["reason_code"] == case["expected"]["reason_code"], (
        case["fixture_id"],
        rs,
    )


def _base():
    return {
        "envelope_id": "mut-env",
        "goal_identity": "mut-goal",
        "facts": [{"fact_id": "f", "statement": "s", "provenance_ids": ["p"]}],
        "provenance": [{"provenance_id": "p", "source": "src"}],
        "uncertainties": [{"uncertainty_id": "u", "description": "maybe"}],
        "hard_constraints": [{"constraint_id": "c", "statement": "must", "strength": "HARD"}],
        "user_preferences": [{"preference_id": "pref", "statement": "concise"}],
        "analysis": {"kind": "analysis", "summary": "s"},
        "recommendation": {"option": "A", "conditional": True, "status": "READY"},
        "rendering": None,
        "authority_state": {"level": 0, "status": "DENIED", "grants": []},
        "execution_grants": [
            {
                "grant_id": "g1",
                "target": "file:/tmp/x",
                "arguments": {"path": "/tmp/x"},
                "status": "ACTIVE",
            }
        ],
        "failures": [{"failure_id": "f1", "status": "UNKNOWN", "message": ""}],
        "taint_labels": ["external_untrusted"],
        "sensitivity_labels": ["USER_PRIVATE"],
        "category_trace": ["CAT:C06"],
        "operation_id": "op-A",
        "outcome": "PARTIAL",
    }


def _case(name: str, before: dict, after: dict, attack: str, expect: str) -> dict:
    raw = {
        "id": name,
        "kind": "negative",
        "attack": attack,
        "expect_reason": expect,
        "before": before,
        "after": after,
    }
    return {
        "fixture_id": name,
        "kind": "negative",
        "attack": attack,
        "before": before,
        "after": after,
        "expected": {"disposition": "INVALID", "reason_code": expect},
        "raw": raw,
    }


REQUIRED_MUTATIONS = [
    (
        "constraint_loss",
        "CONSTRAINT_WEAKENED",
        "X01_CONSTRAINT_WEAKENED",
        lambda b: {**b, "hard_constraints": []},
    ),
    (
        "provenance_loss",
        "PROVENANCE_REMOVED",
        "P_PROVENANCE_REMOVED",
        lambda b: {**b, "provenance": []},
    ),
    (
        "uncertainty_drift",
        "UNCERTAINTY_ERASED",
        "X03_UNCERTAINTY_ERASED",
        lambda b: {**b, "uncertainties": []},
    ),
    (
        "preference_drift",
        "SEMANTIC_NONEQUIVALENT",
        "P_SEMANTIC_NONEQUIVALENT",
        lambda b: {
            **b,
            "user_preferences": [{"preference_id": "pref", "statement": "verbose"}],
        },
    ),
    (
        "private_to_public",
        "PRIVACY_ESCALATION",
        "P_PRIVACY_ESCALATION",
        lambda b: {**b, "sensitivity_labels": ["PUBLIC"]},
    ),
    (
        "taint_removal",
        "TRUST_ESCALATION",
        "P_TRUST_ESCALATION",
        lambda b: {**b, "taint_labels": []},
    ),
    (
        "c06_recommendation",
        "SEMANTIC_NONEQUIVALENT",
        "P_SEMANTIC_NONEQUIVALENT",
        lambda b: {
            **b,
            "recommendation": {"option": "B", "conditional": True, "status": "READY"},
        },
    ),
    (
        "c03_recommendation_drift",
        "SEMANTIC_NONEQUIVALENT",
        "P_SEMANTIC_NONEQUIVALENT",
        lambda b: {
            **b,
            "recommendation": {"option": "A", "conditional": False, "status": "READY"},
        },
    ),
    (
        "c07_missing_authority",
        "SEMANTIC_NONEQUIVALENT",
        "C07_EXECUTION_MISSING_AUTHORITY",
        lambda b: {**b, "execution_grants": []},
    ),
    (
        "target_drift",
        "SEMANTIC_NONEQUIVALENT",
        "C07_TARGET_DRIFT",
        lambda b: {
            **b,
            "execution_grants": [
                {
                    "grant_id": "g1",
                    "target": "file:/tmp/Y",
                    "arguments": {"path": "/tmp/x"},
                    "status": "ACTIVE",
                }
            ],
        },
    ),
    (
        "argument_expansion",
        "SEMANTIC_NONEQUIVALENT",
        "C07_ARGUMENT_DRIFT",
        lambda b: {
            **b,
            "execution_grants": [
                {
                    "grant_id": "g1",
                    "target": "file:/tmp/x",
                    "arguments": {"path": "/tmp/x", "mode": "rw"},
                    "status": "ACTIVE",
                }
            ],
        },
    ),
    (
        "expired_grant",
        "SEMANTIC_NONEQUIVALENT",
        "C07_AUTHORITY_EXPIRED",
        lambda b: {
            **b,
            "execution_grants": [
                {
                    "grant_id": "g1",
                    "target": "file:/tmp/x",
                    "arguments": {"path": "/tmp/x"},
                    "status": "ACTIVE",
                    "expired": True,
                }
            ],
        },
    ),
    (
        "revoked_grant",
        "SEMANTIC_NONEQUIVALENT",
        "C07_AUTHORITY_REVOKED",
        lambda b: {
            **b,
            "execution_grants": [
                {
                    "grant_id": "g1",
                    "target": "file:/tmp/x",
                    "arguments": {"path": "/tmp/x"},
                    "status": "REVOKED",
                }
            ],
        },
    ),
    (
        "consumed_grant",
        "SEMANTIC_NONEQUIVALENT",
        "C07_AUTHORITY_CONSUMED",
        lambda b: {
            **b,
            "execution_grants": [
                {
                    "grant_id": "g1",
                    "target": "file:/tmp/x",
                    "arguments": {"path": "/tmp/x"},
                    "status": "CONSUMED",
                }
            ],
        },
    ),
    (
        "unknown_to_pass",
        "SEMANTIC_NONEQUIVALENT",
        "P_STATUS_COLLAPSE",
        lambda b: {
            **b,
            "failures": [{"failure_id": "f1", "status": "PASS", "message": ""}],
        },
    ),
    (
        "partial_to_success",
        "OUTCOME_ESCALATION",
        "P_OUTCOME_ESCALATION",
        lambda b: {**b, "outcome": "SUCCESS"},
    ),
    (
        "operation_id_replacement",
        "OPERATION_ID_MUTATION",
        "P_OPERATION_ID_MUTATION",
        lambda b: {**b, "operation_id": "op-B"},
    ),
]


@pytest.mark.parametrize(
    "name,attack,expect,mut",
    REQUIRED_MUTATIONS,
    ids=lambda v: v[0] if isinstance(v, tuple) else str(v),
)
def test_required_mutation_detected_cross_language(name, attack, expect, mut):
    before = _base()
    after = mut(copy.deepcopy(before))
    case = _case(name, before, after, attack, expect)
    rs = run_rust_case(case)
    assert rs["disposition"] == "INVALID"
    assert rs["reason_code"] == expect, (name, rs)


def test_c01_authority_creation_detected():
    before = _base()
    before["authority_state"] = {"level": 0, "status": "NONE", "grants": []}
    after = copy.deepcopy(before)
    after["authority_state"] = {"level": 1, "status": "GRANTED", "grants": ["minted"]}
    case = _case(
        "c01_authority_creation",
        before,
        after,
        "AUTHORITY_ESCALATION",
        "P_AUTHORITY_ESCALATION",
    )
    rs = run_rust_case(case)
    assert rs["reason_code"] == "P_AUTHORITY_ESCALATION"


def test_tool_success_not_verified_success():
    before = _base()
    before["tool_success"] = True
    before["outcome"] = "PARTIAL"
    after = copy.deepcopy(before)
    after["outcome"] = "VERIFIED_SUCCESS"
    case = _case(
        "tool_success_to_verified",
        before,
        after,
        "OUTCOME_ESCALATION",
        "P_OUTCOME_ESCALATION",
    )
    rs = run_rust_case(case)
    assert rs["reason_code"] == "P_OUTCOME_ESCALATION"


def test_mutation_escapes_zero():
    escapes = []
    for name, attack, expect, mut in REQUIRED_MUTATIONS:
        before = _base()
        after = mut(copy.deepcopy(before))
        case = _case(name, before, after, attack, expect)
        rs = run_rust_case(case)
        if rs.get("reason_code") != expect:
            escapes.append(name)
    assert escapes == [], f"mutation_escapes={escapes}"
