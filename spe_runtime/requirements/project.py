"""Project a protected envelope into the frozen K1 Requirement Graph.

The builder does not write the caller's objects and does not parse prose into
new amounts, facts, or obligations.
"""

from __future__ import annotations

import hashlib
from typing import Any, Mapping

from spe_runtime.portability.canonical import canonical_dumps, canonicalize
from spe_runtime.provenance.models import Provenance
from spe_runtime.provenance.rules import is_known_provenance, is_protected
from spe_runtime.requirements.conflicts import (
    ConflictRecord,
    ConflictSeverity,
    ConflictType,
    ResolutionState,
    apply_conflict_edges,
    conflict_id,
    detect_conflicts,
    unresolved_hard_conflicts,
)
from spe_runtime.requirements.graph import RequirementGraph
from spe_runtime.requirements.models import RequirementAtom, RequirementKind

SCHEMA_VERSION = "requirement_graph.g1r3"
EXPLICIT_BUDGET_REF = "explicit-budget"

_EXAMPLE_MARKERS = (
    "EXAMPLE / USER_SUPPLIED",
    "NON-AUTHORITATIVE",
)


def _items(value: Any) -> list[Any]:
    if isinstance(value, (list, tuple)):
        return list(value)
    return []


def _text(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    if not value.strip():
        return None
    return value


def _copy(value: Any) -> Any:
    return canonicalize(value)


def _is_example(value: Any) -> bool:
    if isinstance(value, str):
        return any(marker in value for marker in _EXAMPLE_MARKERS)
    if isinstance(value, dict):
        blob = " ".join(
            value.get(key)
            for key in ("classification", "statement", "text", "label")
            if isinstance(value.get(key), str)
        )
        return any(marker in blob for marker in _EXAMPLE_MARKERS)
    return False


def _source_provenance(record: Mapping[str, Any]) -> Provenance:
    explicit = record.get("provenance")
    if is_known_provenance(explicit):
        return Provenance(str(explicit))
    source = record.get("source")
    if not isinstance(source, str) or not source.strip():
        return Provenance.UNKNOWN
    if "user" in source.lower():
        return Provenance.USER_EXPLICIT
    return Provenance.EXTERNAL_EVIDENCE


def _provenance_index(records: list[Any]) -> dict[str, Mapping[str, Any]]:
    index: dict[str, Mapping[str, Any]] = {}
    for record in records:
        if isinstance(record, Mapping) and isinstance(record.get("provenance_id"), str):
            index[str(record["provenance_id"])] = record
    return index


def _fact_provenance(
    fact: Mapping[str, Any],
    index: Mapping[str, Mapping[str, Any]],
) -> Provenance:
    explicit = fact.get("provenance")
    if is_known_provenance(explicit):
        return Provenance(str(explicit))
    linked = fact.get("provenance_ids")
    if not isinstance(linked, (list, tuple)):
        return Provenance.UNKNOWN
    found = [index[item] for item in linked if isinstance(item, str) and item in index]
    if not found:
        return Provenance.UNKNOWN
    if any(_source_provenance(record) is Provenance.USER_EXPLICIT for record in found):
        return Provenance.USER_EXPLICIT
    if any(_source_provenance(record) is Provenance.EXTERNAL_EVIDENCE for record in found):
        return Provenance.EXTERNAL_EVIDENCE
    return Provenance.UNKNOWN


def _statement_ref(text: str) -> str:
    digest = hashlib.sha256(canonical_dumps(text).encode("utf-8")).hexdigest()
    return f"stmt-{digest[:16]}"


def _hard_key(explicit: str | None, source_ref: str) -> str:
    """Distinct obligations are not alternative values of one slot.

    An explicit semantic_key is the caller's slot (`budget` still clashes).
    Otherwise the key is namespaced by the stable source ref.
    """
    if explicit:
        return explicit
    return f"hard_constraint:{source_ref}"


def _hard_kind(item: Mapping[str, Any]) -> RequirementKind:
    kind = item.get("kind")
    if isinstance(kind, str) and kind.strip().upper() == RequirementKind.MUST_NOT.value:
        return RequirementKind.MUST_NOT
    return RequirementKind.MUST


def _statement_of(item: Mapping[str, Any]) -> str | None:
    statement = item.get("statement")
    if isinstance(statement, str):
        return statement
    description = item.get("description")
    if isinstance(description, str):
        return description
    return None


def _ref(item: Mapping[str, Any], *keys: str) -> str | None:
    for key in keys:
        value = item.get(key)
        if isinstance(value, str) and value:
            return value
    return None


class _Atoms:
    def __init__(self) -> None:
        self._by_id: dict[str, RequirementAtom] = {}

    def add(self, atom: RequirementAtom) -> None:
        existing = self._by_id.get(atom.requirement_id)
        if existing is None:
            self._by_id[atom.requirement_id] = atom
            return
        if existing == atom:
            return
        if is_protected(existing.provenance) and not is_protected(atom.provenance):
            return
        if is_protected(atom.provenance) and not is_protected(existing.provenance):
            self._by_id[atom.requirement_id] = atom

    def values(self) -> list[RequirementAtom]:
        return sorted(self._by_id.values(), key=lambda atom: atom.requirement_id)


def _atom(
    *,
    semantic_key: str,
    kind: RequirementKind,
    value: Any,
    provenance: Provenance,
    source_ref: str | None,
    statement: str | None,
) -> RequirementAtom:
    return RequirementAtom.create(
        semantic_key=semantic_key,
        kind=kind,
        value=_copy(value),
        provenance=provenance,
        source_ref=source_ref,
        statement=statement,
    )


def _conflict_marker(atom: RequirementAtom, summary: str) -> ConflictRecord:
    return ConflictRecord(
        conflict_id=conflict_id(
            ConflictType.EXPLICIT_CONFIRMED,
            atom.requirement_id,
            atom.requirement_id,
        ),
        left_requirement_id=atom.requirement_id,
        right_requirement_id=atom.requirement_id,
        conflict_type=ConflictType.EXPLICIT_CONFIRMED,
        severity=ConflictSeverity.HARD,
        resolution_state=ResolutionState.UNRESOLVED,
        summary=summary,
    )


def build_requirement_graph(
    protected: Mapping[str, Any] | None = None,
    category: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    """Return the canonical graph for one protected envelope."""
    source: dict[str, Any] = dict(protected or {})
    atoms = _Atoms()
    markers: list[RequirementAtom] = []

    goal = _text(source.get("goal"))
    if goal is not None:
        atoms.add(
            _atom(
                semantic_key="goal",
                kind=RequirementKind.MUST,
                value=goal,
                provenance=Provenance.USER_EXPLICIT,
                source_ref=None,
                statement=goal,
            )
        )

    for item in _items(source.get("hard_constraints")):
        if isinstance(item, str):
            text = _text(item)
            if text is None:
                continue
            source_ref = _statement_ref(text)
            atom = _atom(
                semantic_key=_hard_key(None, source_ref),
                kind=RequirementKind.MUST,
                value=text,
                provenance=Provenance.USER_EXPLICIT,
                source_ref=source_ref,
                statement=text,
            )
        elif isinstance(item, Mapping):
            statement = _statement_of(item)
            semantic_key = item.get("semantic_key")
            explicit = semantic_key.strip() if isinstance(semantic_key, str) and semantic_key.strip() else None
            source_ref = _ref(item, "constraint_id", "source_ref")
            if source_ref is None:
                source_ref = _statement_ref(statement if statement is not None else canonical_dumps(dict(item)))
            key = _hard_key(explicit, source_ref)
            if "value" in item:
                value: Any = item.get("value")
            elif statement is not None:
                value = statement
            else:
                value = dict(item)
            explicit = item.get("provenance")
            provenance = (
                Provenance(str(explicit))
                if is_known_provenance(explicit)
                else Provenance.USER_EXPLICIT
            )
            atom = _atom(
                semantic_key=key,
                kind=_hard_kind(item),
                value=value,
                provenance=provenance,
                source_ref=source_ref,
                statement=statement,
            )
        else:
            continue
        atoms.add(atom)
        if isinstance(atom.statement, str) and atom.statement.startswith("[CONFLICT]"):
            markers.append(atom)

    budget_present = "budget" in source and source.get("budget") is not None
    input_budget = _copy(source.get("budget")) if budget_present else None
    if budget_present:
        budget_statement = input_budget if isinstance(input_budget, str) else None
        if isinstance(input_budget, dict) and isinstance(input_budget.get("text"), str):
            budget_statement = input_budget["text"]
        atoms.add(
            _atom(
                semantic_key="budget",
                kind=RequirementKind.MUST,
                value=input_budget,
                provenance=Provenance.USER_EXPLICIT,
                source_ref=EXPLICIT_BUDGET_REF,
                statement=budget_statement,
            )
        )

    desired = source.get("desired_output", None)
    if desired is not None:
        if _is_example(desired):
            atoms.add(
                _atom(
                    semantic_key="user_supplied_pattern",
                    kind=RequirementKind.PREFERENCE,
                    value=desired,
                    provenance=Provenance.USER_EXPLICIT,
                    source_ref="desired-output",
                    statement=desired if isinstance(desired, str) else None,
                )
            )
        else:
            atoms.add(
                _atom(
                    semantic_key="desired_output",
                    kind=RequirementKind.MUST,
                    value=desired,
                    provenance=Provenance.USER_EXPLICIT,
                    source_ref="desired-output",
                    statement=desired if isinstance(desired, str) else None,
                )
            )

    provenance_records = [item for item in _items(source.get("provenance")) if isinstance(item, Mapping)]
    index = _provenance_index(provenance_records)
    for record in provenance_records:
        atoms.add(
            _atom(
                semantic_key="provenance_record",
                kind=RequirementKind.SHOULD,
                value=dict(record),
                provenance=_source_provenance(record),
                source_ref=_ref(record, "provenance_id", "source_ref"),
                statement=None,
            )
        )

    for fact in _items(source.get("facts")):
        if not isinstance(fact, Mapping):
            continue
        statement = _statement_of(fact)
        atoms.add(
            _atom(
                semantic_key="fact",
                kind=RequirementKind.SHOULD,
                value=dict(fact),
                provenance=_fact_provenance(fact, index),
                source_ref=_ref(fact, "fact_id", "source_ref"),
                statement=statement,
            )
        )

    for unknown in _items(source.get("uncertainties")):
        if isinstance(unknown, str):
            text = _text(unknown)
            if text is None:
                continue
            value = text
            statement = text
            source_ref = None
        elif isinstance(unknown, Mapping):
            value = dict(unknown)
            statement = _statement_of(unknown)
            source_ref = _ref(unknown, "uncertainty_id", "source_ref")
        else:
            continue
        atoms.add(
            _atom(
                semantic_key="unknown",
                kind=RequirementKind.SHOULD,
                value=value,
                provenance=Provenance.UNKNOWN,
                source_ref=source_ref,
                statement=statement,
            )
        )

    for preference in _items(source.get("user_preferences")):
        if isinstance(preference, str):
            text = _text(preference)
            if text is None:
                continue
            value = text
            statement = text
            source_ref = None
            example = _is_example(text)
        elif isinstance(preference, Mapping):
            value = dict(preference)
            statement = _statement_of(preference)
            source_ref = _ref(preference, "preference_id", "source_ref")
            example = _is_example(preference) or _is_example(statement or "")
        else:
            continue
        atoms.add(
            _atom(
                semantic_key="user_supplied_pattern" if example else "user_preference",
                kind=RequirementKind.PREFERENCE,
                value=value,
                provenance=Provenance.USER_EXPLICIT,
                source_ref=source_ref,
                statement=statement,
            )
        )

    for criterion in _items(source.get("acceptance_criteria")):
        if isinstance(criterion, str):
            text = _text(criterion)
            if text is None:
                continue
            value = text
            statement = text
            source_ref = None
        elif isinstance(criterion, Mapping):
            value = dict(criterion)
            statement = _statement_of(criterion)
            source_ref = _ref(criterion, "criterion_id", "source_ref")
        else:
            continue
        atoms.add(
            _atom(
                semantic_key="acceptance_criterion",
                kind=RequirementKind.MUST,
                value=value,
                provenance=Provenance.USER_EXPLICIT,
                source_ref=source_ref,
                statement=statement,
            )
        )

    for offset, item in enumerate(_items(source.get("conflicts"))):
        if isinstance(item, str):
            text = _text(item)
            if text is None:
                continue
            statement = text if text.startswith("[CONFLICT]") else f"[CONFLICT] {text}"
            source_ref = f"conflict-{offset}"
            atom = _atom(
                semantic_key=_hard_key(None, source_ref),
                kind=RequirementKind.MUST,
                value=statement,
                provenance=Provenance.USER_EXPLICIT,
                source_ref=source_ref,
                statement=statement,
            )
        elif isinstance(item, Mapping):
            statement = _statement_of(item) or ""
            if statement and not statement.startswith("[CONFLICT]"):
                statement = f"[CONFLICT] {statement}"
            source_ref = _ref(item, "constraint_id", "source_ref") or f"conflict-{offset}"
            atom = _atom(
                semantic_key=_hard_key(None, source_ref),
                kind=RequirementKind.MUST,
                value=dict(item),
                provenance=Provenance.USER_EXPLICIT,
                source_ref=source_ref,
                statement=statement or None,
            )
        else:
            continue
        atoms.add(atom)
        markers.append(atom)

    for offset, trace in enumerate(_items(source.get("category_trace"))):
        if not isinstance(trace, Mapping):
            continue
        atoms.add(
            _atom(
                semantic_key="category_ref",
                kind=RequirementKind.PREFERENCE,
                value=dict(trace),
                provenance=Provenance.USER_EXPLICIT,
                source_ref=f"category-trace-{offset}",
                statement=None,
            )
        )

    if isinstance(category, Mapping):
        fields = {}
        for key in ("xcat_id", "protocol_domain_id", "display_label"):
            value = category.get(key)
            if isinstance(value, str) and value.strip():
                fields[key] = value.strip()
        if fields:
            atoms.add(
                _atom(
                    semantic_key="category_ref",
                    kind=RequirementKind.PREFERENCE,
                    value=fields,
                    provenance=Provenance.USER_EXPLICIT,
                    source_ref="category",
                    statement=None,
                )
            )

    graph = RequirementGraph()
    for atom in atoms.values():
        graph = graph.with_node(atom)

    extra: list[ConflictRecord] = []
    for atom in markers:
        summary = atom.statement or "EXPLICIT_CONFIRMED"
        extra.append(_conflict_marker(atom, summary))
    conflicts = detect_conflicts(graph, extra=tuple(extra))
    graph = apply_conflict_edges(graph, conflicts)
    if not graph.nodes:
        validity = "INCOMPLETE"
    elif unresolved_hard_conflicts(conflicts):
        validity = "CONFLICTED"
    else:
        validity = "VALID"

    graph_dict = graph.to_dict()
    digest = "rg-" + hashlib.sha256(canonical_dumps(graph_dict).encode("utf-8")).hexdigest()
    budget_atoms = [atom for atom in atoms.values() if atom.semantic_key == "budget"]
    budget_values = [atom.value for atom in budget_atoms]
    graph_budget = input_budget
    return {
        "schema_version": SCHEMA_VERSION,
        "validity": validity,
        "graph_digest": digest,
        "input_budget": input_budget,
        "graph_budget": graph_budget,
        "output_bound_budget": graph_budget,
        "budget_values": budget_values,
        "conflicts": [record.to_dict() for record in conflicts],
        "graph": graph_dict,
        "node_ids": sorted(graph_dict["nodes"]),
        "edge_ids": sorted(graph_dict["edges"]),
    }


__all__ = ["SCHEMA_VERSION", "EXPLICIT_BUDGET_REF", "build_requirement_graph"]
