"""Public .spe binding path over the owners that already exist.

Python is the reference. This module does not serialize .spe text and it does
not project a workflow. Those calls go to spe_runtime.portability.spe_artifact
and spe_runtime.workflow_export.export_workflow. apps/web workflowExporters.ts
is not an owner and is not recreated.

Target-model compile is owned by the adapter
``spe_runtime.adapters.spe_target_compile.compile_spe_for_target``, which calls
the EXISTING ``formatTargetModelPrompt``
(``apps/web/src/engine/continuation/continuationCompiler.ts``, symbol defined in
``2536c469a43bd8fe43c5342fb58a8b8270a2143f``, bytes from
``5011b5409c86cc7f5426a49d963b72a648bc2765``).

When that path is real end-to-end, ``spe_contract`` is ``BOUND``. Library
bundles remain ``NOT_YET_BOUND`` (a library bundle is not a .spe document).
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Mapping

from spe_runtime.adapters.spe_target_compile import (
    CANONICAL_COMPILER_PATH,
    CANONICAL_COMPILER_SHA,
    CANONICAL_COMPILER_SYMBOL,
    TargetCompileError,
    compile_spe_for_target,
    semantic_compare,
)
from spe_runtime.portability.canonical import strict_equal
from spe_runtime.portability.spe_artifact import (
    dumps_spe_artifact,
    loads_spe_artifact,
    verify_integrity,
)
from spe_runtime.storage.project_library import LibraryError, ProjectLibrary
from spe_runtime.workflow_export import audit_export, export_workflow

# Binding-path contract. Distinct from library bundle spe_contract.
SPE_CONTRACT = "BOUND"
PATH_DECISION = "BOUND"
LIBRARY_BUNDLE_SPE_CONTRACT = "NOT_YET_BOUND"

DEFAULT_TARGET_MODEL = "generic"

PATH_STEPS = (
    "CREATE",
    "SAVE",
    "REVISION",
    "DIFF",
    "ROLLBACK",
    "EXPORT",
    "VERIFY",
    "IMPORT",
    "RECONSTRUCT",
    "WORKFLOW EXPORT",
    "TARGET SELECT",
    "COMPILE",
    "EXPORT TARGET",
    "REOPEN",
    "SEMANTIC COMPARE",
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
    target_model: str = DEFAULT_TARGET_MODEL,
    import_path: str | os.PathLike[str] | None = None,
) -> dict[str, Any]:
    """Run every binding step including target-model compile.

    Promotes ``spe_contract`` to BOUND only when TARGET SELECT → COMPILE →
    EXPORT TARGET → SEMANTIC COMPARE all succeed against the existing
    formatTargetModelPrompt. A failure in a real step raises.
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
    steps["EXPORT"] = "REAL"

    manifest = library.revision_manifest(project["project_id"])
    checked_manifest = library.accept_revision_manifest(project["project_id"], manifest)
    if checked_manifest["entries"] != manifest["entries"]:
        raise LibraryError("HASH_MISMATCH", "recomputed manifest does not match")
    steps["VERIFY"] = "REAL"

    provenance = library.provenance_record(saved["revision_id"])
    library.accept_provenance_record(provenance)

    bundle = library.export_project(project["project_id"])
    if bundle.get("spe_contract") != LIBRARY_BUNDLE_SPE_CONTRACT:
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

    # TARGET SELECT → COMPILE → EXPORT TARGET via existing formatTargetModelPrompt.
    if not isinstance(target_model, str) or not target_model.strip():
        raise LibraryError("UNKNOWN_TARGET", "target model was not selected")
    steps["TARGET SELECT"] = "REAL"

    try:
        compiled = compile_spe_for_target(exported, target_model)
    except TargetCompileError as exc:
        raise LibraryError(exc.code, exc.reason) from None
    steps["COMPILE"] = "REAL"

    target_export = {
        "schema": "spe.target-model.export.v1",
        "target": compiled["target"],
        "prompt": compiled["prompt"],
        "content_sha256": compiled["content_sha256"],
        "compiler": compiled["compiler"],
        "authority": compiled["authority"],
        "protected_intent": compiled["protected_intent"],
    }
    if not target_export["prompt"] or target_export["target"] != compiled["target"]:
        raise LibraryError("NOT_YET_BOUND", "target export did not materialize")
    steps["EXPORT TARGET"] = "REAL"

    reopened = ProjectLibrary(path)
    reopened_text = reopened.export_spe(saved["artifact_id"])
    if reopened_text != exported:
        raise LibraryError("INTEGRITY_MISMATCH", "reopened export does not match the saved export")
    if reopened.head(saved["artifact_id"])["revision_id"] != saved["revision_id"]:
        raise LibraryError("CORRUPT_ENTRY", "reopen did not restore the rolled head")
    steps["REOPEN"] = "REAL"

    if _semantic_hash(loads_spe_artifact(reopened_text)) != semantic_hash:
        raise LibraryError("INTEGRITY_MISMATCH", "semantic hash changed after reopen")

    try:
        recompiled = compile_spe_for_target(reopened_text, target_model)
        compare = semantic_compare(compiled, recompiled)
    except TargetCompileError as exc:
        raise LibraryError(exc.code, exc.reason) from None
    if not compare.get("equal"):
        raise LibraryError("SEMANTIC_MISMATCH", "semantic compare failed after reopen")
    steps["SEMANTIC COMPARE"] = "REAL"

    if any(steps[name] != "REAL" for name in PATH_STEPS):
        raise LibraryError("NOT_YET_BOUND", "a real binding step did not run")
    if SPE_CONTRACT != "BOUND":
        raise LibraryError("NOT_YET_BOUND", "spe_contract was not bound")

    return {
        "spe_contract": SPE_CONTRACT,
        "decision": PATH_DECISION,
        "promoted": True,
        "refused_promotion": "VERIFIED",
        "steps": steps,
        "holds": {},
        "semantic_hash": semantic_hash,
        "project_id": project["project_id"],
        "artifact_id": saved["artifact_id"],
        "saved_revision_id": saved["revision_id"],
        "revised_revision_id": revised["revision_id"],
        "workflow_target": workflow["target"],
        "workflow_source": workflow["source"],
        "spe_format": loaded.get("spe_format"),
        "target_model": compiled["target"],
        "target_export": target_export,
        "compiler": {
            "symbol": CANONICAL_COMPILER_SYMBOL,
            "path": CANONICAL_COMPILER_PATH,
            "defining_sha": CANONICAL_COMPILER_SHA,
        },
        "library_bundle_spe_contract": LIBRARY_BUNDLE_SPE_CONTRACT,
    }
