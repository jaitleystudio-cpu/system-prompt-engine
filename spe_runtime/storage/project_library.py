"""Local private project library (spe.project-library.v1).

Persists inside spe_runtime.storage as append-only JSONL with fsync, the same
local file ownership as the durable journal. This is a schema over that file
discipline, not a new database.

No account is required. Records stay private and noindex. Revision bytes stay
in the library file. Canonical .spe text is emitted only when a revision body
already satisfies spe_runtime.portability.spe_artifact; otherwise export_spe
raises NOT_YET_BOUND. A library bundle is not a .spe document.
"""

from __future__ import annotations

import copy
import hashlib
import json
import os
import re
import uuid
from typing import Any, Mapping

from spe_runtime.portability.spe_artifact import (
    dumps_spe_artifact,
    loads_spe_artifact,
    verify_integrity,
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
    except (TypeError, ValueError) as exc:
        raise LibraryError("CORRUPT_ENTRY", "body is not JSON") from exc
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

    def __init__(self, path: str | os.PathLike[str], *, max_body_bytes: int = _DEFAULT_MAX_BODY_BYTES) -> None:
        if not isinstance(max_body_bytes, int) or isinstance(max_body_bytes, bool) or max_body_bytes < 1:
            raise LibraryError("OVERSIZE_ENTRY", "body limit must be a positive integer")
        self._path = os.fspath(path)
        self._max_body_bytes = max_body_bytes
        self._reset()
        if not os.path.exists(self._path):
            parent = os.path.dirname(self._path)
            if parent:
                os.makedirs(parent, exist_ok=True)
            with open(self._path, "w", encoding="utf-8") as handle:
                handle.write("")
            self._append(self._header_record())
        else:
            self._load()

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
        revisions = []
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
            for revision_id in self._rev_ids_by_artifact.get(artifact_id, []):
                revisions.append(self.get_revision(revision_id))
        return {
            "schema": LIBRARY_SCHEMA,
            "visibility": "private",
            "noindex": True,
            "indexing": "noindex",
            "spe_contract": "NOT_YET_BOUND",
            "project": project,
            "artifacts": artifacts,
            "revisions": revisions,
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
        if not isinstance(name, str) or not name.strip() or len(name) > 200:
            raise LibraryError("CORRUPT_ENTRY", "project name is missing")
        planned = self._plan_import(project_id, artifacts, revisions)
        self._append(
            {
                "schema": RECORD_SCHEMA,
                "kind": "PROJECT",
                "project_id": project_id,
                "name": name,
                "created_at": _require_timestamp(str(project.get("created_at"))),
                "visibility": "private",
                "noindex": True,
            }
        )
        for revision in planned["revisions"]:
            self._append(revision)
        for move in planned["moves"]:
            self._append(move)
        return self.get_project(project_id)

    def export_spe(self, artifact_id: str) -> str:
        body = self.head(artifact_id)["body"]
        try:
            loaded = loads_spe_artifact(body)
        except (TypeError, ValueError, KeyError, json.JSONDecodeError):
            raise LibraryError("NOT_YET_BOUND", "revision body is not a canonical spe artifact") from None
        checked = verify_integrity(loaded)
        if checked.get("integrity", {}).get("state") != "VERIFIED":
            raise LibraryError("INTEGRITY_MISMATCH", "spe integrity digest does not match")
        return dumps_spe_artifact(loaded)

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
        artifacts: list[Any],
        revisions: list[Any],
    ) -> dict[str, Any]:
        heads: dict[str, str] = {}
        types: dict[str, str] = {}
        for artifact in artifacts:
            if not isinstance(artifact, Mapping) or artifact.get("project_id") != project_id:
                raise LibraryError("CORRUPT_ENTRY", "artifact is not in this project")
            artifact_id = _require_id(artifact.get("artifact_id"), "art")
            artifact_type = artifact.get("artifact_type")
            if artifact_type not in ARTIFACT_TYPES:
                raise LibraryError("UNKNOWN_ARTIFACT_TYPE", "artifact type is not in the library vocabulary")
            heads[artifact_id] = _require_id(artifact.get("head_revision_id"), "rev")
            types[artifact_id] = str(artifact_type)
        seen: set[str] = set()
        parent_of: dict[str, str | None] = {}
        children: dict[str, int] = {}
        simulated_head: dict[str, str | None] = {artifact_id: None for artifact_id in heads}
        stored = []
        order: dict[str, list[str]] = {artifact_id: [] for artifact_id in heads}
        for raw in revisions:
            if not isinstance(raw, Mapping):
                raise LibraryError("CORRUPT_ENTRY", "revision is not an object")
            self._refuse_identity(raw)
            revision = self._checked_revision(project_id, raw, types)
            artifact_id = revision["artifact_id"]
            if artifact_id not in heads:
                raise LibraryError("CORRUPT_ENTRY", "revision has no artifact")
            revision_id = revision["revision_id"]
            if revision_id in seen:
                raise LibraryError("ID_COLLISION", "revision id repeated")
            seen.add(revision_id)
            parent_id = revision["parent_revision_id"]
            if parent_id is None:
                if simulated_head[artifact_id] is not None:
                    raise LibraryError("CORRUPT_ENTRY", "artifact has two roots")
            elif parent_id not in seen:
                raise LibraryError("CORRUPT_ENTRY", "parent revision is missing")
            branched = False
            if parent_id is not None:
                branched = parent_id != simulated_head[artifact_id] or children.get(parent_id, 0) > 0
            if revision["branched"] is not branched:
                raise LibraryError("CORRUPT_ENTRY", "branch flag does not match history")
            if parent_id is not None:
                children[parent_id] = children.get(parent_id, 0) + 1
            parent_of[revision_id] = parent_id
            simulated_head[artifact_id] = revision_id
            order[artifact_id].append(revision_id)
            stored.append(
                {
                    "schema": RECORD_SCHEMA,
                    "kind": "REVISION",
                    **revision,
                }
            )
        moves = []
        for artifact_id, head_id in heads.items():
            if head_id not in seen or parent_of.get(head_id, _MISSING) is _MISSING:
                raise LibraryError("CORRUPT_ENTRY", "head revision is missing")
            if simulated_head[artifact_id] != head_id:
                moves.append(
                    {
                        "schema": RECORD_SCHEMA,
                        "kind": "HEAD_MOVE",
                        "project_id": project_id,
                        "artifact_id": artifact_id,
                        "revision_id": head_id,
                        "created_at": stored[-1]["created_at"] if stored else _require_timestamp("1970-01-01T00:00:00Z"),
                        "reason": "ROLLBACK",
                    }
                )
        return {"revisions": stored, "moves": moves}

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
        self._apply(stored)
        with open(self._path, "a", encoding="utf-8") as handle:
            handle.write(_line(stored) + "\n")
            handle.flush()
            os.fsync(handle.fileno())
        self._records.append(stored)

    def _rewrite(self, records: list[Mapping[str, Any]]) -> None:
        temporary = self._path + ".tmp"
        with open(temporary, "w", encoding="utf-8") as handle:
            for record in records:
                handle.write(_line(record) + "\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, self._path)
        self._reset()
        self._load()

    def _load(self) -> None:
        with open(self._path, "r", encoding="utf-8") as handle:
            text = handle.read()
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
            except json.JSONDecodeError as exc:
                raise LibraryError("CORRUPT_ENTRY", "record is not valid JSON") from exc
            if not isinstance(obj, dict):
                raise LibraryError("CORRUPT_ENTRY", "record is not an object")
            if obj.get("schema") not in KNOWN_SCHEMAS:
                raise LibraryError("UNKNOWN_SCHEMA", "record schema is not recognized")
            self._apply(obj)
            self._records.append(obj)
        if not self._records or self._records[0].get("kind") != "LIBRARY":
            raise LibraryError("CORRUPT_ENTRY", "library header is missing")

    def _apply(self, record: Mapping[str, Any]) -> None:
        kind = record.get("kind")
        if kind == "LIBRARY":
            if self._records or record.get("visibility") != "private" or record.get("noindex") is not True:
                raise LibraryError("CORRUPT_ENTRY", "library header is not private")
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
        if not isinstance(name, str) or not name:
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
        body = record.get("body")
        digest = record.get("body_sha256")
        if not isinstance(digest, str) or digest != _hash_body(body):
            raise LibraryError("CORRUPT_ENTRY", "body digest does not match")
        if record.get("branched") not in (True, False):
            raise LibraryError("CORRUPT_ENTRY", "branch flag is missing")
        try:
            provider_target = _normalize_target(record.get("provider_target"))
            provenance_refs = _normalize_refs(record.get("provenance_refs"))
            quality_refs = _normalize_refs(record.get("quality_evidence_refs"))
            version_label = _normalize_label(record.get("version_label"))
        except LibraryError as exc:
            raise LibraryError("CORRUPT_ENTRY", "revision metadata is not a token") from exc
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
        if record.get("reason") != "ROLLBACK":
            raise LibraryError("CORRUPT_ENTRY", "head move reason is not recognized")
        artifact["head_revision_id"] = revision_id
