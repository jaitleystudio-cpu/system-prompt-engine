"""Lane G6 — .spe binding proof against the existing project-library owner.

The bundle contract stays NOT_YET_BOUND. Artifact integrity may be VERIFIED
only when spe_runtime.portability.spe_artifact.verify_integrity says so.
That state must not be copied onto spe_contract.

provenance_record and capability_manifest are real in this ancestry.
workflow export is the frozen G11 package spe_runtime.workflow_export, not workflowExporters.ts.
"""

from __future__ import annotations

import copy
import json
import socket
from pathlib import Path

import jsonschema
import pytest

from spe_runtime.portability.spe_artifact import (
    SPE_FORMAT_V1,
    SPE_FORMAT_V2,
    build_context_protocol_lineage,
    build_spe_artifact,
    loads_spe_artifact,
    verify_integrity,
)
from spe_runtime.protocols.quality_record import QualityRecord
from spe_runtime.storage.project_library import LibraryError, ProjectLibrary

ROOT = Path(__file__).resolve().parents[2]
SCHEMA_PATH = ROOT / "schemas" / "project_library.schema.json"
LIBRARY_SOURCE = ROOT / "spe_runtime" / "storage" / "project_library.py"

T0 = "2026-10-03T00:00:00Z"
T1 = "2026-10-03T00:00:01Z"
T2 = "2026-10-03T00:00:02Z"
T3 = "2026-10-03T00:00:03Z"
T4 = "2026-10-03T00:00:04Z"


def _partial(rendered: str) -> dict:
    return {
        "user_request": "Summarize the quarterly report.",
        "category": "CAT:C02",
        "target": "local",
        "envelope": {},
        "wasm": {
            "status": None,
            "disposition": None,
            "reason_code": None,
            "sha256": None,
            "imports": None,
            "network_mode": "NONE",
            "used_ts_fallback": False,
        },
        "rendered_prompt": rendered,
        "intent": {
            "confirmed": [
                {"id": "i1", "label": "Goal", "text": "Summarize quarterly report"}
            ],
            "assumed": [],
            "unknowns": [],
            "conflicts": [],
        },
        "lineage": {
            "engine": "spe_runtime",
            "abi": "spe.universal-abi.v1",
            "ui": "none",
            "not_a_release": True,
        },
    }


def _v1(rendered: str = "Please summarize the quarterly report.") -> dict:
    return build_spe_artifact(
        _partial(rendered),
        spe_format=SPE_FORMAT_V1,
        created_at_utc=T0,
    )


def _v2() -> dict:
    quality = QualityRecord(
        protocol_id="research.general",
        protocol_version="1",
        depth="STANDARD",
        required_nodes=("MISSION",),
        completed_nodes=("MISSION",),
        skipped_nodes=(),
        failed_nodes=(),
        unknown_nodes=(),
        context_capsule_ids=("cap-1",),
        evaluator_results=(),
        unverified_claims=(),
        known_limitations=("offline",),
        freshness_state="FRESH",
        adapter_id="ANY_AI",
        prompt_digest="digest-g6",
    ).to_dict()
    lineage = build_context_protocol_lineage(
        context_snapshot_ids=["snap-g6"],
        protocol_id="research.general",
        protocol_version="1",
        depth="STANDARD",
        adapter_id="ANY_AI",
        freshness_state="FRESH",
        quality_record=quality,
        prompt_digest="digest-g6",
    )
    return build_spe_artifact(
        _partial("v2 summary"),
        spe_format=SPE_FORMAT_V2,
        context_protocol=lineage,
        created_at_utc=T0,
    )


def test_canonical_workflow_does_not_promote_spe_contract(tmp_path, monkeypatch):
    def _refuse(*_args, **_kwargs):
        raise AssertionError("network attempted")

    monkeypatch.setattr(socket, "socket", _refuse)
    monkeypatch.setattr(socket, "create_connection", _refuse)

    lib = ProjectLibrary(tmp_path / "library.jsonl")
    project = lib.create_project("G6", created_at=T0)
    assert project["visibility"] == "private"
    assert project["noindex"] is True
    assert "email" not in project

    first = lib.create_artifact(
        project["project_id"],
        artifact_type="prompt",
        body=_v1("alpha"),
        created_at=T1,
        provenance_refs=("prov:local",),
        quality_evidence_refs=("evidence:none",),
        provider_target="local",
        version_label="v1",
    )
    second = lib.revise(
        first["artifact_id"],
        body=_v1("beta"),
        created_at=T2,
        provenance_refs=("prov:edit",),
        version_label="v2",
    )
    diff = lib.diff(first["revision_id"], second["revision_id"])
    assert diff["schema"] == "spe.project-library.diff.v1"
    assert any(change["op"] == "replace" for change in diff["changes"])

    rolled = lib.rollback(first["artifact_id"], first["revision_id"], created_at=T3)
    assert rolled["revision_id"] == first["revision_id"]
    assert rolled["body"]["rendered_prompt"] == "alpha"
    assert lib.get_revision(second["revision_id"])["body"]["rendered_prompt"] == "beta"

    text = lib.export_spe(first["artifact_id"])
    loaded = loads_spe_artifact(text)
    checked = verify_integrity(loaded)
    assert checked["integrity"]["state"] == "VERIFIED"
    assert checked["spe_format"] == SPE_FORMAT_V1
    assert "context_protocol" not in loaded
    assert loaded["intent"] == first["body"]["intent"]

    bundle = lib.export_project(project["project_id"])
    schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    jsonschema.validate(bundle, schema)
    assert bundle["spe_contract"] == "NOT_YET_BOUND"
    assert bundle["spe_contract"] != "VERIFIED"
    assert bundle["visibility"] == "private"
    assert bundle["noindex"] is True
    assert bundle["indexing"] == "noindex"

    imported = ProjectLibrary(tmp_path / "imported.jsonl")
    imported.import_bundle(bundle)
    assert imported.head(first["artifact_id"])["revision_id"] == first["revision_id"]
    assert imported.get_revision(second["revision_id"])["provenance_refs"] == ["prov:edit"]
    assert imported.export_project(project["project_id"])["spe_contract"] == "NOT_YET_BOUND"

    report = lib.spe_binding_report(project["project_id"])
    assert report["spe_contract"] == "NOT_YET_BOUND"
    assert report["promoted"] is False
    assert report["refused_promotion"] == "VERIFIED"
    assert "provenance_record" not in report["holds"]
    assert "manifest_hashes" not in report["holds"]
    assert "workflow_export" not in report["holds"]
    assert not (ROOT / "apps/web/src/export/workflowExporters.ts").is_file()
    assert report["promoted"] is False
    assert report["spe_contract"] == "NOT_YET_BOUND"
    assert report["rollback_recorded"] is True
    assert report["provenance_refs_present"] is True
    assert report["revision_count"] == 2
    head = report["heads"][0]
    assert head["export"] == "CANONICAL"
    assert head["integrity_state"] == "VERIFIED"
    assert head["content_sha256"] == checked["integrity"]["content_sha256"]
    assert head["body_sha256"] == rolled["body_sha256"]
    assert report["spe_contract"] != head["integrity_state"]

    source = LIBRARY_SOURCE.read_text(encoding="utf-8")
    for banned in ("urllib", "requests", "http.client", "socket", "telemetry", "analytics"):
        assert banned not in source


def test_v2_generation_still_leaves_bundle_unbound(tmp_path):
    lib = ProjectLibrary(tmp_path / "library.jsonl")
    project = lib.create_project("G6v2", created_at=T0)
    created = lib.create_artifact(
        project["project_id"],
        artifact_type="prompt",
        body=_v2(),
        created_at=T1,
        provenance_refs=("prov:v2",),
    )
    text = lib.export_spe(created["artifact_id"])
    loaded = loads_spe_artifact(text)
    assert loaded["spe_format"] == SPE_FORMAT_V2
    assert verify_integrity(loaded)["integrity"]["state"] == "VERIFIED"
    assert lib.export_project(project["project_id"])["spe_contract"] == "NOT_YET_BOUND"
    report = lib.spe_binding_report(project["project_id"])
    assert report["spe_contract"] == "NOT_YET_BOUND"
    assert report["heads"][0]["spe_format"] == SPE_FORMAT_V2


def test_plain_and_tampered_and_corrupt_stay_unbound(tmp_path):
    lib = ProjectLibrary(tmp_path / "library.jsonl")
    project = lib.create_project("Plain", created_at=T0)
    plain = lib.create_artifact(
        project["project_id"],
        artifact_type="transcript",
        body={"text": "not a spe artifact"},
        created_at=T1,
    )
    with pytest.raises(LibraryError) as missing:
        lib.export_spe(plain["artifact_id"])
    assert missing.value.code == "NOT_YET_BOUND"
    assert lib.export_project(project["project_id"])["spe_contract"] == "NOT_YET_BOUND"
    report = lib.spe_binding_report(project["project_id"])
    assert report["spe_contract"] == "NOT_YET_BOUND"
    assert report["heads"][0]["export"] == "NOT_YET_BOUND"
    assert report["heads"][0]["integrity_state"] is None

    tampered = _v1("gamma")
    tampered["rendered_prompt"] = "changed without recomputing integrity"
    bad = lib.create_artifact(
        project["project_id"],
        artifact_type="prompt",
        body=tampered,
        created_at=T2,
    )
    with pytest.raises(LibraryError) as mismatch:
        lib.export_spe(bad["artifact_id"])
    assert mismatch.value.code == "INTEGRITY_MISMATCH"
    bad_head = next(
        item for item in lib.spe_binding_report(project["project_id"])["heads"]
        if item["artifact_id"] == bad["artifact_id"]
    )
    assert bad_head["export"] == "INTEGRITY_MISMATCH"

    bundle = lib.export_project(project["project_id"])
    bundle["spe_contract"] = "VERIFIED"
    other = ProjectLibrary(tmp_path / "refused.jsonl")
    with pytest.raises(LibraryError) as promoted:
        other.import_bundle(bundle)
    assert promoted.value.code == "UNKNOWN_SCHEMA"

    path = tmp_path / "library.jsonl"
    raw = path.read_text(encoding="utf-8")
    path.write_text(raw.replace("not a spe artifact", "tampered body", 1), encoding="utf-8")
    with pytest.raises(LibraryError) as corrupt:
        ProjectLibrary(path)
    assert corrupt.value.code == "CORRUPT_ENTRY"


def test_legacy_not_yet_bound_bundle_still_imports(tmp_path):
    lib = ProjectLibrary(tmp_path / "library.jsonl")
    project = lib.create_project("Legacy", created_at=T0)
    lib.create_artifact(
        project["project_id"],
        artifact_type="code",
        body={"src": "print(1)"},
        created_at=T1,
        provenance_refs=("prov:legacy",),
    )
    bundle = lib.export_project(project["project_id"])
    assert bundle["spe_contract"] == "NOT_YET_BOUND"
    assert bundle["schema"] == "spe.project-library.v1"
    imported = ProjectLibrary(tmp_path / "legacy.jsonl")
    imported.import_bundle(json.loads(json.dumps(bundle)))
    assert imported.export_project(project["project_id"])["spe_contract"] == "NOT_YET_BOUND"


def test_provenance_record_binds_hash_and_rejects_gaps(tmp_path):
    import jsonschema

    from tools.build_manifest import ManifestError

    lib = ProjectLibrary(tmp_path / "library.jsonl")
    project = lib.create_project("Prov", created_at=T0)
    revision = lib.create_artifact(
        project["project_id"],
        artifact_type="prompt",
        body=_v1("prov"),
        created_at=T1,
        provenance_refs=("USER_EXPLICIT",),
    )
    record = lib.provenance_record(revision["revision_id"])
    schema = json.loads((ROOT / "schemas" / "provenance_record.schema.json").read_text())
    assert "STUB" not in schema.get("description", "")
    assert schema.get("additionalProperties") is False
    jsonschema.validate(record, schema)
    assert record["artifact_sha256"] == revision["body_sha256"]
    assert record["content_sha256"]
    assert record["source"] == "USER_EXPLICIT"
    checked = lib.accept_provenance_record(record)
    assert checked["artifact_sha256"] == revision["body_sha256"]

    bare = lib.create_artifact(
        project["project_id"],
        artifact_type="code",
        body={"src": "print(1)"},
        created_at=T2,
    )
    with pytest.raises(LibraryError) as missing:
        lib.provenance_record(bare["revision_id"])
    assert missing.value.code == "MISSING_PROVENANCE"

    mismatched = dict(record)
    mismatched["artifact_sha256"] = "0" * 64
    with pytest.raises(LibraryError) as bad_hash:
        lib.accept_provenance_record(mismatched)
    assert bad_hash.value.code == "PROVENANCE_MISMATCH"

    dropped = dict(record)
    del dropped["source"]
    with pytest.raises(LibraryError) as dropped_source:
        lib.accept_provenance_record(dropped)
    assert dropped_source.value.code == "MISSING_PROVENANCE"

    wrong_content = dict(record)
    wrong_content["content_sha256"] = "a" * 64
    with pytest.raises(LibraryError) as bad_content:
        lib.accept_provenance_record(wrong_content)
    assert bad_content.value.code == "PROVENANCE_MISMATCH"

    bundle = lib.export_project(project["project_id"])
    assert bundle["spe_contract"] == "NOT_YET_BOUND"
    report = lib.spe_binding_report(project["project_id"])
    assert report["promoted"] is False
    assert report["spe_contract"] != "VERIFIED"
    assert isinstance(ManifestError, type)


def test_manifest_recomputes_hashes_and_rejects_corruption(tmp_path):
    import jsonschema

    from tools.build_manifest import (
        ManifestError,
        build_manifest,
        main,
        verify_manifest,
    )

    schema = json.loads((ROOT / "schemas" / "capability_manifest.schema.json").read_text())
    assert "STUB" not in schema.get("description", "")
    assert schema["properties"]["entries"]["minItems"] >= 1

    payload = tmp_path / "note.txt"
    payload.write_text("alpha", encoding="utf-8")
    manifest = build_manifest(tmp_path, ["note.txt"])
    jsonschema.validate(manifest, schema)
    assert verify_manifest(tmp_path, manifest)["entries"][0]["sha256"] == manifest["entries"][0]["sha256"]

    corrupted = json.loads(json.dumps(manifest))
    corrupted["entries"][0]["sha256"] = "b" * 64
    with pytest.raises(ManifestError) as mismatch:
        verify_manifest(tmp_path, corrupted)
    assert mismatch.value.code == "HASH_MISMATCH"

    payload.write_text("beta", encoding="utf-8")
    with pytest.raises(ManifestError) as drifted:
        verify_manifest(tmp_path, manifest)
    assert drifted.value.code == "HASH_MISMATCH"

    code = main(["check", "--root", str(tmp_path), "--manifest", str(tmp_path / "missing.json")])
    assert code != 0

    lib = ProjectLibrary(tmp_path / "library.jsonl")
    project = lib.create_project("Man", created_at=T0)
    revision = lib.create_artifact(
        project["project_id"],
        artifact_type="template",
        body={"text": "manifest me"},
        created_at=T1,
        provenance_refs=("SYSTEM_REQUIRED",),
    )
    built = lib.revision_manifest(project["project_id"])
    jsonschema.validate(built, schema)
    assert built["entries"][0]["sha256"] == revision["body_sha256"]
    assert lib.accept_revision_manifest(project["project_id"], built)["entries"][0]["sha256"] == revision["body_sha256"]
    tampered = json.loads(json.dumps(built))
    tampered["entries"][0]["sha256"] = "c" * 64
    with pytest.raises(LibraryError) as refused:
        lib.accept_revision_manifest(project["project_id"], tampered)
    assert refused.value.code == "HASH_MISMATCH"
    assert lib.export_project(project["project_id"])["spe_contract"] == "NOT_YET_BOUND"
    assert lib.spe_binding_report(project["project_id"])["promoted"] is False


def test_frozen_g11_export_is_offline_deterministic_and_unverified(tmp_path, monkeypatch):
    """Frozen owner is spe_runtime.workflow_export from 4c916d77, not workflowExporters.ts."""
    def _refuse(*_args, **_kwargs):
        raise AssertionError("network attempted")

    monkeypatch.setattr(socket, "socket", _refuse)
    monkeypatch.setattr(socket, "create_connection", _refuse)

    from spe_runtime.workflow_export import ExportIntegrityError, audit_export, export_workflow

    source = {
        "contract_version": "spe.prompt-contract.v1",
        "prompt_body": "Summarize the quarterly report for {{audience}}.",
        "variables": {"audience": "operators", "tone": "formal"},
        "required_inputs": ["audience"],
        "expected_outputs": ["summary"],
        "constraints": ["no network", "do not call webhooks"],
        "provider_target": "local-prompt",
    }
    first = export_workflow(copy.deepcopy(source), target="generic_json")
    second = export_workflow(copy.deepcopy(source), target="generic_json")
    assert first == second
    assert "spe_contract" not in first
    assert first.get("spe_contract") != "VERIFIED"
    artifact = tmp_path / "workflow-export.json"
    artifact.write_text(json.dumps(first, sort_keys=True), encoding="utf-8")
    assert json.loads(artifact.read_text(encoding="utf-8")) == first

    corrupted = copy.deepcopy(first)
    corrupted["fidelity"] = [item for item in corrupted["fidelity"] if item["facet"] != "constraints"]
    with pytest.raises(ExportIntegrityError):
        audit_export(corrupted)

    lib = ProjectLibrary(tmp_path / "library.jsonl")
    project = lib.create_project("Export", created_at=T0)
    lib.create_artifact(
        project["project_id"],
        artifact_type="prompt",
        body={"text": "not a bundle contract"},
        created_at=T1,
    )
    assert lib.export_project(project["project_id"])["spe_contract"] == "NOT_YET_BOUND"
    report = lib.spe_binding_report(project["project_id"])
    assert report["promoted"] is False
    assert report["spe_contract"] == "NOT_YET_BOUND"
    assert "workflow_export" not in report["holds"]
