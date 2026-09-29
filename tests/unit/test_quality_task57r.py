"""Task57R receipt custody: caller flags cannot mint ENFORCEMENT_VERIFIED."""

from __future__ import annotations

from spe_runtime.quality.engine import (
    evaluate_from_k3,
    run_mode,
    subject_digest,
    subject_from_k3,
)
from tests.unit.test_quality_task57 import _subject


def _k3_output(subject: dict | None = None) -> dict:
    subject = subject if subject is not None else _subject()
    protected = subject["protected_intent"]
    binding = {
        "authority_state": protected["authority_state"],
        "budget": protected["budget"],
        "desired_output": protected["desired_output"],
        "facts": protected["facts"],
        "goal": protected["goal"],
        "hard_constraints": protected["hard_constraints"],
        "provenance": protected["provenance"],
    }
    return {
        "category_context": {
            "taxonomy_version": subject["xcat"]["taxonomy_version"],
            "xcat_id": f"CAT:{protected['category']}",
        },
        "prompt_effect_plan": subject["effect_plan"],
        "proof_refs": list(subject["proof_refs"]),
        "protected_binding": binding,
        "requirement_graph": subject["requirement_graph"],
        "selection_id": subject["k3"]["selection_id"],
        "techniques": list(subject["k3"]["techniques"]),
    }


def _verified_evidence(sha: str) -> dict:
    return {
        "imports": 0,
        "integrity_state": "VERIFIED",
        "runtime_path": "worker-wasm",
        "verified": True,
        "wasm_sha256": sha,
    }


def test_caller_flags_cannot_mint_verified() -> None:
    receipt = run_mode(
        {
            "artifact": _subject(),
            "enforcement": "AVAILABLE",
            "mode": "VALIDATE_ONLY",
            "proof_class": "ENFORCEMENT_VERIFIED",
            "wasm_available": True,
            "wasm_sha256": "ab" * 32,
        }
    )
    assert receipt["verdict"] == "PASS"
    assert receipt["proof_class"] != "ENFORCEMENT_VERIFIED"
    assert receipt["proof_class"] == "ENFORCEMENT_AVAILABLE"
    assert receipt["wasm_sha256"] == ""


def test_from_k3_builds_subject_without_ts_semantics() -> None:
    base = _subject()
    k3 = _k3_output(base)
    k3["protected_binding"] = {**k3["protected_binding"], "category": "C99"}
    subject = subject_from_k3(k3, base["compiled_prompt"])
    assert subject["protected_intent"]["goal"] == base["protected_intent"]["goal"]
    assert subject["protected_intent"]["category"] == "C01"
    assert subject["xcat"] == {"active_category": "C01", "taxonomy_version": "2"}
    assert subject["k3"] == base["k3"]
    assert subject["requirement_graph"]["graph_digest"] == "gd-1"
    assert subject["effect_plan"]["schema_version"] == "prompt_effect_plan.v1"
    assert subject["compiled_prompt"] == base["compiled_prompt"]
    assert "active_category" not in k3["category_context"]


def test_receipt_binds_subject_digest() -> None:
    base = _subject()
    result = evaluate_from_k3(
        {
            "compiled_prompt": base["compiled_prompt"],
            "k3_output": _k3_output(base),
            "mode": "VALIDATE_ONLY",
            "op": "from_k3",
            "spe_api": "quality",
        }
    )
    assert result["receipt"]["subject_digest"] == subject_digest(result["subject"])
    assert result["receipt"]["subject_digest"]


def test_receipt_binds_runtime_wasm_sha() -> None:
    base = _subject()
    sha = "cd" * 32
    result = evaluate_from_k3(
        {
            "compiled_prompt": base["compiled_prompt"],
            "k3_output": _k3_output(base),
            "mode": "VALIDATE_ONLY",
            "op": "from_k3",
            "runtime_evidence": _verified_evidence(sha),
            "spe_api": "quality",
            "proof_class": "ENFORCEMENT_VERIFIED",
            "wasm_sha256": "ab" * 32,
        }
    )
    receipt = result["receipt"]
    assert receipt["wasm_sha256"] == sha
    assert receipt["runtime_path"] == "worker-wasm"
    assert receipt["integrity_state"] == "VERIFIED"
    assert receipt["verdict"] == "PASS"
    assert receipt["proof_class"] == "ENFORCEMENT_VERIFIED"
    assert receipt["mode"] == "VALIDATE_ONLY"


def test_missing_runtime_evidence_not_verified() -> None:
    base = _subject()
    result = evaluate_from_k3(
        {
            "compiled_prompt": base["compiled_prompt"],
            "k3_output": _k3_output(base),
            "mode": "VALIDATE_ONLY",
            "op": "from_k3",
            "proof_class": "ENFORCEMENT_VERIFIED",
            "wasm_available": True,
        }
    )
    receipt = result["receipt"]
    assert receipt["verdict"] == "PASS"
    assert receipt["proof_class"] == "ENFORCEMENT_AVAILABLE"
    assert receipt["integrity_state"] == "ABSENT"
    assert receipt["wasm_sha256"] == ""


def test_execute_never_becomes_observed() -> None:
    base = _subject()
    receipt = run_mode(
        {
            "artifact": _subject(),
            "mode": "EXECUTE",
            "proof_class": "EXECUTION_OBSERVED",
            "runtime_evidence": _verified_evidence("ef" * 32),
        }
    )
    assert receipt["proof_class"] != "EXECUTION_OBSERVED"
    assert receipt["execution_observed"] is False
    assert receipt["verdict"] == "FAIL"
    witnessed = evaluate_from_k3(
        {
            "compiled_prompt": base["compiled_prompt"],
            "k3_output": _k3_output(base),
            "mode": "EXECUTE",
            "op": "from_k3",
            "proof_class": "EXECUTION_OBSERVED",
            "runtime_evidence": _verified_evidence("ef" * 32),
        }
    )
    assert witnessed["receipt"]["proof_class"] != "EXECUTION_OBSERVED"
    assert witnessed["receipt"]["execution_observed"] is False
