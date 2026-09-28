"""Canonical K3 technique selector.

Sole writer: select_prompt_techniques.
Laws: proofs/k3_runtime_closure_20260929/K3_CONTRACT_RECOVERY.md
"""

from __future__ import annotations

import hashlib
from typing import Any, Mapping

from spe_runtime.k3.registry import (
    DISPLAY_LABEL_PROTOCOL,
    DISPLAY_LABEL_XCAT,
    IMPLEMENTED_XCAT,
    INSTRUCTION_MODE,
    KEY_HINTS,
    PLAN_SCHEMA_VERSION,
    PLAN_STEPS,
    SCHEMA_VERSION,
    SELECTOR_VERSION,
    STANDARD_MAX_TECHNIQUES,
    STRATEGY_SCHEMA_VERSION,
    STRENGTH_RANK,
    TECHNIQUE_IDS,
    TECHNIQUE_PRIORITY,
)
from spe_runtime.portability.canonical import canonical_dumps
from spe_runtime.protocols.registry import list_protocol_domains

_PROTOCOL_DOMAINS = frozenset(list_protocol_domains())
_COMPLEXITY = frozenset({"SIMPLE", "STANDARD", "COMPLEX"})


def _digest(payload: Any, prefix: str) -> str:
    raw = canonical_dumps(payload).encode("utf-8")
    return prefix + hashlib.sha256(raw).hexdigest()


def _mapping(value: Any) -> dict[str, Any]:
    if isinstance(value, Mapping):
        return dict(value)
    return {}


def _strip(value: Any) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str):
        return None
    text = value.strip()
    return text or None


def _bool_flag(value: Any) -> bool | None:
    if value is None:
        return None
    if isinstance(value, bool):
        return value
    return None


def _atoms(task: Mapping[str, Any]) -> tuple[dict[str, str], ...]:
    raw = task.get("semantic_atoms") or ()
    if not isinstance(raw, (list, tuple)):
        return ()
    atoms: list[dict[str, str]] = []
    for item in raw:
        if not isinstance(item, Mapping):
            continue
        rid = str(item.get("requirement_id") or "").strip()
        key = str(item.get("semantic_key") or "").strip()
        kind = str(item.get("kind") or "").strip().upper()
        if not rid or not key or kind not in {"MUST", "MUST_NOT", "SHOULD", "PREFERENCE"}:
            continue
        atoms.append({"requirement_id": rid, "semantic_key": key, "kind": kind})
    atoms.sort(key=lambda a: a["requirement_id"])
    return tuple(atoms)


def _kind_strength(kind: str) -> str:
    if kind in {"MUST", "MUST_NOT"}:
        return "MUST"
    if kind == "SHOULD":
        return "SHOULD"
    return "PREFERENCE"


def _best_strength(atoms: tuple[dict[str, str], ...], technique: str) -> tuple[str | None, tuple[str, ...]]:
    tokens = KEY_HINTS.get(technique, ())
    if not tokens:
        return None, ()
    best: str | None = None
    refs: list[str] = []
    for atom in atoms:
        key = atom["semantic_key"].lower()
        if any(tok in key for tok in tokens):
            strength = _kind_strength(atom["kind"])
            refs.append(atom["requirement_id"])
            if best is None or STRENGTH_RANK[strength] < STRENGTH_RANK[best]:
                best = strength
    return best, tuple(sorted(refs))


def _resolve_strength(
    atoms: tuple[dict[str, str], ...],
    technique: str,
    fallback: str,
) -> tuple[str, tuple[str, ...]]:
    best, refs = _best_strength(atoms, technique)
    if best is not None:
        return best, refs
    return fallback, ()


def _protected_view(protected: Mapping[str, Any]) -> dict[str, Any]:
    authority = protected.get("authority_state")
    if not isinstance(authority, Mapping):
        authority_out: dict[str, Any] = {"level": 0, "status": "NONE", "grants": []}
    else:
        grants = authority.get("grants") or []
        authority_out = {
            "level": int(authority.get("level") or 0),
            "status": str(authority.get("status") or "NONE"),
            "grants": [str(g) for g in grants] if isinstance(grants, (list, tuple)) else [],
        }
    constraints = protected.get("hard_constraints")
    facts = protected.get("facts")
    provenance = protected.get("provenance")
    return {
        "goal": protected.get("goal") if isinstance(protected.get("goal"), str) else "",
        "hard_constraints": list(constraints) if isinstance(constraints, (list, tuple)) else [],
        "budget": protected.get("budget", None),
        "desired_output": protected.get("desired_output", None),
        "facts": list(facts) if isinstance(facts, (list, tuple)) else [],
        "authority_state": authority_out,
        "provenance": list(provenance) if isinstance(provenance, (list, tuple)) else [],
    }


def _has_conflict(protected: Mapping[str, Any]) -> bool:
    conflicts = protected.get("conflicts")
    if isinstance(conflicts, (list, tuple)) and len(conflicts) > 0:
        return True
    constraints = protected.get("hard_constraints")
    if not isinstance(constraints, (list, tuple)):
        return False
    for item in constraints:
        if isinstance(item, Mapping):
            statement = item.get("statement")
            if isinstance(statement, str) and statement.startswith("[CONFLICT]"):
                return True
        elif isinstance(item, str) and item.startswith("[CONFLICT]"):
            return True
    return False


def _resolve_category(category: Mapping[str, Any]) -> dict[str, Any]:
    display = _strip(category.get("display_label"))
    xcat = _strip(category.get("xcat_id"))
    protocol = _strip(category.get("protocol_domain_id"))
    if xcat is None and display in DISPLAY_LABEL_XCAT:
        xcat = DISPLAY_LABEL_XCAT[display]
    if protocol is None and display in DISPLAY_LABEL_PROTOCOL:
        protocol = DISPLAY_LABEL_PROTOCOL[display]
    implemented: bool | None
    if xcat is None:
        implemented = None
    else:
        implemented = xcat in IMPLEMENTED_XCAT
    known: bool | None
    if protocol is None:
        known = None
    else:
        known = protocol in _PROTOCOL_DOMAINS
    return {
        "xcat_id": xcat,
        "xcat_implemented": implemented,
        "protocol_domain_id": protocol,
        "protocol_domain_known": known,
        "display_label": display,
    }


def _resolve_task(task: Mapping[str, Any], xcat_id: str | None) -> dict[str, Any]:
    retrieval_default = xcat_id == "CAT:C02"
    execution_default = xcat_id == "CAT:C07"

    def flag(name: str, default: bool) -> bool:
        parsed = _bool_flag(task.get(name))
        return default if parsed is None else parsed

    complexity = task.get("complexity_class")
    if not isinstance(complexity, str) or complexity.strip().upper() not in _COMPLEXITY:
        complexity_out = "STANDARD"
    else:
        complexity_out = complexity.strip().upper()
    example_count = task.get("example_count", 0)
    try:
        count = int(example_count)
    except (TypeError, ValueError):
        count = 0
    if count < 0:
        count = 0
    role = task.get("role_label")
    role_out = role if isinstance(role, str) and role else None
    return {
        "needs_decomposition": flag("needs_decomposition", False),
        "needs_retrieval": flag("needs_retrieval", retrieval_default),
        "needs_comparison": flag("needs_comparison", False),
        "needs_revision": flag("needs_revision", False),
        "needs_structured_output": flag("needs_structured_output", False),
        "needs_examples": flag("needs_examples", False),
        "needs_execution_prep": flag("needs_execution_prep", execution_default),
        "has_context": flag("has_context", False),
        "role_label": role_out,
        "example_count": count,
        "complexity_class": complexity_out,
        "force_zero_shot": bool(task.get("force_zero_shot") is True),
        "ambiguous": bool(task.get("ambiguous") is True),
        "semantic_atoms": [dict(a) for a in _atoms(task)],
    }


def _select_kind(task: Mapping[str, Any]) -> tuple[str, str]:
    if task["needs_retrieval"]:
        return "RETRIEVE_THEN_REASON", "HINT_NEEDS_RETRIEVAL"
    if task["needs_comparison"]:
        return "COMPARE", "HINT_NEEDS_COMPARISON"
    if task["needs_revision"]:
        return "CRITIQUE_REVISE", "HINT_NEEDS_REVISION"
    if task["needs_decomposition"]:
        return "DECOMPOSE", "HINT_NEEDS_DECOMPOSITION"
    if task["needs_execution_prep"]:
        return "PLAN_THEN_EXECUTE", "HINT_NEEDS_EXECUTION_PREP"
    if task["needs_structured_output"] and task["complexity_class"] != "SIMPLE":
        return "STRUCTURED_ANALYSIS", "HINT_NEEDS_STRUCTURED_OUTPUT"
    return "DIRECT", "HINT_DIRECT_DEFAULT"


def _justification(
    technique: str,
    reason: str,
    refs: tuple[str, ...],
    strength: str,
) -> dict[str, Any]:
    return {
        "technique": technique,
        "reason_code": reason,
        "source_refs": list(refs),
        "strength": strength,
    }


def _candidates(
    task: Mapping[str, Any],
    atoms: tuple[dict[str, str], ...],
    plan_kind: str,
    plan_ref: str,
) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    if task["needs_examples"] and task["example_count"] > 0:
        strength, refs = _resolve_strength(atoms, "FEW_SHOT", "HINT")
        out.append(
            _justification(
                "FEW_SHOT",
                "EXAMPLES_SUPPLIED",
                (plan_ref, "hint:needs_examples", *refs),
                strength,
            )
        )
    elif not task["needs_examples"]:
        out.append(
            _justification(
                "ZERO_SHOT",
                "NO_EXAMPLES_REQUIRED",
                (plan_ref,),
                "PLAN",
            )
        )
    if task["has_context"]:
        strength, refs = _resolve_strength(atoms, "CONTEXTUAL", "HINT")
        out.append(
            _justification(
                "CONTEXTUAL",
                "CONTEXT_SUPPLIED",
                (plan_ref, "hint:has_context", *refs),
                strength,
            )
        )
    if task["role_label"]:
        strength, refs = _resolve_strength(atoms, "ROLE_PERSONA", "HINT")
        role_ref = f"hint:role_len:{len(task['role_label'])}"
        out.append(
            _justification(
                "ROLE_PERSONA",
                "ROLE_LABEL_SUPPLIED",
                (plan_ref, role_ref, *refs),
                strength,
            )
        )
    if plan_kind in {"DECOMPOSE", "PLAN_THEN_EXECUTE", "RETRIEVE_THEN_REASON"} or task["complexity_class"] == "COMPLEX":
        out.append(
            _justification(
                "STEP_BACK",
                "PLAN_BENEFITS_FROM_PRINCIPLES_FIRST",
                (plan_ref, f"plan_kind:{plan_kind}"),
                "PLAN",
            )
        )
    if plan_kind in {"DECOMPOSE", "PLAN_THEN_EXECUTE"}:
        strength, refs = _resolve_strength(atoms, "DECOMPOSE_PLAN_SOLVE", "PLAN")
        out.append(
            _justification(
                "DECOMPOSE_PLAN_SOLVE",
                "PLAN_REQUIRES_STAGED_SOLVE",
                (plan_ref, f"plan_kind:{plan_kind}", *refs),
                strength,
            )
        )
    requires_evidence = bool(task["needs_retrieval"] or plan_kind == "RETRIEVE_THEN_REASON")
    if requires_evidence:
        strength, refs = _resolve_strength(atoms, "RETRIEVE_REASON", "HINT")
        out.append(
            _justification(
                "RETRIEVE_REASON",
                "EVIDENCE_OR_RESEARCH_REQUIRED",
                (plan_ref, "plan:requires_evidence", *refs),
                strength,
            )
        )
    if plan_kind == "CRITIQUE_REVISE" or task["needs_revision"]:
        strength, refs = _resolve_strength(atoms, "CRITIQUE_REVISE", "HINT")
        out.append(
            _justification(
                "CRITIQUE_REVISE",
                "REVISION_REQUIRED",
                (plan_ref, "hint:needs_revision", *refs),
                strength,
            )
        )
    requires_structured = bool(
        task["needs_structured_output"] or plan_kind == "STRUCTURED_ANALYSIS"
    )
    if requires_structured:
        strength, refs = _resolve_strength(atoms, "STRUCTURED_OUTPUT", "HINT")
        out.append(
            _justification(
                "STRUCTURED_OUTPUT",
                "STRUCTURED_OUTPUT_REQUIRED",
                (plan_ref, "hint:needs_structured_output", *refs),
                strength,
            )
        )
    return out


def _strategy(
    plan_id: str,
    plan_kind: str,
    techniques: list[str],
    selection_id: str,
    task: Mapping[str, Any],
    notes: list[str],
) -> dict[str, Any]:
    tech = set(techniques)
    context_mode = "with_context" if "CONTEXTUAL" in tech or task["has_context"] else "no_context"
    evidence_mode = (
        "local_or_supplied_evidence_only" if "RETRIEVE_REASON" in tech else "no_retrieval"
    )
    if "FEW_SHOT" in tech:
        example_mode = "few_shot"
    elif "EXAMPLES_REQUIRED_BUT_MISSING" in notes:
        example_mode = "examples_required_missing"
    else:
        example_mode = "zero_shot"
    output_mode = "structured" if "STRUCTURED_OUTPUT" in tech else "prose_or_unspecified"
    revision_mode = "single_critique_revise" if "CRITIQUE_REVISE" in tech else "none"
    payload = {
        "cognitive_plan_id": plan_id,
        "instruction_mode": INSTRUCTION_MODE[plan_kind],
        "context_mode": context_mode,
        "evidence_mode": evidence_mode,
        "example_mode": example_mode,
        "output_mode": output_mode,
        "revision_mode": revision_mode,
        "selected_technique_ids": list(techniques),
        "technique_selection_id": selection_id,
        "schema_version": STRATEGY_SCHEMA_VERSION,
    }
    return {
        "strategy_id": _digest(payload, "pstrategy-"),
        **payload,
    }


def _closed(
    *,
    disposition: str,
    notes: list[str],
    category_context: dict[str, Any],
    protected_binding: dict[str, Any],
    inputs_digest: str,
    task_resolved: dict[str, Any] | None,
) -> dict[str, Any]:
    payload = {
        "schema_version": SCHEMA_VERSION,
        "cognitive_plan_id": None,
        "techniques": [],
        "justifications": [],
        "deferred_techniques": [],
        "budget_truncated": False,
        "notes": list(notes),
    }
    return _envelope(
        disposition=disposition,
        selection_id=_digest(payload, "tsel-"),
        cognitive_plan_id=None,
        techniques=[],
        justifications=[],
        deferred=[],
        budget_truncated=False,
        notes=notes,
        strategy=None,
        category_context=category_context,
        protected_binding=protected_binding,
        inputs_digest=inputs_digest,
        task_resolved=task_resolved or {},
    )


def _envelope(
    *,
    disposition: str,
    selection_id: str,
    cognitive_plan_id: str | None,
    techniques: list[str],
    justifications: list[dict[str, Any]],
    deferred: list[str],
    budget_truncated: bool,
    notes: list[str],
    strategy: dict[str, Any] | None,
    category_context: dict[str, Any],
    protected_binding: dict[str, Any],
    inputs_digest: str,
    task_resolved: dict[str, Any],
) -> dict[str, Any]:
    return {
        "schema_version": SCHEMA_VERSION,
        "selector_version": SELECTOR_VERSION,
        "selection_id": selection_id,
        "cognitive_plan_id": cognitive_plan_id,
        "disposition": disposition,
        "techniques": list(techniques),
        "justifications": justifications,
        "deferred_techniques": list(deferred),
        "budget_truncated": budget_truncated,
        "notes": list(notes),
        "claims_pass": False,
        "network_enabled": False,
        "execution_authorized": False,
        "credentials_granted": False,
        "sharing_approved": False,
        "external_write_authorized": False,
        "authority_effects": [],
        "category_context": category_context,
        "strategy": strategy,
        "protected_binding": protected_binding,
        "inputs_digest": inputs_digest,
        "task_resolved": task_resolved,
    }


def select_prompt_techniques(
    protected: Mapping[str, Any] | None = None,
    category: Mapping[str, Any] | None = None,
    task: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    """Sole canonical prompt-technique selector."""
    protected_in = _mapping(protected)
    category_in = _mapping(category)
    task_in = _mapping(task)
    binding = _protected_view(protected_in)
    context = _resolve_category(category_in)
    inputs_digest = _digest(
        {"category": context, "task": _public_task_for_digest(task_in, context["xcat_id"])},
        "idigest-",
    )

    xcat = context["xcat_id"]
    if xcat is not None and xcat not in IMPLEMENTED_XCAT:
        return _closed(
            disposition="NO_SELECTION",
            notes=["NO_SELECTION", "CATEGORY_NOT_IMPLEMENTED", "UNKNOWN"],
            category_context=context,
            protected_binding=binding,
            inputs_digest=inputs_digest,
            task_resolved={},
        )
    if context["protocol_domain_id"] is not None and context["protocol_domain_known"] is False:
        return _closed(
            disposition="UNKNOWN",
            notes=["UNKNOWN", "PROTOCOL_DOMAIN_UNKNOWN"],
            category_context=context,
            protected_binding=binding,
            inputs_digest=inputs_digest,
            task_resolved={},
        )
    if _has_conflict(protected_in):
        return _closed(
            disposition="UNKNOWN",
            notes=["UNKNOWN", "CONFLICTING_INPUTS"],
            category_context=context,
            protected_binding=binding,
            inputs_digest=inputs_digest,
            task_resolved={},
        )

    resolved = _resolve_task(task_in, xcat)
    if resolved["ambiguous"]:
        return _closed(
            disposition="UNKNOWN",
            notes=["UNKNOWN", "AMBIGUOUS_TASK"],
            category_context=context,
            protected_binding=binding,
            inputs_digest=inputs_digest,
            task_resolved=resolved,
        )
    if resolved["force_zero_shot"] and resolved["needs_examples"]:
        return _closed(
            disposition="UNKNOWN",
            notes=["UNKNOWN", "CONFLICTING_INPUTS"],
            category_context=context,
            protected_binding=binding,
            inputs_digest=inputs_digest,
            task_resolved=resolved,
        )

    atoms = tuple(resolved["semantic_atoms"])
    plan_kind, plan_reason = _select_kind(resolved)
    req_ids = [a["requirement_id"] for a in atoms]
    protected_ids = [a["requirement_id"] for a in atoms if a["kind"] in {"MUST", "MUST_NOT"}]
    requires_evidence = bool(resolved["needs_retrieval"] or plan_kind == "RETRIEVE_THEN_REASON")
    requires_structured = bool(
        resolved["needs_structured_output"] or plan_kind == "STRUCTURED_ANALYSIS"
    )
    plan_stub = {
        "plan_kind": plan_kind,
        "requirement_ids": req_ids,
        "ordered_steps": list(PLAN_STEPS[plan_kind]),
        "reason_codes": [plan_reason],
        "complexity_class": resolved["complexity_class"],
        "requires_evidence": requires_evidence,
        "requires_examples": resolved["needs_examples"],
        "requires_structured_output": requires_structured,
        "protected_requirement_ids": protected_ids,
        "schema_version": PLAN_SCHEMA_VERSION,
    }
    plan_id = _digest(plan_stub, "cplan-")
    plan_ref = f"plan:{plan_id}"
    notes: list[str] = []
    if resolved["needs_examples"] and resolved["example_count"] <= 0:
        notes.append("EXAMPLES_REQUIRED_BUT_MISSING")

    raw = _candidates(resolved, atoms, plan_kind, plan_ref)
    seen: set[str] = set()
    unique: list[dict[str, Any]] = []
    for item in raw:
        tech = item["technique"]
        if tech in seen:
            continue
        if tech not in TECHNIQUE_IDS:
            return _closed(
                disposition="UNKNOWN",
                notes=["UNKNOWN", "INVALID_TECHNIQUE"],
                category_context=context,
                protected_binding=binding,
                inputs_digest=inputs_digest,
                task_resolved=resolved,
            )
        seen.add(tech)
        unique.append(item)
    if "ZERO_SHOT" in seen and "FEW_SHOT" in seen:
        return _closed(
            disposition="UNKNOWN",
            notes=["UNKNOWN", "K3_TECHNIQUE_INCOMPATIBLE"],
            category_context=context,
            protected_binding=binding,
            inputs_digest=inputs_digest,
            task_resolved=resolved,
        )

    unique.sort(
        key=lambda item: (
            STRENGTH_RANK[item["strength"]],
            TECHNIQUE_PRIORITY[item["technique"]],
            item["technique"],
        )
    )
    budget_truncated = len(unique) > STANDARD_MAX_TECHNIQUES
    kept = unique[:STANDARD_MAX_TECHNIQUES]
    deferred = [item["technique"] for item in unique[STANDARD_MAX_TECHNIQUES:]]
    if budget_truncated:
        notes.append(f"BUDGET_TRUNCATED_MAX_{STANDARD_MAX_TECHNIQUES}")
        kept_ranks = {STRENGTH_RANK[item["strength"]] for item in kept}
        for item in unique[STANDARD_MAX_TECHNIQUES:]:
            if item["strength"] == "MUST" and any(rank > STRENGTH_RANK["MUST"] for rank in kept_ranks):
                return _closed(
                    disposition="UNKNOWN",
                    notes=["UNKNOWN", "K3_STRATEGY_INVARIANT_VIOLATION"],
                    category_context=context,
                    protected_binding=binding,
                    inputs_digest=inputs_digest,
                    task_resolved=resolved,
                )

    techniques = [item["technique"] for item in kept]
    if not techniques:
        closed_notes = ["UNKNOWN", *notes]
        return _closed(
            disposition="UNKNOWN",
            notes=closed_notes,
            category_context=context,
            protected_binding=binding,
            inputs_digest=inputs_digest,
            task_resolved=resolved,
        )

    safe = (
        plan_kind == "DIRECT"
        and techniques == ["ZERO_SHOT"]
        and not budget_truncated
        and not notes
    )
    disposition = "SAFE_DEFAULT" if safe else "SELECTED"
    full_notes = [disposition, plan_reason, *notes]
    payload = {
        "schema_version": SCHEMA_VERSION,
        "cognitive_plan_id": plan_id,
        "techniques": techniques,
        "justifications": kept,
        "deferred_techniques": deferred,
        "budget_truncated": budget_truncated,
        "notes": full_notes,
    }
    selection_id = _digest(payload, "tsel-")
    strategy = _strategy(plan_id, plan_kind, techniques, selection_id, resolved, full_notes)
    return _envelope(
        disposition=disposition,
        selection_id=selection_id,
        cognitive_plan_id=plan_id,
        techniques=techniques,
        justifications=kept,
        deferred=deferred,
        budget_truncated=budget_truncated,
        notes=full_notes,
        strategy=strategy,
        category_context=context,
        protected_binding=binding,
        inputs_digest=inputs_digest,
        task_resolved=resolved,
    )


def _public_task_for_digest(task: Mapping[str, Any], xcat_id: str | None) -> dict[str, Any]:
    resolved = _resolve_task(task, xcat_id)
    return resolved


select_k3 = select_prompt_techniques

CANONICAL_SELECTOR = "select_prompt_techniques"


def selection_digest_payload(result: Mapping[str, Any]) -> dict[str, Any]:
    return {
        "schema_version": result.get("schema_version"),
        "cognitive_plan_id": result.get("cognitive_plan_id"),
        "techniques": list(result.get("techniques") or []),
        "justifications": list(result.get("justifications") or []),
        "deferred_techniques": list(result.get("deferred_techniques") or []),
        "budget_truncated": bool(result.get("budget_truncated")),
        "notes": list(result.get("notes") or []),
    }


def selection_is_accepted(result: Mapping[str, Any]) -> bool:
    """Lawful selector completion. Non-empty is not enough. Never a task pass."""
    if result.get("schema_version") != SCHEMA_VERSION:
        return False
    if result.get("selector_version") != SELECTOR_VERSION:
        return False
    disposition = result.get("disposition")
    if disposition not in {"SELECTED", "SAFE_DEFAULT"}:
        return False
    if result.get("claims_pass") is not False:
        return False
    if result.get("network_enabled") is not False:
        return False
    if result.get("execution_authorized") is not False:
        return False
    if result.get("credentials_granted") is not False:
        return False
    if result.get("sharing_approved") is not False:
        return False
    if result.get("external_write_authorized") is not False:
        return False
    if result.get("authority_effects") not in ([], ()):
        return False
    techniques = result.get("techniques")
    if not isinstance(techniques, list) or not techniques:
        return False
    if any(tech not in TECHNIQUE_IDS for tech in techniques):
        return False
    deferred = result.get("deferred_techniques") or []
    if any(tech not in TECHNIQUE_IDS for tech in deferred):
        return False
    if "ZERO_SHOT" in techniques and "FEW_SHOT" in techniques:
        return False
    if disposition == "SAFE_DEFAULT" and techniques != ["ZERO_SHOT"]:
        return False
    if disposition == "UNKNOWN" or "UNKNOWN" in (result.get("notes") or []):
        return False
    expected = _digest(selection_digest_payload(result), "tsel-")
    if result.get("selection_id") != expected:
        return False
    justifications = result.get("justifications") or []
    justified = [item.get("technique") for item in justifications if isinstance(item, Mapping)]
    if justified != techniques:
        return False
    return True
