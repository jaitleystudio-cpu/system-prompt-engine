"""G1R-5E/F evidence consistency — split implementation vs evidence validation."""

from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
IMPL = "ce0d9f7250d07d22fe8f1722cb5635d0c9fdc4fd"
TREE = "8f53d36a35307c808798b82622713623c772838f"
WC = "68bac38afe3f38e85da38a359ed482ace07166fbf64c2d89dca3e499e41424f3"


def _load(p: Path):
    return json.loads(p.read_text(encoding="utf-8"))


def _manifest_content_sha(manifest: dict) -> str:
    payload = {k: v for k, v in manifest.items() if k != "artifact_content_sha256"}
    return hashlib.sha256(
        json.dumps(payload, sort_keys=True, indent=2).encode("utf-8")
    ).hexdigest()


def test_g1r5_binding_copies_byte_identical():
    a = (ROOT / "SPE_IMPLEMENTATION_BINDING_v2.json").read_bytes()
    b = (ROOT / "proofs/g1/SPE_IMPLEMENTATION_BINDING_v2.json").read_bytes()
    c = (ROOT / "proofs/g1r5/SPE_IMPLEMENTATION_BINDING_v2.json").read_bytes()
    assert a == b == c
    assert b"PENDING_SUITE" not in a
    assert b'"final_collected": 0' not in a
    assert b'"conformance_command": "PENDING"' not in a


def test_g1r5_manifest_hash_recomputes():
    m = _load(ROOT / "proofs/g1r5/AUTHORITATIVE_TEST_MANIFEST.json")
    assert m["artifact_content_sha256"] == _manifest_content_sha(m)
    assert m["implementation_identity"]["commit"] == IMPL
    assert m["implementation_identity"]["tree"] == TREE
    assert m["implementation_identity"]["working_contract_sha256"] == WC
    assert m["implementation_validation"]["collected"] == 435
    assert m["implementation_validation"]["passed"] == 432
    assert m["implementation_validation"]["failed"] == 3
    assert m["implementation_validation"]["g1r5"] == "18/18"
    assert m["evidence_validation"]["g1r5e"] == "4/4"
    assert m["evidence_validation"]["reviewed_evidence_head"] == "EXTERNAL_ONLY"
    assert m["g1r5_external_review"] == "PASS"
    assert m["g1r5_implementation"] == "PRESENT"
    # Forbidden: merged 439 attributed to implementation tree
    assert m["implementation_validation"]["collected"] != 439


def test_g1r5_evidence_artifacts_agree():
    m = _load(ROOT / "proofs/g1r5/AUTHORITATIVE_TEST_MANIFEST.json")
    b = _load(ROOT / "SPE_IMPLEMENTATION_BINDING_v2.json")
    w = _load(ROOT / "proofs/g1/semantic_writer_map.json")
    ring = _load(ROOT / "proofs/g1/ring0_gap_matrix.json")
    report = (ROOT / "proofs/g1r5/G1R5_REPORT.md").read_text(encoding="utf-8")
    iv = m["implementation_validation"]
    ev = m["evidence_validation"]

    assert b["status"] == "BOUND_WITH_GAPS"
    assert b["normative_spec"]["sha256"] == WC
    assert b["repository"]["implementation_commit"] == IMPL
    assert b["repository"]["suite_run_commit"] == IMPL
    assert b["repository"]["suite_tree"] == TREE
    assert b["tests"]["final_collected"] == iv["collected"] == 435
    assert b["tests"]["final_passed"] == iv["passed"] == 432
    assert b["tests"]["final_failed"] == iv["failed"] == 3
    assert b["tests"]["implementation_validation"]["collected"] == 435
    assert b["tests"]["evidence_validation"]["g1r5e"] == "4/4"
    assert b["tests"]["g1r1_passed"] == 5
    assert b["tests"]["g1r2_passed"] == 27
    assert b["tests"]["g1r3_passed"] == 37
    assert b["tests"]["g1r4_passed"] == 44
    assert b["tests"]["g1r5_passed"] == 18
    assert b["semantic_binding"]["UNOWNED_RING0_RESPONSIBILITIES"] == 3
    assert b["semantic_binding"]["unowned_facts"] == m["unowned_facts_after"]
    assert b["g1r5"]["external_review"] == "PASS"
    assert b["g1r5"]["implementation"] == "PRESENT"
    assert b["g1r5"]["contract_owner"] == "K4"
    assert b["g1r4"]["external_review"] == "PASS"

    pp = next(f for f in w["facts"] if f["semantic_fact"] == "privacy_projection")
    assert pp["canonical_owner"] == "K4"
    assert pp["writer_modules"] == ["spe_runtime/privacy/project.py"]
    assert pp["duplicate_writer"] is False
    assert w.get("unowned_facts") == m["unowned_facts_after"]
    assert "head_sha" not in w
    assert w.get("implementation_commit") == IMPL

    priv = next(r for r in ring["requirements"] if r["requirement"] == "privacy projection")
    assert priv["owner"] == "K4"
    assert priv["status"] == "IMPLEMENTED"

    assert "G1R5_IMPLEMENTATION_PRESENT" in report
    assert "G1R5_PASS" in report
    assert "Contract won" in report
    assert IMPL in report
    assert TREE in report
    assert WC in report
    assert re.search(r"18/18", report)
    assert re.search(r"44/44", report)
    assert "435" in report and "432" in report
    assert "439" not in report
    assert "EVIDENCE VALIDATION" in report
    assert ev["g1r5e"] == "4/4"


def test_g1r5_working_contract_sha_frozen():
    digest = hashlib.sha256(
        (ROOT / "specs/spe-omega-v2.4.1/RING0_WORKING_CONTRACT.json").read_bytes()
    ).hexdigest()
    assert digest == WC
