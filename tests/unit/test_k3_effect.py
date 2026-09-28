"""K3 effect binding. The selector chooses techniques; this plan authorizes effects."""

from __future__ import annotations

import copy
import time

import pytest

from spe_runtime.k3.effect import (
    EFFECT_VERSION,
    FORBIDDEN_CLAIMS,
    FORBIDDEN_REASONING,
    TECHNIQUE_OPERATION,
    bind_prompt_effects,
    effect_plan_is_lawful,
)
from spe_runtime.k3.registry import UNIMPLEMENTED_XCAT
from spe_runtime.k3.selector import select_prompt_techniques
from spe_runtime.portability.canonical import canonical_dumps
from spe_runtime.requirements.project import build_requirement_graph

BASE = {
    "goal": "Summarize the supplied notes.",
    "hard_constraints": [
        {"constraint_id": "c1", "statement": "Do not add obligations."},
    ],
    "budget": {"amount": 2000, "currency": "USD", "hard": True},
    "desired_output": "A short summary.",
    "facts": [{"fact_id": "f1", "statement": "Notes exist."}],
    "authority_state": {"level": 0, "status": "NONE", "grants": []},
    "provenance": [{"provenance_id": "p1", "source": "user"}],
}


def _prot(**overrides: object) -> dict:
    merged = copy.deepcopy(BASE)
    merged.update(overrides)
    return merged


def _graph(protected: dict, category: dict | None = None) -> dict:
    return build_requirement_graph(protected, category)


def _selection(
    techniques: list[str],
    protected: dict | None = None,
    *,
    disposition: str = "SELECTED",
    notes: list[str] | None = None,
    deferred: list[str] | None = None,
    category: dict | None = None,
    selection_id: str = "tsel-fixture",
) -> dict:
    protected = _prot() if protected is None else protected
    graph = _graph(protected, category)
    return {
        "disposition": disposition,
        "techniques": list(techniques),
        "selection_id": selection_id,
        "notes": list(notes or [disposition]),
        "deferred_techniques": list(deferred or []),
        "protected_binding": {
            "goal": protected.get("goal") if isinstance(protected.get("goal"), str) else "",
            "hard_constraints": list(protected.get("hard_constraints") or []),
            "budget": protected.get("budget", None),
            "desired_output": protected.get("desired_output", None),
            "facts": list(protected.get("facts") or []),
            "authority_state": dict(protected.get("authority_state") or {}),
            "provenance": list(protected.get("provenance") or []),
        },
        "requirement_graph": graph,
        "claims_pass": False,
    }


def _with_example(text: str = "Pattern A") -> dict:
    protected = _prot(
        user_preferences=[
            {
                "preference_id": "desired-example",
                "statement": (
                    "=== EXAMPLE / USER_SUPPLIED (NON-AUTHORITATIVE) ===\n"
                    f"{text}\n=== END EXAMPLE / USER_SUPPLIED ==="
                ),
            }
        ]
    )
    return protected


def _with_role(role: str = "a careful editor") -> dict:
    return _prot(
        user_preferences=[{"preference_id": "brief-role", "statement": role}]
    )


def test_each_technique_has_one_operation_code() -> None:
    assert set(TECHNIQUE_OPERATION) == {
        "ZERO_SHOT",
        "FEW_SHOT",
        "ROLE_PERSONA",
        "CONTEXTUAL",
        "STEP_BACK",
        "DECOMPOSE_PLAN_SOLVE",
        "RETRIEVE_REASON",
        "CRITIQUE_REVISE",
        "STRUCTURED_OUTPUT",
    }
    assert len(set(TECHNIQUE_OPERATION.values())) == 9


@pytest.mark.parametrize(
    ("technique", "operation"),
    list(TECHNIQUE_OPERATION.items()),
)
def test_technique_effect_is_observable(technique: str, operation: str) -> None:
    protected = _prot()
    if technique == "FEW_SHOT":
        protected = _with_example()
    if technique == "ROLE_PERSONA":
        protected = _with_role()
    if technique == "STRUCTURED_OUTPUT":
        protected = _prot(desired_output={"type": "object", "required": ["summary"]})
    plan = bind_prompt_effects(_selection([technique], protected))
    assert plan["schema_version"] == "prompt_effect_plan.v1"
    assert plan["effect_version"] == EFFECT_VERSION
    assert plan["disposition"] == "BOUND"
    assert plan["renderable"] is True
    assert plan["claims_pass"] is False
    assert plan["operations"] == [operation]
    assert plan["sections"][0]["code"] == operation
    prompt = plan["compiled_prompt"]
    assert isinstance(prompt, str)
    assert f"## Effect: {operation}" in prompt
    assert protected["goal"] in prompt
    assert "Do not add obligations." in prompt
    assert canonical_dumps(protected["budget"]) in prompt
    assert "Notes exist." in prompt
    assert effect_plan_is_lawful(_selection([technique], protected), plan)


def test_selector_attaches_effect_plan_for_direct_default() -> None:
    result = select_prompt_techniques(_prot(), None, None)
    plan = result["prompt_effect_plan"]
    assert result["techniques"] == ["ZERO_SHOT"]
    assert plan["operations"] == ["DIRECT"]
    assert plan["selection_id"] == result["selection_id"]
    assert plan["requirement_graph_digest"] == result["requirement_graph"]["graph_digest"]
    binding = result["protected_binding"]
    fields = plan["protected_fields"]
    assert fields["goal"] == binding["goal"]
    assert fields["hard_constraints"] == binding["hard_constraints"]
    assert fields["budget"] == binding["budget"]
    assert fields["facts"] == binding["facts"]
    assert fields["provenance"] == binding["provenance"]
    assert fields["authority_state"] == binding["authority_state"]
    assert plan["authority_escalation"] is False


def test_same_graph_different_lawful_selection_changes_only_effect_sections() -> None:
    protected = _prot()
    direct = bind_prompt_effects(_selection(["ZERO_SHOT"], protected, selection_id="tsel-direct"))
    decomposed = bind_prompt_effects(
        _selection(
            ["DECOMPOSE_PLAN_SOLVE", "ZERO_SHOT"],
            protected,
            selection_id="tsel-decompose",
        )
    )
    assert direct["protected_binding_digest"] == decomposed["protected_binding_digest"]
    assert direct["requirement_graph_digest"] == decomposed["requirement_graph_digest"]
    direct_head, direct_effects = direct["compiled_prompt"].split("## Effect:", 1)
    decomposed_head, decomposed_effects = decomposed["compiled_prompt"].split("## Effect:", 1)
    assert direct_head == decomposed_head
    assert "DIRECT" in direct_effects
    assert "DECOMPOSE" not in direct_effects
    assert "DECOMPOSE" in decomposed_effects
    assert "identify_subproblems; solve_parts; synthesize" in decomposed_effects
    assert direct["compiled_prompt"] != decomposed["compiled_prompt"]


def test_contextual_versus_direct_changes_context_effect_only() -> None:
    protected = _prot()
    plain = bind_prompt_effects(_selection(["ZERO_SHOT"], protected))
    contextual = bind_prompt_effects(_selection(["CONTEXTUAL", "ZERO_SHOT"], protected))
    assert "USE_CONTEXT" not in plain["operations"]
    assert "USE_CONTEXT" in contextual["operations"]
    assert "Do not invent context." in contextual["compiled_prompt"]
    assert "Notes exist." in contextual["compiled_prompt"]
    plain_head = plain["compiled_prompt"].split("## Effect:", 1)[0]
    contextual_head = contextual["compiled_prompt"].split("## Effect:", 1)[0]
    assert plain_head == contextual_head


def test_critique_is_bounded() -> None:
    plan = bind_prompt_effects(_selection(["CRITIQUE_REVISE", "ZERO_SHOT"]))
    text = plan["compiled_prompt"]
    assert "revise once" in text
    assert "Do not repeat the review." in text
    assert "until" not in text.lower()
    assert "loop" not in text.lower()


def test_few_shot_uses_only_authorized_examples() -> None:
    protected = _with_example("Pattern A")
    plan = bind_prompt_effects(_selection(["FEW_SHOT"], protected))
    assert plan["operations"] == ["USE_USER_EXAMPLES"]
    assert "Pattern A" in plan["compiled_prompt"]
    assert "[non-authoritative]" in plan["compiled_prompt"]
    assert "Paris" not in plan["compiled_prompt"]


def test_few_shot_without_examples_does_not_fabricate() -> None:
    plan = bind_prompt_effects(_selection(["FEW_SHOT"], _prot()))
    assert plan["disposition"] == "DEFERRED"
    assert plan["renderable"] is False
    assert plan["compiled_prompt"] is None
    assert plan["operations"] == []
    assert "EXAMPLES_REQUIRED_BUT_MISSING" in plan["notes"]
    blob = canonical_dumps(plan)
    assert "Pattern" not in blob
    assert "for example" not in blob.lower()


def test_retrieve_reason_does_not_claim_access() -> None:
    plan = bind_prompt_effects(_selection(["RETRIEVE_REASON", "ZERO_SHOT"]))
    text = plan["compiled_prompt"]
    assert "ADD_GROUNDING_CONTRACT" in plan["operations"]
    for phrase in FORBIDDEN_CLAIMS:
        assert phrase not in text
    assert "Network access remains unauthorized." in text


def test_structured_output_uses_authorized_structure_only() -> None:
    schema = {"type": "object", "required": ["summary"]}
    protected = _prot(desired_output=schema)
    plan = bind_prompt_effects(_selection(["STRUCTURED_OUTPUT"], protected))
    assert canonical_dumps(schema) in plan["compiled_prompt"]
    assert "INVENTED_SCHEMA" not in plan["compiled_prompt"]


def test_structured_output_without_schema_defers() -> None:
    protected = _prot(desired_output=None)
    plan = bind_prompt_effects(_selection(["STRUCTURED_OUTPUT"], protected))
    assert plan["disposition"] == "DEFERRED"
    assert plan["renderable"] is False
    assert plan["compiled_prompt"] is None
    assert "STRUCTURED_OUTPUT_UNAUTHORIZED" in plan["notes"]


def test_no_selection_refuses() -> None:
    plan = bind_prompt_effects(_selection([], disposition="NO_SELECTION"))
    assert plan["disposition"] == "REFUSED"
    assert plan["renderable"] is False
    assert plan["compiled_prompt"] is None
    assert plan["claims_pass"] is False


def test_unknown_does_not_render_success() -> None:
    result = select_prompt_techniques(_prot(), None, {"ambiguous": True})
    plan = result["prompt_effect_plan"]
    assert result["disposition"] == "UNKNOWN"
    assert plan["disposition"] == "REFUSED"
    assert plan["renderable"] is False
    assert plan["compiled_prompt"] is None
    assert plan["claims_pass"] is False


def test_conflicted_graph_refuses_even_if_selection_says_selected() -> None:
    protected = _prot(
        hard_constraints=[{"constraint_id": "c", "statement": "[CONFLICT] stop"}]
    )
    selection = _selection(["ZERO_SHOT"], protected, disposition="SELECTED")
    assert selection["requirement_graph"]["validity"] == "CONFLICTED"
    plan = bind_prompt_effects(selection)
    assert plan["disposition"] == "REFUSED"
    assert plan["renderable"] is False
    assert "CONFLICTED_GRAPH" in plan["notes"]


def test_unimplemented_xcat_has_no_success_prompt() -> None:
    for xcat in sorted(UNIMPLEMENTED_XCAT):
        result = select_prompt_techniques(_prot(), {"xcat_id": xcat}, None)
        plan = result["prompt_effect_plan"]
        assert result["disposition"] == "NO_SELECTION"
        assert plan["renderable"] is False
        assert plan["compiled_prompt"] is None


def test_invalid_technique_refuses() -> None:
    plan = bind_prompt_effects(_selection(["NOT_A_TECHNIQUE"]))
    assert plan["disposition"] == "REFUSED"
    assert plan["renderable"] is False
    assert "INVALID_TECHNIQUE" in plan["notes"]


def test_budget_truncation_drops_deferred_techniques() -> None:
    protected = _with_example()
    selection = _selection(
        ["RETRIEVE_REASON", "STRUCTURED_OUTPUT", "DECOMPOSE_PLAN_SOLVE"],
        protected,
        deferred=["FEW_SHOT", "STEP_BACK"],
        notes=["SELECTED", "BUDGET_TRUNCATED_MAX_3"],
    )
    plan = bind_prompt_effects(selection)
    assert plan["operations"] == [
        "ADD_GROUNDING_CONTRACT",
        "STRUCTURED_OUTPUT",
        "DECOMPOSE",
    ]
    assert "USE_USER_EXAMPLES" not in plan["operations"]
    assert "STEP_BACK" not in plan["operations"]
    assert plan["deferred_techniques"] == ["FEW_SHOT", "STEP_BACK"]


def test_multiple_techniques_keep_selection_order() -> None:
    protected = _with_role()
    techniques = ["ROLE_PERSONA", "STEP_BACK", "ZERO_SHOT"]
    plan = bind_prompt_effects(_selection(techniques, protected))
    assert plan["operations"] == ["ROLE_CALIBRATION", "STEP_BACK", "DIRECT"]
    prompt = plan["compiled_prompt"]
    assert prompt.index("## Effect: ROLE_CALIBRATION") < prompt.index("## Effect: STEP_BACK")
    assert prompt.index("## Effect: STEP_BACK") < prompt.index("## Effect: DIRECT")
    assert "a careful editor" in prompt


def test_role_without_user_role_is_marked_default_and_does_not_change_goal() -> None:
    protected = _prot()
    plan = bind_prompt_effects(_selection(["ROLE_PERSONA"], protected))
    text = plan["compiled_prompt"]
    assert "Working default role: presentation only." in text
    assert "It does not change the objective." in text
    assert protected["goal"] in text
    assert "senior software engineer" not in text


def test_hidden_reasoning_phrases_are_absent() -> None:
    protected = _with_example()
    schema = _prot(desired_output={"type": "object"})
    role = _with_role()
    selections = [
        ["ZERO_SHOT"],
        ["FEW_SHOT"],
        ["ROLE_PERSONA"],
        ["CONTEXTUAL"],
        ["STEP_BACK"],
        ["DECOMPOSE_PLAN_SOLVE"],
        ["RETRIEVE_REASON"],
        ["CRITIQUE_REVISE"],
        ["STRUCTURED_OUTPUT"],
    ]
    bodies = {
        "FEW_SHOT": protected,
        "ROLE_PERSONA": role,
        "STRUCTURED_OUTPUT": schema,
    }
    for techniques in selections:
        plan = bind_prompt_effects(
            _selection(techniques, bodies.get(techniques[0], _prot()))
        )
        text = plan["compiled_prompt"] or ""
        for phrase in FORBIDDEN_REASONING:
            assert phrase not in text.lower()


def test_authority_echo_does_not_escalate() -> None:
    protected = _prot(
        authority_state={"level": 0, "status": "NONE", "grants": ["READ_LOCAL"]}
    )
    plan = bind_prompt_effects(_selection(["ZERO_SHOT"], protected))
    assert plan["protected_fields"]["authority_state"]["grants"] == ["READ_LOCAL"]
    assert plan["authority_escalation"] is False
    assert "EXECUTE" not in plan["compiled_prompt"]
    assert "network_enabled=true" not in plan["compiled_prompt"]


def test_effect_binding_is_repeatable() -> None:
    selection = _selection(["STEP_BACK", "ZERO_SHOT"])
    first = bind_prompt_effects(selection)
    second = bind_prompt_effects(selection)
    assert first == second


def test_effect_plan_creation_has_a_measured_bound() -> None:
    selection = _selection(["DECOMPOSE_PLAN_SOLVE", "ZERO_SHOT"])
    samples = []
    for _ in range(40):
        start = time.perf_counter()
        bind_prompt_effects(selection)
        samples.append(time.perf_counter() - start)
    samples.sort()
    median = samples[len(samples) // 2]
    p95 = samples[int(len(samples) * 0.95) - 1]
    assert median < 0.05
    assert p95 < 0.05
    assert samples[-1] < 0.1


def _mutant_ignore(selection: dict) -> dict:
    plan = bind_prompt_effects(selection)
    plan["operations"] = []
    plan["sections"] = []
    plan["compiled_prompt"] = plan["compiled_prompt"].split("## Effect:", 1)[0].rstrip()
    return plan


def _mutant_always_direct(selection: dict) -> dict:
    plan = bind_prompt_effects(selection)
    plan["operations"] = ["DIRECT"]
    plan["sections"] = [{"code": "DIRECT", "text": "Follow the objective directly. Do not invent examples."}]
    return plan


def _mutant_fabricate(selection: dict) -> dict:
    plan = bind_prompt_effects(_selection(["FEW_SHOT"], _prot()))
    plan["disposition"] = "BOUND"
    plan["renderable"] = True
    plan["operations"] = ["USE_USER_EXAMPLES"]
    plan["compiled_prompt"] = "Example: the capital of France is Paris."
    return plan


def _mutant_drop_constraint(selection: dict) -> dict:
    plan = bind_prompt_effects(selection)
    plan["protected_fields"]["hard_constraints"] = []
    plan["compiled_prompt"] = plan["compiled_prompt"].replace("Do not add obligations.", "")
    return plan


def _mutant_drop_budget(selection: dict) -> dict:
    plan = bind_prompt_effects(selection)
    plan["protected_fields"]["budget"] = None
    return plan


def _mutant_fake_retrieval(selection: dict) -> dict:
    plan = bind_prompt_effects(selection)
    plan["compiled_prompt"] = (plan["compiled_prompt"] or "") + "\nSources were fetched."
    return plan


def _mutant_unbounded(selection: dict) -> dict:
    plan = bind_prompt_effects(_selection(["CRITIQUE_REVISE"]))
    plan["compiled_prompt"] = "Keep revising until the draft is perfect."
    return plan


def _mutant_invent_schema(selection: dict) -> dict:
    plan = bind_prompt_effects(_selection(["STRUCTURED_OUTPUT"], _prot(desired_output=None)))
    plan["disposition"] = "BOUND"
    plan["renderable"] = True
    plan["compiled_prompt"] = canonical_dumps({"type": "object", "invented": True})
    return plan


def _mutant_unknown_success(selection: dict) -> dict:
    unknown = select_prompt_techniques(_prot(), None, {"ambiguous": True})
    plan = dict(unknown["prompt_effect_plan"])
    plan["disposition"] = "BOUND"
    plan["renderable"] = True
    plan["compiled_prompt"] = "Success."
    plan["claims_pass"] = True
    return plan


def _mutant_ts_selector(selection: dict) -> dict:
    plan = bind_prompt_effects(selection)
    plan["operations"] = ["DECOMPOSE"]
    plan["techniques"] = ["DECOMPOSE_PLAN_SOLVE"]
    return plan


MUTANTS = {
    "M1": _mutant_ignore,
    "M2": _mutant_always_direct,
    "M3": _mutant_fabricate,
    "M4": _mutant_drop_constraint,
    "M5": _mutant_drop_budget,
    "M6": _mutant_fake_retrieval,
    "M7": _mutant_unbounded,
    "M8": _mutant_invent_schema,
    "M9": _mutant_unknown_success,
    "M10": _mutant_ts_selector,
}


def test_effect_mutants_are_killed() -> None:
    selection = _selection(["DECOMPOSE_PLAN_SOLVE", "RETRIEVE_REASON", "ZERO_SHOT"])
    canonical = bind_prompt_effects(selection)
    assert effect_plan_is_lawful(selection, canonical)
    killed = []
    for name, mutant in MUTANTS.items():
        bad = mutant(selection)
        anchor = selection
        if name == "M9":
            anchor = select_prompt_techniques(_prot(), None, {"ambiguous": True})
        elif name == "M3":
            anchor = _selection(["FEW_SHOT"], _prot())
        elif name == "M7":
            anchor = _selection(["CRITIQUE_REVISE"])
        elif name == "M8":
            anchor = _selection(["STRUCTURED_OUTPUT"], _prot(desired_output=None))
        assert effect_plan_is_lawful(anchor, bad) is False
        killed.append(name)
    assert killed == list(MUTANTS)
