"""Local private project library (spe.project-library.v1).

Persists inside spe_runtime.storage as append-only JSONL with fsync, the same
local file ownership as the durable journal. This is a schema over that file
discipline, not a new database.

No account is required. Records stay private and noindex. Revision bytes stay
in the library file. Canonical .spe text is emitted only when a revision body
already satisfies spe_runtime.portability.spe_artifact; otherwise export_spe
raises NOT_YET_BOUND. A library bundle is not a .spe document. spe_binding_report is read-only
and never promotes spe_contract to VERIFIED.
"""

from __future__ import annotations

import copy
import hashlib
import json
import os
import re
import uuid
from pathlib import Path
from typing import Any, Mapping

import jsonschema

from spe_runtime.portability.spe_artifact import (
    dumps_spe_artifact,
    loads_spe_artifact,
    verify_integrity,
)
from spe_runtime.provenance.models import Provenance
from tools.build_manifest import (
    ManifestError,
    build_manifest_from_blobs,
    verify_manifest_blobs,
)

LIBRARY_SCHEMA = "spe.project-library.v1"
RECORD_SCHEMA = "spe.project-library.record.v1"
DIFF_SCHEMA = "spe.project-library.diff.v1"
KNOWN_SCHEMAS = frozenset({LIBRARY_SCHEMA, RECORD_SCHEMA})

ARTIFACT_TYPES = frozenset(
    {"prompt", "transcript", "website", "code", "research_pack", "template"}
)

_TIMESTAMP = re.compile(
    r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$"
)
_ID = {
    "prj": re.compile(r"^prj_[0-9a-f]{32}$"),
    "art": re.compile(r"^art_[0-9a-f]{32}$"),
    "rev": re.compile(r"^rev_[0-9a-f]{32}$"),
}
_REF = re.compile(r"^[A-Za-z0-9:._/-]+$")
_LABEL = re.compile(r"^[A-Za-z0-9._-]{1,64}$")
_TARGET = re.compile(r"^[A-Za-z0-9._:-]{1,64}$")
_IDENTITY_KEYS = frozenset(
    {"email", "account", "account_id", "user_email", "user_id", "e_mail"}
)
_MISSING = object()
_DEFAULT_MAX_BODY_BYTES = 1_048_576
_REVISION_KEYS = frozenset(
    {
        "kind",
        "revision_id",
        "artifact_id",
        "project_id",
        "parent_revision_id",
        "created_at",
        "artifact_type",
        "provider_target",
        "provenance_refs",
        "quality_evidence_refs",
        "body",
        "body_sha256",
        "version_label",
        "branched",
    }
)
_HEAD_MOVE_KEYS = frozenset(
    {"kind", "project_id", "artifact_id", "revision_id", "created_at", "reason"}
)


def _binding_holds() -> dict[str, str]:
    """HOLD where this owner has no implementation to call.

    Provenance records, capability manifests, and the frozen G11 workflow
    export are real when their files are present. Target-model compile is real
    when spe_runtime/adapters/spe_target_compile.py owns the saved-.spe path
    into formatTargetModelPrompt.
    """
    root = Path(__file__).resolve().parents[2]
    holds: dict[str, str] = {}
    provenance = _optional_text(root / "schemas" / "provenance_record.schema.json")
    if "STUB" in provenance or "not yet implemented" in provenance or not provenance:
        holds["provenance_record"] = "HOLD"
    manifest_schema = _optional_text(root / "schemas" / "capability_manifest.schema.json")
    manifest_tool = _optional_text(root / "tools" / "build_manifest.py")
    if (
        "STUB" in manifest_schema
        or "not yet implemented" in manifest_schema
        or "stub:" in manifest_tool
        or not manifest_schema
    ):
        holds["manifest_hashes"] = "HOLD"
    exporter = root / "spe_runtime" / "workflow_export" / "export.py"
    if not exporter.is_file():
        holds["workflow_export"] = (
            "HOLD: missing owner spe_runtime/workflow_export/export.py"
            " (frozen G11). apps/web/src/export/workflowExporters.ts is not the owner"
        )
    adapter = root / "spe_runtime" / "adapters" / "spe_target_compile.py"
    bridge = root / "spe_runtime" / "adapters" / "invoke_format_target_model_prompt.mjs"
    ts_compiler = (
        root / "apps" / "web" / "src" / "engine" / "continuation" / "continuationCompiler.ts"
    )
    guards = root / "apps" / "web" / "src" / "engine" / "continuation" / "oracleGuards.ts"
    if not adapter.is_file() or not bridge.is_file() or not ts_compiler.is_file() or not guards.is_file():
        holds["target_model_compile"] = (
            "HOLD: no owner compiles a saved .spe artifact for a named target model"
        )
    return holds


def _optional_text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except OSError:
        return ""



PROVENANCE_RECORD_SCHEMA = "spe.provenance-record.v1"
_PROVENANCE_SOURCES = frozenset(item.value for item in Provenance)
_PROVENANCE_SCHEMA_PATH = Path(__file__).resolve().parents[2] / "schemas" / "provenance_record.schema.json"


def _provenance_sources(refs: list[str]) -> list[str]:
    return [ref for ref in refs if ref in _PROVENANCE_SOURCES]


def _provenance_id(revision_id: str, artifact_sha256: str) -> str:
    digest = hashlib.sha256(f"{revision_id}:{artifact_sha256}".encode("utf-8")).hexdigest()
    return "prv_" + digest[:32]


def _content_digest(body: Any) -> str | None:
    try:
        loaded = loads_spe_artifact(body)
        checked = verify_integrity(loaded)
    except (TypeError, ValueError, KeyError, json.JSONDecodeError):
        return None
    integrity = checked.get("integrity")
    if not isinstance(integrity, Mapping) or integrity.get("state") != "VERIFIED":
        return None
    digest = integrity.get("content_sha256")
    if not isinstance(digest, str):
        return None
    return digest


def _require_provenance_shape(record: Mapping[str, Any]) -> None:
    schema = json.loads(_PROVENANCE_SCHEMA_PATH.read_text(encoding="utf-8"))
    try:
        jsonschema.validate(record, schema)
    except jsonschema.ValidationError as exc:
        raise LibraryError("CORRUPT_ENTRY", "provenance record does not match its schema") from exc


class LibraryError(Exception):
    """Library refusal. ``code`` is stable; ``reason`` never carries a body."""

    def __init__(self, code: str, reason: str) -> None:
        super().__init__(code + ": " + reason)
        self.code = code
        self.reason = reason


def _dump_body(body: Any) -> str:
    return json.dumps(body, sort_keys=True, ensure_ascii=False, separators=(",", ":"))


def _hash_body(body: Any) -> str:
    return hashlib.sha256(_dump_body(body).encode("utf-8")).hexdigest()


def _line(record: Mapping[str, Any]) -> str:
    return json.dumps(record, sort_keys=True, ensure_ascii=False, separators=(",", ":"))


def _write_all(fd: int, payload: bytes) -> None:
    view = payload
    while view:
        written = os.write(fd, view)
        if written <= 0:
            raise OSError("short write")
        view = view[written:]


def _close_quietly(fd: int) -> None:
    try:
        os.close(fd)
    except OSError:
        return


def _require_timestamp(value: str) -> str:
    if not isinstance(value, str) or not _TIMESTAMP.fullmatch(value):
        raise LibraryError("CORRUPT_ENTRY", "timestamp is not ISO-8601")
    return value


def _require_id(value: object, kind: str) -> str:
    if not isinstance(value, str) or not _ID[kind].fullmatch(value):
        raise LibraryError("CORRUPT_ENTRY", "identifier is not a library id")
    return value


def _normalize_body(body: Any) -> Any:
    if body is None:
        raise LibraryError("CORRUPT_ENTRY", "body is missing")
    try:
        encoded = _dump_body(body)
        parsed = json.loads(encoded)
    except (TypeError, ValueError):
        raise LibraryError("CORRUPT_ENTRY", "body is not JSON") from None
    if isinstance(parsed, (dict, list, str, int, float, bool)):
        return parsed
    raise LibraryError("CORRUPT_ENTRY", "body is not JSON")


def _normalize_refs(values: Any) -> list[str]:
    if values is None:
        return []
    if isinstance(values, (str, bytes)) or not isinstance(values, (list, tuple)):
        raise LibraryError("TYPE_REFUSED", "refs must be a list of reference strings")
    if len(values) > 32:
        raise LibraryError("OVERSIZE_ENTRY", "too many refs")
    out: list[str] = []
    for item in values:
        if not isinstance(item, str) or not _REF.fullmatch(item) or len(item) > 128:
            raise LibraryError("TYPE_REFUSED", "ref must be a short reference token")
        out.append(item)
    return out


def _normalize_target(value: Any) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str) or not _TARGET.fullmatch(value):
        raise LibraryError("TYPE_REFUSED", "provider target is not a token")
    return value


def _normalize_label(value: Any) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str) or not _LABEL.fullmatch(value):
        raise LibraryError("TYPE_REFUSED", "version label is not a token")
    return value


def _diff_values(before: Any, after: Any, path: str) -> list[dict[str, Any]]:
    if before == after:
        return []
    if isinstance(before, dict) and isinstance(after, dict):
        changes: list[dict[str, Any]] = []
        for key in sorted(set(before) | set(after), key=str):
            child = f"{path}.{key}" if path else str(key)
            if key not in before:
                changes.append({"op": "add", "path": child, "before": None, "after": after[key]})
            elif key not in after:
                changes.append({"op": "remove", "path": child, "before": before[key], "after": None})
            else:
                changes.extend(_diff_values(before[key], after[key], child))
        return changes
    if isinstance(before, list) and isinstance(after, list):
        changes = []
        width = max(len(before), len(after))
        for index in range(width):
            child = f"{path}[{index}]"
            if index >= len(before):
                changes.append({"op": "add", "path": child, "before": None, "after": after[index]})
            elif index >= len(after):
                changes.append(
                    {"op": "remove", "path": child, "before": before[index], "after": None}
                )
            else:
                changes.extend(_diff_values(before[index], after[index], child))
        return changes
    return [{"op": "replace", "path": path or "$", "before": before, "after": after}]


def _public_revision(record: Mapping[str, Any]) -> dict[str, Any]:
    return {
        "revision_id": record["revision_id"],
        "artifact_id": record["artifact_id"],
        "project_id": record["project_id"],
        "parent_revision_id": record["parent_revision_id"],
        "created_at": record["created_at"],
        "artifact_type": record["artifact_type"],
        "provider_target": record["provider_target"],
        "provenance_refs": list(record["provenance_refs"]),
        "quality_evidence_refs": list(record["quality_evidence_refs"]),
        "body": copy.deepcopy(record["body"]),
        "body_sha256": record["body_sha256"],
        "version_label": record["version_label"],
        "branched": record["branched"],
    }


class ProjectLibrary:
    """Private local projects and immutable artifact revisions."""

    def __init__(self, path: str | os.PathLike[str], *, max_body_bytes: int | None = None) -> None:
        if max_body_bytes is not None and (
            not isinstance(max_body_bytes, int) or isinstance(max_body_bytes, bool) or max_body_bytes < 1
        ):
            raise LibraryError("OVERSIZE_ENTRY", "body limit must be a positive integer")
        self._path = os.fspath(path)
        self._caller_cap = max_body_bytes
        self._max_body_bytes = max_body_bytes if max_body_bytes is not None else _DEFAULT_MAX_BODY_BYTES
        self._reset()
        if not os.path.exists(self._path) or os.path.getsize(self._path) == 0:
            parent = os.path.dirname(self._path)
            if parent:
                os.makedirs(parent, exist_ok=True)
            self._append(self._header_record())
            return
        self._load()
        if self._caller_cap is not None and self._caller_cap != self._max_body_bytes:
            raise LibraryError("OVERSIZE_ENTRY", "body limit does not match the library")

    def create_project(
        self,
        name: str,
        *,
        created_at: str,
        visibility: str = "private",
        noindex: bool = True,
        **extra: object,
    ) -> dict[str, Any]:
        self._refuse_identity(extra)
        if visibility != "private":
            raise LibraryError("NOT_PRIVATE", "projects are private")
        if noindex is not True:
            raise LibraryError("INDEXING_REFUSED", "projects are noindex")
        if not isinstance(name, str) or not name.strip() or len(name) > 200 or "\n" in name:
            raise LibraryError("TYPE_REFUSED", "project name is empty or too long")
        stamp = _require_timestamp(created_at)
        record = {
            "schema": RECORD_SCHEMA,
            "kind": "PROJECT",
            "project_id": self._new_id("prj"),
            "name": name,
            "created_at": stamp,
            "visibility": "private",
            "noindex": True,
        }
        self._append(record)
        return self.get_project(record["project_id"])

    def create_artifact(
        self,
        project_id: str,
        *,
        artifact_type: str,
        body: Any,
        created_at: str,
        provider_target: str | None = None,
        provenance_refs: Any = (),
        quality_evidence_refs: Any = (),
        version_label: str | None = None,
    ) -> dict[str, Any]:
        self._require_project(project_id)
        if artifact_type not in ARTIFACT_TYPES:
            raise LibraryError("UNKNOWN_ARTIFACT_TYPE", "artifact type is not in the library vocabulary")
        return self._write_revision(
            project_id=project_id,
            artifact_id=self._new_id("art"),
            artifact_type=artifact_type,
            parent_revision_id=None,
            body=body,
            created_at=created_at,
            provider_target=provider_target,
            provenance_refs=provenance_refs,
            quality_evidence_refs=quality_evidence_refs,
            version_label=version_label,
        )

    def revise(
        self,
        artifact_id: str,
        *,
        body: Any,
        created_at: str,
        parent_revision_id: str | None = None,
        provider_target: Any = _MISSING,
        provenance_refs: Any = (),
        quality_evidence_refs: Any = (),
        version_label: str | None = None,
    ) -> dict[str, Any]:
        artifact = self._require_artifact(artifact_id)
        parent_id = parent_revision_id if parent_revision_id is not None else artifact["head_revision_id"]
        parent = self._require_revision(parent_id)
        if parent["artifact_id"] != artifact_id:
            raise LibraryError("NOT_FOUND", "parent revision is not on this artifact")
        target = parent["provider_target"] if provider_target is _MISSING else provider_target
        return self._write_revision(
            project_id=artifact["project_id"],
            artifact_id=artifact_id,
            artifact_type=artifact["artifact_type"],
            parent_revision_id=parent_id,
            body=body,
            created_at=created_at,
            provider_target=target,
            provenance_refs=provenance_refs,
            quality_evidence_refs=quality_evidence_refs,
            version_label=version_label,
        )

    def diff(self, from_revision_id: str, to_revision_id: str) -> dict[str, Any]:
        before = self._require_revision(from_revision_id)
        after = self._require_revision(to_revision_id)
        if before["artifact_id"] != after["artifact_id"]:
            raise LibraryError("NOT_FOUND", "revisions are not on the same artifact")
        return {
            "schema": DIFF_SCHEMA,
            "from_revision_id": from_revision_id,
            "to_revision_id": to_revision_id,
            "changes": _diff_values(before["body"], after["body"], ""),
        }

    def rollback(self, artifact_id: str, revision_id: str, *, created_at: str) -> dict[str, Any]:
        artifact = self._require_artifact(artifact_id)
        revision = self._require_revision(revision_id)
        if revision["artifact_id"] != artifact_id:
            raise LibraryError("NOT_FOUND", "revision is not on this artifact")
        stamp = _require_timestamp(created_at)
        if artifact["head_revision_id"] != revision_id:
            self._append(
                {
                    "schema": RECORD_SCHEMA,
                    "kind": "HEAD_MOVE",
                    "project_id": artifact["project_id"],
                    "artifact_id": artifact_id,
                    "revision_id": revision_id,
                    "created_at": stamp,
                    "reason": "ROLLBACK",
                }
            )
        return self.head(artifact_id)

    def head(self, artifact_id: str) -> dict[str, Any]:
        artifact = self._require_artifact(artifact_id)
        return self.get_revision(artifact["head_revision_id"])

    def get_project(self, project_id: str) -> dict[str, Any]:
        project = self._projects.get(project_id)
        if project is None:
            raise LibraryError("NOT_FOUND", "project not found")
        return {
            "project_id": project["project_id"],
            "name": project["name"],
            "created_at": project["created_at"],
            "visibility": "private",
            "noindex": True,
        }

    def get_revision(self, revision_id: str) -> dict[str, Any]:
        return _public_revision(self._require_revision(revision_id))

    def list_versions(self, artifact_id: str) -> list[dict[str, Any]]:
        self._require_artifact(artifact_id)
        versions = []
        for revision_id in self._rev_ids_by_artifact.get(artifact_id, []):
            revision = self._revisions[revision_id]
            versions.append(
                {
                    "revision_id": revision["revision_id"],
                    "version_label": revision["version_label"],
                    "parent_revision_id": revision["parent_revision_id"],
                    "branched": revision["branched"],
                    "created_at": revision["created_at"],
                }
            )
        return versions

    def export_project(self, project_id: str) -> dict[str, Any]:
        project = self.get_project(project_id)
        artifacts = []
        for artifact_id in self._artifact_ids:
            artifact = self._artifacts[artifact_id]
            if artifact["project_id"] != project_id:
                continue
            artifacts.append(
                {
                    "artifact_id": artifact["artifact_id"],
                    "project_id": artifact["project_id"],
                    "artifact_type": artifact["artifact_type"],
                    "head_revision_id": artifact["head_revision_id"],
                }
            )
        revisions = []
        history = []
        for record in self._records:
            if record.get("project_id") != project_id:
                continue
            kind = record.get("kind")
            if kind == "REVISION":
                public = _public_revision(record)
                revisions.append(public)
                history.append({"kind": "REVISION", **public})
            elif kind == "HEAD_MOVE":
                history.append(
                    {
                        "kind": "HEAD_MOVE",
                        "project_id": record["project_id"],
                        "artifact_id": record["artifact_id"],
                        "revision_id": record["revision_id"],
                        "created_at": record["created_at"],
                        "reason": "ROLLBACK",
                    }
                )
        return {
            "schema": LIBRARY_SCHEMA,
            "visibility": "private",
            "noindex": True,
            "indexing": "noindex",
            "spe_contract": "NOT_YET_BOUND",
            "project": project,
            "artifacts": artifacts,
            "revisions": revisions,
            "history": history,
        }

    def import_bundle(self, bundle: Mapping[str, Any]) -> dict[str, Any]:
        if not isinstance(bundle, Mapping):
            raise LibraryError("CORRUPT_ENTRY", "bundle is not an object")
        if bundle.get("schema") != LIBRARY_SCHEMA:
            raise LibraryError("UNKNOWN_SCHEMA", "bundle schema is not recognized")
        if bundle.get("visibility") != "private":
            raise LibraryError("NOT_PRIVATE", "bundle is not private")
        if bundle.get("noindex") is not True or bundle.get("indexing") != "noindex":
            raise LibraryError("INDEXING_REFUSED", "bundle is not noindex")
        if bundle.get("spe_contract") != "NOT_YET_BOUND":
            raise LibraryError("UNKNOWN_SCHEMA", "bundle spe contract is not recognized")
        project = bundle.get("project")
        artifacts = bundle.get("artifacts")
        revisions = bundle.get("revisions")
        if not isinstance(project, Mapping) or not isinstance(artifacts, list) or not isinstance(revisions, list):
            raise LibraryError("CORRUPT_ENTRY", "bundle is missing project history")
        self._refuse_identity(project)
        project_id = _require_id(project.get("project_id"), "prj")
        if project_id in self._projects:
            raise LibraryError("ID_COLLISION", "project already exists")
        if project.get("visibility") != "private" or project.get("noindex") is not True:
            raise LibraryError("NOT_PRIVATE", "project is not private")
        name = project.get("name")
        if not isinstance(name, str) or not name.strip() or len(name) > 200 or "\n" in name:
            raise LibraryError("CORRUPT_ENTRY", "project name is missing")
        planned = self._plan_import(project_id, name, project, artifacts, revisions, bundle.get("history"))
        self._rewrite([*self._records, *planned])
        return self.get_project(project_id)

    def export_spe(self, artifact_id: str) -> str:
        body = self.head(artifact_id)["body"]
        try:
            loaded = loads_spe_artifact(body)
        except (TypeError, ValueError, KeyError, json.JSONDecodeError):
            raise LibraryError("NOT_YET_BOUND", "revision body is not a canonical spe artifact") from None
        try:
            checked = verify_integrity(loaded)
        except (TypeError, ValueError):
            raise LibraryError("INTEGRITY_MISMATCH", "spe integrity digest does not match") from None
        integrity = checked.get("integrity")
        state = integrity.get("state") if isinstance(integrity, Mapping) else None
        if state != "VERIFIED":
            raise LibraryError("INTEGRITY_MISMATCH", "spe integrity digest does not match")
        return dumps_spe_artifact(loaded)

    def provenance_record(self, revision_id: str) -> dict[str, Any]:
        """Derived provenance record. Not a second journal."""
        revision = self.get_revision(revision_id)
        sources = _provenance_sources(revision["provenance_refs"])
        if len(sources) != 1:
            raise LibraryError("MISSING_PROVENANCE", "revision provenance source is missing")
        digest = _hash_body(revision["body"])
        if digest != revision["body_sha256"]:
            raise LibraryError("PROVENANCE_MISMATCH", "artifact digest does not match")
        record: dict[str, Any] = {
            "schema": PROVENANCE_RECORD_SCHEMA,
            "provenance_id": _provenance_id(revision_id, digest),
            "artifact_id": revision["artifact_id"],
            "revision_id": revision_id,
            "source": sources[0],
            "artifact_sha256": digest,
        }
        content = _content_digest(revision["body"])
        if content is not None:
            record["content_sha256"] = content
        _require_provenance_shape(record)
        return record

    def accept_provenance_record(self, record: Mapping[str, Any]) -> dict[str, Any]:
        """Recompute the revision digest and reject a missing or mismatched record."""
        if not isinstance(record, Mapping):
            raise LibraryError("MISSING_PROVENANCE", "provenance record is missing")
        required = (
            "schema",
            "provenance_id",
            "artifact_id",
            "revision_id",
            "source",
            "artifact_sha256",
        )
        if any(key not in record or record.get(key) in (None, "") for key in required):
            raise LibraryError("MISSING_PROVENANCE", "provenance field is missing")
        _require_provenance_shape(record)
        revision = self.get_revision(str(record["revision_id"]))
        if revision["artifact_id"] != record["artifact_id"]:
            raise LibraryError("PROVENANCE_MISMATCH", "provenance artifact does not match")
        digest = _hash_body(revision["body"])
        if record["artifact_sha256"] != digest or digest != revision["body_sha256"]:
            raise LibraryError("PROVENANCE_MISMATCH", "artifact digest does not match")
        if record["provenance_id"] != _provenance_id(revision["revision_id"], digest):
            raise LibraryError("PROVENANCE_MISMATCH", "provenance id does not match the digest")
        sources = _provenance_sources(revision["provenance_refs"])
        if len(sources) != 1:
            raise LibraryError("MISSING_PROVENANCE", "revision provenance source is missing")
        if record["source"] != sources[0]:
            raise LibraryError("PROVENANCE_MISMATCH", "provenance source does not match")
        content = _content_digest(revision["body"])
        if content is None:
            if "content_sha256" in record:
                raise LibraryError("PROVENANCE_MISMATCH", "content digest is not bound")
        elif "content_sha256" not in record:
            raise LibraryError("MISSING_PROVENANCE", "content digest is missing")
        elif record["content_sha256"] != content:
            raise LibraryError("PROVENANCE_MISMATCH", "content digest does not match")
        return dict(record)

    def revision_manifest(self, project_id: str) -> dict[str, Any]:
        """Hash each revision body again. Does not write the library journal."""
        return build_manifest_from_blobs(self._revision_blobs(project_id))

    def accept_revision_manifest(self, project_id: str, manifest: Mapping[str, Any]) -> dict[str, Any]:
        """Recompute revision hashes and reject a corrupt or stale manifest.

        A manifest that still matches old payloads but does not list every
        current revision is stale. Hash mismatches stay HASH_MISMATCH.
        """
        blobs = self._revision_blobs(project_id)
        try:
            verified = verify_manifest_blobs(blobs, manifest)
        except ManifestError as exc:
            raise LibraryError(exc.code, exc.reason) from None
        if not isinstance(manifest, Mapping):
            raise LibraryError("CORRUPT_ENTRY", "manifest is not an object")
        entries = manifest.get("entries")
        if not isinstance(entries, list):
            raise LibraryError("CORRUPT_ENTRY", "manifest entries are missing")
        claimed = {entry.get("path") for entry in entries if isinstance(entry, Mapping)}
        if claimed != set(blobs):
            raise LibraryError(
                "STALE_MANIFEST",
                "manifest does not list the current revision payloads",
            )
        return verified

    def _revision_blobs(self, project_id: str) -> dict[str, bytes]:
        bundle = self.export_project(project_id)
        blobs: dict[str, bytes] = {}
        for revision in bundle["revisions"]:
            digest = _hash_body(revision["body"])
            if digest != revision["body_sha256"]:
                raise LibraryError("PROVENANCE_MISMATCH", "artifact digest does not match")
            rel = f"{revision['artifact_id']}/{revision['revision_id']}.body.json"
            blobs[rel] = _dump_body(revision["body"]).encode("utf-8")
        if not blobs:
            raise LibraryError("CORRUPT_ENTRY", "manifest has no revisions")
        return blobs

    def spe_binding_report(self, project_id: str) -> dict[str, Any]:
        """Read-only census for one project.

        Writes nothing. ``spe_contract`` stays ``NOT_YET_BOUND``. An artifact
        integrity state of VERIFIED is reported on that head only and is never
        copied onto the bundle contract. Missing owners stay HOLD.
        """
        bundle = self.export_project(project_id)
        if bundle.get("spe_contract") != "NOT_YET_BOUND":
            raise LibraryError("UNKNOWN_SCHEMA", "bundle spe contract is not recognized")
        heads: list[dict[str, Any]] = []
        for artifact in bundle["artifacts"]:
            artifact_id = artifact["artifact_id"]
            entry: dict[str, Any] = {
                "artifact_id": artifact_id,
                "head_revision_id": artifact["head_revision_id"],
                "export": None,
                "integrity_state": None,
                "content_sha256": None,
                "body_sha256": None,
                "spe_format": None,
            }
            try:
                text_spe = self.export_spe(artifact_id)
            except LibraryError as exc:
                entry["export"] = exc.code
            else:
                loaded = loads_spe_artifact(text_spe)
                checked = verify_integrity(loaded)
                integrity = checked.get("integrity")
                state = integrity.get("state") if isinstance(integrity, Mapping) else None
                digest = integrity.get("content_sha256") if isinstance(integrity, Mapping) else None
                if state != "VERIFIED":
                    entry["export"] = "INTEGRITY_MISMATCH"
                else:
                    entry["export"] = "CANONICAL"
                    entry["integrity_state"] = state
                    entry["content_sha256"] = digest
                    entry["body_sha256"] = self.head(artifact_id)["body_sha256"]
                    entry["spe_format"] = loaded.get("spe_format")
            heads.append(entry)
        return {
            "project_id": project_id,
            "spe_contract": "NOT_YET_BOUND",
            "promoted": False,
            "refused_promotion": "VERIFIED",
            "holds": _binding_holds(),
            "rollback_recorded": any(
                item.get("kind") == "HEAD_MOVE" and item.get("reason") == "ROLLBACK"
                for item in bundle["history"]
            ),
            "provenance_refs_present": any(
                bool(revision.get("provenance_refs")) for revision in bundle["revisions"]
            ),
            "revision_count": len(bundle["revisions"]),
            "heads": heads,
        }

    def erase_project(self, project_id: str) -> None:
        self._require_project(project_id)
        kept = []
        for record in self._records:
            kind = record.get("kind")
            if kind == "LIBRARY":
                kept.append(record)
                continue
            if record.get("project_id") == project_id:
                continue
            kept.append(record)
        self._rewrite(kept)

    def _plan_import(
        self,
        project_id: str,
        name: str,
        project: Mapping[str, Any],
        artifacts: list[Any],
        revisions: list[Any],
        history: Any,
    ) -> list[dict[str, Any]]:
        if not isinstance(history, list):
            raise LibraryError("CORRUPT_ENTRY", "bundle is missing project history")
        heads: dict[str, str] = {}
        types: dict[str, str] = {}
        for artifact in artifacts:
            if not isinstance(artifact, Mapping) or artifact.get("project_id") != project_id:
                raise LibraryError("CORRUPT_ENTRY", "artifact is not in this project")
            artifact_id = _require_id(artifact.get("artifact_id"), "art")
            if artifact_id in heads:
                raise LibraryError("CORRUPT_ENTRY", "artifact id repeated")
            if artifact_id in self._artifacts:
                raise LibraryError("ID_COLLISION", "artifact already exists")
            artifact_type = artifact.get("artifact_type")
            if artifact_type not in ARTIFACT_TYPES:
                raise LibraryError("UNKNOWN_ARTIFACT_TYPE", "artifact type is not in the library vocabulary")
            heads[artifact_id] = _require_id(artifact.get("head_revision_id"), "rev")
            types[artifact_id] = str(artifact_type)
        events: list[dict[str, Any]] = []
        public_from_history: list[dict[str, Any]] = []
        for raw in history:
            if not isinstance(raw, Mapping):
                raise LibraryError("CORRUPT_ENTRY", "history entry is not an object")
            self._refuse_identity(raw)
            kind = raw.get("kind")
            if kind == "REVISION":
                if set(raw) - _REVISION_KEYS:
                    raise LibraryError("CORRUPT_ENTRY", "revision has an unknown field")
                revision = self._checked_revision(project_id, raw, types)
                if revision["artifact_id"] not in heads:
                    raise LibraryError("CORRUPT_ENTRY", "revision has no artifact")
                if revision["revision_id"] in self._revisions:
                    raise LibraryError("ID_COLLISION", "revision already exists")
                public_from_history.append(_public_revision(revision))
                events.append({"schema": RECORD_SCHEMA, "kind": "REVISION", **revision})
            elif kind == "HEAD_MOVE":
                if set(raw) - _HEAD_MOVE_KEYS:
                    raise LibraryError("CORRUPT_ENTRY", "head move has an unknown field")
                if raw.get("project_id") != project_id:
                    raise LibraryError("CORRUPT_ENTRY", "head move is not in this project")
                if raw.get("reason") != "ROLLBACK":
                    raise LibraryError("CORRUPT_ENTRY", "head move reason is not recognized")
                artifact_id = _require_id(raw.get("artifact_id"), "art")
                if artifact_id not in heads:
                    raise LibraryError("CORRUPT_ENTRY", "head move has no artifact")
                events.append(
                    {
                        "schema": RECORD_SCHEMA,
                        "kind": "HEAD_MOVE",
                        "project_id": project_id,
                        "artifact_id": artifact_id,
                        "revision_id": _require_id(raw.get("revision_id"), "rev"),
                        "created_at": _require_timestamp(str(raw.get("created_at"))),
                        "reason": "ROLLBACK",
                    }
                )
            else:
                raise LibraryError("CORRUPT_ENTRY", "history kind is not recognized")
        public_from_revisions: list[dict[str, Any]] = []
        for raw in revisions:
            if not isinstance(raw, Mapping):
                raise LibraryError("CORRUPT_ENTRY", "revision is not an object")
            self._refuse_identity(raw)
            if set(raw) - (_REVISION_KEYS - {"kind"}):
                raise LibraryError("CORRUPT_ENTRY", "revision has an unknown field")
            public_from_revisions.append(_public_revision(self._checked_revision(project_id, raw, types)))
        if public_from_revisions != public_from_history:
            raise LibraryError("CORRUPT_ENTRY", "history does not match revisions")
        records = [
            {
                "schema": RECORD_SCHEMA,
                "kind": "PROJECT",
                "project_id": project_id,
                "name": name,
                "created_at": _require_timestamp(str(project.get("created_at"))),
                "visibility": "private",
                "noindex": True,
            },
            *events,
        ]
        snap = self._capture()
        try:
            for record in records:
                self._apply(dict(record))
            for artifact_id, head_id in heads.items():
                current = self._artifacts.get(artifact_id)
                if current is None or current["head_revision_id"] != head_id:
                    raise LibraryError("CORRUPT_ENTRY", "head revision does not match history")
                if current["artifact_type"] != types[artifact_id]:
                    raise LibraryError("CORRUPT_ENTRY", "artifact type does not match")
        except Exception:
            self._restore(snap)
            raise
        self._restore(snap)
        return records

    def _checked_revision(
        self,
        project_id: str,
        raw: Mapping[str, Any],
        types: Mapping[str, str],
    ) -> dict[str, Any]:
        artifact_id = _require_id(raw.get("artifact_id"), "art")
        if raw.get("project_id") != project_id:
            raise LibraryError("CORRUPT_ENTRY", "revision is not in this project")
        artifact_type = raw.get("artifact_type")
        if artifact_type != types.get(artifact_id):
            raise LibraryError("CORRUPT_ENTRY", "artifact type does not match")
        parent = raw.get("parent_revision_id")
        parent_id = None if parent is None else _require_id(parent, "rev")
        body = _normalize_body(raw.get("body"))
        self._require_body_size(body)
        digest = raw.get("body_sha256")
        if digest != _hash_body(body):
            raise LibraryError("CORRUPT_ENTRY", "body digest does not match")
        label = _normalize_label(raw.get("version_label"))
        if raw.get("branched") not in (True, False):
            raise LibraryError("CORRUPT_ENTRY", "branch flag is missing")
        return {
            "revision_id": _require_id(raw.get("revision_id"), "rev"),
            "artifact_id": artifact_id,
            "project_id": project_id,
            "parent_revision_id": parent_id,
            "created_at": _require_timestamp(str(raw.get("created_at"))),
            "artifact_type": artifact_type,
            "provider_target": _normalize_target(raw.get("provider_target")),
            "provenance_refs": _normalize_refs(raw.get("provenance_refs")),
            "quality_evidence_refs": _normalize_refs(raw.get("quality_evidence_refs")),
            "body": body,
            "body_sha256": digest,
            "version_label": label,
            "branched": raw.get("branched"),
        }

    def _write_revision(
        self,
        *,
        project_id: str,
        artifact_id: str,
        artifact_type: str,
        parent_revision_id: str | None,
        body: Any,
        created_at: str,
        provider_target: Any,
        provenance_refs: Any,
        quality_evidence_refs: Any,
        version_label: Any,
    ) -> dict[str, Any]:
        parsed = _normalize_body(body)
        self._require_body_size(parsed)
        label = _normalize_label(version_label)
        self._refuse_duplicate_label(artifact_id, label)
        stamp = _require_timestamp(created_at)
        branched = self._branched(artifact_id, parent_revision_id)
        record = {
            "schema": RECORD_SCHEMA,
            "kind": "REVISION",
            "revision_id": self._new_id("rev"),
            "artifact_id": artifact_id,
            "project_id": project_id,
            "parent_revision_id": parent_revision_id,
            "created_at": stamp,
            "artifact_type": artifact_type,
            "provider_target": _normalize_target(provider_target),
            "provenance_refs": _normalize_refs(provenance_refs),
            "quality_evidence_refs": _normalize_refs(quality_evidence_refs),
            "body": parsed,
            "body_sha256": _hash_body(parsed),
            "version_label": label,
            "branched": branched,
        }
        self._append(record)
        return self.get_revision(record["revision_id"])

    def _branched(self, artifact_id: str, parent_revision_id: str | None) -> bool:
        if parent_revision_id is None:
            return False
        artifact = self._artifacts.get(artifact_id)
        head_id = None if artifact is None else artifact.get("head_revision_id")
        children = 0
        for revision_id in self._rev_ids_by_artifact.get(artifact_id, []):
            if self._revisions[revision_id]["parent_revision_id"] == parent_revision_id:
                children += 1
        return parent_revision_id != head_id or children > 0

    def _refuse_duplicate_label(self, artifact_id: str, label: str | None) -> None:
        if label is None:
            return
        for revision_id in self._rev_ids_by_artifact.get(artifact_id, []):
            if self._revisions[revision_id]["version_label"] == label:
                raise LibraryError("DUPLICATE_VERSION", "version label already exists")

    def _require_body_size(self, body: Any) -> None:
        size = len(_dump_body(body).encode("utf-8"))
        if size > self._max_body_bytes:
            raise LibraryError("OVERSIZE_ENTRY", "body exceeds the local byte limit")

    def _refuse_identity(self, mapping: Mapping[str, Any]) -> None:
        for key in mapping:
            if str(key).lower() in _IDENTITY_KEYS:
                raise LibraryError("ACCOUNT_FORBIDDEN", "identity fields are not accepted")

    def _require_project(self, project_id: str) -> dict[str, Any]:
        project = self._projects.get(project_id)
        if project is None:
            raise LibraryError("NOT_FOUND", "project not found")
        return project

    def _require_artifact(self, artifact_id: str) -> dict[str, Any]:
        artifact = self._artifacts.get(artifact_id)
        if artifact is None:
            raise LibraryError("NOT_FOUND", "artifact not found")
        return artifact

    def _require_revision(self, revision_id: str) -> dict[str, Any]:
        revision = self._revisions.get(revision_id)
        if revision is None:
            raise LibraryError("NOT_FOUND", "revision not found")
        return revision

    def _header_record(self) -> dict[str, Any]:
        return {
            "schema": LIBRARY_SCHEMA,
            "kind": "LIBRARY",
            "visibility": "private",
            "noindex": True,
            "indexing": "noindex",
            "max_body_bytes": self._max_body_bytes,
        }

    def _new_id(self, prefix: str) -> str:
        return prefix + "_" + uuid.uuid4().hex

    def _reset(self) -> None:
        self._records: list[dict[str, Any]] = []
        self._projects: dict[str, dict[str, Any]] = {}
        self._revisions: dict[str, dict[str, Any]] = {}
        self._artifacts: dict[str, dict[str, Any]] = {}
        self._artifact_ids: list[str] = []
        self._rev_ids_by_artifact: dict[str, list[str]] = {}

    def _append(self, record: Mapping[str, Any]) -> None:
        stored = dict(record)
        snap = self._capture()
        try:
            self._apply(stored)
        except Exception:
            self._restore(snap)
            raise
        try:
            self._write_record(stored)
        except OSError:
            self._restore(snap)
            raise
        self._records.append(stored)

    def _write_record(self, record: Mapping[str, Any]) -> None:
        payload = (_line(record) + "\n").encode("utf-8")
        flags = os.O_APPEND | os.O_CREAT | os.O_WRONLY
        fd = os.open(self._path, flags, 0o600)
        try:
            before = os.lseek(fd, 0, os.SEEK_END)
            try:
                _write_all(fd, payload)
                os.fsync(fd)
                os.fchmod(fd, 0o600)
            except OSError:
                try:
                    os.ftruncate(fd, before)
                    os.fsync(fd)
                except OSError:
                    pass
                raise
        finally:
            _close_quietly(fd)
        try:
            self._fsync_parent()
        except OSError:
            return

    def _fsync_parent(self) -> None:
        directory = os.path.dirname(self._path) or "."
        try:
            fd = os.open(directory, os.O_RDONLY)
        except OSError:
            return
        try:
            os.fsync(fd)
        except OSError:
            return
        finally:
            _close_quietly(fd)

    def _rewrite(self, records: list[Mapping[str, Any]]) -> None:
        temporary = self._path + ".tmp"
        if os.path.lexists(temporary):
            if os.path.islink(temporary):
                raise LibraryError("CORRUPT_ENTRY", "library temp path is a symlink")
            os.unlink(temporary)
        flags = os.O_CREAT | os.O_EXCL | os.O_WRONLY
        if hasattr(os, "O_NOFOLLOW"):
            flags |= os.O_NOFOLLOW
        fd = os.open(temporary, flags, 0o600)
        try:
            os.fchmod(fd, 0o600)
            for record in records:
                _write_all(fd, (_line(dict(record)) + "\n").encode("utf-8"))
            os.fsync(fd)
        except Exception:
            _close_quietly(fd)
            if os.path.lexists(temporary) and not os.path.islink(temporary):
                os.unlink(temporary)
            raise
        _close_quietly(fd)
        os.replace(temporary, self._path)
        self._fsync_parent()
        self._reset()
        self._load()

    def _capture(self) -> dict[str, Any]:
        return {
            "records": list(self._records),
            "projects": copy.deepcopy(self._projects),
            "revisions": copy.deepcopy(self._revisions),
            "artifacts": copy.deepcopy(self._artifacts),
            "artifact_ids": list(self._artifact_ids),
            "rev_ids_by_artifact": copy.deepcopy(self._rev_ids_by_artifact),
            "max_body_bytes": self._max_body_bytes,
        }

    def _restore(self, snap: Mapping[str, Any]) -> None:
        self._records = list(snap["records"])
        self._projects = snap["projects"]
        self._revisions = snap["revisions"]
        self._artifacts = snap["artifacts"]
        self._artifact_ids = list(snap["artifact_ids"])
        self._rev_ids_by_artifact = snap["rev_ids_by_artifact"]
        self._max_body_bytes = snap["max_body_bytes"]

    def _load(self) -> None:
        try:
            with open(self._path, "r", encoding="utf-8") as handle:
                text = handle.read()
        except UnicodeDecodeError:
            raise LibraryError("CORRUPT_ENTRY", "library file is not valid text") from None
        if text == "":
            raise LibraryError("CORRUPT_ENTRY", "library file is empty")
        parts = text.split("\n")
        if text.endswith("\n"):
            parts = parts[:-1]
        elif parts:
            tail = parts[-1]
            parts = parts[:-1]
            if tail.strip():
                try:
                    json.loads(tail)
                except json.JSONDecodeError:
                    tail = ""
                if tail:
                    parts.append(tail)
        if not parts:
            raise LibraryError("CORRUPT_ENTRY", "library file has no records")
        for line in parts:
            if not line.strip():
                continue
            try:
                obj = json.loads(line)
            except json.JSONDecodeError:
                raise LibraryError("CORRUPT_ENTRY", "record is not valid JSON") from None
            if not isinstance(obj, dict):
                raise LibraryError("CORRUPT_ENTRY", "record is not an object")
            if obj.get("schema") not in KNOWN_SCHEMAS:
                raise LibraryError("UNKNOWN_SCHEMA", "record schema is not recognized")
            self._apply(obj)
            self._records.append(self._durable_record(obj))
        if not self._records or self._records[0].get("kind") != "LIBRARY":
            raise LibraryError("CORRUPT_ENTRY", "library header is missing")

    def _apply(self, record: Mapping[str, Any]) -> None:
        kind = record.get("kind")
        if kind == "LIBRARY":
            if self._records:
                raise LibraryError("CORRUPT_ENTRY", "library header is not first")
            if record.get("visibility") != "private" or record.get("noindex") is not True:
                raise LibraryError("CORRUPT_ENTRY", "library header is not private")
            if record.get("indexing") != "noindex":
                raise LibraryError("CORRUPT_ENTRY", "library header is not noindex")
            cap = record.get("max_body_bytes")
            if not isinstance(cap, int) or isinstance(cap, bool) or cap < 1:
                raise LibraryError("CORRUPT_ENTRY", "library body limit is missing")
            self._max_body_bytes = cap
            return
        if kind == "PROJECT":
            self._apply_project(record)
            return
        if kind == "REVISION":
            self._apply_revision(record)
            return
        if kind == "HEAD_MOVE":
            self._apply_head_move(record)
            return
        raise LibraryError("CORRUPT_ENTRY", "record kind is not recognized")

    def _apply_project(self, record: Mapping[str, Any]) -> None:
        if record.get("schema") != RECORD_SCHEMA:
            raise LibraryError("UNKNOWN_SCHEMA", "project schema is not recognized")
        if record.get("visibility") != "private" or record.get("noindex") is not True:
            raise LibraryError("NOT_PRIVATE", "stored project is not private")
        project_id = _require_id(record.get("project_id"), "prj")
        if project_id in self._projects:
            raise LibraryError("CORRUPT_ENTRY", "project id repeated")
        name = record.get("name")
        if not isinstance(name, str) or not name.strip() or len(name) > 200 or "\n" in name:
            raise LibraryError("CORRUPT_ENTRY", "project name is missing")
        self._projects[project_id] = {
            "project_id": project_id,
            "name": name,
            "created_at": _require_timestamp(str(record.get("created_at"))),
            "visibility": "private",
            "noindex": True,
        }

    def _apply_revision(self, record: Mapping[str, Any]) -> None:
        if record.get("schema") != RECORD_SCHEMA:
            raise LibraryError("UNKNOWN_SCHEMA", "revision schema is not recognized")
        project_id = _require_id(record.get("project_id"), "prj")
        if project_id not in self._projects:
            raise LibraryError("CORRUPT_ENTRY", "revision project is missing")
        artifact_id = _require_id(record.get("artifact_id"), "art")
        revision_id = _require_id(record.get("revision_id"), "rev")
        if revision_id in self._revisions:
            raise LibraryError("CORRUPT_ENTRY", "revision id repeated")
        artifact_type = record.get("artifact_type")
        if artifact_type not in ARTIFACT_TYPES:
            raise LibraryError("UNKNOWN_ARTIFACT_TYPE", "artifact type is not in the library vocabulary")
        parent = record.get("parent_revision_id")
        parent_id = None if parent is None else _require_id(parent, "rev")
        if parent_id is not None and parent_id not in self._revisions:
            raise LibraryError("CORRUPT_ENTRY", "parent revision is missing")
        try:
            body = _normalize_body(record.get("body"))
        except LibraryError:
            raise LibraryError("CORRUPT_ENTRY", "body is not JSON") from None
        digest = record.get("body_sha256")
        if not isinstance(digest, str) or digest != _hash_body(body):
            raise LibraryError("CORRUPT_ENTRY", "body digest does not match")
        if artifact_id not in self._artifacts:
            if parent_id is not None:
                raise LibraryError("CORRUPT_ENTRY", "first revision has a parent")
        else:
            if parent_id is None:
                raise LibraryError("CORRUPT_ENTRY", "artifact has two roots")
            if self._revisions[parent_id]["artifact_id"] != artifact_id:
                raise LibraryError("CORRUPT_ENTRY", "parent revision is not on this artifact")
        if record.get("branched") is not self._branched(artifact_id, parent_id):
            raise LibraryError("CORRUPT_ENTRY", "branch flag does not match history")
        try:
            provider_target = _normalize_target(record.get("provider_target"))
            provenance_refs = _normalize_refs(record.get("provenance_refs"))
            quality_refs = _normalize_refs(record.get("quality_evidence_refs"))
            version_label = _normalize_label(record.get("version_label"))
        except LibraryError:
            raise LibraryError("CORRUPT_ENTRY", "revision metadata is not a token") from None
        if version_label is not None:
            for existing_id in self._rev_ids_by_artifact.get(artifact_id, []):
                if self._revisions[existing_id]["version_label"] == version_label:
                    raise LibraryError("CORRUPT_ENTRY", "version label repeated")
        size = len(_dump_body(body).encode("utf-8"))
        if size > self._max_body_bytes:
            raise LibraryError("OVERSIZE_ENTRY", "stored body exceeds the local byte limit")
        if artifact_id not in self._artifacts:
            if parent_id is not None:
                raise LibraryError("CORRUPT_ENTRY", "first revision has a parent")
            self._artifacts[artifact_id] = {
                "artifact_id": artifact_id,
                "project_id": project_id,
                "artifact_type": artifact_type,
                "head_revision_id": revision_id,
            }
            self._artifact_ids.append(artifact_id)
            self._rev_ids_by_artifact[artifact_id] = []
        else:
            current = self._artifacts[artifact_id]
            if current["artifact_type"] != artifact_type or current["project_id"] != project_id:
                raise LibraryError("CORRUPT_ENTRY", "artifact identity changed")
            current["head_revision_id"] = revision_id
        stored = {
            "revision_id": revision_id,
            "artifact_id": artifact_id,
            "project_id": project_id,
            "parent_revision_id": parent_id,
            "created_at": _require_timestamp(str(record.get("created_at"))),
            "artifact_type": artifact_type,
            "provider_target": provider_target,
            "provenance_refs": provenance_refs,
            "quality_evidence_refs": quality_refs,
            "body": body,
            "body_sha256": digest,
            "version_label": version_label,
            "branched": record.get("branched"),
        }
        self._revisions[revision_id] = stored
        self._rev_ids_by_artifact[artifact_id].append(revision_id)

    def _apply_head_move(self, record: Mapping[str, Any]) -> None:
        if record.get("schema") != RECORD_SCHEMA:
            raise LibraryError("UNKNOWN_SCHEMA", "head move schema is not recognized")
        artifact_id = _require_id(record.get("artifact_id"), "art")
        revision_id = _require_id(record.get("revision_id"), "rev")
        artifact = self._artifacts.get(artifact_id)
        revision = self._revisions.get(revision_id)
        if artifact is None or revision is None or revision["artifact_id"] != artifact_id:
            raise LibraryError("CORRUPT_ENTRY", "head move target is missing")
        if record.get("project_id") != artifact["project_id"]:
            raise LibraryError("CORRUPT_ENTRY", "head move project does not match")
        if record.get("reason") != "ROLLBACK":
            raise LibraryError("CORRUPT_ENTRY", "head move reason is not recognized")
        _require_timestamp(str(record.get("created_at")))
        if artifact["head_revision_id"] == revision_id:
            raise LibraryError("CORRUPT_ENTRY", "head move does not change head")
        artifact["head_revision_id"] = revision_id

    def _durable_record(self, record: Mapping[str, Any]) -> dict[str, Any]:
        kind = record.get("kind")
        if kind == "LIBRARY":
            return self._header_record()
        if kind == "PROJECT":
            project = self._projects[str(record.get("project_id"))]
            return {
                "schema": RECORD_SCHEMA,
                "kind": "PROJECT",
                "project_id": project["project_id"],
                "name": project["name"],
                "created_at": project["created_at"],
                "visibility": "private",
                "noindex": True,
            }
        if kind == "REVISION":
            revision = self._revisions[str(record.get("revision_id"))]
            return {"schema": RECORD_SCHEMA, "kind": "REVISION", **_public_revision(revision)}
        if kind == "HEAD_MOVE":
            return {
                "schema": RECORD_SCHEMA,
                "kind": "HEAD_MOVE",
                "project_id": record["project_id"],
                "artifact_id": record["artifact_id"],
                "revision_id": record["revision_id"],
                "created_at": _require_timestamp(str(record.get("created_at"))),
                "reason": "ROLLBACK",
            }
        raise LibraryError("CORRUPT_ENTRY", "record kind is not recognized")
