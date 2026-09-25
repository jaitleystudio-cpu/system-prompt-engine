"""G1 mechanical binding tests. Do not implement production semantics to pass."""
from __future__ import annotations

import json
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
G1 = ROOT / "proofs" / "g1"
BINDING = ROOT / "SPE_IMPLEMENTATION_BINDING_v2.json"
VALID_DISP = {"RETAIN", "WRAP", "MIGRATE", "REPLACE", "RETIRE"}
OWNERS = {"K0", "K1", "K2", "K3", "K4", "K5", "K6", "K7", None}


def _load(p: Path):
    return json.loads(p.read_text(encoding="utf-8"))


def _py_modules():
    return sorted(
        p.relative_to(ROOT).as_posix()
        for p in (ROOT / "spe_runtime").rglob("*.py")
    )


def test_g1_runtime_inventory_complete():
    inv = _load(G1 / "runtime_module_inventory.json")
    listed = sorted(m["path"] for m in inv["modules"])
    disk = _py_modules()
    assert listed == disk, (set(disk) - set(listed), set(listed) - set(disk))
    assert inv["module_count"] == len(disk)


def test_g1_every_module_has_disposition():
    disp = _load(G1 / "module_disposition.json")
    listed = sorted(m["path"] for m in disp["modules"])
    disk = _py_modules()
    assert listed == disk
    for m in disp["modules"]:
        assert m["disposition"] in VALID_DISP
        assert "reason" in m and m["reason"]


def test_g1_disposition_enum_valid():
    disp = _load(G1 / "module_disposition.json")
    for m in disp["modules"]:
        assert m["disposition"] in VALID_DISP
        owner = m["normative_owner"]
        assert owner in OWNERS or owner is None
    # exactly one disposition per path
    paths = [m["path"] for m in disp["modules"]]
    assert len(paths) == len(set(paths))


def test_g1_ring0_owner_mapping_complete():
    ring = _load(G1 / "ring0_gap_matrix.json")
    reqs = ring["requirements"]
    assert reqs, "ring0 matrix empty"
    owners = {r["owner"] for r in reqs}
    assert {"K0", "K1", "K2", "K3", "K4", "K5", "K6", "K7"} <= owners
    for r in reqs:
        assert r["status"] in {"IMPLEMENTED", "PARTIAL", "MISSING", "CONFLICTING"}
        assert "future_action" in r


def test_g1_binding_manifest_complete():
    b = _load(BINDING)
    for key in (
        "schema_version",
        "gate",
        "status",
        "normative_spec",
        "repository",
        "tests",
        "module_binding",
        "semantic_binding",
        "conformance_command",
        "conformance_result",
        "blockers",
    ):
        assert key in b
    assert b["gate"] == "G1_RUNTIME_BINDING"
    assert b["status"] in {"BOUND_AND_PASS", "BOUND_WITH_GAPS"}
    mb = b["module_binding"]
    assert mb["module_count"] == len(_py_modules())
    assert mb["retain"] + mb["wrap"] + mb["migrate"] + mb["replace"] + mb["retire"] == mb["module_count"]


def test_g1_repo_tree_hash_bound():
    b = _load(BINDING)
    ident = _load(G1 / "repo_identity.json")
    assert b["repository"]["base_sha"].startswith("931128b")
    assert b["repository"]["tree_hash"]
    assert ident["git_tree_sha"] == b["repository"]["tree_hash"]
    assert (G1 / "source_files.sha256").exists()
    assert ident.get("source_manifest_hash")


def test_g1_normative_spec_hash_bound():
    b = _load(BINDING)
    spec = b["normative_spec"]
    assert spec["version"] == "SPE Ω v2.4.1"
    # Honest: v2.4.1 bytes are not in this NEW_IMPLEMENTATION tree.
    assert spec["sha256"], (
        "G1-B01: SPE Ω v2.4.1 sha256 is unbound; tree only has SPE-SPEC "
        f"{spec.get('repo_spec_sha256')} (NEW_IMPLEMENTATION, not 181/69)."
    )


def test_g1_no_duplicate_canonical_writers():
    writers = _load(G1 / "semantic_writer_map.json")
    dups = [f for f in writers["facts"] if f["duplicate_writer"]]
    assert dups == [], f"duplicate canonical writers: {[d['semantic_fact'] for d in dups]}"


def test_g1_no_unowned_required_ring0_responsibility():
    writers = _load(G1 / "semantic_writer_map.json")
    ring = _load(G1 / "ring0_gap_matrix.json")
    unowned_facts = [f["semantic_fact"] for f in writers["facts"] if not f["writer_modules"]]
    missing = [r["requirement"] for r in ring["requirements"] if r["status"] == "MISSING"]
    assert unowned_facts == [] and missing == [], {
        "unowned_facts": unowned_facts,
        "missing_requirements": missing,
    }


def test_g1_authority_owner_unique():
    writers = _load(G1 / "semantic_writer_map.json")
    grant = next(f for f in writers["facts"] if f["semantic_fact"] == "grant_compatibility")
    assert grant["writer_modules"] == ["spe_runtime/authority/validate.py"]
    assert grant["duplicate_writer"] is False
    consume = next(f for f in writers["facts"] if f["semantic_fact"] == "grant_uses_consumed")
    assert consume["writer_modules"] == ["spe_runtime/authority/consume.py"]


def test_g1_proof_owner_unique():
    writers = _load(G1 / "semantic_writer_map.json")
    proof = next(f for f in writers["facts"] if f["semantic_fact"] == "proof_receipt")
    assert proof["writer_modules"], "K2 proof_receipt has no writer (proof/ is empty)"


def test_g1_error_owner_unique():
    writers = _load(G1 / "semantic_writer_map.json")
    err = next(f for f in writers["facts"] if f["semantic_fact"] == "typed_error_code")
    assert err["duplicate_writer"] is False, (
        f"split error vocabulary writers={err['writer_modules']}"
    )
    assert len(err["writer_modules"]) == 1


def test_g1_artifact_lineage_owner_unique():
    writers = _load(G1 / "semantic_writer_map.json")
    art = next(f for f in writers["facts"] if f["semantic_fact"] == "spe_artifact_identity")
    assert art["writer_modules"], "K6 .spe artifact identity has no writer"


def test_g1_qualification_owner_unique():
    writers = _load(G1 / "semantic_writer_map.json")
    q = next(f for f in writers["facts"] if f["semantic_fact"] == "qualification_evidence")
    assert q["writer_modules"], "K7 qualification evidence has no writer"
