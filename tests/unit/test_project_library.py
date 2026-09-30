"""G10 project library — local revisions, private by default, zero network.

Required cases: create, revision, diff, rollback, branch/version, corrupt entry,
oversize entry, unknown schema, export, import, private/noindex, zero network.
.spe export uses the existing canonical serializer only when the body is a
real spe artifact; otherwise the result is NOT_YET_BOUND.
"""

from __future__ import annotations

import json
import socket
from pathlib import Path

import jsonschema
import pytest

from spe_runtime.portability.spe_artifact import (
    build_spe_artifact,
    loads_spe_artifact,
)
from spe_runtime.storage.journal import DurableJournal
from spe_runtime.storage.project_library import LibraryError, ProjectLibrary

ROOT = Path(__file__).resolve().parents[2]
SCHEMA_PATH = ROOT / "schemas" / "project_library.schema.json"
LIBRARY_SOURCE = ROOT / "spe_runtime" / "storage" / "project_library.py"

T0 = "2026-09-30T00:00:00Z"
T1 = "2026-09-30T00:00:01Z"
T2 = "2026-09-30T00:00:02Z"
T3 = "2026-09-30T00:00:03Z"
T4 = "2026-09-30T00:00:04Z"

ARTIFACT_TYPES = (
    "prompt",
    "transcript",
    "website",
    "code",
    "research_pack",
    "template",
)


def _lib(tmp_path: Path, **kwargs) -> ProjectLibrary:
    return ProjectLibrary(tmp_path / "library.jsonl", **kwargs)


def _project(lib: ProjectLibrary, name: str = "Studio") -> dict:
    return lib.create_project(name, created_at=T0)


def _spe_body() -> dict:
    return build_spe_artifact(
        {
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
            "rendered_prompt": "Please summarize the quarterly report.",
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
        },
        created_at_utc="2026-09-30T00:00:00Z",
    )


def test_create_project_is_private_noindex_without_account(tmp_path):
    lib = _lib(tmp_path)
    project = _project(lib)
    assert project["project_id"].startswith("prj_")
    assert project["visibility"] == "private"
    assert project["noindex"] is True
    assert "email" not in project
    assert "account" not in project
    reopened = ProjectLibrary(tmp_path / "library.jsonl")
    assert reopened.get_project(project["project_id"])["name"] == "Studio"


def test_create_accepts_every_artifact_type_and_keeps_stable_ids(tmp_path):
    lib = _lib(tmp_path)
    project = _project(lib)
    ids = []
    for kind in ARTIFACT_TYPES:
        rev = lib.create_artifact(
            project["project_id"],
            artifact_type=kind,
            body={"kind": kind, "text": "seed"},
            created_at=T1,
            provider_target="local" if kind == "prompt" else None,
            provenance_refs=("prov:local",),
            quality_evidence_refs=("evidence:qr-1",),
        )
        ids.append(rev["artifact_id"])
        assert rev["revision_id"].startswith("rev_")
        assert rev["artifact_id"].startswith("art_")
        assert rev["parent_revision_id"] is None
        assert rev["artifact_type"] == kind
        assert rev["provenance_refs"] == ["prov:local"]
        assert rev["quality_evidence_refs"] == ["evidence:qr-1"]
        assert rev["created_at"] == T1
    assert len(set(ids)) == len(ARTIFACT_TYPES)


def test_unknown_artifact_type_is_refused(tmp_path):
    lib = _lib(tmp_path)
    project = _project(lib)
    with pytest.raises(LibraryError) as ei:
        lib.create_artifact(
            project["project_id"],
            artifact_type="billing",
            body={"text": "no"},
            created_at=T1,
        )
    assert ei.value.code == "UNKNOWN_ARTIFACT_TYPE"


def test_revision_keeps_artifact_id_and_parent(tmp_path):
    lib = _lib(tmp_path)
    project = _project(lib)
    first = lib.create_artifact(
        project["project_id"],
        artifact_type="code",
        body={"src": "v1"},
        created_at=T1,
        provider_target="local",
    )
    second = lib.revise(
        first["artifact_id"],
        body={"src": "v2"},
        created_at=T2,
        provider_target="local",
        provenance_refs=("prov:edit",),
        quality_evidence_refs=("evidence:qr-2",),
        version_label="v2",
    )
    assert second["artifact_id"] == first["artifact_id"]
    assert second["revision_id"] != first["revision_id"]
    assert second["parent_revision_id"] == first["revision_id"]
    assert second["version_label"] == "v2"
    assert second["branched"] is False
    assert lib.head(first["artifact_id"])["revision_id"] == second["revision_id"]
    assert lib.get_revision(first["revision_id"])["body"] == {"src": "v1"}


def test_diff_reports_replace_add_and_remove(tmp_path):
    lib = _lib(tmp_path)
    project = _project(lib)
    first = lib.create_artifact(
        project["project_id"],
        artifact_type="research_pack",
        body={"title": "A", "drop": 1, "keep": True},
        created_at=T1,
    )
    second = lib.revise(
        first["artifact_id"],
        body={"title": "B", "keep": True, "note": "added"},
        created_at=T2,
    )
    diff = lib.diff(first["revision_id"], second["revision_id"])
    ops = {change["path"]: change["op"] for change in diff["changes"]}
    assert ops["title"] == "replace"
    assert ops["drop"] == "remove"
    assert ops["note"] == "add"
    assert "keep" not in ops
    assert diff["from_revision_id"] == first["revision_id"]
    assert diff["to_revision_id"] == second["revision_id"]
    assert lib.diff(first["revision_id"], first["revision_id"])["changes"] == []


def test_rollback_restores_head_and_keeps_later_revision(tmp_path):
    lib = _lib(tmp_path)
    project = _project(lib)
    first = lib.create_artifact(
        project["project_id"],
        artifact_type="website",
        body={"html": "<p>one</p>"},
        created_at=T1,
    )
    second = lib.revise(
        first["artifact_id"],
        body={"html": "<p>two</p>"},
        created_at=T2,
    )
    moved = lib.rollback(first["artifact_id"], first["revision_id"], created_at=T3)
    assert moved["revision_id"] == first["revision_id"]
    assert lib.head(first["artifact_id"])["body"]["html"] == "<p>one</p>"
    assert lib.get_revision(second["revision_id"])["body"]["html"] == "<p>two</p>"
    again = lib.rollback(first["artifact_id"], first["revision_id"], created_at=T3)
    assert again["revision_id"] == first["revision_id"]


def test_branch_from_parent_keeps_both_versions(tmp_path):
    lib = _lib(tmp_path)
    project = _project(lib)
    first = lib.create_artifact(
        project["project_id"],
        artifact_type="template",
        body={"slot": "base"},
        created_at=T1,
        version_label="v1",
    )
    second = lib.revise(
        first["artifact_id"],
        body={"slot": "main"},
        created_at=T2,
        version_label="v2",
    )
    branch = lib.revise(
        first["artifact_id"],
        body={"slot": "side"},
        created_at=T4,
        parent_revision_id=first["revision_id"],
        version_label="v1.side",
    )
    assert branch["branched"] is True
    assert branch["parent_revision_id"] == first["revision_id"]
    assert branch["artifact_id"] == first["artifact_id"]
    versions = lib.list_versions(first["artifact_id"])
    labels = {item["version_label"]: item["revision_id"] for item in versions}
    assert labels["v1"] == first["revision_id"]
    assert labels["v2"] == second["revision_id"]
    assert labels["v1.side"] == branch["revision_id"]
    assert lib.head(first["artifact_id"])["revision_id"] == branch["revision_id"]
    assert lib.get_revision(second["revision_id"])["body"]["slot"] == "main"


def test_corrupt_complete_line_is_not_a_pass(tmp_path):
    lib = _lib(tmp_path)
    _project(lib)
    path = tmp_path / "library.jsonl"
    path.write_text(path.read_text(encoding="utf-8") + "{not-json}\n", encoding="utf-8")
    with pytest.raises(LibraryError) as ei:
        ProjectLibrary(path)
    assert ei.value.code == "CORRUPT_ENTRY"


def test_truncated_tail_does_not_drop_earlier_records(tmp_path):
    lib = _lib(tmp_path)
    project = _project(lib)
    path = tmp_path / "library.jsonl"
    path.write_text(path.read_text(encoding="utf-8") + '{"schema":', encoding="utf-8")
    reopened = ProjectLibrary(path)
    assert reopened.get_project(project["project_id"])["name"] == "Studio"


def test_oversize_entry_is_refused_and_not_stored(tmp_path):
    lib = _lib(tmp_path, max_body_bytes=32)
    project = _project(lib)
    secret = "OVERSIZE-TOKEN-" + ("x" * 80)
    with pytest.raises(LibraryError) as ei:
        lib.create_artifact(
            project["project_id"],
            artifact_type="prompt",
            body={"text": secret},
            created_at=T1,
        )
    assert ei.value.code == "OVERSIZE_ENTRY"
    assert secret not in (tmp_path / "library.jsonl").read_text(encoding="utf-8")


def test_unknown_schema_on_import_and_on_disk(tmp_path):
    lib = _lib(tmp_path)
    project = _project(lib)
    bundle = lib.export_project(project["project_id"])
    bundle["schema"] = "spe.project-library.v9"
    other = ProjectLibrary(tmp_path / "other.jsonl")
    with pytest.raises(LibraryError) as ei:
        other.import_bundle(bundle)
    assert ei.value.code == "UNKNOWN_SCHEMA"

    path = tmp_path / "library.jsonl"
    path.write_text(
        path.read_text(encoding="utf-8") + json.dumps({"schema": "nope", "kind": "NOTE"}) + "\n",
        encoding="utf-8",
    )
    with pytest.raises(LibraryError) as ei2:
        ProjectLibrary(path)
    assert ei2.value.code == "UNKNOWN_SCHEMA"


def test_export_import_round_trip_preserves_history(tmp_path):
    lib = _lib(tmp_path)
    project = _project(lib)
    first = lib.create_artifact(
        project["project_id"],
        artifact_type="transcript",
        body={"text": "hello"},
        created_at=T1,
        provenance_refs=("prov:mic",),
        quality_evidence_refs=("evidence:none",),
    )
    second = lib.revise(
        first["artifact_id"],
        body={"text": "hello there"},
        created_at=T2,
        version_label="v2",
    )
    bundle = lib.export_project(project["project_id"])
    schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    jsonschema.validate(bundle, schema)
    assert bundle["visibility"] == "private"
    assert bundle["noindex"] is True
    assert bundle["indexing"] == "noindex"
    assert bundle["spe_contract"] == "NOT_YET_BOUND"

    imported = ProjectLibrary(tmp_path / "imported.jsonl")
    imported.import_bundle(bundle)
    head = imported.head(first["artifact_id"])
    assert head["revision_id"] == second["revision_id"]
    assert head["body"] == {"text": "hello there"}
    assert imported.get_revision(first["revision_id"])["body"] == {"text": "hello"}
    assert imported.get_project(project["project_id"])["noindex"] is True


def test_spe_export_binds_only_canonical_artifacts(tmp_path):
    lib = _lib(tmp_path)
    project = _project(lib)
    spe = _spe_body()
    bound = lib.create_artifact(
        project["project_id"],
        artifact_type="prompt",
        body=spe,
        created_at=T1,
        provider_target="local",
    )
    text = lib.export_spe(bound["artifact_id"])
    loaded = loads_spe_artifact(text)
    assert loaded["user_request"] == spe["user_request"]
    assert loaded["intent"] == spe["intent"]

    plain = lib.create_artifact(
        project["project_id"],
        artifact_type="transcript",
        body={"text": "not a spe artifact"},
        created_at=T1,
    )
    with pytest.raises(LibraryError) as ei:
        lib.export_spe(plain["artifact_id"])
    assert ei.value.code == "NOT_YET_BOUND"

    tampered = json.loads(json.dumps(spe))
    tampered["user_request"] = "changed without recomputing integrity"
    bad = lib.create_artifact(
        project["project_id"],
        artifact_type="prompt",
        body=tampered,
        created_at=T2,
    )
    with pytest.raises(LibraryError) as ei2:
        lib.export_spe(bad["artifact_id"])
    assert ei2.value.code == "INTEGRITY_MISMATCH"


def test_public_or_indexed_or_account_is_refused(tmp_path):
    lib = _lib(tmp_path)
    with pytest.raises(LibraryError) as public:
        lib.create_project("Pub", created_at=T0, visibility="public")
    assert public.value.code == "NOT_PRIVATE"
    with pytest.raises(LibraryError) as indexed:
        lib.create_project("Idx", created_at=T0, noindex=False)
    assert indexed.value.code == "INDEXING_REFUSED"
    with pytest.raises(LibraryError) as account:
        lib.create_project("Acct", created_at=T0, email="person@example.com")
    assert account.value.code == "ACCOUNT_FORBIDDEN"
    assert "person@example.com" not in (tmp_path / "library.jsonl").read_text(encoding="utf-8")


def test_zero_network_and_no_telemetry_imports(tmp_path, monkeypatch):
    def _refuse(*_args, **_kwargs):
        raise AssertionError("network attempted")

    monkeypatch.setattr(socket, "socket", _refuse)
    monkeypatch.setattr(socket, "create_connection", _refuse)
    lib = _lib(tmp_path)
    project = _project(lib)
    rev = lib.create_artifact(
        project["project_id"],
        artifact_type="code",
        body={"src": "print(1)"},
        created_at=T1,
    )
    lib.revise(rev["artifact_id"], body={"src": "print(2)"}, created_at=T2)
    lib.diff(rev["revision_id"], lib.head(rev["artifact_id"])["revision_id"])
    lib.rollback(rev["artifact_id"], rev["revision_id"], created_at=T3)
    bundle = lib.export_project(project["project_id"])
    other = ProjectLibrary(tmp_path / "net.jsonl")
    other.import_bundle(bundle)
    source = LIBRARY_SOURCE.read_text(encoding="utf-8")
    for banned in ("urllib", "requests", "http.client", "socket", "telemetry", "analytics"):
        assert banned not in source


def test_erase_removes_local_body_bytes(tmp_path):
    lib = _lib(tmp_path)
    project = _project(lib)
    secret = "GDPR-LOCAL-SECRET-9f3a"
    lib.create_artifact(
        project["project_id"],
        artifact_type="prompt",
        body={"text": secret},
        created_at=T1,
    )
    lib.erase_project(project["project_id"])
    raw = (tmp_path / "library.jsonl").read_text(encoding="utf-8")
    assert secret not in raw
    with pytest.raises(LibraryError) as ei:
        lib.get_project(project["project_id"])
    assert ei.value.code == "NOT_FOUND"


def test_body_hash_mismatch_is_corrupt(tmp_path):
    lib = _lib(tmp_path)
    project = _project(lib)
    lib.create_artifact(
        project["project_id"],
        artifact_type="code",
        body={"src": "alpha"},
        created_at=T1,
    )
    path = tmp_path / "library.jsonl"
    text = path.read_text(encoding="utf-8").replace("alpha", "beta", 1)
    path.write_text(text, encoding="utf-8")
    with pytest.raises(LibraryError) as ei:
        ProjectLibrary(path)
    assert ei.value.code == "CORRUPT_ENTRY"


def test_existing_journal_ownership_still_appends(tmp_path):
    journal = DurableJournal(str(tmp_path / "journal.jsonl"))
    journal.append_event("DISPATCH", "op-1", {})
    assert journal.replay()[0]["kind"] == "DISPATCH"
