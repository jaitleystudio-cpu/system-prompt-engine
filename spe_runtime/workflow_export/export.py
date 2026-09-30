"""Public offline workflow export. Calling this does not execute a workflow."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Mapping

import jsonschema

from spe_runtime.workflow_export.audit import audit_export
from spe_runtime.workflow_export.model import (
    EXPORT_CONTRACT_VERSION,
    GUARANTEES,
    TARGETS,
    extract_contract,
)
from spe_runtime.workflow_export.project import (
    apply_loss_overrides,
    loss_state_for,
    project_document,
    base_fidelity,
    warnings_for,
)

_SCHEMA_PATH = Path(__file__).resolve().parents[2] / "schemas" / "workflow_export.schema.json"


def _schema() -> dict[str, Any]:
    return json.loads(_SCHEMA_PATH.read_text(encoding="utf-8"))


def export_workflow(source: Mapping[str, Any], *, target: str) -> dict[str, Any]:
    """Return a portable workflow document. Never sends, publishes, or executes it."""
    if target not in TARGETS:
        raise ValueError(f"unsupported export target: {target}")
    extracted = extract_contract(source)
    variables_stripped = any(
        item["disposition"] == "STRIPPED" for item in extracted.canonical["variables"]
    )
    fidelity = apply_loss_overrides(
        base_fidelity(target),
        prompt_withheld=extracted.prompt_withheld,
        variables_stripped=variables_stripped,
    )
    document: dict[str, Any] = {
        "export_contract_version": EXPORT_CONTRACT_VERSION,
        "target": target,
        "loss_state": loss_state_for(fidelity),
        "guarantees": dict(GUARANTEES),
        "canonical": extracted.canonical,
        "fidelity": fidelity,
        "warnings": warnings_for(fidelity, extracted.stripped_paths),
        "stripped_paths": list(extracted.stripped_paths),
        "target_document": project_document(
            target,
            extracted.canonical,
            prompt_withheld=extracted.prompt_withheld,
        ),
        "source": extracted.source_info,
    }
    jsonschema.validate(document, _schema())
    audit_export(document)
    retained = _retained_secrets(document, extracted.secrets)
    if retained:
        raise RuntimeError("export retained a stripped secret")
    return document


def _retained_secrets(document: dict[str, Any], secrets: tuple[str, ...]) -> list[str]:
    leaves: list[str] = []

    def walk(value: Any) -> None:
        if isinstance(value, str):
            leaves.append(value)
        elif isinstance(value, Mapping):
            for child in value.values():
                walk(child)
        elif isinstance(value, list):
            for child in value:
                walk(child)

    walk(document)
    return [secret for secret in secrets if secret and any(secret in leaf for leaf in leaves)]
