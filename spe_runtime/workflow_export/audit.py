"""Reject silent omission, fake preservation, and execution flags."""

from __future__ import annotations

from typing import Any

from spe_runtime.workflow_export.model import FACETS, GUARANTEES, WITHHELD_MARKER
from spe_runtime.workflow_export.project import loss_state_for
from spe_runtime.workflow_export.text import parse_generic_text

_PRESERVABLE = {
    "generic_json": set(FACETS),
    "generic_text": set(FACETS),
    "n8n": {"prompt_body", "variables"},
    "make": set(),
    "zapier": set(),
}


class ExportIntegrityError(ValueError):
    """The export ledger does not match the document it describes."""


def _require(condition: bool, message: str) -> None:
    if not condition:
        raise ExportIntegrityError(message)


def _prompt_carry(document: dict[str, Any], canonical: dict[str, Any]) -> str:
    if canonical["prompt_body_disposition"] == "WITHHELD_CREDENTIAL":
        return WITHHELD_MARKER
    return canonical["prompt_body"]


def _check_target(document: dict[str, Any]) -> None:
    target = document["target"]
    canonical = document["canonical"]
    projected = document["target_document"]
    if target == "generic_json":
        _require(projected == canonical, "generic json target drifted from canonical")
        return
    if target == "generic_text":
        _require(
            parse_generic_text(projected) == canonical,
            "generic text does not round-trip canonical",
        )
        return
    if target == "n8n":
        _require(projected.get("active") is False, "n8n workflow must stay inactive")
        nodes = projected.get("nodes")
        _require(
            isinstance(nodes, list)
            and [node.get("type") for node in nodes] == ["n8n-nodes-base.stickyNote"],
            "n8n export may contain only an inactive sticky note",
        )
        content = nodes[0]["parameters"]["content"]
        _require(content == _prompt_carry(projected, canonical), "n8n prompt carry mismatch")
        _require(
            projected["staticData"]["spe_variables"] == canonical["variables"],
            "n8n variables were omitted or changed",
        )
        carried = projected["staticData"]["spe"]
        for facet in ("required_inputs", "expected_outputs", "constraints", "provider_target"):
            _require(carried[facet] == canonical[facet], f"n8n omitted {facet}")
        _require(carried.get("executable") is False, "n8n executable flag must stay false")
        return
    if target == "make":
        _require(projected.get("flow") == [], "Make flow must stay empty")
        _require("connections" not in projected, "Make export must not include connections")
        _require(projected["metadata"].get("executable") is False, "Make executable flag must stay false")
        _require(
            projected["metadata"]["spe"] == canonical,
            "Make metadata.spe omitted canonical fields",
        )
        return
    if target == "zapier":
        _require(projected.get("importable") is False, "Zapier descriptor must not be importable")
        _require(projected.get("runnable") is False, "Zapier descriptor must not be runnable")
        _require(projected.get("executable") is False, "Zapier descriptor must not be executable")
        _require(projected.get("note") == _prompt_carry(projected, canonical), "Zapier prompt carry mismatch")
        _require(projected.get("variables") == canonical["variables"], "Zapier variables mismatch")
        _require(projected.get("constraints") == canonical["constraints"], "Zapier constraints mismatch")
        _require(
            projected.get("provider_target") == canonical["provider_target"],
            "Zapier provider_target mismatch",
        )
        review = projected.get("review_copy")
        _require(isinstance(review, dict) and review.get("semantic") is False, "Zapier review_copy must be non-semantic")
        _require(review.get("required_inputs") == canonical["required_inputs"], "Zapier omitted required_inputs")
        _require(
            review.get("expected_outputs") == canonical["expected_outputs"],
            "Zapier omitted expected_outputs",
        )
        declared = {item.get("facet") for item in projected.get("unsupported", [])}
        ledger = {item["facet"] for item in document["fidelity"] if item["state"] == "UNSUPPORTED"}
        _require(declared == ledger, "Zapier unsupported list does not match the ledger")
        return
    raise ExportIntegrityError(f"unsupported export target: {target}")


def audit_export(document: dict[str, Any]) -> None:
    if not isinstance(document, dict):
        raise ExportIntegrityError("export must be an object")
    fidelity = document.get("fidelity")
    _require(isinstance(fidelity, list), "fidelity ledger is missing")
    facets = [item.get("facet") for item in fidelity]
    for facet in FACETS:
        _require(facet in facets, f"fidelity missing facet: {facet}")
    _require(facets == list(FACETS), "fidelity facet order drifted")
    target = document.get("target")
    _require(target in _PRESERVABLE, f"unsupported export target: {target}")
    canonical = document.get("canonical")
    _require(isinstance(canonical, dict), "canonical contract is missing")
    for item in fidelity:
        state = item.get("state")
        _require(state in {"PRESERVED", "DEGRADED", "UNSUPPORTED"}, "fidelity state is invalid")
        _require(bool(item.get("code")) and bool(item.get("reason")), "fidelity reason is empty")
        if state == "PRESERVED":
            _require(
                item["facet"] in _PRESERVABLE[target],
                f"{item['facet']} cannot be PRESERVED on {target}",
            )
            if item["facet"] == "prompt_body":
                _require(
                    canonical.get("prompt_body_disposition") != "WITHHELD_CREDENTIAL",
                    "WITHHELD prompt body cannot be PRESERVED",
                )
            if item["facet"] == "variables":
                variables = canonical.get("variables")
                _require(isinstance(variables, list), "variables are missing")
                _require(
                    all(variable.get("disposition") != "STRIPPED" for variable in variables),
                    "STRIPPED variables cannot be PRESERVED",
                )
    expected_loss = loss_state_for(fidelity)
    _require(
        document.get("loss_state") == expected_loss,
        f"loss_state {document.get('loss_state')} does not match ledger {expected_loss}",
    )
    guarantees = document.get("guarantees")
    _require(isinstance(guarantees, dict), "guarantees are missing")
    for key, value in GUARANTEES.items():
        _require(guarantees.get(key) == value, f"guarantees.{key} must be {value!r}")
    warnings = document.get("warnings")
    _require(isinstance(warnings, list), "warnings are missing")
    for item in fidelity:
        if item["state"] == "PRESERVED":
            continue
        _require(
            any(warning.get("facet") == item["facet"] for warning in warnings),
            f"missing warning for {item['facet']}",
        )
    stripped = document.get("stripped_paths")
    _require(isinstance(stripped, list), "stripped_paths is missing")
    for path in stripped:
        _require(
            any(path in str(warning.get("message", "")) for warning in warnings),
            f"stripped path {path} was not warned",
        )
    _check_target(document)
