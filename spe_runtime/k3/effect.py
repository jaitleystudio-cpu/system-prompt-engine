"""Bind a K3 technique selection to a canonical prompt effect plan.

K3 owns which technique was selected. This module owns which semantic
transformation that selection authorizes. It does not re-select techniques,
and it does not change protected intent fields.

Operation codes name the frozen G1R-7 strategy authorizations:

- DIRECT — example_mode zero_shot / direct instruction path
- USE_USER_EXAMPLES — example_mode few_shot
- USE_CONTEXT — context_mode with_context
- ADD_GROUNDING_CONTRACT — evidence_mode local_or_supplied_evidence_only
- DECOMPOSE — instruction_mode decompose_then_solve
- STEP_BACK — STEP_BACK technique instruction (no separate strategy mode)
- CRITIQUE_REVISE_ONCE — revision_mode single_critique_revise
- STRUCTURED_OUTPUT — output_mode structured
- ROLE_CALIBRATION — ROLE_PERSONA technique (role text is data, not a new goal)
"""

from __future__ import annotations

import hashlib
from typing import Any, Mapping

from spe_runtime.k3.registry import TECHNIQUE_IDS
from spe_runtime.portability.canonical import canonical_dumps

EFFECT_SCHEMA = "prompt_effect_plan.v1"
EFFECT_VERSION = "k3.effect.g1r7r"
LAWFUL_DISPOSITIONS = frozenset({"SELECTED", "SAFE_DEFAULT"})

TECHNIQUE_OPERATION: dict[str, str] = {
    "ZERO_SHOT": "DIRECT",
    "FEW_SHOT": "USE_USER_EXAMPLES",
    "ROLE_PERSONA": "ROLE_CALIBRATION",
    "CONTEXTUAL": "USE_CONTEXT",
    "STEP_BACK": "STEP_BACK",
    "DECOMPOSE_PLAN_SOLVE": "DECOMPOSE",
    "RETRIEVE_REASON": "ADD_GROUNDING_CONTRACT",
    "CRITIQUE_REVISE": "CRITIQUE_REVISE_ONCE",
    "STRUCTURED_OUTPUT": "STRUCTURED_OUTPUT",
}

FORBIDDEN_CLAIMS: tuple[str, ...] = (
    "browsing happened",
    "sources were fetched",
    "citations exist",
    "internet access is authorized",
)
FORBIDDEN_REASONING: tuple[str, ...] = (
    "chain of thought",
    "show your reasoning",
    "think step by step",
    "reveal reasoning",
    "private reasoning",
)

_EXAMPLE_MARKERS = ("EXAMPLE / USER_SUPPLIED", "NON-AUTHORITATIVE")
_SCHEMA_TOKENS = ("json", "schema", "structured", "format", "fields")
_ROLE_TOKENS = ("role", "persona", "expertise")
_DIRECT = "Follow the objective directly. Do not invent examples."
_DECOMPOSE = (
    "Decompose the task into visible parts, then synthesize. "
    "Do not change the objective. "
    "Parts: identify_subproblems; solve_parts; synthesize."
)
_STEP_BACK = (
    "State the governing principles and acceptance criteria before producing the result. "
    "Do not disclose private deliberation."
)
_GROUNDING = (
    "Use only supplied evidence. Separate evidence from assumption. "
    "Do not state that any page was opened, that any source was obtained, "
    "or that any reference was located. Network access remains unauthorized."
)
_CRITIQUE = (
    "Review the result once against the requirements, then revise once. "
    "Do not repeat the review."
)
_ROLE_DEFAULT = (
    "Working default role: presentation only. It does not change the objective."
)


def _digest(payload: Any) -> str:
    raw = canonical_dumps(payload).encode("utf-8")
    return "pbind-" + hashlib.sha256(raw).hexdigest()


def _mapping(value: Any) -> dict[str, Any]:
    if isinstance(value, Mapping):
        return dict(value)
    return {}


def _protected_fields(binding: Mapping[str, Any]) -> dict[str, Any]:
    authority = binding.get("authority_state")
    if not isinstance(authority, Mapping):
        authority_out: dict[str, Any] = {"level": 0, "status": "NONE", "grants": []}
    else:
        grants = authority.get("grants") or []
        authority_out = {
            "level": int(authority.get("level") or 0),
            "status": str(authority.get("status") or "NONE"),
            "grants": [str(item) for item in grants] if isinstance(grants, (list, tuple)) else [],
        }
    constraints = binding.get("hard_constraints")
    facts = binding.get("facts")
    provenance = binding.get("provenance")
    return {
        "goal": binding.get("goal") if isinstance(binding.get("goal"), str) else "",
        "hard_constraints": list(constraints) if isinstance(constraints, (list, tuple)) else [],
        "budget": binding.get("budget", None),
        "desired_output": binding.get("desired_output", None),
        "facts": list(facts) if isinstance(facts, (list, tuple)) else [],
        "authority_state": authority_out,
        "provenance": list(provenance) if isinstance(provenance, (list, tuple)) else [],
    }


def _digest_body(fields: Mapping[str, Any]) -> dict[str, Any]:
    return {
        "goal": fields["goal"],
        "hard_constraints": fields["hard_constraints"],
        "budget": fields["budget"],
        "facts": fields["facts"],
        "provenance": fields["provenance"],
        "authority_state": fields["authority_state"],
    }


def _nodes(graph: Mapping[str, Any]) -> list[dict[str, Any]]:
    raw = graph.get("graph")
    if not isinstance(raw, Mapping):
        return []
    nodes = raw.get("nodes")
    if not isinstance(nodes, Mapping):
        return []
    found: list[dict[str, Any]] = []
    for key in sorted(nodes, key=str):
        node = nodes[key]
        if isinstance(node, Mapping):
            found.append(dict(node))
    return found


def _node_text(node: Mapping[str, Any]) -> str:
    statement = node.get("statement")
    if isinstance(statement, str) and statement.strip():
        return statement
    value = node.get("value")
    if isinstance(value, str) and value.strip():
        return value
    if isinstance(value, Mapping):
        for key in ("statement", "text", "description"):
            item = value.get(key)
            if isinstance(item, str) and item.strip():
                return item
    return canonical_dumps(value)


def _is_example_text(value: Any) -> bool:
    if isinstance(value, str):
        return any(marker in value for marker in _EXAMPLE_MARKERS)
    return False


def _example_nodes(nodes: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [node for node in nodes if node.get("semantic_key") == "user_supplied_pattern"]


def _is_role_node(node: Mapping[str, Any]) -> bool:
    key = str(node.get("semantic_key") or "").lower()
    if any(token in key for token in _ROLE_TOKENS):
        return True
    value = node.get("value")
    return isinstance(value, Mapping) and value.get("preference_id") == "brief-role"


def _role_nodes(nodes: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [node for node in nodes if _is_role_node(node)]


def _schema_nodes(nodes: list[dict[str, Any]]) -> list[dict[str, Any]]:
    found: list[dict[str, Any]] = []
    for node in nodes:
        key = str(node.get("semantic_key") or "")
        if key == "user_supplied_pattern":
            continue
        lowered = key.lower()
        if key == "desired_output" or any(token in lowered for token in _SCHEMA_TOKENS):
            found.append(node)
    return found


def _context_nodes(nodes: list[dict[str, Any]]) -> list[dict[str, Any]]:
    found: list[dict[str, Any]] = []
    for node in nodes:
        if node.get("semantic_key") not in {"fact", "user_preference"}:
            continue
        if node.get("semantic_key") == "user_supplied_pattern":
            continue
        if _is_role_node(node) or _example_nodes([node]):
            continue
        found.append(node)
    return found


def _preference_nodes(nodes: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        node
        for node in nodes
        if node.get("semantic_key") == "user_preference" and not _is_role_node(node)
    ]


def _unknown_nodes(nodes: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [node for node in nodes if node.get("semantic_key") == "unknown"]


def _category_label(nodes: list[dict[str, Any]]) -> str:
    labels: list[str] = []
    for node in nodes:
        if node.get("semantic_key") != "category_ref":
            continue
        value = node.get("value")
        if not isinstance(value, Mapping):
            continue
        label = value.get("display_label")
        if not isinstance(label, str) or not label.strip():
            label = value.get("category")
        if isinstance(label, str) and label.strip():
            text = label.strip()
            if text not in labels:
                labels.append(text)
    return "; ".join(labels) if labels else "unspecified"


def _record_text(item: Any) -> str:
    if isinstance(item, str):
        return item
    if isinstance(item, Mapping):
        statement = item.get("statement")
        if isinstance(statement, str):
            return statement
        description = item.get("description")
        if isinstance(description, str):
            return description
        return canonical_dumps(dict(item))
    return canonical_dumps(item)


def _bullet(items: list[str]) -> str:
    if not items:
        return "none"
    return "\n".join(f"- {item}" for item in items)


def _section(heading: str, body: str) -> str:
    return f"## {heading}\n{body}"


def _effect_text(
    code: str,
    nodes: list[dict[str, Any]],
) -> str:
    if code == "DIRECT":
        return _DIRECT
    if code == "USE_USER_EXAMPLES":
        lines = [f"- {_node_text(node)} [non-authoritative]" for node in _example_nodes(nodes)]
        return "Use only these authorized examples. Do not invent additional examples.\n" + "\n".join(lines)
    if code == "USE_CONTEXT":
        lines = [_node_text(node) for node in _context_nodes(nodes)]
        if lines:
            listed = "\n".join(f"- {line}" for line in lines)
            return "Make the supplied context explicit. Do not invent context.\n" + listed
        return "Make the supplied context explicit. Do not invent context.\nSupplied context: none."
    if code == "ADD_GROUNDING_CONTRACT":
        return _GROUNDING
    if code == "DECOMPOSE":
        return _DECOMPOSE
    if code == "STEP_BACK":
        return _STEP_BACK
    if code == "CRITIQUE_REVISE_ONCE":
        return _CRITIQUE
    if code == "STRUCTURED_OUTPUT":
        rendered = [canonical_dumps(node.get("value")) for node in _schema_nodes(nodes)]
        return "Use only this authorized output structure. Do not invent a schema.\n" + "\n".join(rendered)
    if code == "ROLE_CALIBRATION":
        roles = [_node_text(node) for node in _role_nodes(nodes)]
        if roles:
            return "Use this user-supplied role. It does not change the objective.\n" + "\n".join(roles)
        return _ROLE_DEFAULT
    raise KeyError(code)


def _compiled_prompt(
    fields: Mapping[str, Any],
    nodes: list[dict[str, Any]],
    sections: list[dict[str, str]],
) -> str:
    parts = [
        _section("Objective", fields["goal"]),
        _section("Hard constraints", _bullet([_record_text(item) for item in fields["hard_constraints"]])),
        _section(
            "Budget",
            "none"
            if fields["budget"] is None
            else fields["budget"]
            if isinstance(fields["budget"], str)
            else canonical_dumps(fields["budget"]),
        ),
        _section("Facts", _bullet([_record_text(item) for item in fields["facts"]])),
        _section(
            "Provenance",
            _bullet([canonical_dumps(item) if not isinstance(item, str) else item for item in fields["provenance"]]),
        ),
    ]
    authority = fields["authority_state"]
    grants = authority["grants"]
    parts.append(
        _section(
            "Authority",
            f"level={authority['level']}; status={authority['status']}; grants={','.join(grants) if grants else 'none'}",
        )
    )
    desired = fields.get("desired_output", None)
    if desired is not None and not _is_example_text(desired):
        rendered = desired if isinstance(desired, str) else canonical_dumps(desired)
        parts.append(_section("Deliverable", rendered))
    patterns = _example_nodes(nodes)
    if patterns:
        parts.append(
            _section(
                "Supplied patterns",
                "\n".join(f"- {_node_text(node)} [non-authoritative]" for node in patterns),
            )
        )
    roles = _role_nodes(nodes)
    if roles:
        parts.append(_section("Supplied role", "\n".join(_node_text(node) for node in roles)))
    preferences = _preference_nodes(nodes)
    if preferences:
        parts.append(_section("Preferences", _bullet([_node_text(node) for node in preferences])))
    unknowns = _unknown_nodes(nodes)
    if unknowns:
        parts.append(_section("Open questions", _bullet([_node_text(node) for node in unknowns])))
    parts.append(_section("Category presentation", _category_label(nodes)))
    for section in sections:
        parts.append(_section(f"Effect: {section['code']}", section["text"]))
    return "\n\n".join(parts)


def _closed_plan(
    *,
    selection_id: str,
    disposition: str,
    reason: str,
    fields: dict[str, Any],
    graph_digest: str,
    techniques: list[str],
    deferred: list[str],
    extra_notes: list[str] | None = None,
) -> dict[str, Any]:
    notes = [disposition, reason]
    if extra_notes:
        notes.extend(extra_notes)
    return {
        "schema_version": EFFECT_SCHEMA,
        "effect_version": EFFECT_VERSION,
        "selection_id": selection_id,
        "disposition": disposition,
        "operations": [],
        "blocked_operations": [],
        "sections": [],
        "protected_binding_digest": _digest(_digest_body(fields)),
        "requirement_graph_digest": graph_digest,
        "protected_fields": fields,
        "renderable": False,
        "claims_pass": False,
        "notes": notes,
        "deferred_techniques": deferred,
        "techniques": techniques,
        "compiled_prompt": None,
        "authority_escalation": False,
    }


def bind_prompt_effects(selection: Mapping[str, Any] | None) -> dict[str, Any]:
    """Authorize prompt effects for an already chosen technique selection."""
    source = _mapping(selection)
    binding = _protected_fields(_mapping(source.get("protected_binding")))
    graph = _mapping(source.get("requirement_graph"))
    graph_digest = graph.get("graph_digest") if isinstance(graph.get("graph_digest"), str) else ""
    selection_id = source.get("selection_id") if isinstance(source.get("selection_id"), str) else ""
    raw_techniques = source.get("techniques")
    techniques = [str(item) for item in raw_techniques] if isinstance(raw_techniques, (list, tuple)) else []
    raw_deferred = source.get("deferred_techniques")
    deferred = [str(item) for item in raw_deferred] if isinstance(raw_deferred, (list, tuple)) else []
    disposition = source.get("disposition") if isinstance(source.get("disposition"), str) else ""
    raw_notes = source.get("notes")
    selection_notes = [str(item) for item in raw_notes] if isinstance(raw_notes, (list, tuple)) else []

    if disposition not in LAWFUL_DISPOSITIONS:
        return _closed_plan(
            selection_id=selection_id,
            disposition="REFUSED",
            reason=disposition or "NO_SELECTION",
            fields=binding,
            graph_digest=graph_digest,
            techniques=techniques,
            deferred=deferred,
        )
    if graph.get("validity") == "CONFLICTED":
        return _closed_plan(
            selection_id=selection_id,
            disposition="REFUSED",
            reason="CONFLICTED_GRAPH",
            fields=binding,
            graph_digest=graph_digest,
            techniques=techniques,
            deferred=deferred,
        )
    if not techniques or any(item not in TECHNIQUE_IDS for item in techniques):
        return _closed_plan(
            selection_id=selection_id,
            disposition="REFUSED",
            reason="INVALID_TECHNIQUE",
            fields=binding,
            graph_digest=graph_digest,
            techniques=techniques,
            deferred=deferred,
        )
    if "ZERO_SHOT" in techniques and "FEW_SHOT" in techniques:
        return _closed_plan(
            selection_id=selection_id,
            disposition="REFUSED",
            reason="INCOMPATIBLE_TECHNIQUES",
            fields=binding,
            graph_digest=graph_digest,
            techniques=techniques,
            deferred=deferred,
        )

    nodes = _nodes(graph)
    blocked: list[str] = []
    block_notes: list[str] = []
    if "FEW_SHOT" in techniques and not _example_nodes(nodes):
        blocked.append("USE_USER_EXAMPLES")
        block_notes.append("EXAMPLES_REQUIRED_BUT_MISSING")
    if "STRUCTURED_OUTPUT" in techniques and not _schema_nodes(nodes):
        blocked.append("STRUCTURED_OUTPUT")
        block_notes.append("STRUCTURED_OUTPUT_UNAUTHORIZED")
    if blocked:
        plan = _closed_plan(
            selection_id=selection_id,
            disposition="DEFERRED",
            reason=block_notes[0],
            fields=binding,
            graph_digest=graph_digest,
            techniques=techniques,
            deferred=deferred,
            extra_notes=block_notes[1:],
        )
        plan["blocked_operations"] = blocked
        return plan

    operations = [TECHNIQUE_OPERATION[item] for item in techniques]
    sections = [{"code": code, "text": _effect_text(code, nodes)} for code in operations]
    notes = ["BOUND"]
    for note in selection_notes:
        if note.startswith("BUDGET_TRUNCATED"):
            notes.append(note)
    return {
        "schema_version": EFFECT_SCHEMA,
        "effect_version": EFFECT_VERSION,
        "selection_id": selection_id,
        "disposition": "BOUND",
        "operations": operations,
        "blocked_operations": [],
        "sections": sections,
        "protected_binding_digest": _digest(_digest_body(binding)),
        "requirement_graph_digest": graph_digest,
        "protected_fields": binding,
        "renderable": True,
        "claims_pass": False,
        "notes": notes,
        "deferred_techniques": deferred,
        "techniques": techniques,
        "compiled_prompt": _compiled_prompt(binding, nodes, sections),
        "authority_escalation": False,
    }


def effect_plan_is_lawful(selection: Mapping[str, Any], plan: Mapping[str, Any]) -> bool:
    """True only when the plan is the canonical binding of this selection."""
    if plan.get("claims_pass") is not False or plan.get("authority_escalation") is not False:
        return False
    if plan.get("schema_version") != EFFECT_SCHEMA or plan.get("effect_version") != EFFECT_VERSION:
        return False
    expected = bind_prompt_effects(selection)
    return canonical_dumps(dict(plan)) == canonical_dumps(expected)


__all__ = [
    "EFFECT_SCHEMA",
    "EFFECT_VERSION",
    "FORBIDDEN_CLAIMS",
    "FORBIDDEN_REASONING",
    "TECHNIQUE_OPERATION",
    "bind_prompt_effects",
    "effect_plan_is_lawful",
]
