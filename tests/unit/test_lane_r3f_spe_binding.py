"""Lane R3-F — bind saved .spe to EXISTING formatTargetModelPrompt.

spe_contract is BOUND only when the end-to-end journey and fail-closed attacks
pass through spe_runtime.adapters.spe_target_compile → formatTargetModelPrompt.
"""

from __future__ import annotations

import copy
import json
from pathlib import Path

import pytest

from spe_runtime.adapters.spe_target_compile import (
    CANONICAL_COMPILER_PATH,
    CANONICAL_COMPILER_SHA,
    CANONICAL_COMPILER_SYMBOL,
    TARGET_EXPORT_MODELS,
)
from spe_runtime.portability.spe_artifact import (
    SPE_FORMAT_V1,
    SPE_FORMAT_V2,
    build_context_protocol_lineage,
    build_spe_artifact,
    dumps_spe_artifact,
    loads_spe_artifact,
)
from spe_runtime.protocols.quality_record import QualityRecord
from spe_runtime.storage.project_library import LibraryError, ProjectLibrary
from spe_runtime.storage.spe_binding import (
    LIBRARY_BUNDLE_SPE_CONTRACT,
    PATH_DECISION,
    SPE_CONTRACT,
    run_public_binding_path,
)
from spe_runtime.workflow_export import ExportIntegrityError, audit_export, export_workflow
from tools.build_manifest import ManifestError, build_manifest, verify_manifest

ROOT = Path(__file__).resolve().parents[2]
WASM_PIN = "b707f5eb480adc166f8b5b0df733e742a08a476c89c3f99b90ad63a61c11199b"

T0 = "2026-10-03T00:00:00Z"
T1 = "2026-10-03T00:00:01Z"
T2 = "2026-10-03T00:00:02Z"
T3 = "2026-10-03T00:00:03Z"


def _partial(rendered: str) -> dict:
    return {
        "user_request": "Summarize the quarterly report within the $2000 budget.",
        "category": "CAT:C02",
        "target": "local",
        "envelope": {
            "network_mode": "NONE",
            "payload": {
                "authority_state": {"grants": [], "level": 0, "status": "NONE"},
                "hard_constraints": [
                    {
                        "constraint_id": "budget-cap",
                        "statement": "Budget must remain $2000.",
                        "strength": "HARD",
                    }
                ],
                "facts": [
                    {
                        "fact_id": "f-user-request",
                        "statement": "Summarize the quarterly report within the $2000 budget.",
                        "provenance_ids": ["p-user"],
                    }
                ],
                "provenance": [{"provenance_id": "p-user", "source": "test"}],
                "uncertainties": [],
                "execution_grants": [],
            },
        },
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
                {
                    "id": "i1",
                    "label": "Goal",
                    "text": "Summarize quarterly report",
                },
                {
                    "id": "i-budget",
                    "label": "Must follow",
                    "text": "Budget must remain $2000.",
                },
            ],
            "assumed": [],
            "unknowns": [
                {
                    "id": "u-scope",
                    "label": "Questions to resolve",
                    "text": "Which quarter is in scope?",
                }
            ],
            "conflicts": [],
        },
        "lineage": {
            "engine": "spe_runtime",
            "abi": "spe.universal-abi.v1",
            "ui": "none",
            "not_a_release": True,
        },
    }


def _v1(rendered: str) -> dict:
    return build_spe_artifact(_partial(rendered), spe_format=SPE_FORMAT_V1, created_at_utc=T0)


def _v2(rendered: str) -> dict:
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
        prompt_digest="digest-r3f",
    ).to_dict()
    lineage = build_context_protocol_lineage(
        context_snapshot_ids=["snap-r3f"],
        protocol_id="research.general",
        protocol_version="1",
        depth="STANDARD",
        adapter_id="ANY_AI",
        freshness_state="FRESH",
        quality_record=quality,
        prompt_digest="digest-r3f",
    )
    return build_spe_artifact(
        _partial(rendered),
        spe_format=SPE_FORMAT_V2,
        context_protocol=lineage,
        created_at_utc=T0,
    )


def _run(tmp_path: Path, first: dict, revised: dict, name: str, target_model: str = "generic") -> dict:
    return run_public_binding_path(
        tmp_path / "library.jsonl",
        project_name=name,
        created_at=T0,
        saved_at=T1,
        revised_at=T2,
        rollback_at=T3,
        first_body=first,
        revised_body=revised,
        target_model=target_model,
    )


def test_public_path_v1_and_v2_bind_all_targets(tmp_path):
    assert SPE_CONTRACT == "BOUND"
    assert PATH_DECISION == "BOUND"
    assert LIBRARY_BUNDLE_SPE_CONTRACT == "NOT_YET_BOUND"
    for target in TARGET_EXPORT_MODELS:
        first = _run(
            tmp_path / f"v1-{target}",
            _v1("alpha payload"),
            _v1("beta payload"),
            f"R3F-v1-{target}",
            target_model=target,
        )
        second = _run(
            tmp_path / f"v2-{target}",
            _v2("alpha payload"),
            _v2("beta payload"),
            f"R3F-v2-{target}",
            target_model=target,
        )
        for report, fmt in ((first, SPE_FORMAT_V1), (second, SPE_FORMAT_V2)):
            assert report["spe_contract"] == "BOUND"
            assert report["decision"] == "BOUND"
            assert report["promoted"] is True
            assert report["refused_promotion"] == "VERIFIED"
            assert report["spe_format"] == fmt
            assert report["target_model"] == target
            assert report["library_bundle_spe_contract"] == "NOT_YET_BOUND"
            assert report["compiler"]["symbol"] == CANONICAL_COMPILER_SYMBOL
            assert report["compiler"]["path"] == CANONICAL_COMPILER_PATH
            assert report["compiler"]["defining_sha"] == CANONICAL_COMPILER_SHA
            for name, status in report["steps"].items():
                assert status == "REAL", name
            prompt = report["target_export"]["prompt"]
            assert "ProtectedIntent (Immutable)" in prompt
            assert "Budget must remain $2000." in prompt
            assert "budget-cap" in prompt
            assert "f-user-request" in prompt
            assert "Which quarter is in scope?" in prompt
            assert report["target_export"]["authority"]["status"] == "NONE"
            assert report["target_export"]["authority"]["level"] == 0
            assert len(report["semantic_hash"]) == 64
        assert first["semantic_hash"] != second["semantic_hash"]

    binding = (ROOT / "spe_runtime" / "storage" / "spe_binding.py").read_text(encoding="utf-8")
    assert "compile_execution_contract" not in binding
    assert "Date.now" not in binding
    assert "TargetCompiler2" not in binding
    assert "formatTargetModelPrompt2" not in binding
    assert not (ROOT / "apps/web/src/export/workflowExporters.ts").is_file()
    assert (ROOT / CANONICAL_COMPILER_PATH).is_file()
    wasm = json.loads((ROOT / "apps/web/public/spe_wasm.sha256.json").read_text(encoding="utf-8"))
    assert wasm["sha256"] == WASM_PIN


def test_stale_manifest_and_changed_payload(tmp_path):
    payload = tmp_path / "note.txt"
    payload.write_text("alpha", encoding="utf-8")
    manifest = build_manifest(tmp_path, ["note.txt"])
    payload.write_text("beta", encoding="utf-8")
    with pytest.raises(ManifestError) as changed:
        verify_manifest(tmp_path, manifest)
    assert changed.value.code == "HASH_MISMATCH"

    lib = ProjectLibrary(tmp_path / "library.jsonl")
    project = lib.create_project("Stale", created_at=T0)
    lib.create_artifact(
        project["project_id"],
        artifact_type="prompt",
        body=_v1("before"),
        created_at=T1,
        provenance_refs=("USER_EXPLICIT",),
        version_label="v1",
    )
    stale = lib.revision_manifest(project["project_id"])
    lib.revise(
        lib.export_project(project["project_id"])["artifacts"][0]["artifact_id"],
        body=_v1("after"),
        created_at=T2,
        provenance_refs=("USER_EXPLICIT",),
        version_label="v2",
    )
    with pytest.raises(LibraryError) as old:
        lib.accept_revision_manifest(project["project_id"], stale)
    assert old.value.code == "STALE_MANIFEST"
    fresh = lib.revision_manifest(project["project_id"])
    assert lib.accept_revision_manifest(project["project_id"], fresh)["entries"] == fresh["entries"]


def test_missing_provenance_duplicate_ids_future_version_and_tamper(tmp_path):
    lib = ProjectLibrary(tmp_path / "library.jsonl")
    project = lib.create_project("Gaps", created_at=T0)
    bare = lib.create_artifact(
        project["project_id"],
        artifact_type="code",
        body={"src": "print(1)"},
        created_at=T1,
    )
    with pytest.raises(LibraryError) as missing:
        lib.provenance_record(bare["revision_id"])
    assert missing.value.code == "MISSING_PROVENANCE"

    saved = lib.create_artifact(
        project["project_id"],
        artifact_type="prompt",
        body=_v1("once"),
        created_at=T2,
        provenance_refs=("USER_EXPLICIT",),
        version_label="once",
    )
    bundle = lib.export_project(project["project_id"])
    prompt_only = {
        **bundle,
        "artifacts": [item for item in bundle["artifacts"] if item["artifact_id"] == saved["artifact_id"]],
        "revisions": [item for item in bundle["revisions"] if item["revision_id"] == saved["revision_id"]],
        "history": [item for item in bundle["history"] if item.get("revision_id") == saved["revision_id"]],
    }
    duplicated = copy.deepcopy(prompt_only)
    duplicated["revisions"].append(copy.deepcopy(duplicated["revisions"][0]))
    duplicated["history"].append(copy.deepcopy(duplicated["history"][0]))
    collided = ProjectLibrary(tmp_path / "dup.jsonl")
    with pytest.raises(LibraryError) as duplicate:
        collided.import_bundle(duplicated)
    assert duplicate.value.code == "CORRUPT_ENTRY"

    again = ProjectLibrary(tmp_path / "again.jsonl")
    again.import_bundle(copy.deepcopy(prompt_only))
    with pytest.raises(LibraryError) as second:
        again.import_bundle(copy.deepcopy(prompt_only))
    assert second.value.code == "ID_COLLISION"

    future = copy.deepcopy(_v1("future"))
    future["spe_format"] = "spe.artifact.v9"
    created = lib.create_artifact(
        project["project_id"],
        artifact_type="prompt",
        body=future,
        created_at=T3,
        provenance_refs=("USER_EXPLICIT",),
        version_label="future",
    )
    with pytest.raises(LibraryError) as refused:
        lib.export_spe(created["artifact_id"])
    assert refused.value.code == "NOT_YET_BOUND"
    with pytest.raises(ValueError):
        loads_spe_artifact(future)

    archive = tmp_path / "library.jsonl"
    raw = archive.read_text(encoding="utf-8")
    assert "print(1)" in raw
    archive.write_text(raw.replace("print(1)", "print(2)", 1), encoding="utf-8")
    with pytest.raises(LibraryError) as tampered:
        ProjectLibrary(archive)
    assert tampered.value.code == "CORRUPT_ENTRY"
    assert lib.export_project(project["project_id"])["spe_contract"] == "NOT_YET_BOUND"


def test_rollback_after_import_and_export_mismatch(tmp_path):
    report = _run(tmp_path, _v1("alpha payload"), _v1("beta payload"), "Rollback")
    library = ProjectLibrary(tmp_path / "library.jsonl")
    bundle = library.export_project(report["project_id"])
    assert bundle["spe_contract"] == "NOT_YET_BOUND"
    assert any(item.get("kind") == "HEAD_MOVE" and item.get("reason") == "ROLLBACK" for item in bundle["history"])
    imported = ProjectLibrary(tmp_path / "rolled-import.jsonl")
    imported.import_bundle(bundle)
    assert imported.head(report["artifact_id"])["revision_id"] == report["saved_revision_id"]
    moved = imported.rollback(
        report["artifact_id"],
        report["revised_revision_id"],
        created_at="2026-10-03T00:00:04Z",
    )
    assert moved["revision_id"] == report["revised_revision_id"]
    assert moved["body"]["rendered_prompt"] == "beta payload"
    assert imported.get_revision(report["saved_revision_id"])["body"]["rendered_prompt"] == "alpha payload"

    exported = loads_spe_artifact(library.export_spe(report["artifact_id"]))
    document = export_workflow(exported, target="generic_json")
    drifted = copy.deepcopy(document)
    drifted["target_document"]["prompt_body"] = "not the artifact"
    with pytest.raises(ExportIntegrityError):
        audit_export(drifted)
    tampered = copy.deepcopy(exported)
    tampered["rendered_prompt"] = "changed without recomputing integrity"
    bad = library.create_artifact(
        report["project_id"],
        artifact_type="prompt",
        body=tampered,
        created_at="2026-10-03T00:00:05Z",
        provenance_refs=("USER_EXPLICIT",),
        version_label="tampered",
    )
    with pytest.raises(LibraryError) as mismatch:
        library.export_spe(bad["artifact_id"])
    assert mismatch.value.code == "INTEGRITY_MISMATCH"
    holds = library.spe_binding_report(report["project_id"])["holds"]
    assert "target_model_compile" not in holds
    assert library.export_project(report["project_id"])["spe_contract"] == "NOT_YET_BOUND"
    assert report["spe_contract"] == "BOUND"
