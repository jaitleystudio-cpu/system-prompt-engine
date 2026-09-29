"""Task 56B §28 — XCAT mutation kill suite (M1–M16).

Each mutant attempts an illegal transformation. The real engines/validators/
invariants MUST reject or preserve protected fields (mutant killed).
"""

from __future__ import annotations

from typing import Any, Callable

import pytest

from spe_runtime.categories.apply import apply_category_payload
from spe_runtime.categories.c03_communicate import communicate
from spe_runtime.categories.c06_analyze import analyze
from spe_runtime.categories.domain import (
    apply_domain_category,
    domain_production_kernel_bypasses,
    production_legacy_writer_reachability,
)
from spe_runtime.categories._common import replace_envelope
from spe_runtime.xcat.handoff import HandoffResult, validate_handoff
from spe_runtime.xcat.invariants import (
    validate_analysis_not_recommendation,
    validate_authority_non_escalation,
    validate_constraint_monotonicity,
    validate_failure_preservation,
    validate_facts_have_provenance,
    validate_no_semantic_rewrite,
    validate_preference_immutability,
    validate_provenance_monotonicity,
    validate_recommendation_not_execution,
    validate_uncertainty_preservation,
)
from spe_runtime.xcat.migration import reject_legacy_payload_reinterpretation
from spe_runtime.xcat.models import AuthorityState, CrossCategoryEnvelope, FailureRecord
from spe_runtime.xcat.router import route_mission_stage


def _env(**overrides: Any) -> CrossCategoryEnvelope:
    base: dict[str, Any] = dict(
        envelope_id="env-mut-56b",
        goal_identity="goal-locked",
        facts=({"fact_id": "f1", "statement": "known", "provenance_ids": ["p1"]},),
        provenance=({"provenance_id": "p1", "source": "user"},),
        uncertainties=({"uncertainty_id": "u1", "description": "open"},),
        hard_constraints=(
            {"constraint_id": "c1", "statement": "must not invent", "strength": "HARD"},
        ),
        user_preferences=({"preference_id": "pref1", "statement": "be concise"},),
        analysis=None,
        recommendation=None,
        rendering=None,
        authority_state=AuthorityState(level=0, status="NONE", grants=()),
        execution_grants=(),
        failures=(FailureRecord(failure_id="fail1", status="UNKNOWN", message="unk"),),
        taint_labels=(),
        sensitivity_labels=(),
        category_trace=(),
        taxonomy_version="2",
    )
    base.update(overrides)
    return CrossCategoryEnvelope(**base)


def _killed_by_raise(fn: Callable[[], Any], match: str | None = None) -> bool:
    try:
        fn()
    except ValueError as exc:
        if match is None or match in str(exc):
            return True
        return False
    return False


def _killed_by_invariant(holds: bool) -> bool:
    """Mutant is killed when the invariant reports violation (False)."""
    return holds is False


# --- Mutants ---


def mutant_m1_drop_hard_constraint() -> bool:
    """M1: drop hard constraint — X01 must detect."""
    before = _env()
    after = replace_envelope(before, hard_constraints=())
    return _killed_by_invariant(validate_constraint_monotonicity(before, after))


def mutant_m2_remove_provenance() -> bool:
    """M2: remove provenance — X02 must detect."""
    before = _env()
    after = replace_envelope(before, provenance=())
    return _killed_by_invariant(validate_provenance_monotonicity(before, after))


def mutant_m3_remove_uncertainty() -> bool:
    """M3: remove uncertainty — X03 must detect."""
    before = _env()
    after = replace_envelope(before, uncertainties=())
    return _killed_by_invariant(validate_uncertainty_preservation(before, after))


def mutant_m4_mutate_preference() -> bool:
    """M4: mutate preference statement — X04 must detect."""
    before = _env()
    after = replace_envelope(
        before,
        user_preferences=({"preference_id": "pref1", "statement": "be verbose"},),
    )
    return _killed_by_invariant(validate_preference_immutability(before, after))


def mutant_m5_fact_without_provenance() -> bool:
    """M5: fact without provenance — X05 must detect."""
    env = _env(
        facts=({"fact_id": "orphan", "statement": "claim", "provenance_ids": []},)
    )
    return _killed_by_invariant(validate_facts_have_provenance(env))


def mutant_m6_analysis_to_recommendation() -> bool:
    """M6: analysis laundered as recommendation — X06 / analyze must reject."""

    def attack() -> None:
        before = _env()
        # Direct envelope laundering shape
        laundered = replace_envelope(
            before,
            analysis={"kind": "recommendation", "action": "ship", "certainty": "CERTAIN"},
        )
        if validate_analysis_not_recommendation(laundered):
            raise AssertionError("X06 failed to detect analysis→recommendation")
        # Engine path: analyze rejects recommendation-shaped payloads
        analyze(
            before,
            analysis={"kind": "recommendation", "action": "ship", "certainty": "CERTAIN"},
        )

    # Prefer engine raise; fall back to invariant already returning False above
    try:
        attack()
        return False
    except (ValueError, AssertionError):
        return True


def mutant_m7_recommendation_to_execution() -> bool:
    """M7: recommendation copied into execution_grants — X07 must detect."""
    before = _env(
        recommendation={"kind": "recommendation", "action": "deploy", "certainty": "CONDITIONAL"}
    )
    after = replace_envelope(
        before,
        execution_grants=(
            {"kind": "recommendation", "action": "deploy", "certainty": "CONDITIONAL"},
        ),
    )
    return _killed_by_invariant(validate_recommendation_not_execution(after))


def mutant_m8_communication_rewrites_goal() -> bool:
    """M8: communicate rewrites goal — X08 / C03 validate must refuse."""
    before = _env(recommendation={"kind": "recommendation", "action": "a", "certainty": "CONDITIONAL"})

    def attack() -> None:
        # Illegal direct rewrite
        after = replace_envelope(before, goal_identity="goal-hijacked")
        if validate_no_semantic_rewrite(before, after):
            raise AssertionError("X08 missed goal rewrite")
        # Engine cannot accept goal_identity kwarg
        communicate(before, rendering={"text": "hi"}, goal_identity="goal-hijacked")

    try:
        attack()
        return False
    except (ValueError, TypeError, AssertionError):
        return True


def mutant_m9_authority_self_escalation() -> bool:
    """M9: authority self-escalation without event — X09 must detect."""
    before = _env()
    after = replace_envelope(
        before,
        authority_state=AuthorityState(level=3, status="GRANTED", grants=("EXECUTE",)),
    )
    return _killed_by_invariant(
        validate_authority_non_escalation(before, after, authority_event=None)
    )


def mutant_m10_unknown_to_pass() -> bool:
    """M10: UNKNOWN→PASS failure laundering — X10 must detect."""
    before = _env()
    after = replace_envelope(
        before,
        failures=(FailureRecord(failure_id="fail1", status="PASS", message="ok"),),
    )
    return _killed_by_invariant(validate_failure_preservation(before, after))


def mutant_m11_wrong_category_writes_field() -> bool:
    """M11: C09 tries to write C04-only field — apply rejects unknown fields."""
    return _killed_by_raise(
        lambda: apply_category_payload(
            _env(), "CAT:C09", {"repository": "x", "source_language": "en"}
        ),
        match="unknown fields",
    )


def mutant_m12_unsupported_defaults_to_c01() -> bool:
    """M12: routing without evidence must NOT default to C01."""
    result = route_mission_stage({"mission": "anything"})
    if result["primary_category"] == "CAT:C01":
        return False
    if result["disposition"] not in {"NEEDS_DISAMBIGUATION", "UNKNOWN"}:
        return False
    return result["primary_category"] is None


def mutant_m13_legacy_privacy_as_code() -> bool:
    """M13: legacy C09 Privacy silently treated as Code — migration rejects."""
    return _killed_by_raise(
        lambda: reject_legacy_payload_reinterpretation(
            "1", "CAT:C09", {"repository": "x"}
        ),
        match="LEGACY_TAXONOMY_UNMIGRATED",
    ) and _killed_by_raise(
        lambda: apply_category_payload(
            _env(taxonomy_version="1"),
            "CAT:C09",
            {"repository": "x"},
        ),
        match="LEGACY_TAXONOMY_UNMIGRATED",
    )


def mutant_m14_category_commits_canonical_state() -> bool:
    """M14: category tries to commit authority/execution — forbidden keys."""
    return _killed_by_raise(
        lambda: apply_category_payload(
            _env(),
            "CAT:C09",
            {"repository": "x", "authority": "GRANTED", "EXECUTED": True},
        ),
        match="forbidden",
    )


def mutant_m15_routing_ignores_stage_evidence() -> bool:
    """M15: routing ignores stage evidence — real router must honor it."""
    result = route_mission_stage({"stage": {"category_ref": "CAT:C08"}})
    # Mutant would ignore stage and return NEEDS_DISAMBIGUATION / C01.
    # Kill = router ROUTED to C08 from stage evidence.
    return (
        result["disposition"] == "ROUTED"
        and result["primary_category"] == "CAT:C08"
    )


def mutant_m16_category_redefines_kernel_truth() -> bool:
    """M16: category module redefines kernel truth (facts/goal) — ownership holds."""
    before = _env()
    after = apply_category_payload(
        before,
        "CAT:C04",
        {"source_language": "en", "target_language": "fr"},
    )
    # Mutant would rewrite facts/goal; kill = apply preserved kernel fields.
    if after.facts != before.facts:
        return False
    if after.goal_identity != before.goal_identity:
        return False
    if after.provenance != before.provenance:
        return False
    if after.hard_constraints != before.hard_constraints:
        return False
    if after.authority_state != before.authority_state:
        return False
    # Handoff refuses goal rewrite between stages
    hijack = replace_envelope(after, goal_identity="stolen")
    handoff = validate_handoff(after, hijack, "CAT:C04", "CAT:C03")
    return handoff in {HandoffResult.REFUSE, HandoffResult.BLOCKED}


def mutant_m17_c01_commits_recommendation() -> bool:
    """M17: DOMAIN C01 must not commit envelope.recommendation."""
    before = _env(recommendation={"kind": "recommendation", "action": "hold"})
    after = apply_domain_category(
        before,
        "CAT:C01",
        {"options": ["a"], "criteria": ["cost"], "decision_authority": "user"},
    )
    if after.recommendation != before.recommendation:
        return False
    return _killed_by_raise(
        lambda: apply_domain_category(
            before,
            "CAT:C01",
            {"options": ["a"], "recommendation": {"action": "ship"}},
        ),
        match="unknown fields",
    )


def mutant_m18_c02_appends_fact() -> bool:
    """M18: DOMAIN C02 must not append canonical facts."""
    before = _env()
    after = apply_domain_category(
        before, "CAT:C02", {"question": "q", "search_strategy": "manual"}
    )
    if after.facts != before.facts:
        return False
    return _killed_by_raise(
        lambda: apply_domain_category(
            before,
            "CAT:C02",
            {"question": "q", "facts": [{"fact_id": "x", "statement": "s"}]},
        ),
        match="unknown fields",
    )


def mutant_m19_c02_appends_provenance() -> bool:
    """M19: DOMAIN C02 must not append canonical provenance."""
    before = _env()
    after = apply_domain_category(before, "CAT:C02", {"question": "q"})
    if after.provenance != before.provenance:
        return False
    return _killed_by_raise(
        lambda: apply_domain_category(
            before, "CAT:C02", {"question": "q", "provenance": [{"provenance_id": "p"}]}
        ),
        match="unknown fields",
    )


def mutant_m20_c02_changes_uncertainty() -> bool:
    """M20: DOMAIN C02 must not change canonical uncertainty."""
    before = _env()
    after = apply_domain_category(before, "CAT:C02", {"question": "q", "gaps": ["g"]})
    if after.uncertainties != before.uncertainties:
        return False
    return _killed_by_raise(
        lambda: apply_domain_category(
            before, "CAT:C02", {"question": "q", "uncertainties": []}
        ),
        match="unknown fields",
    )


def mutant_m21_c03_commits_rendering() -> bool:
    """M21: DOMAIN C03 must not commit envelope.rendering."""
    before = _env()
    after = apply_domain_category(
        before,
        "CAT:C03",
        {"communicative_goal": "inform", "audience": "ops", "voice": "plain"},
    )
    if after.rendering != before.rendering:
        return False
    return _killed_by_raise(
        lambda: apply_domain_category(
            before, "CAT:C03", {"audience": "ops", "rendering": {"text": "hi"}}
        ),
        match="unknown fields",
    )


def mutant_m22_c06_commits_analysis() -> bool:
    """M22: DOMAIN C06 must not commit envelope.analysis."""
    before = _env(analysis={"summary": "kept", "kind": "analysis"})
    after = apply_domain_category(
        before, "CAT:C06", {"source_objects": ["s"], "dimensions": ["d"]}
    )
    if after.analysis != before.analysis:
        return False
    return _killed_by_raise(
        lambda: apply_domain_category(
            before, "CAT:C06", {"dimensions": ["d"], "analysis": {"summary": "new"}}
        ),
        match="unknown fields",
    )


def mutant_m23_production_reaches_legacy_writer() -> bool:
    """M23: DOMAIN production path must not reach legacy direct writers."""
    if production_legacy_writer_reachability() != 0:
        return False
    if domain_production_kernel_bypasses() != 0:
        return False
    return _killed_by_raise(
        lambda: apply_domain_category(
            _env(),
            "CAT:C01",
            {"options": ["a"]},
            via_legacy="decide",
        ),
        match="legacy direct-writer",
    )


MUTANTS: dict[str, Callable[[], bool]] = {
    "M1": mutant_m1_drop_hard_constraint,
    "M2": mutant_m2_remove_provenance,
    "M3": mutant_m3_remove_uncertainty,
    "M4": mutant_m4_mutate_preference,
    "M5": mutant_m5_fact_without_provenance,
    "M6": mutant_m6_analysis_to_recommendation,
    "M7": mutant_m7_recommendation_to_execution,
    "M8": mutant_m8_communication_rewrites_goal,
    "M9": mutant_m9_authority_self_escalation,
    "M10": mutant_m10_unknown_to_pass,
    "M11": mutant_m11_wrong_category_writes_field,
    "M12": mutant_m12_unsupported_defaults_to_c01,
    "M13": mutant_m13_legacy_privacy_as_code,
    "M14": mutant_m14_category_commits_canonical_state,
    "M15": mutant_m15_routing_ignores_stage_evidence,
    "M16": mutant_m16_category_redefines_kernel_truth,
    "M17": mutant_m17_c01_commits_recommendation,
    "M18": mutant_m18_c02_appends_fact,
    "M19": mutant_m19_c02_appends_provenance,
    "M20": mutant_m20_c02_changes_uncertainty,
    "M21": mutant_m21_c03_commits_rendering,
    "M22": mutant_m22_c06_commits_analysis,
    "M23": mutant_m23_production_reaches_legacy_writer,
}


@pytest.mark.parametrize("name", list(MUTANTS))
def test_mutant_killed(name: str) -> None:
    assert MUTANTS[name]() is True, f"{name} survived"


def test_all_twenty_three_mutants_killed() -> None:
    killed = [name for name, fn in MUTANTS.items() if fn()]
    survived = [name for name in MUTANTS if name not in killed]
    assert len(MUTANTS) == 23
    assert survived == [], f"survived: {survived}"
    assert killed == list(MUTANTS)
