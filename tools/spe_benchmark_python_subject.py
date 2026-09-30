"""Read-only Python reference subject for the SPE benchmark harness.

Invokes the frozen selector and attaches compiled prompt text when the core
returns it. Measurement slots are never set here. A missing prompt stays
UNKNOWN and is not a PASS.
"""

from __future__ import annotations

import hashlib
from typing import Any, Mapping

from spe_runtime.k3.selector import select_prompt_techniques

SUBJECT_ID = "python-reference"
CORE_ENTRY = "spe_runtime.k3.selector.select_prompt_techniques"
METHOD = "python_reference_select_prompt_techniques"
# Structural stamp so two captures of the same frozen core are byte-identical.
# It is not a wall-clock quality measurement.
CAPTURE_STAMP = "2026-09-30T00:00:00Z"
OBSERVATION_SCHEMA = "spe_benchmark_observation.v1"


class SubjectRefuse(Exception):
    """The core returned a claim this harness will not record."""


def _sha256_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def case_to_protected(case: Mapping[str, Any]) -> dict[str, Any]:
    """Map a frozen case onto the selector's protected envelope.

    Only case fields the requirement graph already accepts are copied.
    Category, task, desired output, and scores are not invented.
    """
    raw_prompt = case.get("raw_prompt")
    constraints = case.get("constraints")
    unknowns = case.get("declared_unknowns")
    if not isinstance(raw_prompt, str) or not raw_prompt.strip():
        raise SubjectRefuse("case raw_prompt is missing; refusing to invent a goal")
    if not isinstance(constraints, list) or any(not isinstance(item, str) or not item.strip() for item in constraints):
        raise SubjectRefuse("case constraints must be strings already on the case")
    if not isinstance(unknowns, list) or any(not isinstance(item, str) or not item.strip() for item in unknowns):
        raise SubjectRefuse("case declared_unknowns must be strings already on the case")
    return {
        "goal": raw_prompt,
        "hard_constraints": list(constraints),
        "uncertainties": list(unknowns),
    }


def assess_selection(case_id: str, selection: Mapping[str, Any]) -> dict[str, Any]:
    """Turn one selector result into a capture. No measurement status is set."""
    if selection.get("claims_pass") is not False:
        raise SubjectRefuse(f"{case_id}: core claims_pass is not false; prompt not attached")
    plan = selection.get("prompt_effect_plan")
    if isinstance(plan, Mapping) and plan.get("claims_pass") not in (False, None):
        raise SubjectRefuse(f"{case_id}: effect plan claims_pass is not false; prompt not attached")
    if not isinstance(plan, Mapping):
        plan = {}
    compiled = plan.get("compiled_prompt")
    prompt: str | None
    if isinstance(compiled, str) and compiled.strip() and compiled.strip() != "UNKNOWN":
        prompt = compiled
    else:
        prompt = None
    techniques = selection.get("techniques")
    notes = selection.get("notes")
    return {
        "case_id": case_id,
        "disposition": selection.get("disposition") if isinstance(selection.get("disposition"), str) else "UNKNOWN",
        "renderable": plan.get("renderable") is True and prompt is not None,
        "prompt_attached": prompt is not None,
        "claims_pass": False,
        "techniques": [str(item) for item in techniques] if isinstance(techniques, list) else [],
        "notes": [str(item) for item in notes] if isinstance(notes, list) else [],
        "spe_prompt": prompt,
        "spe_prompt_sha256": _sha256_text(prompt) if prompt is not None else None,
    }


def invoke_case(case: Mapping[str, Any]) -> dict[str, Any]:
    """Call the frozen Python reference once."""
    case_id = str(case.get("case_id") or "")
    protected = case_to_protected(case)
    selection = select_prompt_techniques(protected, {}, {})
    if not isinstance(selection, Mapping):
        raise SubjectRefuse(f"{case_id}: selector did not return an object")
    return assess_selection(case_id, selection)


def invoke_cases(cases: list[Mapping[str, Any]]) -> list[dict[str, Any]]:
    """Invoke every case. A per-case failure leaves that prompt absent."""
    captures: list[dict[str, Any]] = []
    for case in cases:
        case_id = str(case.get("case_id") or "")
        try:
            captures.append(invoke_case(case))
        except SubjectRefuse:
            raise
        except Exception as exc:
            captures.append(
                {
                    "case_id": case_id,
                    "disposition": "ERROR",
                    "renderable": False,
                    "prompt_attached": False,
                    "claims_pass": False,
                    "techniques": [],
                    "notes": [f"SUBJECT_ERROR:{type(exc).__name__}"],
                    "spe_prompt": None,
                    "spe_prompt_sha256": None,
                }
            )
    return captures


def observations_for(captures: list[Mapping[str, Any]]) -> list[dict[str, Any]]:
    """SPE-prompt rows only. Unattached captures produce no observation."""
    rows: list[dict[str, Any]] = []
    for capture in captures:
        if capture.get("prompt_attached") is not True:
            continue
        text = capture.get("spe_prompt")
        case_id = capture.get("case_id")
        if not isinstance(text, str) or not text.strip():
            continue
        if not isinstance(case_id, str) or not case_id:
            raise SubjectRefuse("attached prompt is missing case_id")
        rows.append(
            {
                "schema_version": OBSERVATION_SCHEMA,
                "record_kind": "spe_prompt",
                "case_id": case_id,
                "arm_id": "SPE",
                "spe_prompt": text,
                "evidence_ref": f"python-reference://select_prompt_techniques/{case_id}",
                "method": METHOD,
                "measured_at": CAPTURE_STAMP,
                "notes": "Compiled by the frozen Python reference. Text is not a measurement PASS.",
            }
        )
    return rows


def trace_document(captures: list[Mapping[str, Any]], *, marked_pass_count: int) -> dict[str, Any]:
    """Custody trace. Prompt bodies stay in the comparison document, not here."""
    listed = []
    for capture in captures:
        listed.append(
            {
                "case_id": capture.get("case_id"),
                "disposition": capture.get("disposition"),
                "renderable": capture.get("renderable"),
                "prompt_attached": capture.get("prompt_attached"),
                "claims_pass": False,
                "techniques": list(capture.get("techniques") or []),
                "notes": list(capture.get("notes") or []),
                "spe_prompt_sha256": capture.get("spe_prompt_sha256"),
            }
        )
    return {
        "subject": SUBJECT_ID,
        "core_entry": CORE_ENTRY,
        "network_used": False,
        "provider_calls": 0,
        "scores_emitted": False,
        "marked_pass_count": marked_pass_count,
        "prompts_attached": sum(1 for item in captures if item.get("prompt_attached") is True),
        "prompts_absent": sum(1 for item in captures if item.get("prompt_attached") is not True),
        "captures": listed,
    }
