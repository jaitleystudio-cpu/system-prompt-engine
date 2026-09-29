"""Python ↔ Rust (native + WASM) XCAT parity for Task 56B."""

from __future__ import annotations

import json
import subprocess
from pathlib import Path
from typing import Any

import pytest

from spe_runtime.categories.apply import apply_category_payload
from spe_runtime.portability.canonical import canonical_dumps
from spe_runtime.xcat.migration import validate_taxonomy_version
from spe_runtime.xcat.models import AuthorityState, CrossCategoryEnvelope
from spe_runtime.xcat.router import route_mission_stage

REPO = Path(__file__).resolve().parents[2]
RUST_BIN = REPO / "portable" / "spe-core-rs" / "target" / "debug" / "spe-core-eval"
PUBLIC_WASM = REPO / "apps" / "web" / "public" / "spe_wasm.wasm"
WASM_HOST = REPO / "tools" / "spe_wasm_node_host.js"


def _envelope_from_dict(data: dict[str, Any]) -> CrossCategoryEnvelope:
    auth = data.get("authority_state") or {"level": 0, "status": "NONE", "grants": []}
    return CrossCategoryEnvelope(
        envelope_id=str(data["envelope_id"]),
        goal_identity=str(data["goal_identity"]),
        facts=tuple(data.get("facts") or ()),
        provenance=tuple(data.get("provenance") or ()),
        uncertainties=tuple(data.get("uncertainties") or ()),
        hard_constraints=tuple(data.get("hard_constraints") or ()),
        user_preferences=tuple(data.get("user_preferences") or ()),
        analysis=data.get("analysis"),
        recommendation=data.get("recommendation"),
        rendering=data.get("rendering"),
        authority_state=AuthorityState(
            level=int(auth.get("level", 0)),
            status=str(auth.get("status", "NONE")),
            grants=tuple(auth.get("grants") or ()),
        ),
        execution_grants=tuple(data.get("execution_grants") or ()),
        failures=(),
        taint_labels=tuple(data.get("taint_labels") or ()),
        sensitivity_labels=tuple(data.get("sensitivity_labels") or ()),
        category_trace=tuple(data.get("category_trace") or ()),
        taxonomy_version=str(data.get("taxonomy_version", "2")),
        active_category=data.get("active_category"),
        category_payload=data.get("category_payload"),
        proof_obligation_proposals=tuple(data.get("proof_obligation_proposals") or ()),
    )


def _env(**overrides: Any) -> CrossCategoryEnvelope:
    base: dict[str, Any] = dict(
        envelope_id="env-parity-56b",
        goal_identity="goal-parity-56b",
        facts=({"fact_id": "f1", "statement": "note", "provenance_ids": ["p1"]},),
        provenance=({"provenance_id": "p1", "source": "user"},),
        uncertainties=({"uncertainty_id": "u1", "description": "maybe"},),
        hard_constraints=(
            {"constraint_id": "c1", "statement": "no invent", "strength": "HARD"},
        ),
        user_preferences=({"preference_id": "pref1", "statement": "concise"},),
        analysis=None,
        recommendation=None,
        rendering=None,
        authority_state=AuthorityState(level=0, status="NONE", grants=()),
        execution_grants=(),
        failures=(),
        taint_labels=(),
        sensitivity_labels=(),
        category_trace=(),
        taxonomy_version="2",
    )
    base.update(overrides)
    return CrossCategoryEnvelope(**base)


CASES: list[dict[str, Any]] = [
    {
        "id": "route_c09",
        "kind": "success",
        "payload": {
            "spe_api": "xcat",
            "op": "route",
            "evidence": {
                "stage": {"category_ref": "CAT:C09"},
                "category_evidence": [{"key": "stage"}],
            },
        },
    },
    {
        "id": "route_empty",
        "kind": "success",
        "payload": {"spe_api": "xcat", "op": "route", "evidence": {}},
    },
    {
        "id": "route_self_selected",
        "kind": "success",
        "payload": {
            "spe_api": "xcat",
            "op": "route",
            "evidence": {"self_selected_category": "CAT:C01"},
        },
    },
    {
        "id": "route_secondary",
        "kind": "success",
        "payload": {
            "spe_api": "xcat",
            "op": "route",
            "evidence": {
                "category_ref": "CAT:C04",
                "secondary_categories": ["CAT:C03", "CAT:C04"],
            },
        },
    },
    {
        "id": "apply_c04",
        "kind": "success",
        "payload": {
            "spe_api": "xcat",
            "op": "apply",
            "envelope": _env().to_dict(),
            "category_id": "CAT:C04",
            "payload": {
                "source_language": "en",
                "target_language": "es",
                "protected_terms": ["SPE"],
            },
            "proof_obligation_proposals": [],
        },
    },
    {
        "id": "apply_c05",
        "kind": "success",
        "payload": {
            "spe_api": "xcat",
            "op": "apply",
            "envelope": _env().to_dict(),
            "category_id": "CAT:C05",
            "payload": {
                "learner_state": {"status": "LEARNING"},
                "mastery_evidence": {"quiz_id": "q1"},
            },
            "proof_obligation_proposals": [],
        },
    },
    {
        "id": "apply_c09",
        "kind": "success",
        "payload": {
            "spe_api": "xcat",
            "op": "apply",
            "envelope": _env().to_dict(),
            "category_id": "CAT:C09",
            "payload": {"repository": "spe", "architecture": "modular"},
            "proof_obligation_proposals": [],
        },
    },
    {
        "id": "apply_c01_payload_only",
        "kind": "success",
        "payload": {
            "spe_api": "xcat",
            "op": "apply",
            "envelope": _env().to_dict(),
            "category_id": "CAT:C01",
            "payload": {
                "options": ["hold", "ship"],
                "criteria": ["risk"],
                "decision_authority": "user",
            },
            "proof_obligation_proposals": [],
        },
    },
    {
        "id": "apply_c07_authority_is_payload",
        "kind": "success",
        "payload": {
            "spe_api": "xcat",
            "op": "apply",
            "envelope": _env().to_dict(),
            "category_id": "CAT:C07",
            "payload": {
                "desired_action": "draft_note",
                "authority": "NONE",
                "reversibility": "REVERSIBLE",
            },
            "proof_obligation_proposals": [],
        },
    },
    {
        "id": "validate_current",
        "kind": "success",
        "payload": {
            "spe_api": "xcat",
            "op": "validate_taxonomy",
            "taxonomy_version": "2",
        },
    },
    {
        "id": "validate_legacy",
        "kind": "success",
        "payload": {
            "spe_api": "xcat",
            "op": "validate_taxonomy",
            "taxonomy_version": "1",
        },
    },
    {
        "id": "validate_unknown",
        "kind": "success",
        "payload": {
            "spe_api": "xcat",
            "op": "validate_taxonomy",
            "taxonomy_version": "9",
        },
    },
    {
        "id": "apply_legacy_reject",
        "kind": "failure",
        "reason_code": "LEGACY_TAXONOMY_UNMIGRATED",
        "payload": {
            "spe_api": "xcat",
            "op": "apply",
            "envelope": _env(taxonomy_version="1").to_dict(),
            "category_id": "CAT:C09",
            "payload": {"repository": "x"},
            "proof_obligation_proposals": [],
        },
    },
    {
        "id": "apply_unknown_taxonomy",
        "kind": "failure",
        "reason_code": "UNKNOWN_TAXONOMY_VERSION",
        "payload": {
            "spe_api": "xcat",
            "op": "apply",
            "envelope": _env(taxonomy_version="9").to_dict(),
            "category_id": "CAT:C04",
            "payload": {"source_language": "en"},
            "proof_obligation_proposals": [],
        },
    },
    {
        "id": "apply_mastery_reject",
        "kind": "failure",
        "reason_substr": "mastery_evidence",
        "payload": {
            "spe_api": "xcat",
            "op": "apply",
            "envelope": _env().to_dict(),
            "category_id": "CAT:C05",
            "payload": {"learner_state": {"status": "MASTERED"}},
            "proof_obligation_proposals": [],
        },
    },
    {
        "id": "apply_c09_build_pass_reject",
        "kind": "failure",
        "reason_substr": "BUILD_PASS",
        "payload": {
            "spe_api": "xcat",
            "op": "apply",
            "envelope": _env().to_dict(),
            "category_id": "CAT:C09",
            "payload": {"repository": "x", "BUILD_PASS": True},
            "proof_obligation_proposals": [],
        },
    },
]


def _python_eval(case: dict[str, Any]) -> dict[str, Any]:
    body = case["payload"]
    op = body["op"]
    if op == "route":
        return {"status": "VALID", "output": route_mission_stage(body["evidence"])}
    if op == "validate_taxonomy":
        return {
            "status": "VALID",
            "output": validate_taxonomy_version(body.get("taxonomy_version")),
        }
    if op == "apply":
        env = _envelope_from_dict(body["envelope"])
        try:
            after = apply_category_payload(
                env,
                body["category_id"],
                body["payload"],
                body.get("proof_obligation_proposals") or (),
            )
            return {"status": "VALID", "output": after.to_dict()}
        except ValueError as exc:
            msg = str(exc)
            code = "PORTABILITY_INVALID_FIXTURE"
            if msg.startswith("LEGACY_TAXONOMY_UNMIGRATED"):
                code = "LEGACY_TAXONOMY_UNMIGRATED"
            elif msg.startswith("UNKNOWN_TAXONOMY_VERSION"):
                code = "UNKNOWN_TAXONOMY_VERSION"
            return {
                "status": "INVALID",
                "reason_code": code,
                "output": {"message": msg},
            }
    raise AssertionError(f"unknown op {op}")


def _rust_bin() -> Path:
    if RUST_BIN.is_file():
        return RUST_BIN
    proc = subprocess.run(
        [
            "cargo",
            "build",
            "--manifest-path",
            str(REPO / "portable" / "spe-core-rs" / "Cargo.toml"),
            "--locked",
            "--bin",
            "spe-core-eval",
        ],
        cwd=REPO,
        capture_output=True,
        text=True,
        check=False,
    )
    if proc.returncode != 0:
        raise AssertionError(proc.stderr[-2000:])
    return RUST_BIN


def _run_json(cmd: list[str], payload: dict) -> dict:
    proc = subprocess.run(
        cmd,
        input=json.dumps(payload),
        capture_output=True,
        text=True,
        check=False,
    )
    if proc.returncode != 0:
        raise AssertionError(proc.stderr[-2000:] or proc.stdout[-500:])
    return json.loads(proc.stdout)


def _compare_success(py: dict, other: dict) -> bool:
    if other.get("status") != "VALID":
        return False
    return canonical_dumps(py["output"]) == canonical_dumps(other["output"])


def _compare_failure(case: dict, py: dict, other: dict) -> bool:
    if other.get("status") != "INVALID":
        return False
    if case.get("reason_code"):
        if other.get("reason_code") != case["reason_code"]:
            return False
        if py.get("reason_code") != case["reason_code"]:
            return False
    if case.get("reason_substr"):
        msg = (other.get("output") or {}).get("message", "")
        if case["reason_substr"] not in msg:
            return False
        py_msg = (py.get("output") or {}).get("message", "")
        if case["reason_substr"] not in py_msg:
            return False
    return True


def test_python_rust_xcat_parity() -> None:
    binary = _rust_bin()
    mismatches: list[str] = []
    for case in CASES:
        py = _python_eval(case)
        rust = _run_json([str(binary)], case["payload"])
        ok = (
            _compare_success(py, rust)
            if case["kind"] == "success"
            else _compare_failure(case, py, rust)
        )
        if not ok:
            mismatches.append(case["id"])
    assert mismatches == [], f"parity mismatches: {mismatches}"


def test_python_wasm_xcat_parity() -> None:
    if not PUBLIC_WASM.is_file():
        pytest.skip("public WASM artifact missing")
    mismatches: list[str] = []
    for case in CASES:
        py = _python_eval(case)
        wasm = _run_json(
            ["node", str(WASM_HOST), str(PUBLIC_WASM)], case["payload"]
        )
        # Pre-rebuild WASM may lack xcat API; treat as skippable mismatch signal.
        if wasm.get("status") == "INVALID" and case["kind"] == "success":
            # Still count — after rebuild this must pass.
            pass
        ok = (
            _compare_success(py, wasm)
            if case["kind"] == "success"
            else _compare_failure(case, py, wasm)
        )
        if not ok:
            mismatches.append(case["id"])
    assert mismatches == [], f"wasm parity mismatches: {mismatches}"


def test_parity_case_coverage() -> None:
    assert len(CASES) >= 12
    assert any(c["id"] == "apply_legacy_reject" for c in CASES)
    assert any(c["id"] == "apply_c09_build_pass_reject" for c in CASES)
