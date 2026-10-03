"""Public .spe binding path over the owners that already exist.

Python is the reference. This module does not serialize .spe text and it does
not project a workflow. Those calls go to spe_runtime.portability.spe_artifact
and spe_runtime.workflow_export.export_workflow. apps/web workflowExporters.ts
is not an owner and is not recreated.

spe_contract stays NOT_YET_BOUND. TARGET MODEL COMPILE has no owner that reads
a saved .spe artifact, so the path decision is HOLD and the constant is not flipped.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Mapping

from spe_runtime.portability.canonical import strict_equal
from spe_runtime.portability.spe_artifact import (
    dumps_spe_artifact,
    loads_spe_artifact,
    verify_integrity,
)
from spe_runtime.storage.project_library import LibraryError, ProjectLibrary
from spe_runtime.workflow_export import audit_export, export_workflow

SPE_CONTRACT = "NOT_YET_BOUND"
PATH_DECISION = "HOLD"
TARGET_MODEL_COMPILE_HOLD = (
    "HOLD: no owner compiles a saved .spe artifact for a named target model"
)

PATH_STEPS = (
    "CREATE",
    "SAVE",
    "REVISION",
    "DIFF",
    "ROLLBACK",
    "EXPORT .spe",
    "VERIFY manifest hashes",
    "IMPORT",
    "RECONSTRUCT",
    "WORKFLOW EXPORT",
    "TARGET MODEL COMPILE",
    "REOPEN",
    "stable semantic hash",
)


def _semantic_hash(artifact: Mapping[str, Any]) -> str:
    """Canonical SHA-256 of the artifact with the integrity field removed.

    This is spe_runtime.portability.spe_artifact.verify_integrity. It is not a
    second hash function.
    """
    checked = verify_integrity(artifact)
    integrity = checked.get("integrity")
    if not isinstance(integrity, Mapping) or integrity.get("state") != "VERIFIED":
        raise LibraryError("INTEGRITY_MISMATCH", "spe integrity digest does not match")
    digest = integrity.get("content_sha256")
    if not isinstance(digest, str) or len(digest) != 64:
        raise LibraryError("INTEGRITY_MISMATCH", "spe integrity digest does not match")
    return digest


def run_public_binding_path(
    library_path: str | os.PathLike[str],
    *,
    project_name: str,
    created_at: str,
    saved_at: str,
    revised_at: str,
    rollback_at: str,
    first_body: Any,
    revised_body: Any,
    artifact_type: str = "prompt",
    provenance_refs: tuple[str, ...] | list[str] = ("USER_EXPLICIT",),
    provider_target: str | None = "local",
    workflow_target: str = "generic_json",
    import_path: str | os.PathLike[str] | None = None,
) -> dict[str, Any]:
    """Run every binding step that has an owner. Do not promote spe_contract.

    The returned decision is exactly HOLD while TARGET MODEL COMPILE has no
    owner. A failure in a real step raises; it is not reported as success.
    """
    path = Path(library_path)
    other = Path(import_path) if import_path is not None else path.with_name(path.name + ".import.jsonl")
    steps: dict[str, str] = {name: "MISSING" for name in PATH_STEPS}

    library = ProjectLibrary(path)
    project = library.create_project(project_name, created_at=created_at)
    steps["CREATE"] = "REAL"

    saved = library.create_artifact(
        project["project_id"],
        artifact_type=artifact_type,
        body=first_body,
        created_at=saved_at,
        provenance_refs=provenance_refs,
        provider_target=provider_target,
        version_label="v1",
    )
    if not path.is_file() or path.stat().st_size == 0:
        raise LibraryError("CORRUPT_ENTRY", "library file was not saved")
    if saved["body_sha256"] not in path.read_text(encoding="utf-8"):
        raise LibraryError("CORRUPT_ENTRY", "saved revision is not in the library file")
    steps["SAVE"] = "REAL"

    revised = library.revise(
        saved["artifact_id"],
        body=revised_body,
        created_at=revised_at,
        provenance_refs=provenance_refs,
        version_label="v2",
    )
    steps["REVISION"] = "REAL"

    diff = library.diff(saved["revision_id"], revised["revision_id"])
    if diff.get("schema") != "spe.project-library.diff.v1" or not diff.get("changes"):
        raise LibraryError("CORRUPT_ENTRY", "revision did not change the payload")
    steps["DIFF"] = "REAL"

    rolled = library.rollback(saved["artifact_id"], saved["revision_id"], created_at=rollback_at)
    if rolled["revision_id"] != saved["revision_id"]:
        raise LibraryError("CORRUPT_ENTRY", "rollback did not restore the saved revision")
    steps["ROLLBACK"] = "REAL"

    exported = library.export_spe(saved["artifact_id"])
    loaded = loads_spe_artifact(exported)
    semantic_hash = _semantic_hash(loaded)
    if dumps_spe_artifact(loaded) != exported:
        raise LibraryError("INTEGRITY_MISMATCH", "spe export is not canonical")
    steps["EXPORT .spe"] = "REAL"

    manifest = library.revision_manifest(project["project_id"])
    checked_manifest = library.accept_revision_manifest(project["project_id"], manifest)
    if checked_manifest["entries"] != manifest["entries"]:
        raise LibraryError("HASH_MISMATCH", "recomputed manifest does not match")
    steps["VERIFY manifest hashes"] = "REAL"

    provenance = library.provenance_record(saved["revision_id"])
    library.accept_provenance_record(provenance)

    bundle = library.export_project(project["project_id"])
    if bundle.get("spe_contract") != SPE_CONTRACT:
        raise LibraryError("UNKNOWN_SCHEMA", "bundle spe contract is not recognized")
    imported = ProjectLibrary(other)
    imported.import_bundle(bundle)
    if imported.head(saved["artifact_id"])["revision_id"] != saved["revision_id"]:
        raise LibraryError("CORRUPT_ENTRY", "import did not keep the rolled head")
    steps["IMPORT"] = "REAL"

    reconstructed = loads_spe_artifact(imported.export_spe(saved["artifact_id"]))
    if not strict_equal(reconstructed, loaded):
        raise LibraryError("INTEGRITY_MISMATCH", "reconstructed artifact does not match the export")
    if _semantic_hash(reconstructed) != semantic_hash:
        raise LibraryError("INTEGRITY_MISMATCH", "reconstructed semantic hash does not match")
    steps["RECONSTRUCT"] = "REAL"

    workflow = export_workflow(reconstructed, target=workflow_target)
    audit_export(workflow)
    if "spe_contract" in workflow or workflow.get("guarantees", {}).get("network") is not False:
        raise LibraryError("UNKNOWN_SCHEMA", "workflow export is not the offline G11 document")
    if workflow.get("canonical", {}).get("prompt_body") != reconstructed.get("rendered_prompt"):
        raise LibraryError("INTEGRITY_MISMATCH", "workflow export prompt does not match the artifact")
    steps["WORKFLOW EXPORT"] = "REAL"

    steps["TARGET MODEL COMPILE"] = "HOLD"

    reopened = ProjectLibrary(path)
    reopened_text = reopened.export_spe(saved["artifact_id"])
    if reopened_text != exported:
        raise LibraryError("INTEGRITY_MISMATCH", "reopened export does not match the saved export")
    if reopened.head(saved["artifact_id"])["revision_id"] != saved["revision_id"]:
        raise LibraryError("CORRUPT_ENTRY", "reopen did not restore the rolled head")
    steps["REOPEN"] = "REAL"

    if _semantic_hash(loads_spe_artifact(reopened_text)) != semantic_hash:
        raise LibraryError("INTEGRITY_MISMATCH", "semantic hash changed after reopen")
    steps["stable semantic hash"] = "REAL"

    if any(steps[name] != "REAL" for name in PATH_STEPS if name != "TARGET MODEL COMPILE"):
        raise LibraryError("NOT_YET_BOUND", "a real binding step did not run")
    if steps["TARGET MODEL COMPILE"] != "HOLD":
        raise LibraryError("NOT_YET_BOUND", "target model compile was reported without an owner")

    return {
        "spe_contract": SPE_CONTRACT,
        "decision": PATH_DECISION,
        "promoted": False,
        "refused_promotion": "VERIFIED",
        "steps": steps,
        "holds": {"TARGET MODEL COMPILE": TARGET_MODEL_COMPILE_HOLD},
        "semantic_hash": semantic_hash,
        "project_id": project["project_id"],
        "artifact_id": saved["artifact_id"],
        "saved_revision_id": saved["revision_id"],
        "revised_revision_id": revised["revision_id"],
        "workflow_target": workflow["target"],
        "workflow_source": workflow["source"],
        "spe_format": loaded.get("spe_format"),
    }
