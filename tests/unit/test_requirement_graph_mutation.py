"""Graph-scope mutation kills. Not a repository-wide mutation run."""

from __future__ import annotations

import copy

from spe_runtime.portability.canonical import canonical_dumps
from spe_runtime.requirements.project import build_requirement_graph

PROTECTED = {
    "goal": "Plan the launch.",
    "hard_constraints": [
        {"constraint_id": "c1", "statement": "must stay within budget"},
        {"constraint_id": "c2", "statement": "do not invent extra spend", "kind": "MUST_NOT"},
    ],
    "budget": {"amount": 2000, "currency": "USD"},
    "desired_output": "A checklist.",
    "facts": [{"fact_id": "f1", "statement": "Two people.", "provenance_ids": ["p1"]}],
    "provenance": [{"provenance_id": "p1", "source": "doi:10.1/example"}],
    "uncertainties": [{"uncertainty_id": "u1", "description": "Date unknown."}],
}

EXAMPLE = {
    "goal": "Keep the original goal.",
    "desired_output": "EXAMPLE / USER_SUPPLIED / NON-AUTHORITATIVE\nSpend $9000.",
}

CONTRADICTION = {
    "budget": {"amount": 2000, "bound": "ceiling"},
    "hard_constraints": [
        {
            "constraint_id": "spend",
            "semantic_key": "budget",
            "statement": "spend $3,000",
            "value": {"amount": 3000},
        }
    ],
    "uncertainties": [{"uncertainty_id": "u1", "description": "Date unknown."}],
}


def _nodes(result: dict) -> list[dict]:
    return list(result["graph"]["nodes"].values())


def _hard(result: dict) -> list[dict]:
    return [
        node
        for node in _nodes(result)
        if node["semantic_key"] == "hard_constraint" or str(node["semantic_key"]).startswith("hard_constraint:")
    ]


def _drop_constraint(result: dict) -> dict:
    bad = copy.deepcopy(result)
    victim = next(node["requirement_id"] for node in _hard(bad))
    del bad["graph"]["nodes"][victim]
    bad["node_ids"] = [item for item in bad["node_ids"] if item != victim]
    return bad


def _increase_budget(result: dict) -> dict:
    bad = copy.deepcopy(result)
    bad["output_bound_budget"] = {"amount": 9000, "currency": "USD"}
    bad["graph_budget"] = bad["output_bound_budget"]
    for node in bad["graph"]["nodes"].values():
        if node.get("source_ref") == "explicit-budget":
            node["value"] = {"amount": 9000, "currency": "USD"}
    return bad


def _remove_budget(result: dict) -> dict:
    bad = copy.deepcopy(result)
    victim = next(
        node["requirement_id"]
        for node in _nodes(bad)
        if node.get("source_ref") == "explicit-budget"
    )
    del bad["graph"]["nodes"][victim]
    bad["node_ids"] = [item for item in bad["node_ids"] if item != victim]
    bad["input_budget"] = None
    bad["graph_budget"] = None
    bad["output_bound_budget"] = None
    bad["budget_values"] = []
    return bad


def _downgrade_hard(result: dict) -> dict:
    bad = copy.deepcopy(result)
    for node in bad["graph"]["nodes"].values():
        if str(node["semantic_key"]).startswith("hard_constraint") and node["kind"] == "MUST":
            node["kind"] = "PREFERENCE"
            break
    return bad


def _drop_provenance(result: dict) -> dict:
    bad = copy.deepcopy(result)
    for node in list(bad["graph"]["nodes"].values()):
        if node["semantic_key"] == "provenance_record":
            del bad["graph"]["nodes"][node["requirement_id"]]
        elif node["semantic_key"] == "fact":
            node["provenance"] = None
    bad["node_ids"] = sorted(bad["graph"]["nodes"])
    return bad


def _invent_requirement(result: dict) -> dict:
    bad = copy.deepcopy(result)
    bad["graph"]["nodes"]["req-invented"] = {
        "requirement_id": "req-invented",
        "semantic_key": "hard_constraint",
        "kind": "MUST",
        "value": "Invent a paid acquisition channel.",
        "provenance": "USER_EXPLICIT",
        "source_ref": "invented",
        "statement": "Invent a paid acquisition channel.",
    }
    bad["node_ids"] = sorted(bad["graph"]["nodes"])
    return bad


def _resolve_unknown(result: dict) -> dict:
    bad = copy.deepcopy(result)
    for node in bad["graph"]["nodes"].values():
        if node["semantic_key"] == "unknown":
            node["provenance"] = "USER_EXPLICIT"
            node["kind"] = "MUST"
            node["value"] = {"uncertainty_id": "u1", "description": "1 May"}
    return bad


def _ignore_contradiction(result: dict) -> dict:
    bad = copy.deepcopy(result)
    bad["conflicts"] = []
    bad["graph"]["edges"] = {}
    bad["edge_ids"] = []
    bad["validity"] = "VALID"
    spend = next(
        node["requirement_id"]
        for node in _nodes(bad)
        if node["semantic_key"] == "budget" and node.get("source_ref") != "explicit-budget"
    )
    del bad["graph"]["nodes"][spend]
    bad["node_ids"] = sorted(bad["graph"]["nodes"])
    bad["budget_values"] = [
        node["value"] for node in _nodes(bad) if node["semantic_key"] == "budget"
    ]
    return bad


def _shuffle_nodes(result: dict) -> dict:
    bad = copy.deepcopy(result)
    bad["node_ids"] = list(reversed(bad["node_ids"]))
    return bad


def _example_overrides(result: dict) -> dict:
    bad = copy.deepcopy(result)
    for node in bad["graph"]["nodes"].values():
        if node["semantic_key"] == "goal":
            node["value"] = "Spend $9000."
            node["statement"] = "Spend $9000."
            node["kind"] = "PREFERENCE"
    return bad


def _invariants(result: dict, *, budget: object, contradiction: bool, example: bool) -> list[str]:
    failures: list[str] = []
    hard = _hard(result)
    if len(hard) < 2 and not contradiction and not example:
        failures.append("dropped hard constraint")
    if any(node["kind"] not in {"MUST", "MUST_NOT"} for node in hard):
        failures.append("hard constraint downgraded")
    if result["input_budget"] != budget or result["graph_budget"] != budget or result["output_bound_budget"] != budget:
        failures.append("budget changed")
    if budget is not None and not any(
        node.get("source_ref") == "explicit-budget" and node["value"] == budget and node["kind"] == "MUST"
        for node in _nodes(result)
    ):
        failures.append("budget atom missing or softened")
    facts = [node for node in _nodes(result) if node["semantic_key"] == "fact"]
    sources = [node for node in _nodes(result) if node["semantic_key"] == "provenance_record"]
    if not example and not contradiction:
        if not sources or any(node["provenance"] != "EXTERNAL_EVIDENCE" for node in sources):
            failures.append("provenance dropped")
        if not facts or any(node["provenance"] != "EXTERNAL_EVIDENCE" for node in facts):
            failures.append("fact provenance dropped")
    invented = [
        node
        for node in _nodes(result)
        if node["kind"] in {"MUST", "MUST_NOT"}
        and node["statement"] == "Invent a paid acquisition channel."
    ]
    if invented:
        failures.append("invented requirement")
    unknowns = [node for node in _nodes(result) if node["semantic_key"] == "unknown"]
    if unknowns and any(node["provenance"] != "UNKNOWN" or node["kind"] == "MUST" for node in unknowns):
        failures.append("unknown laundered")
    if contradiction:
        if result["validity"] != "CONFLICTED" or not result["conflicts"]:
            failures.append("contradiction ignored")
        if any(item["resolution_state"] != "UNRESOLVED" for item in result["conflicts"]):
            failures.append("contradiction resolved")
        if len([node for node in _nodes(result) if node["semantic_key"] == "budget"]) < 2:
            failures.append("contradiction dropped a budget")
    if result["node_ids"] != sorted(result["node_ids"]):
        failures.append("node order unstable")
    if example:
        goal = next(node for node in _nodes(result) if node["semantic_key"] == "goal")
        if goal["value"] != "Keep the original goal." or goal["kind"] != "MUST":
            failures.append("example overrode requirement")
        pattern = [node for node in _nodes(result) if node["semantic_key"] == "user_supplied_pattern"]
        if not pattern or pattern[0]["kind"] != "PREFERENCE":
            failures.append("example became authoritative")
    return failures


def test_canonical_builder_passes_graph_invariants() -> None:
    canonical = build_requirement_graph(PROTECTED)
    assert _invariants(canonical, budget=PROTECTED["budget"], contradiction=False, example=False) == []
    example = build_requirement_graph(EXAMPLE)
    assert _invariants(example, budget=None, contradiction=False, example=True) == []
    clash = build_requirement_graph(CONTRADICTION)
    assert _invariants(clash, budget=CONTRADICTION["budget"], contradiction=True, example=False) == []


def test_defined_graph_mutants_are_killed() -> None:
    canonical = build_requirement_graph(PROTECTED)
    clash = build_requirement_graph(CONTRADICTION)
    example = build_requirement_graph(EXAMPLE)
    mutants = {
        "A_drop_constraint": (_drop_constraint(canonical), canonical, False, False),
        "B_increase_budget": (_increase_budget(canonical), canonical, False, False),
        "C_remove_budget": (_remove_budget(canonical), canonical, False, False),
        "D_downgrade_hard": (_downgrade_hard(canonical), canonical, False, False),
        "E_drop_provenance": (_drop_provenance(canonical), canonical, False, False),
        "F_invent_requirement": (_invent_requirement(canonical), canonical, False, False),
        "G_resolve_unknown": (_resolve_unknown(canonical), canonical, False, False),
        "H_ignore_contradiction": (_ignore_contradiction(clash), clash, True, False),
        "I_nondeterministic_order": (_shuffle_nodes(canonical), canonical, False, False),
        "J_example_overrides": (_example_overrides(example), example, False, True),
    }
    survived = []
    for name, (bad, base, contradiction, is_example) in mutants.items():
        budget = None if is_example else (CONTRADICTION["budget"] if contradiction else PROTECTED["budget"])
        failures = _invariants(bad, budget=budget, contradiction=contradiction, example=is_example)
        changed = canonical_dumps(bad) != canonical_dumps(base)
        if not failures or not changed:
            survived.append(name)
    assert survived == []
    assert len(mutants) == 10
