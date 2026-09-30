"""Target projections. Documents describe workflows. They do not run them."""

from __future__ import annotations

import copy
from typing import Any

from spe_runtime.workflow_export.model import (
    EXPORT_CONTRACT_VERSION,
    FACETS,
    WITHHELD_MARKER,
)
from spe_runtime.workflow_export.text import render_generic_text


def _item(facet: str, state: str, code: str, reason: str) -> dict[str, str]:
    return {"facet": facet, "state": state, "code": code, "reason": reason}


def _exact(facet: str) -> dict[str, str]:
    return _item(facet, "PRESERVED", "EXACT", f"The generic document stores {facet} exactly.")


def _degraded(facet: str, code: str, reason: str) -> dict[str, str]:
    return _item(facet, "DEGRADED", code, reason)


def _unsupported(facet: str, reason: str) -> dict[str, str]:
    return _item(facet, "UNSUPPORTED", "NO_OFFLINE_ZAP_CONTRACT", reason)


def base_fidelity(target: str) -> list[dict[str, str]]:
    if target in {"generic_json", "generic_text"}:
        return [_exact(facet) for facet in FACETS]
    if target == "n8n":
        return [
            _item(
                "prompt_body",
                "PRESERVED",
                "NATIVE_FIELD",
                "Sticky note content is the prompt body and the workflow is inactive.",
            ),
            _item(
                "variables",
                "PRESERVED",
                "NATIVE_FIELD",
                "Variables are stored in staticData.spe_variables, which the workflow file retains.",
            ),
            _degraded(
                "required_inputs",
                "TARGET_DOES_NOT_ENFORCE",
                "n8n workflow JSON does not enforce required inputs; values are copied into staticData.spe.required_inputs.",
            ),
            _degraded(
                "expected_outputs",
                "TARGET_DOES_NOT_ENFORCE",
                "n8n workflow JSON has no expected-output contract; values are copied into staticData.spe.expected_outputs.",
            ),
            _degraded(
                "constraints",
                "TARGET_DOES_NOT_ENFORCE",
                "n8n workflow JSON does not enforce constraints; values are copied into staticData.spe.constraints.",
            ),
            _degraded(
                "provider_target",
                "TARGET_DOES_NOT_ENFORCE",
                "n8n workflow JSON has no provider-target field; the value is copied into staticData.spe.provider_target.",
            ),
        ]
    if target == "make":
        return [
            _degraded(
                facet,
                "TARGET_DOES_NOT_ENFORCE",
                f"Make blueprint has no native prompt-contract field for {facet}; the value is copied into metadata.spe and is not enforced.",
            )
            for facet in FACETS
        ]
    if target == "zapier":
        degraded = (
            "prompt_body",
            "variables",
            "constraints",
            "provider_target",
        )
        items = []
        for facet in FACETS:
            if facet in {"required_inputs", "expected_outputs"}:
                items.append(
                    _unsupported(
                        facet,
                        "Zapier required flags and output fields exist only on live app definitions; "
                        f"this offline descriptor cannot represent {facet} as an enforced Zap contract. "
                        "The value is listed under review_copy and is not semantic.",
                    )
                )
            elif facet in degraded:
                items.append(
                    _degraded(
                        facet,
                        "NOT_A_NATIVE_ZAP_FIELD",
                        "Zapier has no offline import contract; "
                        f"{facet} is copied onto a non-importable descriptor and is not a live Zap field.",
                    )
                )
        return items
    raise ValueError(f"unsupported export target: {target}")


def apply_loss_overrides(
    fidelity: list[dict[str, str]],
    *,
    prompt_withheld: bool,
    variables_stripped: bool,
) -> list[dict[str, str]]:
    updated: list[dict[str, str]] = []
    for item in fidelity:
        if item["facet"] == "prompt_body" and prompt_withheld:
            updated.append(
                _degraded(
                    "prompt_body",
                    "PROMPT_BODY_WITHHELD",
                    "Prompt body matched a credential pattern and was withheld. A SHA-256 digest is kept and the body is not stored.",
                )
            )
        elif item["facet"] == "variables" and variables_stripped:
            updated.append(
                _degraded(
                    "variables",
                    "VALUE_STRIPPED",
                    "One or more variables used a credential or webhook name. Those values were removed and the names were kept with disposition STRIPPED.",
                )
            )
        else:
            updated.append(item)
    return updated


def loss_state_for(fidelity: list[dict[str, str]]) -> str:
    states = {item["state"] for item in fidelity}
    if "UNSUPPORTED" in states:
        return "UNSUPPORTED"
    if "DEGRADED" in states:
        return "DEGRADED"
    return "NONE"


def warnings_for(fidelity: list[dict[str, str]], stripped_paths: tuple[str, ...]) -> list[dict[str, Any]]:
    warnings: list[dict[str, Any]] = []
    for item in fidelity:
        if item["state"] == "PRESERVED":
            continue
        warnings.append(
            {"code": item["code"], "facet": item["facet"], "message": item["reason"]}
        )
    for path in stripped_paths:
        warnings.append(
            {
                "code": "UNSUPPORTED_FEATURE",
                "facet": None,
                "message": (
                    f"credential or execution field stripped at {path}; value not stored"
                ),
            }
        )
    return warnings


def _prompt_carry(canonical: dict[str, Any], *, prompt_withheld: bool) -> str:
    if prompt_withheld:
        return WITHHELD_MARKER
    return canonical["prompt_body"]


def project_document(
    target: str,
    canonical: dict[str, Any],
    *,
    prompt_withheld: bool,
) -> Any:
    if target == "generic_json":
        return copy.deepcopy(canonical)
    if target == "generic_text":
        return render_generic_text(canonical)
    prompt_carry = _prompt_carry(canonical, prompt_withheld=prompt_withheld)
    if target == "n8n":
        return {
            "name": "SPE offline export (not executable)",
            "active": False,
            "nodes": [
                {
                    "parameters": {
                        "content": prompt_carry,
                        "height": 240,
                        "width": 320,
                    },
                    "name": "SPE Prompt",
                    "type": "n8n-nodes-base.stickyNote",
                    "typeVersion": 1,
                    "position": [0, 0],
                }
            ],
            "connections": {},
            "settings": {"executionOrder": "v1"},
            "staticData": {
                "spe_variables": copy.deepcopy(canonical["variables"]),
                "spe": {
                    "required_inputs": list(canonical["required_inputs"]),
                    "expected_outputs": list(canonical["expected_outputs"]),
                    "constraints": list(canonical["constraints"]),
                    "provider_target": canonical["provider_target"],
                    "export_contract_version": EXPORT_CONTRACT_VERSION,
                    "executable": False,
                },
            },
            "meta": {
                "speExport": EXPORT_CONTRACT_VERSION,
                "executable": False,
            },
            "pinData": {},
        }
    if target == "make":
        return {
            "name": "SPE offline export (not executable)",
            "flow": [],
            "metadata": {
                "instant": False,
                "offline": True,
                "executable": False,
                "spe": copy.deepcopy(canonical),
            },
        }
    if target == "zapier":
        return {
            "format": "zapier.offline-descriptor.v1",
            "importable": False,
            "runnable": False,
            "executable": False,
            "provider_target": canonical["provider_target"],
            "note": prompt_carry,
            "variables": copy.deepcopy(canonical["variables"]),
            "constraints": list(canonical["constraints"]),
            "unsupported": [
                {
                    "facet": "required_inputs",
                    "reason": "No offline Zap contract can enforce required inputs.",
                },
                {
                    "facet": "expected_outputs",
                    "reason": "No offline Zap contract can represent expected outputs.",
                },
            ],
            "review_copy": {
                "semantic": False,
                "required_inputs": list(canonical["required_inputs"]),
                "expected_outputs": list(canonical["expected_outputs"]),
            },
        }
    raise ValueError(f"unsupported export target: {target}")
