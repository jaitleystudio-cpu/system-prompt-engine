"""Task57R-F3E: AI Assistant is AUTO mode, not a category."""

from __future__ import annotations

from pathlib import Path

from spe_runtime.k3.selector import select_prompt_techniques
from spe_runtime.quality.engine import evaluate_from_k3, governing_proof_refs, quality_delta, reconstruct
from spe_runtime.xcat.migration import CURRENT_TAXONOMY_VERSION, validate_taxonomy_version
from spe_runtime.xcat.models import CATEGORY_IDS
from spe_runtime.xcat.router import route_mission_stage
from tests.unit.test_quality_task57 import _subject
from tests.unit.test_quality_task57r import _missing_constraint

REPO = Path(__file__).resolve().parents[2]

GOALS = {
    "CAT:C01": "Decide whether to launch the checklist in four weeks.",
    "CAT:C02": "Research current accessibility evidence for public websites.",
    "CAT:C03": "Write an executive brief about the launch.",
    "CAT:C04": "Translate the launch note into Spanish.",
    "CAT:C05": "Teach the concept of indexes with three check questions.",
    "CAT:C06": "Analyze the permit dataset for anomalies.",
    "CAT:C07": "Execute the release checklist and record each postcondition.",
    "CAT:C08": "Business offer for a writing app with pricing and channels.",
    "CAT:C09": "Code a PostgreSQL query for monthly active users.",
    "CAT:C10": "Storyboard a 15-second product video.",
    "CAT:C11": "Career plan for a product designer interview.",
    "CAT:C12": "Roleplay a coastal dawn scene with two characters.",
}

MULTI = "Research current accessibility evidence and write an executive brief"
DEFAULT_GOAL = (
    "Write a four-week launch checklist. Budget must remain $2000. "
    "Do not invent extra spend."
)


def _auto(goal: str, **extra: object) -> dict:
    evidence = {
        "display_label": "AI Assistant",
        "goal": goal,
        "routing_mode": "AUTO",
    }
    evidence.update(extra)
    return route_mission_stage(evidence)


def _protected(goal: str) -> dict:
    return {
        "goal": goal,
        "hard_constraints": [
            {
                "constraint_id": "c-preserve-intent",
                "statement": "Preserve the user's stated goal without inventing obligations",
                "strength": "HARD",
            }
        ],
        "budget": None,
        "facts": [{"fact_id": "f-user-request", "statement": goal}],
        "authority_state": {"grants": [], "level": 0, "status": "NONE"},
        "provenance": [{"provenance_id": "p-user", "source": "user"}],
    }


def test_ai_assistant_is_not_a_category() -> None:
    assert "AI Assistant" not in CATEGORY_IDS
    assert "CAT:C13" not in CATEGORY_IDS
    assert len(CATEGORY_IDS) == 12


def test_each_domain_routes_from_auto_goal() -> None:
    for category_id, goal in GOALS.items():
        routed = _auto(goal)
        assert routed["disposition"] == "ROUTED", goal
        assert routed["primary_category"] == category_id
        assert routed["secondary_categories"] == []
        assert routed["routing_receipt"]["basis"] == "semantic_frame"
        assert "AI Assistant" not in routed["routing_receipt"]["basis"]
        assert goal not in str(routed["category_evidence"])


def test_multi_domain_keeps_primary_and_secondary() -> None:
    routed = _auto(MULTI)
    assert routed["primary_category"] == "CAT:C02"
    assert routed["secondary_categories"] == ["CAT:C03"]
    assert routed["primary_category"] != routed["secondary_categories"][0]
    assert routed["cross_category_dependencies"][0]["relation"] == "COORDINATED_ACT"


def test_ambiguous_and_insufficient_need_disambiguation() -> None:
    ambiguous = _auto("Help with this soon.")
    assert ambiguous["disposition"] == "NEEDS_DISAMBIGUATION"
    assert ambiguous["primary_category"] is None
    assert ambiguous["routing_receipt"]["basis"] == "ambiguous_request"
    assert "NEEDS_DISAMBIGUATION" not in CATEGORY_IDS
    fox = _auto("The quick brown fox jumps over the lazy dog")
    assert fox["primary_category"] is None
    assert fox["disposition"] == "NEEDS_DISAMBIGUATION"
    empty = _auto("  ")
    assert empty["disposition"] == "NEEDS_DISAMBIGUATION"
    assert empty["routing_receipt"]["basis"] == "insufficient_evidence"
    label_only = route_mission_stage({"display_label": "AI Assistant"})
    assert label_only["primary_category"] is None


def test_substring_lookalikes_do_not_route() -> None:
    assert _auto("Researcher notes from yesterday")["primary_category"] is None
    assert _auto("Write a launch plan for the team.")["primary_category"] == "CAT:C03"
    assert route_mission_stage({"mission": "Research the archive"})["primary_category"] is None


def test_conflict_fails_closed() -> None:
    routed = _auto("Research the market or code the scraper")
    assert routed["disposition"] == "UNKNOWN"
    assert routed["primary_category"] is None
    assert "CONFLICTING_CATEGORY_EVIDENCE" in routed["escalation_conditions"]
    structured = _auto(
        "Write a brief",
        structured_evidence=[{"question": "what changed", "search_strategy": "scholarly"}],
    )
    assert structured["disposition"] == "UNKNOWN"
    assert structured["primary_category"] is None


def test_forged_category_cannot_override_kernel_frame() -> None:
    routed = _auto("Write a note", xcat_id="CAT:C01")
    assert routed["primary_category"] == "CAT:C03"
    assert "CAT:C01" in routed["rejected_categories"]
    unknown = _auto("Hello there", xcat_id="CAT:C99")
    assert unknown["disposition"] == "UNKNOWN"
    assert unknown["primary_category"] is None
    assert "CAT:C99" in unknown["rejected_categories"]
    browser = route_mission_stage(
        {
            "routing_mode": "AUTO",
            "display_label": "AI Assistant",
            "goal": "Hello there",
            "category_evidence": [{"category": "CAT:C02", "proof": "browser-supplied"}],
        }
    )
    assert browser["primary_category"] is None
    assert browser["disposition"] == "UNKNOWN"


def test_explicit_product_bridge_remains_for_research_and_analysis() -> None:
    assert route_mission_stage({"display_label": "Research"})["primary_category"] == "CAT:C02"
    assert route_mission_stage({"display_label": "Analysis"})["primary_category"] == "CAT:C06"
    assert route_mission_stage({})["primary_category"] is None
    assert route_mission_stage({"self_selected_category": "CAT:C01"})["disposition"] == "UNKNOWN"


def test_k3_consumes_router_and_does_not_keep_a_forged_id() -> None:
    protected = _protected(DEFAULT_GOAL)
    selected = select_prompt_techniques(
        protected,
        {"display_label": "AI Assistant", "xcat_id": "CAT:C01"},
        {},
    )
    route = selected["category_route"]
    assert route["primary_category"] == "CAT:C03"
    assert selected["category_context"]["xcat_id"] == route["primary_category"]
    assert "CAT:C01" in route["rejected_categories"]
    assert selected["category_context"]["display_label"] == "AI Assistant"
    ambiguous = select_prompt_techniques(
        _protected("Hello there"),
        {"display_label": "AI Assistant", "xcat_id": "CAT:C02"},
        {},
    )
    assert ambiguous["category_context"]["xcat_id"] is None
    assert ambiguous["disposition"] == "UNKNOWN"
    research = select_prompt_techniques(_protected("Write a checklist"), {"display_label": "Research"}, {})
    assert "category_route" not in research
    assert research["category_context"]["xcat_id"] == "CAT:C02"


def test_default_auto_repair_is_one_pass() -> None:
    protected = _protected(DEFAULT_GOAL)
    k3 = select_prompt_techniques(protected, {"display_label": "AI Assistant"}, {})
    compiled = k3["prompt_effect_plan"]["compiled_prompt"]
    statement = "Preserve the user's stated goal without inventing obligations"
    corrupted = compiled.replace(f"## Hard constraints\n- {statement}", "## Hard constraints\nnone", 1)
    result = evaluate_from_k3(
        {
            "compiled_prompt": corrupted,
            "k3_output": k3,
            "mode": "VALIDATE_ONLY",
            "op": "from_k3",
        }
    )
    reconstruction = result["reconstruction"]
    assert reconstruction["kept"] == "repaired"
    assert reconstruction["plan"]["disposition"] == "ACCEPTED"
    assert reconstruction["quality_delta"]["disposition"] == "IMPROVED"
    assert reconstruction["quality_delta"]["protected_regressions"] == []
    assert reconstruction["plan"]["attempt_index"] <= 1
    assert result["receipt"]["verdict"] == "PASS"
    kept = reconstruction["kept_subject"]["compiled_prompt"]
    assert statement in kept
    assert kept != corrupted
    assert result["subject"]["xcat"]["active_category"] == "C03"
    assert result["subject"]["proof_refs"] == governing_proof_refs(result["subject"])
    intact = evaluate_from_k3(
        {"compiled_prompt": compiled, "k3_output": k3, "mode": "VALIDATE_ONLY", "op": "from_k3"}
    )
    assert intact["reconstruction"]["kept"] == "original"
    assert intact["receipt"]["verdict"] == "PASS"


def test_f3e_mutants_are_killed() -> None:
    killed: list[str] = []
    assert _auto("Write a note")["primary_category"] != "CAT:C01"
    assert _auto("Hello there")["primary_category"] != "CAT:C01"
    killed.append("map AI Assistant to C01")
    assert _auto("Write a note")["primary_category"] != "CAT:C02"
    killed.append("map AI Assistant to C02")
    selected = select_prompt_techniques(
        _protected(DEFAULT_GOAL),
        {"display_label": "AI Assistant"},
        {},
    )
    assert selected["category_context"]["xcat_id"] == selected["category_route"]["primary_category"]
    killed.append("bypass CategoryRouterIR")
    browser = _auto("Hello there", category_evidence=[{"category": "CAT:C09", "proof": "browser"}])
    assert browser["primary_category"] is None
    killed.append("trust browser category proof")
    assert _auto("Help with this soon.")["primary_category"] is None
    killed.append("NEEDS_DISAMBIGUATION is not a category")
    multi = _auto(MULTI)
    assert multi["secondary_categories"] == ["CAT:C03"]
    killed.append("primary/secondary distinction")
    assert _auto("Hello there", xcat_id="CAT:C13")["primary_category"] is None
    assert route_mission_stage({"xcat_id": "CAT:C13"})["primary_category"] is None
    killed.append("unknown CAT ids")
    forged = select_prompt_techniques(
        _protected("Hello there"),
        {"display_label": "AI Assistant", "xcat_id": "CAT:C08"},
        {},
    )
    assert forged["category_context"]["xcat_id"] is None
    killed.append("K3 category writer")
    from spe_runtime.quality.engine import subject_from_k3

    bare = dict(selected)
    bare["category_context"] = {**bare["category_context"], "xcat_id": None}
    subject = subject_from_k3(bare, bare["prompt_effect_plan"]["compiled_prompt"])
    assert subject["xcat"]["active_category"] == ""
    killed.append("Quality category writer")
    transport = (REPO / "apps/web/src/engine/k3Transport.ts").read_text(encoding="utf-8")
    app = (REPO / "apps/web/src/App.tsx").read_text(encoding="utf-8")
    assert "CAT:C" not in transport and "CAT:C" not in app
    assert "xcat_id" not in transport
    killed.append("TS keyword routing")
    assert reconstruct(_missing_constraint(), attempt_index=2)["plan"]["disposition"] == "REFUSED"
    killed.append("second repair")
    regressed = _subject()
    other = _subject(protected={**regressed["protected_intent"], "goal": "other goal"})
    assert quality_delta(regressed, other)["disposition"] != "IMPROVED"
    killed.append("protected regression")
    legacy = validate_taxonomy_version("1")
    assert legacy["code"] != "CURRENT"
    stale = _subject()
    stale["xcat"] = {"active_category": "C03", "taxonomy_version": "1"}
    stale["proof_refs"] = governing_proof_refs(stale)
    assert quality_delta(stale, _subject())["disposition"] != "IMPROVED"
    killed.append("taxonomy version downgrade")
    missing = evaluate_from_k3(
        {
            "compiled_prompt": "Hello",
            "k3_output": select_prompt_techniques(
                _protected("Hello there"),
                {"display_label": "Coding"},
                {},
            ),
            "mode": "VALIDATE_ONLY",
            "op": "from_k3",
        }
    )
    assert missing["receipt"]["verdict"] != "PASS"
    killed.append("PASS without governing category")
    assert _auto("The quick brown fox jumps over the lazy dog")["primary_category"] is None
    killed.append("arbitrary prose fallback")
    assert len(killed) == 15


def test_one_category_router() -> None:
    router = (REPO / "spe_runtime/xcat/router.py").read_text(encoding="utf-8")
    rust = (REPO / "portable/spe-core-rs/src/xcat.rs").read_text(encoding="utf-8")
    assert router.count("def route_mission_stage") == 1
    assert rust.count("fn route_mission_stage") == 1
    assert "def route_mission_stage" not in (REPO / "spe_runtime/k3/selector.py").read_text(encoding="utf-8")
    assert "def route_mission_stage" not in (REPO / "spe_runtime/quality/engine.py").read_text(encoding="utf-8")
    assert CURRENT_TAXONOMY_VERSION == "2"
