"""Deterministic obligation evaluation, quality delta, and Plan B.

Quality Delta reports obligation movement. It does not emit a global score.
Plan B applies at most one lawful repair from the registry, then re-evaluates.
VALIDATE_ONLY never performs an external effect.
"""

from __future__ import annotations

import hashlib
import re
from typing import Any, Mapping

from spe_runtime.portability.canonical import canonical_dumps

DELTA_VERSION = "spe.quality_delta.v1"
RECONSTRUCTION_VERSION = "spe.reconstruction_plan.v1"
RECEIPT_VERSION = "spe.validation_receipt.v1"
MAX_AUTOMATIC_ATTEMPTS = 1

OBLIGATION_STATUSES = (
    "SATISFIED",
    "UNSATISFIED",
    "CONFLICT",
    "UNKNOWN",
    "NOT_APPLICABLE",
)
DISPOSITIONS = ("IMPROVED", "NON_INFERIOR", "REGRESSED", "UNRESOLVED")
MODES = ("DRY_RUN", "VALIDATE_ONLY", "EXECUTE")
REPAIR_OPERATIONS = (
    "RESTORE_MISSING_CONSTRAINT",
    "RESTORE_UNKNOWN_MARKER",
    "RESTORE_REQUIRED_SECTION",
    "RENDER_FROM_BOUND_EFFECT_PLAN",
    "RESTORE_AUTHORIZED_OUTPUT_CONTRACT",
    "REMOVE_UNAUTHORIZED_ADDITION",
)
FORBIDDEN_REPAIRS = (
    "CHANGE_USER_GOAL",
    "INVENT_FACT",
    "INVENT_EXAMPLE",
    "INVENT_RETRIEVAL_RESULT",
    "MINT_AUTHORITY",
    "CHANGE_CATEGORY",
    "CHANGE_K3_TECHNIQUE",
    "EXECUTE_TOOL",
    "WEAKEN_CONSTRAINT",
)
PROOF_CLASSES = (
    "DECLARED_POLICY",
    "ENFORCEMENT_AVAILABLE",
    "ENFORCEMENT_VERIFIED",
    "EXECUTION_OBSERVED",
)
UNSUPPORTED_CLAIMS = (
    "browsing happened",
    "sources were fetched",
    "citations exist",
    "internet access is authorized",
)
BENEFICIAL = {("UNSATISFIED", "SATISFIED"), ("CONFLICT", "SATISFIED")}
PROTECTED_TYPES = {
    "HARD_CONSTRAINT",
    "GOAL_IDENTITY",
    "AUTHORITY_BOUND",
    "UNKNOWN_MARKER",
    "FACT_BOUND",
    "UNAUTHORIZED_ADDITION",
    "UNSUPPORTED_CLAIM",
}
_AUTHORITY_RE = re.compile(
    r"^level=(\d+); status=([A-Z0-9_]+); grants=(none|[A-Z0-9_]+(?:,[A-Z0-9_]+)*)$"
)
_STATUS_RANK = {"NONE": 0, "RECOMMEND": 1, "AUTHORIZE": 2, "GRANTED": 3}


def _digest(payload: Any) -> str:
    return hashlib.sha256(canonical_dumps(payload).encode("utf-8")).hexdigest()


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


def _as_dict(value: Any) -> dict[str, Any] | None:
    if isinstance(value, Mapping):
        return dict(value)
    return None


def _as_list(value: Any) -> list[Any]:
    if isinstance(value, list):
        return list(value)
    return []


def _norm_authority(value: Any) -> dict[str, Any]:
    raw = value if isinstance(value, Mapping) else {}
    grants = raw.get("grants")
    grant_list = [str(item) for item in grants] if isinstance(grants, list) else []
    level_raw = raw.get("level")
    try:
        level = int(level_raw) if level_raw is not None else 0
    except (TypeError, ValueError):
        level = 0
    status = raw.get("status")
    return {
        "grants": grant_list,
        "level": level,
        "status": str(status) if isinstance(status, str) and status else "NONE",
    }


def _shared_protected(value: Any) -> dict[str, Any] | None:
    raw = _as_dict(value)
    if raw is None:
        return None
    return {
        "authority_state": _norm_authority(raw.get("authority_state")),
        "budget": raw.get("budget", None),
        "desired_output": raw.get("desired_output", None),
        "facts": _as_list(raw.get("facts")),
        "goal": raw.get("goal") if isinstance(raw.get("goal"), str) else "",
        "hard_constraints": _as_list(raw.get("hard_constraints")),
        "provenance": _as_list(raw.get("provenance")),
    }


def _full_protected(value: Any) -> dict[str, Any] | None:
    shared = _shared_protected(value)
    if shared is None:
        return None
    raw = _as_dict(value) or {}
    category = raw.get("category")
    shared["category"] = category if isinstance(category, str) else ""
    shared["unknowns"] = _as_list(raw.get("unknowns"))
    shared["user_preferences"] = _as_list(raw.get("user_preferences"))
    return shared


def _effect_identity(plan: Any) -> dict[str, Any] | None:
    raw = _as_dict(plan)
    if raw is None:
        return None
    return {
        "blocked_operations": _as_list(raw.get("blocked_operations")),
        "disposition": raw.get("disposition") if isinstance(raw.get("disposition"), str) else "",
        "effect_version": raw.get("effect_version") if isinstance(raw.get("effect_version"), str) else "",
        "operations": [str(item) for item in _as_list(raw.get("operations"))],
        "renderable": raw.get("renderable") is True,
        "requirement_graph_digest": raw.get("requirement_graph_digest")
        if isinstance(raw.get("requirement_graph_digest"), str)
        else "",
        "schema_version": raw.get("schema_version") if isinstance(raw.get("schema_version"), str) else "",
        "sections": _as_list(raw.get("sections")),
        "selection_id": raw.get("selection_id") if isinstance(raw.get("selection_id"), str) else "",
        "techniques": [str(item) for item in _as_list(raw.get("techniques"))],
    }


def _k3_identity(value: Any) -> dict[str, Any] | None:
    raw = _as_dict(value)
    if raw is None:
        return None
    return {
        "selection_id": raw.get("selection_id") if isinstance(raw.get("selection_id"), str) else "",
        "techniques": [str(item) for item in _as_list(raw.get("techniques"))],
    }


def _xcat_identity(value: Any) -> dict[str, Any] | None:
    raw = _as_dict(value)
    if raw is None:
        return None
    return {
        "active_category": raw.get("active_category") if isinstance(raw.get("active_category"), str) else "",
        "taxonomy_version": raw.get("taxonomy_version") if isinstance(raw.get("taxonomy_version"), str) else "",
    }


def _graph_digest(value: Any) -> str:
    raw = _as_dict(value)
    if raw is None:
        return ""
    digest = raw.get("graph_digest")
    return digest if isinstance(digest, str) else ""


def _subject_view(subject: Mapping[str, Any]) -> dict[str, Any]:
    prompt = subject.get("compiled_prompt")
    return {
        "compiled_prompt": prompt if isinstance(prompt, str) else None,
        "effect_identity": _effect_identity(subject.get("effect_plan")),
        "k3": _k3_identity(subject.get("k3")),
        "protected_intent": _full_protected(subject.get("protected_intent")),
        "requirement_graph_digest": _graph_digest(subject.get("requirement_graph")),
        "xcat": _xcat_identity(subject.get("xcat")),
    }


def subject_digest(subject: Mapping[str, Any]) -> str:
    return _digest(_subject_view(subject))


def _authority_line(auth: Mapping[str, Any]) -> str:
    grants = auth["grants"]
    joined = ",".join(grants) if grants else "none"
    return f"level={auth['level']}; status={auth['status']}; grants={joined}"


def _parse_sections(prompt: str) -> list[tuple[str, str]] | None:
    if not isinstance(prompt, str) or not prompt.startswith("## "):
        return None
    sections: list[tuple[str, str]] = []
    seen: set[str] = set()
    for chunk in prompt.split("\n\n"):
        if not chunk.startswith("## "):
            return None
        head, sep, body = chunk[3:].partition("\n")
        if not sep or not head or head in seen:
            return None
        seen.add(head)
        sections.append((head, body))
    return sections


def _render(sections: list[tuple[str, str]]) -> str:
    return "\n\n".join(f"## {heading}\n{body}" for heading, body in sections)


def _section_map(sections: list[tuple[str, str]]) -> dict[str, str]:
    return {heading: body for heading, body in sections}


def _insert_index(sections: list[tuple[str, str]], after: str | None) -> int:
    if after is None:
        return 0
    for index, (heading, _) in enumerate(sections):
        if heading == after:
            return index + 1
    return len(sections)


def _set_section(
    prompt: str,
    heading: str,
    body: str,
    *,
    after: str | None = None,
) -> str | None:
    sections = _parse_sections(prompt)
    if sections is None:
        return None
    replaced = False
    updated: list[tuple[str, str]] = []
    for current, text in sections:
        if current == heading:
            updated.append((heading, body))
            replaced = True
        else:
            updated.append((current, text))
    if not replaced:
        updated.insert(_insert_index(updated, after), (heading, body))
    return _render(updated)


def _unknown_statements(protected: Mapping[str, Any]) -> list[tuple[str, str]]:
    found: list[tuple[str, str]] = []
    for index, item in enumerate(_as_list(protected.get("unknowns"))):
        if isinstance(item, Mapping):
            item_id = str(item.get("uncertainty_id") or item.get("id") or f"u{index}")
        else:
            item_id = f"u{index}"
        found.append((item_id, _record_text(item)))
    for index, item in enumerate(_as_list(protected.get("facts"))):
        if isinstance(item, Mapping) and (
            item.get("status") == "UNKNOWN" or item.get("marker") == "UNKNOWN"
        ):
            found.append((str(item.get("fact_id") or f"f{index}"), _record_text(item)))
    return found


def _is_example_text(value: Any) -> bool:
    return isinstance(value, str) and (
        "EXAMPLE / USER_SUPPLIED" in value or "NON-AUTHORITATIVE" in value
    )


def _plan_section_text(plan: Mapping[str, Any], code: str) -> str | None:
    for section in _as_list(plan.get("sections")):
        if isinstance(section, Mapping) and section.get("code") == code:
            text = section.get("text")
            if isinstance(text, str):
                return text
    return None


def _obligation(
    obligation_id: str,
    obligation_type: str,
    source_ref: str,
    status: str,
    evidence: list[str],
    reasons: list[str],
) -> dict[str, Any]:
    if status not in OBLIGATION_STATUSES:
        raise ValueError(f"illegal obligation status: {status}")
    return {
        "evidence_refs": sorted(set(evidence)),
        "obligation_id": obligation_id,
        "obligation_type": obligation_type,
        "reason_codes": sorted(set(reasons)),
        "source_ref": source_ref,
        "status": status,
    }


def _malformed(obligation_id: str, obligation_type: str, source_ref: str) -> dict[str, Any]:
    return _obligation(
        obligation_id,
        obligation_type,
        source_ref,
        "UNKNOWN",
        ["artifact:compiled_prompt"],
        ["MALFORMED_ARTIFACT"],
    )


def evaluate_obligations(subject: Mapping[str, Any]) -> list[dict[str, Any]]:
    """Per-obligation statuses for one candidate. UNKNOWN is never SATISFIED."""
    protected = _full_protected(subject.get("protected_intent"))
    plan = _as_dict(subject.get("effect_plan"))
    graph = _as_dict(subject.get("requirement_graph"))
    k3 = _k3_identity(subject.get("k3"))
    xcat = _xcat_identity(subject.get("xcat"))
    prompt = subject.get("compiled_prompt")
    results: list[dict[str, Any]] = []

    if protected is None or plan is None or not isinstance(prompt, str):
        results.append(_malformed("artifact:shape", "ARTIFACT", "compiled_prompt"))
        results.sort(key=lambda item: item["obligation_id"])
        return results

    sections = _parse_sections(prompt)
    section_body = _section_map(sections) if sections is not None else None

    def body(heading: str) -> str | None:
        if section_body is None:
            return None
        return section_body.get(heading)

    if sections is None:
        results.append(_malformed("artifact:sections", "ARTIFACT", "compiled_prompt"))

    goal = protected["goal"]
    objective = body("Objective")
    if sections is None:
        results.append(_malformed("goal:identity", "GOAL_IDENTITY", "goal"))
    elif objective == goal:
        results.append(
            _obligation("goal:identity", "GOAL_IDENTITY", "goal", "SATISFIED", ["section:Objective"], [])
        )
    else:
        results.append(
            _obligation(
                "goal:identity",
                "GOAL_IDENTITY",
                "goal",
                "UNSATISFIED",
                ["section:Objective"],
                ["GOAL_MISMATCH" if objective is not None else "MISSING_SECTION"],
            )
        )

    hard_body = body("Hard constraints")
    for index, item in enumerate(protected["hard_constraints"]):
        if isinstance(item, Mapping):
            constraint_id = str(item.get("constraint_id") or f"c{index}")
        else:
            constraint_id = f"c{index}"
        statement = _record_text(item)
        bullet = f"- {statement}"
        obligation_id = f"hard:{constraint_id}"
        if sections is None:
            results.append(_malformed(obligation_id, "HARD_CONSTRAINT", constraint_id))
            continue
        if hard_body is None:
            results.append(
                _obligation(
                    obligation_id,
                    "HARD_CONSTRAINT",
                    constraint_id,
                    "UNSATISFIED",
                    ["section:Hard constraints"],
                    ["MISSING_SECTION"],
                )
            )
            continue
        waived = f"waive: {statement}" in hard_body or f"constraint removed: {statement}" in hard_body
        present = bullet in hard_body.split("\n")
        if waived:
            results.append(
                _obligation(
                    obligation_id,
                    "HARD_CONSTRAINT",
                    constraint_id,
                    "CONFLICT",
                    ["section:Hard constraints"],
                    ["CONSTRAINT_WEAKENED"],
                )
            )
        elif present:
            results.append(
                _obligation(
                    obligation_id,
                    "HARD_CONSTRAINT",
                    constraint_id,
                    "SATISFIED",
                    ["section:Hard constraints"],
                    [],
                )
            )
        else:
            results.append(
                _obligation(
                    obligation_id,
                    "HARD_CONSTRAINT",
                    constraint_id,
                    "UNSATISFIED",
                    ["section:Hard constraints"],
                    ["MISSING_CONSTRAINT"],
                )
            )

    auth = protected["authority_state"]
    expected_auth = _authority_line(auth)
    auth_body = body("Authority")
    if sections is None:
        results.append(_malformed("authority:bound", "AUTHORITY_BOUND", "authority_state"))
    elif auth_body is None:
        results.append(
            _obligation(
                "authority:bound",
                "AUTHORITY_BOUND",
                "authority_state",
                "UNSATISFIED",
                ["section:Authority"],
                ["MISSING_SECTION"],
            )
        )
    elif auth_body == expected_auth:
        results.append(
            _obligation(
                "authority:bound",
                "AUTHORITY_BOUND",
                "authority_state",
                "SATISFIED",
                ["section:Authority"],
                [],
            )
        )
    else:
        reasons = ["AUTHORITY_MISMATCH"]
        match = _AUTHORITY_RE.match(auth_body)
        if match:
            level = int(match.group(1))
            status = match.group(2)
            grants_raw = match.group(3)
            grants = [] if grants_raw == "none" else grants_raw.split(",")
            protected_grants = set(auth["grants"])
            rank = _STATUS_RANK.get(status, 99)
            protected_rank = _STATUS_RANK.get(auth["status"], 0)
            if level > auth["level"] or rank > protected_rank or not set(grants).issubset(protected_grants):
                reasons = ["AUTHORITY_EXPANSION"]
        else:
            reasons = ["AUTHORITY_EXPANSION"]
        results.append(
            _obligation(
                "authority:bound",
                "AUTHORITY_BOUND",
                "authority_state",
                "UNSATISFIED",
                ["section:Authority"],
                reasons,
            )
        )

    fact_body = body("Facts")
    fact_lines = fact_body.split("\n") if isinstance(fact_body, str) else []
    allowed_facts: list[str] = []
    for index, item in enumerate(protected["facts"]):
        if isinstance(item, Mapping):
            fact_id = str(item.get("fact_id") or f"f{index}")
        else:
            fact_id = f"f{index}"
        statement = _record_text(item)
        allowed_facts.append(statement)
        obligation_id = f"fact:{fact_id}"
        if sections is None:
            results.append(_malformed(obligation_id, "FACT_BOUND", fact_id))
        elif f"- {statement}" in fact_lines:
            results.append(
                _obligation(obligation_id, "FACT_BOUND", fact_id, "SATISFIED", ["section:Facts"], [])
            )
        else:
            results.append(
                _obligation(
                    obligation_id,
                    "FACT_BOUND",
                    fact_id,
                    "UNSATISFIED",
                    ["section:Facts"],
                    ["MISSING_FACT" if fact_body is not None else "MISSING_SECTION"],
                )
            )
    extras = [
        line[2:]
        for line in fact_lines
        if line.startswith("- ") and line[2:] not in allowed_facts
    ]
    invented = isinstance(prompt, str) and "INVENTED FACT:" in prompt
    if sections is None:
        results.append(_malformed("fact:unauthorized", "UNAUTHORIZED_ADDITION", "facts"))
    elif extras or invented:
        results.append(
            _obligation(
                "fact:unauthorized",
                "UNAUTHORIZED_ADDITION",
                "facts",
                "UNSATISFIED",
                ["section:Facts"],
                ["UNSUPPORTED_FACT"],
            )
        )
    else:
        results.append(
            _obligation(
                "fact:unauthorized",
                "UNAUTHORIZED_ADDITION",
                "facts",
                "SATISFIED",
                ["section:Facts"],
                [],
            )
        )

    lowered_prompt = prompt.lower()
    claim_hits = [phrase for phrase in UNSUPPORTED_CLAIMS if phrase in lowered_prompt]
    if sections is None:
        results.append(_malformed("claim:unsupported", "UNSUPPORTED_CLAIM", "compiled_prompt"))
    elif claim_hits:
        results.append(
            _obligation(
                "claim:unsupported",
                "UNSUPPORTED_CLAIM",
                "compiled_prompt",
                "UNSATISFIED",
                ["compiled_prompt"],
                ["UNSUPPORTED_CLAIM"],
            )
        )
    else:
        results.append(
            _obligation(
                "claim:unsupported",
                "UNSUPPORTED_CLAIM",
                "compiled_prompt",
                "SATISFIED",
                ["compiled_prompt"],
                [],
            )
        )

    plan_prompt = plan.get("compiled_prompt") if isinstance(plan.get("compiled_prompt"), str) else ""
    invented_example = "invented example" in lowered_prompt and "invented example" not in plan_prompt.lower()
    if sections is None:
        results.append(_malformed("example:unauthorized", "UNAUTHORIZED_ADDITION", "examples"))
    elif invented_example:
        results.append(
            _obligation(
                "example:unauthorized",
                "UNAUTHORIZED_ADDITION",
                "examples",
                "UNSATISFIED",
                ["compiled_prompt"],
                ["INVENTED_EXAMPLE"],
            )
        )
    else:
        results.append(
            _obligation(
                "example:unauthorized",
                "UNAUTHORIZED_ADDITION",
                "examples",
                "SATISFIED",
                ["compiled_prompt"],
                [],
            )
        )

    for item_id, statement in _unknown_statements(protected):
        obligation_id = f"unknown:{item_id}"
        if sections is None:
            results.append(_malformed(obligation_id, "UNKNOWN_MARKER", item_id))
            continue
        open_body = body("Open questions") or ""
        line = next((item for item in open_body.split("\n") if statement in item), "")
        laundered = bool(line) and ("SATISFIED" in line or "verified" in line.lower()) and "UNKNOWN" not in line
        if laundered or (statement in prompt and "SATISFIED" in prompt and "UNKNOWN" not in prompt):
            results.append(
                _obligation(
                    obligation_id,
                    "UNKNOWN_MARKER",
                    item_id,
                    "CONFLICT",
                    ["section:Open questions"],
                    ["UNKNOWN_LAUNDERED"],
                )
            )
        elif line and "UNKNOWN" in line:
            results.append(
                _obligation(
                    obligation_id,
                    "UNKNOWN_MARKER",
                    item_id,
                    "SATISFIED",
                    ["section:Open questions"],
                    [],
                )
            )
        else:
            results.append(
                _obligation(
                    obligation_id,
                    "UNKNOWN_MARKER",
                    item_id,
                    "UNSATISFIED",
                    ["section:Open questions"],
                    ["MISSING_UNKNOWN_MARKER"],
                )
            )

    desired = protected.get("desired_output", None)
    if desired is not None and not _is_example_text(desired):
        rendered = desired if isinstance(desired, str) else canonical_dumps(desired)
        deliverable = body("Deliverable")
        if sections is None:
            results.append(_malformed("output:desired", "OUTPUT_CONTRACT", "desired_output"))
        elif deliverable == rendered:
            results.append(
                _obligation(
                    "output:desired",
                    "OUTPUT_CONTRACT",
                    "desired_output",
                    "SATISFIED",
                    ["section:Deliverable"],
                    [],
                )
            )
        else:
            results.append(
                _obligation(
                    "output:desired",
                    "OUTPUT_CONTRACT",
                    "desired_output",
                    "UNSATISFIED",
                    ["section:Deliverable"],
                    ["MISSING_OUTPUT_CONTRACT"],
                )
            )

    for code in [str(item) for item in _as_list(plan.get("operations"))]:
        obligation_id = f"effect:{code}"
        expected = _plan_section_text(plan, code)
        actual = body(f"Effect: {code}")
        if sections is None:
            results.append(_malformed(obligation_id, "EFFECT_OPERATION", code))
        elif expected is not None and actual == expected:
            results.append(
                _obligation(
                    obligation_id,
                    "EFFECT_OPERATION",
                    code,
                    "SATISFIED",
                    [f"section:Effect: {code}"],
                    [],
                )
            )
        else:
            results.append(
                _obligation(
                    obligation_id,
                    "EFFECT_OPERATION",
                    code,
                    "UNSATISFIED",
                    [f"section:Effect: {code}"],
                    ["MISSING_EFFECT_OPERATION"],
                )
            )
        if code == "STRUCTURED_OUTPUT":
            if sections is None:
                results.append(_malformed("output:structured", "OUTPUT_CONTRACT", code))
            elif expected is not None and actual == expected:
                results.append(
                    _obligation(
                        "output:structured",
                        "OUTPUT_CONTRACT",
                        code,
                        "SATISFIED",
                        [f"section:Effect: {code}"],
                        [],
                    )
                )
            else:
                results.append(
                    _obligation(
                        "output:structured",
                        "OUTPUT_CONTRACT",
                        code,
                        "UNSATISFIED",
                        [f"section:Effect: {code}"],
                        ["MISSING_OUTPUT_CONTRACT"],
                    )
                )

    shared_subject = _shared_protected(subject.get("protected_intent"))
    shared_plan = _shared_protected(plan.get("protected_fields"))
    if shared_subject is not None and shared_plan is not None and canonical_dumps(shared_subject) == canonical_dumps(shared_plan):
        results.append(
            _obligation(
                "bind:protected",
                "PROTECTED_INTENT_BINDING",
                "protected_fields",
                "SATISFIED",
                ["effect_plan.protected_fields"],
                [],
            )
        )
    else:
        results.append(
            _obligation(
                "bind:protected",
                "PROTECTED_INTENT_BINDING",
                "protected_fields",
                "UNSATISFIED",
                ["effect_plan.protected_fields"],
                ["UNBOUND_EFFECT_PLAN"],
            )
        )

    graph_digest = _graph_digest(graph)
    plan_digest = plan.get("requirement_graph_digest") if isinstance(plan.get("requirement_graph_digest"), str) else ""
    if graph is not None and graph.get("validity") == "CONFLICTED":
        results.append(
            _obligation(
                "requirement:conflict",
                "REQUIREMENT_CONFLICT",
                "requirement_graph",
                "CONFLICT",
                ["requirement_graph.validity"],
                ["REQUIREMENT_CONFLICT"],
            )
        )
    if graph_digest and graph_digest == plan_digest:
        results.append(
            _obligation(
                "bind:graph",
                "REQUIREMENT_GRAPH_BINDING",
                "graph_digest",
                "SATISFIED",
                ["requirement_graph.graph_digest"],
                [],
            )
        )
    elif not graph_digest or not plan_digest:
        results.append(
            _obligation(
                "bind:graph",
                "REQUIREMENT_GRAPH_BINDING",
                "graph_digest",
                "UNKNOWN",
                ["requirement_graph.graph_digest"],
                ["MISSING_PROOF"],
            )
        )
    else:
        results.append(
            _obligation(
                "bind:graph",
                "REQUIREMENT_GRAPH_BINDING",
                "graph_digest",
                "UNSATISFIED",
                ["requirement_graph.graph_digest"],
                ["REQUIREMENT_GRAPH_MISMATCH"],
            )
        )

    if k3 is None:
        results.append(
            _obligation("bind:k3", "K3_BINDING", "techniques", "UNKNOWN", ["k3"], ["MISSING_K3"])
        )
    elif k3["techniques"] == [str(item) for item in _as_list(plan.get("techniques"))]:
        results.append(
            _obligation("bind:k3", "K3_BINDING", "techniques", "SATISFIED", ["k3.techniques"], [])
        )
    else:
        results.append(
            _obligation(
                "bind:k3",
                "K3_BINDING",
                "techniques",
                "UNSATISFIED",
                ["k3.techniques"],
                ["K3_MISMATCH"],
            )
        )

    if xcat is None:
        results.append(
            _obligation("bind:xcat", "XCAT_BINDING", "active_category", "UNKNOWN", ["xcat"], ["MISSING_XCAT"])
        )
    elif xcat["taxonomy_version"] == "2" and xcat["active_category"] == protected["category"]:
        results.append(
            _obligation(
                "bind:xcat",
                "XCAT_BINDING",
                "active_category",
                "SATISFIED",
                ["xcat.active_category"],
                [],
            )
        )
    else:
        results.append(
            _obligation(
                "bind:xcat",
                "XCAT_BINDING",
                "active_category",
                "UNSATISFIED",
                ["xcat.active_category"],
                ["CATEGORY_MISMATCH"],
            )
        )

    proof_refs = subject.get("proof_refs")
    if isinstance(proof_refs, list) and proof_refs and all(isinstance(item, str) and item for item in proof_refs):
        results.append(
            _obligation("proof:present", "PROOF", "proof_refs", "SATISFIED", ["proof_refs"], [])
        )
    else:
        results.append(
            _obligation("proof:present", "PROOF", "proof_refs", "UNKNOWN", ["proof_refs"], ["MISSING_PROOF"])
        )

    results.sort(key=lambda item: item["obligation_id"])
    return results


def _index(obligations: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    return {item["obligation_id"]: item for item in obligations}


def _proof_refs(subject: Mapping[str, Any]) -> list[str]:
    raw = subject.get("proof_refs")
    if not isinstance(raw, list):
        return []
    return sorted({item for item in raw if isinstance(item, str) and item})


def quality_delta(before: Mapping[str, Any], after: Mapping[str, Any]) -> dict[str, Any]:
    """Compare two candidates that must share one ProtectedIntent."""
    before_pi = _full_protected(before.get("protected_intent"))
    after_pi = _full_protected(after.get("protected_intent"))
    before_obs = evaluate_obligations(before)
    after_obs = evaluate_obligations(after)
    ids = sorted(set(_index(before_obs)) | set(_index(after_obs)))
    before_map = _index(before_obs)
    after_map = _index(after_obs)
    rows: list[dict[str, Any]] = []
    improved: list[str] = []
    regressed: list[str] = []
    unchanged: list[str] = []
    unresolved: list[str] = []
    protected: list[str] = []
    reasons: list[str] = []

    intent_mismatch = before_pi is None or after_pi is None or canonical_dumps(before_pi) != canonical_dumps(after_pi)
    governing_mismatch = (
        _graph_digest(before.get("requirement_graph")) != _graph_digest(after.get("requirement_graph"))
        or canonical_dumps(_xcat_identity(before.get("xcat"))) != canonical_dumps(_xcat_identity(after.get("xcat")))
        or canonical_dumps(_k3_identity(before.get("k3"))) != canonical_dumps(_k3_identity(after.get("k3")))
        or canonical_dumps(_effect_identity(before.get("effect_plan")))
        != canonical_dumps(_effect_identity(after.get("effect_plan")))
    )
    malformed = any(item["obligation_id"] == "artifact:shape" for item in before_obs + after_obs)

    for obligation_id in ids:
        left = before_map.get(obligation_id)
        right = after_map.get(obligation_id)
        before_status = left["status"] if left else "NOT_APPLICABLE"
        after_status = right["status"] if right else "NOT_APPLICABLE"
        obligation_type = (right or left)["obligation_type"]
        source_ref = (right or left)["source_ref"]
        evidence = list((right or left)["evidence_refs"])
        row_reasons = list((right or {"reason_codes": []})["reason_codes"])
        if left:
            row_reasons.extend(left["reason_codes"])
        rows.append(
            {
                "after_status": after_status,
                "before_status": before_status,
                "evidence_refs": sorted(set(evidence)),
                "obligation_id": obligation_id,
                "obligation_type": obligation_type,
                "reason_codes": sorted(set(row_reasons)),
                "source_ref": source_ref,
            }
        )
        before_reasons = left["reason_codes"] if left else []
        after_reasons = right["reason_codes"] if right else []
        laundered = (
            "UNKNOWN_LAUNDERED" in after_reasons and "UNKNOWN_LAUNDERED" not in before_reasons
        ) or (
            obligation_type == "UNKNOWN_MARKER"
            and before_status == "UNKNOWN"
            and after_status == "SATISFIED"
        )
        if before_status == after_status and after_status not in {"UNKNOWN", "CONFLICT"}:
            unchanged.append(obligation_id)
        elif (
            (before_status, after_status) in BENEFICIAL
            and not laundered
            and "UNKNOWN_LAUNDERED" not in after_reasons
        ):
            improved.append(obligation_id)
        elif before_status == "SATISFIED" and after_status != "SATISFIED":
            regressed.append(obligation_id)
        elif after_status in {"UNKNOWN", "CONFLICT"} or before_status in {"UNKNOWN", "CONFLICT"}:
            unresolved.append(obligation_id)
        elif before_status != after_status:
            regressed.append(obligation_id)
        else:
            unresolved.append(obligation_id)
        newly_bad = any(
            code in after_reasons and code not in before_reasons
            for code in (
                "AUTHORITY_EXPANSION",
                "CONSTRAINT_WEAKENED",
                "UNSUPPORTED_FACT",
                "INVENTED_EXAMPLE",
                "UNSUPPORTED_CLAIM",
            )
        )
        protected_hit = obligation_type in PROTECTED_TYPES and (
            laundered or newly_bad or (before_status == "SATISFIED" and after_status != "SATISFIED")
        )
        if protected_hit and obligation_id not in protected:
            protected.append(obligation_id)
        if laundered:
            reasons.append("UNKNOWN_LAUNDERED")
        reasons.extend(row_reasons)

    if malformed:
        disposition = "UNRESOLVED"
        reasons.append("MALFORMED_ARTIFACT")
        improved = []
    elif intent_mismatch:
        disposition = "UNRESOLVED"
        reasons.append("PROTECTED_INTENT_MISMATCH")
        improved = []
        protected = []
        regressed = []
    elif governing_mismatch:
        disposition = "UNRESOLVED"
        reasons.append("GOVERNING_STATE_MISMATCH")
        improved = []
    elif protected or regressed:
        disposition = "REGRESSED"
    elif improved:
        proof_ok = bool(_proof_refs(before) and _proof_refs(after))
        proof_status = after_map.get("proof:present", {}).get("status")
        unknown_laundered = "UNKNOWN_LAUNDERED" in reasons
        if not proof_ok or proof_status != "SATISFIED" or unknown_laundered:
            disposition = "UNRESOLVED"
            reasons.append(
                "MISSING_PROOF" if not proof_ok or proof_status != "SATISFIED" else "UNKNOWN_LAUNDERED"
            )
            unresolved.extend(improved)
            improved = []
        else:
            disposition = "IMPROVED"
    elif any(item["after_status"] in {"UNKNOWN", "CONFLICT"} for item in rows):
        disposition = "UNRESOLVED"
    else:
        disposition = "NON_INFERIOR"
        before_prompt = before.get("compiled_prompt")
        after_prompt = after.get("compiled_prompt")
        if isinstance(before_prompt, str) and isinstance(after_prompt, str) and before_prompt != after_prompt:
            reasons.append("LENGTH_NOT_QUALITY")
        if subject_digest(before) == subject_digest(after):
            reasons.append("SAME_CANDIDATE")

    return {
        "disposition": disposition,
        "effect_plan_digest": _digest(_effect_identity(before.get("effect_plan"))),
        "improved_obligation_ids": sorted(improved) if disposition == "IMPROVED" else [],
        "k3_digest": _digest(_k3_identity(before.get("k3"))),
        "obligation_results": rows,
        "proof_refs": sorted(set(_proof_refs(before) + _proof_refs(after))),
        "protected_intent_digest": _digest(before_pi),
        "protected_regressions": sorted(protected) if not intent_mismatch else [],
        "reason_codes": sorted(set(reasons)),
        "regressed_obligation_ids": sorted(regressed) if not intent_mismatch else [],
        "requirement_graph_digest": _graph_digest(before.get("requirement_graph")),
        "subject_after_digest": subject_digest(after),
        "subject_before_digest": subject_digest(before),
        "unchanged_obligation_ids": sorted(unchanged),
        "unresolved_obligation_ids": sorted(set(unresolved)),
        "version": DELTA_VERSION,
        "xcat_digest": _digest(_xcat_identity(before.get("xcat"))),
    }


def _bad(item: Mapping[str, Any]) -> bool:
    return item["status"] in {"UNSATISFIED", "CONFLICT"}


def _choose_repair(obligations: list[dict[str, Any]]) -> tuple[str | None, list[str], list[str]]:
    hard = [item for item in obligations if item["obligation_type"] == "HARD_CONSTRAINT" and _bad(item)]
    if hard:
        return "RESTORE_MISSING_CONSTRAINT", [item["obligation_id"] for item in hard], ["MISSING_CONSTRAINT"]
    unknowns = [item for item in obligations if item["obligation_type"] == "UNKNOWN_MARKER" and _bad(item)]
    if unknowns:
        return "RESTORE_UNKNOWN_MARKER", [item["obligation_id"] for item in unknowns], ["MISSING_UNKNOWN_MARKER"]
    unauthorized = [
        item
        for item in obligations
        if item["obligation_id"] in {"fact:unauthorized", "example:unauthorized", "claim:unsupported"} and _bad(item)
    ]
    authority = next((item for item in obligations if item["obligation_id"] == "authority:bound"), None)
    if unauthorized or (authority and "AUTHORITY_EXPANSION" in authority["reason_codes"]):
        ids = [item["obligation_id"] for item in unauthorized]
        if authority and "AUTHORITY_EXPANSION" in authority["reason_codes"]:
            ids.append(authority["obligation_id"])
        return "REMOVE_UNAUTHORIZED_ADDITION", ids, ["UNAUTHORIZED_ADDITION"]
    output = [item for item in obligations if item["obligation_type"] == "OUTPUT_CONTRACT" and _bad(item)]
    if output:
        return "RESTORE_AUTHORIZED_OUTPUT_CONTRACT", [item["obligation_id"] for item in output], ["MISSING_OUTPUT_CONTRACT"]
    required = [
        item
        for item in obligations
        if item["obligation_id"] in {"goal:identity", "authority:bound"} and _bad(item)
    ]
    missing_hard_section = [
        item
        for item in obligations
        if item["obligation_type"] == "HARD_CONSTRAINT" and "MISSING_SECTION" in item["reason_codes"]
    ]
    if required or missing_hard_section:
        ids = [item["obligation_id"] for item in required + missing_hard_section]
        return "RESTORE_REQUIRED_SECTION", ids, ["MISSING_SECTION"]
    effects = [item for item in obligations if item["obligation_type"] == "EFFECT_OPERATION" and _bad(item)]
    if effects:
        return "RENDER_FROM_BOUND_EFFECT_PLAN", [item["obligation_id"] for item in effects], ["MISSING_EFFECT_OPERATION"]
    conflict = [item for item in obligations if item["obligation_type"] == "REQUIREMENT_CONFLICT"]
    if conflict:
        return None, [item["obligation_id"] for item in conflict], ["UNREPAIRABLE_CONFLICT"]
    unbound = [
        item
        for item in obligations
        if item["obligation_id"] in {"bind:protected", "bind:k3", "bind:xcat", "bind:graph"} and _bad(item)
    ]
    if unbound:
        return None, [item["obligation_id"] for item in unbound], ["UNREPAIRABLE_BINDING"]
    return None, [], []


def _effect_prompt_authorized(subject: Mapping[str, Any]) -> bool:
    plan = _as_dict(subject.get("effect_plan"))
    protected = _shared_protected(subject.get("protected_intent"))
    if plan is None or protected is None or plan.get("renderable") is not True:
        return False
    prompt = plan.get("compiled_prompt")
    if not isinstance(prompt, str) or not prompt.strip():
        return False
    if canonical_dumps(_shared_protected(plan.get("protected_fields"))) != canonical_dumps(protected):
        return False
    k3 = _k3_identity(subject.get("k3"))
    if k3 is None or k3["techniques"] != [str(item) for item in _as_list(plan.get("techniques"))]:
        return False
    xcat = _xcat_identity(subject.get("xcat"))
    full = _full_protected(subject.get("protected_intent"))
    if xcat is None or full is None or xcat["active_category"] != full["category"]:
        return False
    if xcat["taxonomy_version"] != "2":
        return False
    return True


def _apply_repair(operation: str, subject: Mapping[str, Any]) -> str | None:
    prompt = subject.get("compiled_prompt")
    protected = _full_protected(subject.get("protected_intent"))
    plan = _as_dict(subject.get("effect_plan"))
    if not isinstance(prompt, str) or protected is None or plan is None:
        return None
    if operation == "RENDER_FROM_BOUND_EFFECT_PLAN":
        if not _effect_prompt_authorized(subject):
            return None
        rendered = plan.get("compiled_prompt")
        return rendered if isinstance(rendered, str) else None
    if operation == "RESTORE_MISSING_CONSTRAINT":
        updated = prompt
        for item in protected["hard_constraints"]:
            statement = _record_text(item)
            sections = _parse_sections(updated)
            if sections is None:
                return None
            body = _section_map(sections).get("Hard constraints")
            if body is None:
                bullets = [f"- {_record_text(entry)}" for entry in protected["hard_constraints"]]
                updated = _set_section(updated, "Hard constraints", "\n".join(bullets) or "none", after="Objective")
                return updated
            lines = [line for line in body.split("\n") if line and not line.startswith("waive:") and not line.startswith("constraint removed:")]
            if lines == ["none"]:
                lines = []
            bullet = f"- {statement}"
            if bullet not in lines:
                lines.append(bullet)
            updated = _set_section(updated, "Hard constraints", "\n".join(lines), after="Objective")
            if updated is None:
                return None
        return updated
    if operation == "RESTORE_UNKNOWN_MARKER":
        lines = [f"- {statement} [UNKNOWN]" for _, statement in _unknown_statements(protected)]
        return _set_section(prompt, "Open questions", "\n".join(lines) if lines else "none", after="Authority")
    if operation == "REMOVE_UNAUTHORIZED_ADDITION":
        sections = _parse_sections(prompt)
        if sections is None:
            return None
        allowed = {_record_text(item) for item in protected["facts"]}
        updated_sections: list[tuple[str, str]] = []
        for heading, body in sections:
            if "invented" in heading.lower():
                continue
            if heading == "Facts":
                kept = [line for line in body.split("\n") if not line.startswith("- ") or line[2:] in allowed]
                if not kept:
                    kept = [f"- {item}" for item in allowed] or ["none"]
                body = "\n".join(kept)
            if heading == "Authority":
                body = _authority_line(protected["authority_state"])
            filtered = [
                line
                for line in body.split("\n")
                if "invented example" not in line.lower()
                and not any(phrase in line.lower() for phrase in UNSUPPORTED_CLAIMS)
                and not line.startswith("INVENTED FACT:")
            ]
            updated_sections.append((heading, "\n".join(filtered) if filtered else "none"))
        return _render(updated_sections)
    if operation == "RESTORE_AUTHORIZED_OUTPUT_CONTRACT":
        updated = prompt
        desired = protected.get("desired_output", None)
        if desired is not None and not _is_example_text(desired):
            rendered = desired if isinstance(desired, str) else canonical_dumps(desired)
            updated = _set_section(updated, "Deliverable", rendered, after="Authority")
            if updated is None:
                return None
        if "STRUCTURED_OUTPUT" in _as_list(plan.get("operations")):
            text = _plan_section_text(plan, "STRUCTURED_OUTPUT")
            if text is None:
                return None
            updated = _set_section(updated, "Effect: STRUCTURED_OUTPUT", text, after="Category presentation")
        return updated
    if operation == "RESTORE_REQUIRED_SECTION":
        updated = prompt
        sections = _parse_sections(updated)
        if sections is None:
            return None
        headings = {heading for heading, _ in sections}
        objective = _section_map(sections).get("Objective")
        if "Objective" not in headings or objective != protected["goal"]:
            updated = _set_section(updated, "Objective", protected["goal"], after=None)
            if updated is None:
                return None
        if "Hard constraints" not in headings:
            bullets = [f"- {_record_text(item)}" for item in protected["hard_constraints"]]
            updated = _set_section(
                updated,
                "Hard constraints",
                "\n".join(bullets) if bullets else "none",
                after="Objective",
            )
            if updated is None:
                return None
        if "Authority" not in headings:
            updated = _set_section(
                updated,
                "Authority",
                _authority_line(protected["authority_state"]),
                after="Provenance",
            )
        return updated
    return None


def _copy_subject(subject: Mapping[str, Any], prompt: str | None = None) -> dict[str, Any]:
    copied = dict(subject)
    if prompt is not None:
        copied["compiled_prompt"] = prompt
    return copied


def _plan(
    *,
    subject: Mapping[str, Any],
    kept: Mapping[str, Any],
    disposition: str,
    deficits: list[str],
    causes: list[str],
    operations: list[str],
    reasons: list[str],
    attempt_index: int,
) -> dict[str, Any]:
    return {
        "attempt_index": attempt_index,
        "candidate_digest": subject_digest(kept),
        "cause_codes": sorted(set(causes)),
        "disposition": disposition,
        "forbidden_changes": list(FORBIDDEN_REPAIRS),
        "max_attempts": MAX_AUTOMATIC_ATTEMPTS,
        "proof_refs": _proof_refs(subject),
        "reason_codes": sorted(set(reasons)),
        "repair_operations": operations,
        "source_artifact_digest": subject_digest(subject),
        "triggering_deficit_ids": sorted(deficits),
        "version": RECONSTRUCTION_VERSION,
    }


def reconstruct(
    subject: Mapping[str, Any],
    *,
    attempt_index: int = 1,
    max_attempts: int = MAX_AUTOMATIC_ATTEMPTS,
    requested_repair: str | None = None,
) -> dict[str, Any]:
    """One bounded repair. Never loops and never accepts a regression."""
    del max_attempts  # Task 57 budget is fixed at one automatic attempt.
    prior = subject.get("prior_reconstruction_attempts")
    prior_count = prior if isinstance(prior, int) else 0
    if attempt_index > MAX_AUTOMATIC_ATTEMPTS or prior_count >= MAX_AUTOMATIC_ATTEMPTS:
        plan = _plan(
            subject=subject,
            kept=subject,
            disposition="REFUSED",
            deficits=[],
            causes=["ATTEMPT_BUDGET_EXCEEDED"],
            operations=[],
            reasons=["ATTEMPT_BUDGET_EXCEEDED"],
            attempt_index=MAX_AUTOMATIC_ATTEMPTS,
        )
        delta = quality_delta(subject, subject)
        return {"kept": "original", "kept_subject": _copy_subject(subject), "plan": plan, "quality_delta": delta}
    if requested_repair is not None and requested_repair not in REPAIR_OPERATIONS:
        plan = _plan(
            subject=subject,
            kept=subject,
            disposition="REFUSED",
            deficits=[],
            causes=["FORBIDDEN_REPAIR"],
            operations=[],
            reasons=["FORBIDDEN_REPAIR", requested_repair],
            attempt_index=1,
        )
        return {
            "kept": "original",
            "kept_subject": _copy_subject(subject),
            "plan": plan,
            "quality_delta": quality_delta(subject, subject),
        }

    obligations = evaluate_obligations(subject)
    operation, deficits, causes = _choose_repair(obligations)
    if operation is None and not deficits:
        plan = _plan(
            subject=subject,
            kept=subject,
            disposition="NOT_TRIGGERED",
            deficits=[],
            causes=["NO_DEFICIT"],
            operations=[],
            reasons=["NO_DEFICIT"],
            attempt_index=1,
        )
        return {
            "kept": "original",
            "kept_subject": _copy_subject(subject),
            "plan": plan,
            "quality_delta": quality_delta(subject, subject),
        }
    if operation is None:
        plan = _plan(
            subject=subject,
            kept=subject,
            disposition="UNRESOLVED",
            deficits=deficits,
            causes=causes or ["UNREPAIRABLE"],
            operations=[],
            reasons=causes or ["UNREPAIRABLE"],
            attempt_index=1,
        )
        return {
            "kept": "original",
            "kept_subject": _copy_subject(subject),
            "plan": plan,
            "quality_delta": quality_delta(subject, subject),
        }
    if requested_repair is not None and requested_repair != operation:
        plan = _plan(
            subject=subject,
            kept=subject,
            disposition="REFUSED",
            deficits=deficits,
            causes=["REPAIR_NOT_MINIMAL"],
            operations=[],
            reasons=["REPAIR_NOT_MINIMAL"],
            attempt_index=1,
        )
        return {
            "kept": "original",
            "kept_subject": _copy_subject(subject),
            "plan": plan,
            "quality_delta": quality_delta(subject, subject),
        }

    repaired_prompt = _apply_repair(operation, subject)
    if repaired_prompt is None or repaired_prompt == subject.get("compiled_prompt"):
        plan = _plan(
            subject=subject,
            kept=subject,
            disposition="UNRESOLVED",
            deficits=deficits,
            causes=causes + ["REPAIR_UNAVAILABLE"],
            operations=[operation],
            reasons=["REPAIR_UNAVAILABLE"],
            attempt_index=1,
        )
        return {
            "kept": "original",
            "kept_subject": _copy_subject(subject),
            "plan": plan,
            "quality_delta": quality_delta(subject, subject),
        }
    repaired = _copy_subject(subject, repaired_prompt)
    repaired["prior_reconstruction_attempts"] = 1
    delta = quality_delta(subject, repaired)
    if delta["disposition"] == "IMPROVED" and not delta["protected_regressions"]:
        plan = _plan(
            subject=subject,
            kept=repaired,
            disposition="ACCEPTED",
            deficits=deficits,
            causes=causes,
            operations=[operation],
            reasons=["IMPROVED"],
            attempt_index=1,
        )
        return {"kept": "repaired", "kept_subject": repaired, "plan": plan, "quality_delta": delta}
    failure = "NO_IMPROVEMENT" if delta["disposition"] == "NON_INFERIOR" else "UNRESOLVED"
    plan = _plan(
        subject=subject,
        kept=subject,
        disposition=failure,
        deficits=deficits,
        causes=causes + [delta["disposition"]],
        operations=[operation],
        reasons=[failure, delta["disposition"]],
        attempt_index=1,
    )
    return {"kept": "original", "kept_subject": _copy_subject(subject), "plan": plan, "quality_delta": delta}


def _sha64(value: Any) -> bool:
    return isinstance(value, str) and len(value) == 64 and all(char in "0123456789abcdef" for char in value)


def _runtime_fields(evidence: Any) -> dict[str, str]:
    if not isinstance(evidence, Mapping):
        return {"integrity_state": "ABSENT", "runtime_path": "", "wasm_sha256": ""}
    sha = evidence.get("wasm_sha256")
    path = evidence.get("runtime_path")
    state = evidence.get("integrity_state")
    return {
        "integrity_state": state if isinstance(state, str) and state else "ABSENT",
        "runtime_path": path if isinstance(path, str) else "",
        "wasm_sha256": sha if _sha64(sha) else "",
    }


def _runtime_verified(evidence: Any) -> bool:
    if not isinstance(evidence, Mapping):
        return False
    fields = _runtime_fields(evidence)
    return (
        evidence.get("verified") is True
        and evidence.get("imports") == 0
        and fields["integrity_state"] == "VERIFIED"
        and fields["runtime_path"] == "worker-wasm"
        and bool(fields["wasm_sha256"])
    )


def _normalize_category_id(value: Any) -> str:
    if not isinstance(value, str):
        return ""
    text = value.strip()
    if text.startswith("CAT:"):
        text = text[4:].strip()
    return text


def _receipt(
    *,
    mode: str,
    verdict: str,
    reasons: list[str],
    proof_class: str,
    reconstruction_eligible: bool,
    quality: dict[str, Any] | None = None,
    subject_digest_value: str = "",
    runtime_evidence: Any = None,
) -> dict[str, Any]:
    if proof_class == "EXECUTION_OBSERVED":
        proof_class = "DECLARED_POLICY"
        reasons = reasons + ["EXECUTION_OBSERVED_REJECTED"]
    runtime = _runtime_fields(runtime_evidence)
    return {
        "authority_minted": False,
        "credentials_used": False,
        "execution_authorized": False,
        "execution_observed": False,
        "external_effect": False,
        "external_write": False,
        "integrity_state": runtime["integrity_state"],
        "mode": mode,
        "network": False,
        "outcome": "NOT_EXECUTED",
        "proof_class": proof_class,
        "quality_delta": quality,
        "reason_codes": sorted(set(reasons)),
        "reconstruction_eligible": reconstruction_eligible,
        "runtime_path": runtime["runtime_path"],
        "subject_digest": subject_digest_value,
        "verdict": verdict,
        "version": RECEIPT_VERSION,
        "wasm_sha256": runtime["wasm_sha256"],
    }


def _eligible(subject: Mapping[str, Any]) -> bool:
    operation, _, _ = _choose_repair(evaluate_obligations(subject))
    return operation is not None


def run_mode(request: Mapping[str, Any]) -> dict[str, Any]:
    """DRY_RUN, VALIDATE_ONLY, and EXECUTE are distinct and non-aliasing."""
    evidence = request.get("runtime_evidence") if isinstance(request.get("runtime_evidence"), Mapping) else None
    artifact_for_digest = request.get("artifact")
    digest = subject_digest(artifact_for_digest) if isinstance(artifact_for_digest, Mapping) else ""

    def emit(**kwargs: Any) -> dict[str, Any]:
        return _receipt(subject_digest_value=digest, runtime_evidence=evidence, **kwargs)

    mode = request.get("mode")
    if mode not in MODES:
        return emit(
            mode=str(mode) if isinstance(mode, str) else "",
            verdict="FAIL",
            reasons=["UNSUPPORTED_MODE"],
            proof_class="DECLARED_POLICY",
            reconstruction_eligible=False,
        )
    artifact = request.get("artifact")
    if not isinstance(artifact, Mapping):
        return emit(
            mode=mode,
            verdict="FAIL",
            reasons=["MALFORMED_ARTIFACT"],
            proof_class="DECLARED_POLICY",
            reconstruction_eligible=False,
        )
    requested = request.get("requested_effects")
    effects = [str(item) for item in requested] if isinstance(requested, list) else []
    blocked = [item for item in effects if item in {"network", "credential", "external_write", "execute"}]
    enforcement = request.get("enforcement")
    wasm_available = request.get("wasm_available", True)
    caller_proof = request.get("proof_class")

    if mode == "EXECUTE":
        reasons = ["EXECUTION_NOT_AUTHORIZED", "EXECUTION_NOT_OBSERVED"]
        reasons.extend(f"{item.upper()}_FORBIDDEN" for item in blocked)
        if caller_proof == "EXECUTION_OBSERVED":
            reasons.append("EXECUTION_OBSERVED_REJECTED")
        return emit(
            mode="EXECUTE",
            verdict="FAIL",
            reasons=reasons,
            proof_class="DECLARED_POLICY",
            reconstruction_eligible=False,
        )

    if mode == "DRY_RUN":
        reasons = ["LOCAL_PREVIEW_ONLY"]
        verdict = "PREVIEW"
        if blocked:
            verdict = "REFUSED"
            reasons.extend(f"{item.upper()}_FORBIDDEN" for item in blocked)
        if caller_proof == "EXECUTION_OBSERVED":
            reasons.append("EXECUTION_OBSERVED_REJECTED")
        return emit(
            mode="DRY_RUN",
            verdict=verdict,
            reasons=reasons,
            proof_class="DECLARED_POLICY",
            reconstruction_eligible=False,
        )

    reasons: list[str] = []
    if caller_proof == "EXECUTION_OBSERVED":
        reasons.append("EXECUTION_OBSERVED_REJECTED")
    if enforcement != "AVAILABLE" or wasm_available is False:
        return emit(
            mode="VALIDATE_ONLY",
            verdict="FAIL",
            reasons=reasons + ["ENFORCEMENT_UNAVAILABLE"],
            proof_class="DECLARED_POLICY",
            reconstruction_eligible=False,
        )
    if blocked:
        return emit(
            mode="VALIDATE_ONLY",
            verdict="FAIL",
            reasons=reasons + [f"{item.upper()}_FORBIDDEN" for item in blocked],
            proof_class="ENFORCEMENT_AVAILABLE",
            reconstruction_eligible=False,
        )
    obligations = evaluate_obligations(artifact)
    if any(item["obligation_id"] == "artifact:shape" for item in obligations):
        return emit(
            mode="VALIDATE_ONLY",
            verdict="FAIL",
            reasons=reasons + ["MALFORMED_ARTIFACT"],
            proof_class="ENFORCEMENT_AVAILABLE",
            reconstruction_eligible=False,
        )
    by_id = _index(obligations)
    for obligation_id, code in (
        ("bind:protected", "PROTECTED_INTENT_MISMATCH"),
        ("bind:graph", "REQUIREMENT_GRAPH_MISMATCH"),
        ("bind:xcat", "CATEGORY_MISMATCH"),
        ("bind:k3", "K3_MISMATCH"),
    ):
        item = by_id.get(obligation_id)
        if item and item["status"] in {"UNSATISFIED", "UNKNOWN"} and code != "K3_MISMATCH":
            if obligation_id == "bind:graph" and item["status"] == "UNKNOWN":
                return emit(
                    mode="VALIDATE_ONLY",
                    verdict="UNKNOWN",
                    reasons=reasons + ["UNKNOWN_PROOF"],
                    proof_class="ENFORCEMENT_AVAILABLE",
                    reconstruction_eligible=False,
                )
            if item["status"] == "UNSATISFIED":
                return emit(
                    mode="VALIDATE_ONLY",
                    verdict="FAIL",
                    reasons=reasons + [code],
                    proof_class="ENFORCEMENT_AVAILABLE",
                    reconstruction_eligible=False,
                )
    if by_id.get("bind:k3", {}).get("status") == "UNSATISFIED":
        return emit(
            mode="VALIDATE_ONLY",
            verdict="FAIL",
            reasons=reasons + ["K3_MISMATCH"],
            proof_class="ENFORCEMENT_AVAILABLE",
            reconstruction_eligible=False,
        )
    if not isinstance(artifact.get("effect_plan"), Mapping):
        return emit(
            mode="VALIDATE_ONLY",
            verdict="FAIL",
            reasons=reasons + ["MISSING_EFFECT_PLAN"],
            proof_class="ENFORCEMENT_AVAILABLE",
            reconstruction_eligible=False,
        )
    if by_id.get("proof:present", {}).get("status") == "UNKNOWN":
        return emit(
            mode="VALIDATE_ONLY",
            verdict="UNKNOWN",
            reasons=reasons + ["UNKNOWN_PROOF"],
            proof_class="ENFORCEMENT_AVAILABLE",
            reconstruction_eligible=_eligible(artifact),
        )
    if any(item["status"] == "UNKNOWN" for item in obligations):
        return emit(
            mode="VALIDATE_ONLY",
            verdict="UNKNOWN",
            reasons=reasons + ["OBLIGATION_UNKNOWN"],
            proof_class="ENFORCEMENT_AVAILABLE",
            reconstruction_eligible=_eligible(artifact),
        )
    if any(item["status"] in {"UNSATISFIED", "CONFLICT"} for item in obligations):
        return emit(
            mode="VALIDATE_ONLY",
            verdict="FAIL",
            reasons=reasons + ["OBLIGATION_UNSATISFIED"],
            proof_class="ENFORCEMENT_AVAILABLE",
            reconstruction_eligible=_eligible(artifact),
        )
    verified = _runtime_verified(evidence)
    return emit(
        mode="VALIDATE_ONLY",
        verdict="PASS",
        reasons=reasons + ["OBLIGATIONS_SATISFIED"],
        proof_class="ENFORCEMENT_VERIFIED" if verified else "ENFORCEMENT_AVAILABLE",
        reconstruction_eligible=False,
    )


def subject_from_k3(k3_output: Mapping[str, Any], compiled_prompt: str) -> dict[str, Any]:
    """Build a quality subject from kernel K3 output. Category normalization stays here."""
    if not isinstance(k3_output, Mapping) or not isinstance(compiled_prompt, str):
        raise ValueError("MALFORMED_K3")
    protected = _full_protected(k3_output.get("protected_binding"))
    if protected is None:
        raise ValueError("MALFORMED_K3")
    context = k3_output.get("category_context")
    context_map = context if isinstance(context, Mapping) else {}
    category = _normalize_category_id(context_map.get("xcat_id"))
    taxonomy = context_map.get("taxonomy_version")
    protected["category"] = category
    graph = k3_output.get("requirement_graph")
    techniques_raw = k3_output.get("techniques")
    techniques = [str(item) for item in techniques_raw] if isinstance(techniques_raw, list) else []
    selection = k3_output.get("selection_id")
    effect = k3_output.get("prompt_effect_plan")
    proof_raw = k3_output.get("proof_refs")
    proof_refs = (
        [item for item in proof_raw if isinstance(item, str) and item] if isinstance(proof_raw, list) else []
    )
    return {
        "compiled_prompt": compiled_prompt,
        "effect_plan": dict(effect) if isinstance(effect, Mapping) else None,
        "k3": {
            "selection_id": selection if isinstance(selection, str) else "",
            "techniques": techniques,
        },
        "proof_refs": proof_refs,
        "protected_intent": protected,
        "requirement_graph": dict(graph) if isinstance(graph, Mapping) else {},
        "xcat": {
            "active_category": category,
            "taxonomy_version": taxonomy if isinstance(taxonomy, str) else "",
        },
    }


def evaluate_from_k3(payload: Mapping[str, Any]) -> dict[str, Any]:
    """Quality over a kernel K3 result. Caller proof flags are not copied."""
    k3_output = payload.get("k3_output")
    compiled_prompt = payload.get("compiled_prompt")
    if not isinstance(k3_output, Mapping) or not isinstance(compiled_prompt, str):
        return {
            "receipt": _receipt(
                mode=payload.get("mode") if isinstance(payload.get("mode"), str) else "",
                verdict="FAIL",
                reasons=["MALFORMED_K3"],
                proof_class="DECLARED_POLICY",
                reconstruction_eligible=False,
            ),
            "subject": None,
        }
    subject = subject_from_k3(k3_output, compiled_prompt)
    mode = payload.get("mode") if isinstance(payload.get("mode"), str) else "VALIDATE_ONLY"
    evidence = payload.get("runtime_evidence") if isinstance(payload.get("runtime_evidence"), Mapping) else None
    receipt = run_mode(
        {
            "artifact": subject,
            "enforcement": "AVAILABLE",
            "mode": mode,
            "runtime_evidence": evidence,
        }
    )
    return {"receipt": receipt, "subject": subject}


def quality_loop(subject: Mapping[str, Any], mode: str = "VALIDATE_ONLY") -> dict[str, Any]:
    reconstruction = reconstruct(subject)
    kept = reconstruction["kept_subject"]
    receipt = run_mode(
        {
            "artifact": kept,
            "enforcement": subject.get("enforcement", "AVAILABLE"),
            "mode": mode,
            "proof_class": subject.get("proof_class"),
            "wasm_available": subject.get("wasm_available", True),
        }
    )
    receipt["quality_delta"] = reconstruction["quality_delta"]
    return {"quality_delta": reconstruction["quality_delta"], "receipt": receipt, "reconstruction": reconstruction}


def evaluate_request(payload: Mapping[str, Any]) -> dict[str, Any]:
    op = payload.get("op")
    if op == "obligations":
        subject = payload.get("subject")
        if not isinstance(subject, Mapping):
            raise ValueError("MALFORMED_SUBJECT")
        return {"obligations": evaluate_obligations(subject)}
    if op == "delta":
        before = payload.get("before")
        after = payload.get("after")
        if not isinstance(before, Mapping) or not isinstance(after, Mapping):
            raise ValueError("MALFORMED_SUBJECT")
        return quality_delta(before, after)
    if op == "reconstruct":
        subject = payload.get("subject")
        if not isinstance(subject, Mapping):
            raise ValueError("MALFORMED_SUBJECT")
        attempt = payload.get("attempt_index", 1)
        requested = payload.get("requested_repair")
        return reconstruct(
            subject,
            attempt_index=attempt if isinstance(attempt, int) else 1,
            requested_repair=requested if isinstance(requested, str) else None,
        )
    if op == "mode":
        return run_mode(payload)
    if op == "from_k3":
        return evaluate_from_k3(payload)
    if op == "loop":
        subject = payload.get("subject")
        if not isinstance(subject, Mapping):
            raise ValueError("MALFORMED_SUBJECT")
        mode = payload.get("mode") if isinstance(payload.get("mode"), str) else "VALIDATE_ONLY"
        return quality_loop(subject, mode)
    raise ValueError("UNSUPPORTED_OP")
