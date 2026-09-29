"""F3E AUTO-XCAT contract. Explicit ids route. Unrecovered names do not."""

from __future__ import annotations

from spe_runtime.k3.registry import DISPLAY_LABEL_PROTOCOL, DISPLAY_LABEL_XCAT
from spe_runtime.xcat.auto_route import _DISPLAY_LABEL_PROTOCOL, _DISPLAY_LABEL_XCAT
from spe_runtime.k3.selector import _digest, _public_task_for_digest, _resolve_category, select_prompt_techniques
from spe_runtime.xcat.auto_route import EFFECT_PLAN_SENTINEL, auto_route_task
from spe_runtime.xcat.router import route_mission_stage


def _route(**kwargs: object) -> dict:
    category = kwargs.get("category")
    task = kwargs.get("task")
    goal = kwargs.get("goal", "")
    return auto_route_task(
        category if isinstance(category, dict) else {},
        task if isinstance(task, dict) else {},
        goal if isinstance(goal, str) else "",
    )


def test_display_bridges_match_k3_registry() -> None:
    assert DISPLAY_LABEL_XCAT["Research"] == "CAT:C02"
    assert DISPLAY_LABEL_XCAT["Analysis"] == "CAT:C06"
    assert _DISPLAY_LABEL_XCAT == DISPLAY_LABEL_XCAT
    assert _DISPLAY_LABEL_PROTOCOL == DISPLAY_LABEL_PROTOCOL
    assert "Writing" not in DISPLAY_LABEL_XCAT
    assert "AI Assistant" not in DISPLAY_LABEL_XCAT


def test_ai_assistant_is_not_a_category() -> None:
    receipt = _route(category={"display_label": "AI Assistant"}, goal="Summarize the supplied notes.")
    assert receipt["primary_category"] is None
    assert receipt["disposition"] == "NEEDS_DISAMBIGUATION"
    assert receipt["protocol_status"] == "ABSENT"
    assert receipt["presentation_label"] == "AI Assistant"
    assert receipt["protocol_domain_id"] == "general"
    assert receipt["effect_plan"] == EFFECT_PLAN_SENTINEL
    assert receipt["execution_authorized"] is False
    assert receipt["claims_pass"] is False
    assert receipt["twin_version"] == "xcat.auto.v1"
    assert receipt["routing_id"].startswith("auto-")


def test_no_c01_default() -> None:
    receipt = _route(goal="Summarize the supplied notes.")
    assert receipt["primary_category"] is None
    assert receipt["disposition"] == "NEEDS_DISAMBIGUATION"


def test_recovered_goal_tokens_are_exclusive() -> None:
    research = _route(category={"display_label": "AI Assistant"}, goal="Research the archive.")
    assert research["disposition"] == "ROUTED"
    assert research["primary_category"] == "CAT:C02"
    assert research["protocol_status"] == "RECOVERED"
    assert research["confidence_basis"] == ["RECOVERED_GOAL_TOKEN"]
    writing = _route(goal="Write the memo.")
    assert writing["primary_category"] == "CAT:C03"
    both = _route(goal="Write and research the memo.")
    assert both["disposition"] == "NEEDS_DISAMBIGUATION"
    assert both["primary_category"] is None
    assert both["rejected_names"] == ["CAT:C02", "CAT:C03"]


def test_unrecovered_english_names_hold() -> None:
    for goal in ("Learn the topic.", "Code a parser.", "Tell a story.", "Plan the business."):
        receipt = _route(category={"display_label": "AI Assistant"}, goal=goal)
        assert receipt["disposition"] == "PROTOCOL_HOLD", goal
        assert receipt["primary_category"] is None
        assert receipt["protocol_status"] == "NOT_RECOVERED"
        assert receipt["confidence_basis"] == ["UNRECOVERED_GOAL_TOKEN"]


def test_product_labels_do_not_mint_unrecovered_ids() -> None:
    for label in ("Coding", "Business", "Education", "Creative", "Multilingual", "Website / 3D", "Image", "Video"):
        receipt = _route(category={"display_label": label}, goal="Write a function.")
        assert receipt["disposition"] == "PROTOCOL_HOLD", label
        assert receipt["primary_category"] is None
        assert label in receipt["rejected_names"]


def test_writing_research_analysis_bridges() -> None:
    writing = _route(category={"display_label": "Writing"}, goal="Code a parser.")
    assert writing["primary_category"] == "CAT:C03"
    assert writing["confidence_basis"] == ["AUTO_WRITING_BRIDGE"]
    research = _route(category={"display_label": "Research"})
    assert research["primary_category"] == "CAT:C02"
    assert research["confidence_basis"] == ["DISPLAY_LABEL_XCAT"]
    analysis = _route(category={"display_label": "Analysis"})
    assert analysis["primary_category"] == "CAT:C06"


def test_structured_data_is_not_an_unrecovered_category_name() -> None:
    receipt = _route(
        category={"display_label": "Structured Data"},
        task={"needs_retrieval": True},
    )
    assert receipt["disposition"] == "ROUTED"
    assert receipt["primary_category"] == "CAT:C02"
    assert receipt["confidence_basis"] == ["STRUCTURED_TASK_FLAG"]


def test_flags_are_exclusive_and_raw() -> None:
    one = _route(task={"needs_execution_prep": True}, goal="Write the note.")
    assert one["primary_category"] == "CAT:C07"
    assert one["execution_authorized"] is False
    many = _route(task={"needs_retrieval": True, "needs_revision": True})
    assert many["disposition"] == "NEEDS_DISAMBIGUATION"
    assert many["confidence_basis"] == ["MULTIPLE_RECOVERED_SIGNALS"]
    assert many["rejected_names"] == ["needs_retrieval", "needs_revision"]
    prose = _route(goal="Execute the work.")
    assert prose["primary_category"] is None


def test_explicit_ids_route_without_inventing_protocols() -> None:
    recovered = _route(category={"xcat_id": "CAT:C02", "display_label": "AI Assistant"}, goal="Code it.")
    assert recovered["disposition"] == "ROUTED"
    assert recovered["primary_category"] == "CAT:C02"
    assert recovered["protocol_status"] == "RECOVERED"
    held = _route(category={"xcat_id": "CAT:C08"}, goal="Write a story.")
    assert held["disposition"] == "ROUTED"
    assert held["primary_category"] == "CAT:C08"
    assert held["protocol_status"] == "NOT_RECOVERED"
    unknown = _route(category={"self_selected_category": "CAT:C01"})
    assert unknown["disposition"] == "UNKNOWN"
    assert unknown["primary_category"] is None


def test_router_behavior_is_unchanged() -> None:
    assert route_mission_stage({})["disposition"] == "NEEDS_DISAMBIGUATION"
    assert route_mission_stage({})["primary_category"] is None
    assert route_mission_stage({"display_label": "AI Assistant"})["disposition"] == "NEEDS_DISAMBIGUATION"
    routed = route_mission_stage({"category_ref": "CAT:C08"})
    assert routed["disposition"] == "ROUTED"
    assert routed["primary_category"] == "CAT:C08"


def test_routing_id_is_deterministic() -> None:
    left = _route(category={"display_label": "AI Assistant"}, goal="Research the archive.")
    right = _route(category={"display_label": "AI Assistant"}, goal="Research the archive.")
    assert left == right
    assert left["effect_plan"] == "NO_EFFECT_PLAN"


def test_k3_attaches_receipt_without_changing_selection() -> None:
    category = {"display_label": "AI Assistant"}
    task = {"goal_ignored": True}
    protected = {"goal": "Summarize the supplied notes."}
    result = select_prompt_techniques(protected, category, task)
    context = _resolve_category(category)
    expected = _digest(
        {"category": context, "task": _public_task_for_digest(task, context["xcat_id"])},
        "idigest-",
    )
    assert result["inputs_digest"] == expected
    assert result["category_context"]["xcat_id"] is None
    assert result["techniques"] == ["ZERO_SHOT"]
    assert result["disposition"] == "SAFE_DEFAULT"
    receipt = result["category_context"]["auto_xcat"]
    assert receipt["disposition"] == "NEEDS_DISAMBIGUATION"
    assert receipt["primary_category"] is None
    assert receipt["effect_plan"] == "NO_EFFECT_PLAN"
    assert isinstance(result["prompt_effect_plan"], dict)
    assert result["prompt_effect_plan"] != "NO_EFFECT_PLAN"
    coding = select_prompt_techniques(
        {"goal": "Write a function."},
        {"protocol_domain_id": "coding"},
        {},
    )
    assert coding["category_context"]["xcat_id"] is None
    assert coding["category_context"]["auto_xcat"]["disposition"] == "PROTOCOL_HOLD"
    assert coding["disposition"] == "SAFE_DEFAULT"
