"""G1R-8 K6 .spe semantic artifact + lineage tests."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import pytest

from spe_runtime.contract import ProtectedIntentContract, propose_requirement, confirm_requirement
from spe_runtime.contract.protected import ContractValidity
from spe_runtime.error_registry import ErrorCode, SpeTypedError
from spe_runtime.proof.snapshot import make_snapshot
from spe_runtime.prompt import PlanningHints, build_prompt_artifact
from spe_runtime.provenance import Provenance
from spe_runtime.requirements import RequirementKind
from spe_runtime.storage import (
    ARTIFACT_ID_PREFIX,
    SpeArtifact,
    build_spe_artifact,
    dumps_spe,
    load_spe,
    loads_spe,
    save_spe,
    validate_spe_artifact,
)

ROOT = Path(__file__).resolve().parents[2]


def _req(c, key, kind, value, prov=Provenance.USER_EXPLICIT):
    return propose_requirement(
        c, semantic_key=key, kind=kind, value=value, provenance=prov, source_ref="t"
    )


def _simple_state():
    c = _req(ProtectedIntentContract(), "goal", RequirementKind.MUST, "hello")
    snap = make_snapshot(c, version=1)
    prompt = build_prompt_artifact(c, planning_hints=PlanningHints(complexity_class="SIMPLE"))
    return c, snap, prompt


# ---------------------------------------------------------------------------
# Positive
# ---------------------------------------------------------------------------


def test_spe_artifact_identity_is_deterministic():
    _, snap, prompt = _simple_state()
    a = build_spe_artifact(snap, prompt_artifact=prompt)
    b = build_spe_artifact(snap, prompt_artifact=prompt)
    assert a.artifact_id == b.artifact_id
    assert a.artifact_id.startswith(ARTIFACT_ID_PREFIX)
    assert a.artifact_id != prompt.prompt_content_digest
    assert a.artifact_id != snap.snapshot_id


def test_spe_artifact_cross_process_identity_stable():
    code = r"""
from spe_runtime.contract import ProtectedIntentContract, propose_requirement
from spe_runtime.provenance import Provenance
from spe_runtime.requirements import RequirementKind
from spe_runtime.proof.snapshot import make_snapshot
from spe_runtime.prompt import PlanningHints, build_prompt_artifact
from spe_runtime.storage import build_spe_artifact, dumps_spe
c = ProtectedIntentContract()
c = propose_requirement(c, semantic_key='goal', kind=RequirementKind.MUST, value='hello', provenance=Provenance.USER_EXPLICIT)
snap = make_snapshot(c, version=1)
prompt = build_prompt_artifact(c, planning_hints=PlanningHints(complexity_class='SIMPLE'))
art = build_spe_artifact(snap, prompt_artifact=prompt)
print(art.artifact_id)
print(dumps_spe(art).hex())
"""
    a = subprocess.check_output([sys.executable, "-c", code], cwd=str(ROOT), text=True)
    b = subprocess.check_output([sys.executable, "-c", code], cwd=str(ROOT), text=True)
    assert a == b


def test_spe_artifact_round_trip():
    _, snap, prompt = _simple_state()
    art = build_spe_artifact(snap, prompt_artifact=prompt)
    raw = dumps_spe(art)
    parsed = loads_spe(raw)
    assert parsed.artifact_id == art.artifact_id
    assert parsed.snapshot_id == art.snapshot_id
    assert parsed.prompt_content_digest == art.prompt_content_digest
    assert dumps_spe(parsed) == raw


def test_spe_artifact_root_parent_is_none():
    _, snap, prompt = _simple_state()
    art = build_spe_artifact(snap, prompt_artifact=prompt)
    assert art.parent_artifact_id is None


def test_spe_artifact_child_binds_parent():
    c1 = _req(ProtectedIntentContract(), "goal", RequirementKind.MUST, "v1")
    snap1 = make_snapshot(c1, version=1)
    parent = build_spe_artifact(snap1)
    c2 = _req(ProtectedIntentContract(), "goal", RequirementKind.MUST, "v2")
    snap2 = make_snapshot(c2, version=2, parent=snap1)
    child = build_spe_artifact(snap2, parent_artifact_id=parent.artifact_id)
    assert child.parent_artifact_id == parent.artifact_id
    assert child.artifact_id != parent.artifact_id
    assert child.snapshot_version > parent.snapshot_version


def test_spe_artifact_binds_snapshot_id():
    _, snap, _ = _simple_state()
    art = build_spe_artifact(snap)
    assert art.snapshot_id == snap.snapshot_id
    assert art.snapshot_id.startswith("snap-")


def test_spe_artifact_binds_snapshot_version():
    _, snap, _ = _simple_state()
    art = build_spe_artifact(snap)
    assert art.snapshot_version == snap.version


def test_spe_artifact_binds_prompt_digest():
    _, snap, prompt = _simple_state()
    art = build_spe_artifact(snap, prompt_artifact=prompt)
    assert art.prompt_content_digest == prompt.prompt_content_digest
    assert art.prompt_content_digest.startswith("pad-")


def test_spe_artifact_preserves_provenance():
    c = _req(
        ProtectedIntentContract(),
        "goal",
        RequirementKind.MUST,
        "x",
        Provenance.USER_EXPLICIT,
    )
    rid = next(iter(c.graph.nodes.keys()))
    c = confirm_requirement(c, rid)
    snap = make_snapshot(c, version=1)
    art = build_spe_artifact(snap)
    payload = dict(art.protected_intent_payload)
    provs = {r["provenance"] for r in payload["requirements"]}
    assert "USER_CONFIRMED" in provs
    assert art.contract_validity == "VALID"


def test_spe_artifact_preserves_requirement_strength():
    c = ProtectedIntentContract()
    c = _req(c, "a", RequirementKind.MUST, "1")
    c = _req(c, "b", RequirementKind.MUST_NOT, "2")
    c = _req(c, "c", RequirementKind.SHOULD, "3")
    c = _req(c, "d", RequirementKind.PREFERENCE, "4")
    art = build_spe_artifact(make_snapshot(c, version=1))
    kinds = {r["kind"] for r in art.protected_intent_payload["requirements"]}
    assert kinds == {"MUST", "MUST_NOT", "SHOULD", "PREFERENCE"}


def test_spe_artifact_preserves_conflicted_state():
    c = _req(ProtectedIntentContract(), "fmt", RequirementKind.MUST, "json")
    c = confirm_requirement(c, next(iter(c.graph.nodes.keys())))
    c = _req(c, "fmt", RequirementKind.MUST_NOT, "json", Provenance.INFERRED)
    assert c.validity is ContractValidity.CONFLICTED
    art = build_spe_artifact(make_snapshot(c, version=1))
    assert art.contract_validity == "CONFLICTED"
    assert art.protected_intent_payload["validity"] == "CONFLICTED"
    assert art.protected_intent_payload["conflicts"]


def test_spe_artifact_builder_copy_on_write():
    c, snap, prompt = _simple_state()
    before_snap = snap.snapshot_id
    before_pad = prompt.prompt_content_digest
    before_nodes = set(c.graph.nodes.keys())
    build_spe_artifact(snap, prompt_artifact=prompt)
    assert snap.snapshot_id == before_snap
    assert prompt.prompt_content_digest == before_pad
    assert set(c.graph.nodes.keys()) == before_nodes


def test_spe_artifact_nested_immutable():
    _, snap, prompt = _simple_state()
    art = build_spe_artifact(snap, prompt_artifact=prompt)
    with pytest.raises(TypeError):
        art.protected_intent_payload["validity"] = "VALID"  # type: ignore[index]


def test_filename_does_not_affect_identity(tmp_path):
    _, snap, prompt = _simple_state()
    art = build_spe_artifact(snap, prompt_artifact=prompt)
    p1 = tmp_path / "foo.spe"
    p2 = tmp_path / "bar.spe"
    save_spe(art, p1)
    save_spe(art, p2)
    assert load_spe(p1).artifact_id == load_spe(p2).artifact_id == art.artifact_id


def test_path_does_not_affect_identity(tmp_path):
    _, snap, prompt = _simple_state()
    art = build_spe_artifact(snap, prompt_artifact=prompt)
    d1 = tmp_path / "a"
    d2 = tmp_path / "b"
    d1.mkdir()
    d2.mkdir()
    save_spe(art, d1 / "x.spe")
    save_spe(art, d2 / "x.spe")
    assert load_spe(d1 / "x.spe").artifact_id == load_spe(d2 / "x.spe").artifact_id


# ---------------------------------------------------------------------------
# Negative
# ---------------------------------------------------------------------------


def test_spe_rejects_tampered_identity_bearing_field():
    _, snap, prompt = _simple_state()
    art = build_spe_artifact(snap, prompt_artifact=prompt)
    doc = json.loads(dumps_spe(art))
    doc["snapshot_version"] = art.snapshot_version + 99
    # keep old artifact_id
    with pytest.raises(SpeTypedError) as ei:
        loads_spe(json.dumps(doc))
    assert ei.value.code is ErrorCode.K6_ARTIFACT_ID_MISMATCH


def test_spe_rejects_wrong_artifact_id():
    _, snap, prompt = _simple_state()
    art = build_spe_artifact(snap, prompt_artifact=prompt)
    doc = json.loads(dumps_spe(art))
    doc["artifact_id"] = "spe-" + ("0" * 64)
    with pytest.raises(SpeTypedError) as ei:
        loads_spe(json.dumps(doc))
    assert ei.value.code is ErrorCode.K6_ARTIFACT_ID_MISMATCH


def test_spe_rejects_wrong_snapshot_id_domain():
    _, snap, _ = _simple_state()
    art = build_spe_artifact(snap)
    doc = json.loads(dumps_spe(art))
    doc["snapshot_id"] = art.prompt_content_digest or ("pad-" + "ab" * 32)
    # recompute won't match anyway; also domain invalid
    with pytest.raises(SpeTypedError) as ei:
        loads_spe(json.dumps(doc, sort_keys=True))
    assert ei.value.code in (
        ErrorCode.K6_INVALID_ARTIFACT,
        ErrorCode.K6_ARTIFACT_ID_MISMATCH,
    )


def test_spe_rejects_wrong_parent_id_domain():
    _, snap, _ = _simple_state()
    with pytest.raises(SpeTypedError) as ei:
        build_spe_artifact(snap, parent_artifact_id="pad-" + "ab" * 32)
    assert ei.value.code is ErrorCode.K6_INVALID_LINEAGE


def test_spe_rejects_direct_self_parent():
    _, snap, _ = _simple_state()
    art = build_spe_artifact(snap)
    doc = json.loads(dumps_spe(art))
    doc["parent_artifact_id"] = doc["artifact_id"]
    with pytest.raises(SpeTypedError) as ei:
        loads_spe(json.dumps(doc))
    assert ei.value.code in (
        ErrorCode.K6_INVALID_LINEAGE,
        ErrorCode.K6_ARTIFACT_ID_MISMATCH,
    )


def test_spe_rejects_duplicate_json_keys():
    raw = '{"format":"spe","format":"spe"}'
    with pytest.raises(SpeTypedError) as ei:
        loads_spe(raw)
    assert ei.value.code is ErrorCode.K6_INVALID_ARTIFACT
    assert "duplicate" in str(ei.value).lower()


def test_spe_rejects_unknown_semantic_field():
    _, snap, _ = _simple_state()
    art = build_spe_artifact(snap)
    doc = json.loads(dumps_spe(art))
    doc["production_ready"] = True
    with pytest.raises(SpeTypedError) as ei:
        loads_spe(json.dumps(doc))
    assert ei.value.code is ErrorCode.K6_INVALID_ARTIFACT


def test_spe_rejects_wrong_field_type():
    _, snap, _ = _simple_state()
    art = build_spe_artifact(snap)
    doc = json.loads(dumps_spe(art))
    doc["snapshot_version"] = "5"
    with pytest.raises(SpeTypedError) as ei:
        loads_spe(json.dumps(doc))
    assert ei.value.code is ErrorCode.K6_INVALID_ARTIFACT


def test_spe_import_does_not_grant_authority():
    _, snap, prompt = _simple_state()
    art = build_spe_artifact(snap, prompt_artifact=prompt)
    doc = json.loads(dumps_spe(art))
    # Inject authority-looking string into embedded payload statement via tamper
    # that also breaks id — instead check validated artifact has no authority fields
    parsed = loads_spe(dumps_spe(art))
    blob = json.dumps(parsed.to_canonical_document())
    assert "AuthorityGrant" not in blob
    assert "authority_grant" not in blob


def test_spe_import_does_not_upgrade_provenance():
    c = _req(
        ProtectedIntentContract(),
        "goal",
        RequirementKind.PREFERENCE,
        "x",
        Provenance.INFERRED,
    )
    art = build_spe_artifact(make_snapshot(c, version=1))
    parsed = loads_spe(dumps_spe(art))
    provs = {r["provenance"] for r in parsed.protected_intent_payload["requirements"]}
    assert provs == {"INFERRED"}
    assert "USER_CONFIRMED" not in provs


def test_spe_import_does_not_mint_proof():
    _, snap, _ = _simple_state()
    parsed = loads_spe(dumps_spe(build_spe_artifact(snap)))
    blob = json.dumps(parsed.to_canonical_document())
    assert "proof_valid" not in blob
    assert "VerificationReceipt" not in blob


def test_spe_import_does_not_mint_qualification():
    _, snap, _ = _simple_state()
    art = build_spe_artifact(snap)
    doc = json.loads(dumps_spe(art))
    # Attempt to smuggle qualification field
    with pytest.raises(SpeTypedError):
        doc2 = dict(doc)
        doc2["qualified"] = True
        loads_spe(json.dumps(doc2))
    parsed = loads_spe(dumps_spe(art))
    assert "qualified" not in parsed.to_canonical_document()
    assert "world_number_one" not in parsed.to_canonical_document()


def test_pad_identity_does_not_collapse_spe_identity():
    """Same pad- with different snapshot state → different spe- ids."""
    c1 = _req(ProtectedIntentContract(), "goal", RequirementKind.MUST, "same-prompt-goal")
    c2 = _req(ProtectedIntentContract(), "goal", RequirementKind.MUST, "same-prompt-goal")
    c2 = _req(c2, "extra", RequirementKind.SHOULD, "different-semantic")
    # Force same prompt digest by building prompts from identical contracts for pad,
    # but different snapshots for spe.
    p1 = build_prompt_artifact(c1)
    # Different snapshot versions / contracts
    a1 = build_spe_artifact(make_snapshot(c1, version=1), prompt_artifact=p1)
    a2 = build_spe_artifact(make_snapshot(c2, version=1), prompt_artifact=p1)
    # prompt digest from c1 may not match c2 semantics; still a1 != a2 because payload differs
    assert a1.artifact_id != a2.artifact_id


def test_parent_lineage_is_identity_bearing():
    c = _req(ProtectedIntentContract(), "goal", RequirementKind.MUST, "x")
    snap = make_snapshot(c, version=1)
    root = build_spe_artifact(snap)
    child = build_spe_artifact(snap, parent_artifact_id=root.artifact_id)
    assert child.artifact_id != root.artifact_id
    assert child.prompt_content_digest == root.prompt_content_digest  # both None
    assert child.snapshot_id == root.snapshot_id


def test_noncanonical_whitespace_normalizes_on_reserialize():
    _, snap, prompt = _simple_state()
    art = build_spe_artifact(snap, prompt_artifact=prompt)
    canonical = dumps_spe(art)
    pretty = json.dumps(json.loads(canonical), indent=2, sort_keys=False)
    parsed = loads_spe(pretty)
    assert dumps_spe(parsed) == canonical
    assert parsed.artifact_id == art.artifact_id


def test_overwrite_false_refuses(tmp_path):
    _, snap, _ = _simple_state()
    art = build_spe_artifact(snap)
    path = tmp_path / "a.spe"
    save_spe(art, path)
    with pytest.raises(SpeTypedError):
        save_spe(art, path, overwrite=False)


def test_sole_writer_module():
    assert build_spe_artifact.__module__ == "spe_runtime.storage.build"
    assert validate_spe_artifact.__module__ == "spe_runtime.storage.validate"


def test_gap_matrix_k6_movement():
    ring = json.loads((ROOT / "proofs/g1/ring0_gap_matrix.json").read_text())
    writers = json.loads((ROOT / "proofs/g1/semantic_writer_map.json").read_text())
    for name in (".spe semantic artifact", "snapshot binding"):
        row = next(r for r in ring["requirements"] if r["requirement"] == name)
        assert row["status"] == "IMPLEMENTED", name
    missing = [r["requirement"] for r in ring["requirements"] if r["status"] == "MISSING"]
    assert set(missing) == {"claim qualification", "qualification evidence"}
    unowned = writers["unowned_facts"]
    assert unowned == ["qualification_evidence"]
    art = next(f for f in writers["facts"] if f["semantic_fact"] == "spe_artifact_identity")
    assert art["writer_modules"] == ["spe_runtime/storage/build.py"]
    assert art["duplicate_writer"] is False
