"""Merge-gate differential campaign: seed 20260915, 1000 generated cases.

Python oracle ↔ native Rust ↔ Node WebAssembly must agree on disposition/reason
(and protected semantics for positives). COST ₹0. Never weaken detectors.
"""

from __future__ import annotations

import copy
import hashlib
import json
import random

from tools.sprint5_conformance import (
    REPO,
    compare_protected,
    load_reference_cases,
    run_python_reference_case,
    run_rust_case,
    run_wasm_case,
)

SEED = 20260915
N = 1000
EVIDENCE = REPO / "proofs" / "generated" / "sprint5_merge_gate_differential_seed20260915.json"


def _pick_positive_payloads(rng: random.Random) -> list[dict]:
    cases = load_reference_cases(kind="positive")
    return [copy.deepcopy(c) for c in cases]


def _neg_surface() -> dict:
    return {
        "envelope_id": "diff-env",
        "goal_identity": "diff-goal",
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
        "operation_id": "op-diff",
        "outcome": "PARTIAL",
    }


# Mutators: (attack, expect, before_factory, after_factory)
def _B():
    return _neg_surface()

MUTATORS = [
    (
        "PROVENANCE_REMOVED",
        "P_PROVENANCE_REMOVED",
        _B,
        lambda b: {**b, "provenance": []},
    ),
    (
        "DENIED_TO_GRANTED",
        "P_DENIED_TO_GRANTED",
        lambda: {**_B(), "authority_state": {"level": 0, "status": "DENIED", "grants": []}},
        lambda b: {**b, "authority_state": {"level": 0, "status": "GRANTED", "grants": []}},
    ),
    (
        "PRIVACY_ESCALATION",
        "P_PRIVACY_ESCALATION",
        _B,
        lambda b: {**b, "sensitivity_labels": ["PUBLIC"]},
    ),
    (
        "UNCERTAINTY_ERASED",
        "X03_UNCERTAINTY_ERASED",
        _B,
        lambda b: {**b, "uncertainties": []},
    ),
    (
        "OPERATION_ID_MUTATION",
        "P_OPERATION_ID_MUTATION",
        _B,
        lambda b: {**b, "operation_id": "op-OTHER"},
    ),
    (
        "OUTCOME_ESCALATION",
        "P_OUTCOME_ESCALATION",
        _B,
        lambda b: {**b, "outcome": "SUCCESS"},
    ),
    (
        "CONSTRAINT_WEAKENED",
        "X01_CONSTRAINT_WEAKENED",
        _B,
        lambda b: {
            **b,
            "hard_constraints": [
                {"constraint_id": "c", "statement": "must", "strength": "SOFT"}
            ],
        },
    ),
    (
        "UNKNOWN_NULLIFIED",
        "P_UNKNOWN_NULLIFIED",
        _B,
        lambda b: {
            **b,
            "failures": [{"failure_id": "f1", "status": None, "message": ""}],
        },
    ),
    (
        "TRUST_ESCALATION",
        "P_TRUST_ESCALATION",
        _B,
        lambda b: {**b, "taint_labels": []},
    ),
    (
        "AUTHORITY_ESCALATION",
        "P_AUTHORITY_ESCALATION",
        lambda: {**_B(), "authority_state": {"level": 0, "status": "NONE", "grants": []}},
        lambda b: {
            **b,
            "authority_state": {"level": 9, "status": "GRANTED", "grants": ["g1"]},
        },
    ),
]


def test_1000_generated_differential_seed_20260915():
    rng = random.Random(SEED)
    positives = _pick_positive_payloads(rng)
    base = _neg_surface()
    failures = []
    agreement = 0
    records = []

    for i in range(N):
        if rng.random() < 0.25:
            src = positives[rng.randrange(len(positives))]
            case = copy.deepcopy(src)
            case["fixture_id"] = f"gen-pos-{i}"
            py = run_python_reference_case(case)
            rs = run_rust_case(case)
            wasm = run_wasm_case(case)
            ok = (
                py.get("status") == "VALID"
                and rs.get("status") == "VALID"
                and wasm.get("status") == "VALID"
                and wasm.get("runtime") == "node-webassembly"
                and compare_protected(py, rs)
                and compare_protected(rs, wasm)
            )
            if ok:
                agreement += 1
            else:
                failures.append(
                    {
                        "i": i,
                        "kind": "positive",
                        "id": src["fixture_id"],
                        "py": py.get("status"),
                        "rs": rs.get("status"),
                        "wasm": wasm.get("status"),
                        "runtime": wasm.get("runtime"),
                        "py_rs": compare_protected(py, rs),
                        "rs_wasm": compare_protected(rs, wasm),
                    }
                )
            records.append({"i": i, "kind": "positive", "ok": ok})
        else:
            attack, expect, before_fn, after_fn = MUTATORS[rng.randrange(len(MUTATORS))]
            before = before_fn()
            after = after_fn(copy.deepcopy(before))
            raw = {
                "id": f"gen-neg-{i}",
                "kind": "negative",
                "attack": attack,
                "expect_reason": expect,
                "before": before,
                "after": after,
            }
            case = {
                "fixture_id": f"gen-neg-{i}",
                "kind": "negative",
                "attack": attack,
                "expected": {"disposition": "INVALID", "reason_code": expect},
                "raw": raw,
            }
            py = run_python_reference_case(case)
            rs = run_rust_case(case)
            wasm = run_wasm_case(case)
            ok = (
                rs.get("disposition") == "INVALID"
                and rs.get("reason_code") == expect
                and wasm.get("disposition") == "INVALID"
                and wasm.get("reason_code") == expect
                and wasm.get("runtime") == "node-webassembly"
                and py.get("status") != "ERROR"
                and py.get("reason_code") == expect
            )
            if ok:
                agreement += 1
            else:
                failures.append(
                    {
                        "i": i,
                        "kind": "negative",
                        "attack": attack,
                        "expect": expect,
                        "py": {"status": py.get("status"), "reason": py.get("reason_code")},
                        "rs": {"status": rs.get("status"), "reason": rs.get("reason_code")},
                        "wasm": {
                            "status": wasm.get("status"),
                            "reason": wasm.get("reason_code"),
                            "runtime": wasm.get("runtime"),
                        },
                    }
                )
            records.append({"i": i, "kind": "negative", "attack": attack, "ok": ok})

    evidence = {
        "seed": SEED,
        "n": N,
        "agreement": agreement,
        "failures": len(failures),
        "failure_samples": failures[:25],
        "rust_vs_wasm_agreement": agreement,
        "wasm_runtime": "node-webassembly",
        "status": "PASS" if agreement == N else "FAIL",
        "sha256_of_record_ok_bits": hashlib.sha256(
            "".join("1" if r["ok"] else "0" for r in records).encode()
        ).hexdigest(),
    }
    EVIDENCE.parent.mkdir(parents=True, exist_ok=True)
    EVIDENCE.write_text(json.dumps(evidence, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    assert failures == [], f"differential failures={len(failures)} sample={failures[:5]}"
    assert agreement == N
