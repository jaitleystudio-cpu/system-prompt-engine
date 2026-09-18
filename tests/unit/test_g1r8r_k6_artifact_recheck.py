"""G1R-8R — independent adversarial recheck of K6 .spe artifact + lineage."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import pytest

from spe_runtime.contract import ProtectedIntentContract, propose_requirement, confirm_requirement
from spe_runtime.error_registry import ErrorCode, SpeTypedError
from spe_runtime.proof.snapshot import make_snapshot
from spe_runtime.prompt import PlanningHints, build_prompt_artifact
from spe_runtime.provenance import Provenance
from spe_runtime.requirements import RequirementKind
from spe_runtime.storage import (
    SpeArtifact,
    build_spe_artifact,
    dumps_spe,
    loads_spe,
    validate_spe_artifact,
)
from spe_runtime.storage.validate import compute_artifact_id

ROOT = Path(__file__).resolve().parents[2]


def _req(c, key, kind, value, prov=Provenance.USER_EXPLICIT):
    return propose_requirement(
        c, semantic_key=key, kind=kind, value=value, provenance=prov, source_ref="t"
    )


def _art(**kwargs):
    c = _req(ProtectedIntentContract(), "goal", RequirementKind.MUST, "hello")
    snap = make_snapshot(c, version=1)
    prompt = build_prompt_artifact(c, planning_hints=PlanningHints(complexity_class="SIMPLE"))
    return build_spe_artifact(snap, prompt_artifact=prompt, **kwargs), c, snap, prompt


# ---------------------------------------------------------------------------
# F01 — digest ↔ payload consistency
# ---------------------------------------------------------------------------


def test_rejects_digest_payload_mismatch_with_recomputed_id():
    """G1R8R-F01: lying digests must not validate even if artifact_id matches envelope."""
    art, _, _, _ = _art()
    doc = json.loads(dumps_spe(art))
    rid = next(iter(doc["protected_intent_payload"]["graph"]["nodes"]))
    node = doc["protected_intent_payload"]["graph"]["nodes"][rid]
    node["value"] = "TAMPERED_VALUE"
    for r in doc["protected_intent_payload"]["requirements"]:
        if r["requirement_id"] == node["requirement_id"]:
            r["value"] = "TAMPERED_VALUE"
    # Keep OLD digests; recompute only artifact_id so ID envelope is consistent
    preimage = {k: v for k, v in doc.items() if k != "artifact_id"}
    doc["artifact_id"] = compute_artifact_id(preimage)
    with pytest.raises(SpeTypedError) as ei:
        loads_spe(json.dumps(doc))
    assert ei.value.code is ErrorCode.K6_INVALID_ARTIFACT
    assert "protected_intent_digest" in str(ei.value) or "digest" in str(ei.value).lower()


def test_honest_payload_digest_consistency_survives_roundtrip():
    c = ProtectedIntentContract()
    c = _req(c, "z", RequirementKind.MUST, "z")
    c = _req(c, "a", RequirementKind.SHOULD, "a")
    art = build_spe_artifact(make_snapshot(c, version=2))
    assert loads_spe(dumps_spe(art)).artifact_id == art.artifact_id


# ---------------------------------------------------------------------------
# Replay capability / claim scope
# ---------------------------------------------------------------------------


def test_replay_capability_matrix_from_bytes_alone():
    art, _, snap, prompt = _art()
    raw = dumps_spe(art)
    parsed = loads_spe(raw)
    payload = dict(parsed.protected_intent_payload)

    # ProtectedIntent: EMBEDDED / reconstructable from payload
    assert "requirements" in payload and "graph" in payload
    assert payload["validity"] == parsed.contract_validity

    # RequirementGraph: EMBEDDED via payload.graph
    assert "nodes" in payload["graph"]

    # SemanticSnapshot: DIGEST_ONLY (id+version bound; full snap object absent)
    assert parsed.snapshot_id == snap.snapshot_id
    assert parsed.snapshot_version == snap.version
    assert "parent_snapshot_id" not in parsed.to_canonical_document()

    # PromptArtifact: DIGEST_ONLY
    assert parsed.prompt_content_digest == prompt.prompt_content_digest
    assert "rendered_prompt" not in parsed.to_canonical_document()

    # ProofLedger: ABSENT / optional DIGEST_ONLY
    assert parsed.proof_ledger_digest is None

    # Direct lineage: EMBEDDED field (null for root)
    assert parsed.parent_artifact_id is None


def test_portability_claim_is_binding_not_full_replay():
    """Earned scope: PORTABLE_SEMANTIC_BINDING_ARTIFACT."""
    art, _, _, _ = _art()
    doc = art.to_canonical_document()
    # Has embed for intent; digests for snap/prompt
    assert "protected_intent_payload" in doc
    assert doc["snapshot_id"].startswith("snap-")
    assert doc["prompt_content_digest"].startswith("pad-")
    # Cannot reconstruct PromptArtifact text from .spe alone
    assert "rendered_prompt" not in doc


# ---------------------------------------------------------------------------
# Identity preimage / domains
# ---------------------------------------------------------------------------


def test_full_sha256_hex_length():
    import hashlib
    from spe_runtime.portability.canonical import canonical_dumps

    art, _, _, _ = _art()
    body = hashlib.sha256(
        canonical_dumps(art.to_identity_preimage()).encode("utf-8")
    ).hexdigest()
    assert len(body) == 64
    assert art.artifact_id == "spe-" + body


def test_format_discriminator_in_preimage():
    art, _, _, _ = _art()
    pre = art.to_identity_preimage()
    assert pre["format"] == "spe"
    assert pre["format_version"] == "1"
    assert "artifact_id" not in pre


def test_same_prompt_different_snapshot_different_spe_id():
    c1 = _req(ProtectedIntentContract(), "goal", RequirementKind.MUST, "same")
    c2 = _req(ProtectedIntentContract(), "goal", RequirementKind.MUST, "same")
    c2 = _req(c2, "extra", RequirementKind.SHOULD, "diff")
    p = build_prompt_artifact(c1)
    a1 = build_spe_artifact(make_snapshot(c1, version=1), prompt_artifact=p)
    a2 = build_spe_artifact(make_snapshot(c2, version=1), prompt_artifact=p)
    assert a1.prompt_content_digest == p.prompt_content_digest
    assert a1.artifact_id != a2.artifact_id


def test_same_state_different_parent_different_spe_id():
    c = _req(ProtectedIntentContract(), "goal", RequirementKind.MUST, "x")
    snap = make_snapshot(c, version=1)
    root = build_spe_artifact(snap)
    other = build_spe_artifact(
        make_snapshot(_req(ProtectedIntentContract(), "o", RequirementKind.MUST, "o"), version=0)
    )
    a = build_spe_artifact(snap, parent_artifact_id=root.artifact_id)
    b = build_spe_artifact(snap, parent_artifact_id=other.artifact_id)
    assert a.artifact_id != b.artifact_id
    assert a.snapshot_id == b.snapshot_id


def test_self_parent_dedicated_lineage_error_on_validate():
    art, _, _, _ = _art()
    # Construct raw object with matching ID fixed-point is infeasible; use validate path
    # with parent == artifact_id after forging via model (bypass builder)
    forged = SpeArtifact(
        format=art.format,
        format_version=art.format_version,
        artifact_id=art.artifact_id,
        snapshot_id=art.snapshot_id,
        snapshot_version=art.snapshot_version,
        protected_intent_digest=art.protected_intent_digest,
        requirement_graph_digest=art.requirement_graph_digest,
        prompt_content_digest=art.prompt_content_digest,
        proof_ledger_digest=art.proof_ledger_digest,
        parent_artifact_id=art.artifact_id,  # self-parent
        contract_validity=art.contract_validity,
        protected_intent_payload=dict(art.protected_intent_payload),
    )
    with pytest.raises(SpeTypedError) as ei:
        validate_spe_artifact(forged, recompute_id=False)
    assert ei.value.code is ErrorCode.K6_INVALID_LINEAGE


def test_import_does_not_mutate_sources():
    art, c, snap, prompt = _art()
    before = (snap.snapshot_id, prompt.prompt_content_digest, set(c.graph.nodes.keys()))
    _ = loads_spe(dumps_spe(art))
    assert (snap.snapshot_id, prompt.prompt_content_digest, set(c.graph.nodes.keys())) == before


def test_import_inert_no_authority_proof_qualification_fields():
    art, _, _, _ = _art()
    doc = json.loads(dumps_spe(art))
    blob = json.dumps(doc)
    for banned in ("AuthorityGrant", "proof_valid", "qualified", "world_number_one", "production_ready"):
        assert banned not in blob
    with pytest.raises(SpeTypedError):
        doc2 = dict(doc)
        doc2["is_qualified"] = True
        loads_spe(json.dumps(doc2))


def test_embedded_intent_is_plaintext_not_confidential():
    """CONFIDENTIALITY = NO — hashing does not encrypt embedded intent."""
    art, _, _, _ = _art()
    raw = dumps_spe(art)
    assert b"hello" in raw or b"goal" in raw
    assert b"MUST" in raw


def test_parent_reference_only_not_existence():
    c = _req(ProtectedIntentContract(), "goal", RequirementKind.MUST, "x")
    fake_parent = "spe-" + ("ab" * 32)
    art = build_spe_artifact(make_snapshot(c, version=1), parent_artifact_id=fake_parent)
    # Accepts syntactically valid spe- parent without proving existence
    assert art.parent_artifact_id == fake_parent


def test_snapshot_mismatch_on_build():
    c = _req(ProtectedIntentContract(), "goal", RequirementKind.MUST, "x")
    snap = make_snapshot(c, version=1)
    # Corrupt digest field via object replace — frozen, so build another snap and swap ids conceptually
    # Direct: pass prompt only; mismatch tested by constructing SpeArtifact with wrong version in load
    art = build_spe_artifact(snap)
    doc = json.loads(dumps_spe(art))
    doc["snapshot_version"] = snap.version + 7
    with pytest.raises(SpeTypedError) as ei:
        loads_spe(json.dumps(doc))
    assert ei.value.code is ErrorCode.K6_ARTIFACT_ID_MISMATCH


def test_raw_dataclass_not_canonical_without_validate():
    art, _, _, _ = _art()
    raw = SpeArtifact(
        format=art.format,
        format_version=art.format_version,
        artifact_id="spe-" + ("00" * 32),
        snapshot_id=art.snapshot_id,
        snapshot_version=art.snapshot_version,
        protected_intent_digest=art.protected_intent_digest,
        requirement_graph_digest=art.requirement_graph_digest,
        prompt_content_digest=art.prompt_content_digest,
        proof_ledger_digest=None,
        parent_artifact_id=None,
        contract_validity=art.contract_validity,
        protected_intent_payload=dict(art.protected_intent_payload),
    )
    with pytest.raises(SpeTypedError) as ei:
        validate_spe_artifact(raw)
    assert ei.value.code is ErrorCode.K6_ARTIFACT_ID_MISMATCH


def test_cross_process_determinism():
    code = r"""
from spe_runtime.contract import ProtectedIntentContract, propose_requirement
from spe_runtime.provenance import Provenance
from spe_runtime.requirements import RequirementKind
from spe_runtime.proof.snapshot import make_snapshot
from spe_runtime.prompt import PlanningHints, build_prompt_artifact
from spe_runtime.storage import build_spe_artifact, dumps_spe
c = propose_requirement(ProtectedIntentContract(), semantic_key='goal', kind=RequirementKind.MUST, value='hello', provenance=Provenance.USER_EXPLICIT)
art = build_spe_artifact(make_snapshot(c, version=1), prompt_artifact=build_prompt_artifact(c))
print(art.artifact_id)
print(dumps_spe(art).hex())
"""
    a = subprocess.check_output([sys.executable, "-c", code], cwd=str(ROOT), text=True)
    b = subprocess.check_output([sys.executable, "-c", code], cwd=str(ROOT), text=True)
    assert a == b


def test_claim_scope_and_gap_state():
    ring = json.loads((ROOT / "proofs/g1/ring0_gap_matrix.json").read_text())
    writers = json.loads((ROOT / "proofs/g1/semantic_writer_map.json").read_text())
    # Post-G1R-9: K7 gaps closed; no required Ring-0 fact remains unowned/missing.
    missing = [r["requirement"] for r in ring["requirements"] if r["status"] == "MISSING"]
    assert missing == []
    assert writers["unowned_facts"] == []
    art = next(f for f in writers["facts"] if f["semantic_fact"] == "spe_artifact_identity")
    assert art["writer_modules"] == ["spe_runtime/storage/build.py"]
    qe = next(f for f in writers["facts"] if f["semantic_fact"] == "qualification_evidence")
    assert qe["writer_modules"] == ["spe_runtime/qualification/evidence.py"]
