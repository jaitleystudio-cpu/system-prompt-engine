"""Sprint 2 integration: CAT:C02 → C06 → C01 → C03 chain + hard gates.

RED→GREEN: ownership and preservation must be enforced by category engines
and validate_handoff between stages. No category may mint authority,
execution grants, permits, or verified outcomes.
"""

from __future__ import annotations


import pytest

from spe_runtime.categories.c01_decide.engine import decide
from spe_runtime.categories.c02_research.engine import research
from spe_runtime.categories.c03_communicate.engine import communicate
from spe_runtime.categories.c06_analyze.engine import analyze
from spe_runtime.categories.c01_decide.validate import validate_c01_output
from spe_runtime.categories.c02_research.validate import validate_c02_output
from spe_runtime.categories.c03_communicate.validate import validate_c03_output
from spe_runtime.categories.c06_analyze.validate import validate_c06_output
from spe_runtime.xcat.handoff import HandoffResult, validate_handoff
from spe_runtime.xcat.models import (
    AuthorityState,
    CrossCategoryEnvelope,
    FailureRecord,
)


def _seed(**overrides) -> CrossCategoryEnvelope:
    base = dict(
        envelope_id="env-s2-001",
        goal_identity="goal-sprint2",
        facts=(),
        provenance=(),
        uncertainties=(),
        hard_constraints=(
            {
                "constraint_id": "c1",
                "statement": "never invent facts",
                "strength": "HARD",
            },
        ),
        user_preferences=(
            {"preference_id": "pref1", "statement": "prefer concise answers"},
        ),
        analysis=None,
        recommendation=None,
        rendering=None,
        authority_state=AuthorityState(level=0, status="NONE", grants=()),
        execution_grants=(),
        failures=(FailureRecord("f-unk", "UNKNOWN", "pending research"),),
        taint_labels=("external_untrusted",),
        sensitivity_labels=("PII_NONE",),
        category_trace=(),
    )
    base.update(overrides)
    return CrossCategoryEnvelope(**base)


# ---------------------------------------------------------------------------
# Happy path: C02 → C06 → C01 → C03
# ---------------------------------------------------------------------------


def test_happy_path_chain_with_handoffs():
    seed = _seed()

    after_c02 = research(
        seed,
        facts=(
            {
                "fact_id": "f1",
                "statement": "widget X exists",
                "provenance_ids": ["p1"],
            },
        ),
        provenance=({"provenance_id": "p1", "source": "catalog"},),
        uncertainties=(
            {"uncertainty_id": "u1", "description": "price may change"},
        ),
    )
    assert validate_c02_output(seed, after_c02) is True
    # Handoff validates after destination stage; destination must be in category_trace.
    assert validate_handoff(seed, after_c02, "CAT:C02", "CAT:C02") == HandoffResult.VALID

    after_c06 = analyze(
        after_c02,
        analysis={"summary": "catalog supports existence of widget X", "kind": "analysis"},
    )
    assert validate_c06_output(after_c02, after_c06) is True
    assert after_c06.recommendation is None
    assert validate_handoff(after_c02, after_c06, "CAT:C02", "CAT:C06") == HandoffResult.VALID

    after_c01 = decide(
        after_c06,
        recommendation={
            "action": "consider_purchase",
            "certainty": "CONDITIONAL",
            "kind": "recommendation",
        },
    )
    assert validate_c01_output(after_c06, after_c01) is True
    assert after_c01.authority_state == after_c06.authority_state
    assert after_c01.execution_grants == ()
    assert validate_handoff(after_c06, after_c01, "CAT:C06", "CAT:C01") == HandoffResult.VALID

    after_c03 = communicate(
        after_c01,
        rendering={
            "format": "text",
            "body": "Conditional: consider purchase of widget X (price uncertain).",
            "certainty": "CONDITIONAL",
        },
    )
    assert validate_c03_output(after_c01, after_c03) is True
    assert after_c03.recommendation == after_c01.recommendation
    assert after_c03.recommendation["certainty"] == "CONDITIONAL"
    assert validate_handoff(after_c01, after_c03, "CAT:C01", "CAT:C03") == HandoffResult.VALID


# ---------------------------------------------------------------------------
# C06 cannot manufacture recommendation
# ---------------------------------------------------------------------------


def test_c06_cannot_manufacture_recommendation():
    seed = _seed()
    after_c02 = research(
        seed,
        facts=(
            {
                "fact_id": "f1",
                "statement": "a",
                "provenance_ids": ["p1"],
            },
        ),
        provenance=({"provenance_id": "p1", "source": "s"},),
        uncertainties=(),
    )
    with pytest.raises(ValueError, match="recommendation|ownership|C06"):
        analyze(
            after_c02,
            analysis={"summary": "ok"},
            # illicit extra: engines that accept kwargs smuggling should refuse
            illicit_recommendation={"action": "buy_now", "certainty": "CERTAIN"},
        )


def test_c06_output_validator_rejects_recommendation():
    before = _seed(category_trace=("CAT:C02",))
    after = _seed(
        category_trace=("CAT:C02", "CAT:C06"),
        analysis={"summary": "x"},
        recommendation={"action": "smuggled", "certainty": "CERTAIN"},
        facts=(
            {
                "fact_id": "f1",
                "statement": "a",
                "provenance_ids": ["p1"],
            },
        ),
        provenance=({"provenance_id": "p1", "source": "s"},),
    )
    assert validate_c06_output(before, after) is False


# ---------------------------------------------------------------------------
# C01 cannot manufacture authority / execution
# ---------------------------------------------------------------------------


def test_c01_cannot_manufacture_authority():
    before = _seed(
        category_trace=("CAT:C02", "CAT:C06"),
        analysis={"summary": "a", "kind": "analysis"},
        facts=(
            {
                "fact_id": "f1",
                "statement": "a",
                "provenance_ids": ["p1"],
            },
        ),
        provenance=({"provenance_id": "p1", "source": "s"},),
    )
    with pytest.raises(ValueError, match="authority|ownership|C01"):
        decide(
            before,
            recommendation={"action": "hold", "certainty": "CONDITIONAL", "kind": "recommendation"},
            illicit_authority=AuthorityState(level=9, status="GRANTED", grants=("execute",)),
        )


def test_c01_output_validator_rejects_authority_escalation():
    before = _seed(
        category_trace=("CAT:C02", "CAT:C06"),
        analysis={"summary": "a", "kind": "analysis"},
        authority_state=AuthorityState(level=0, status="NONE", grants=()),
        facts=(
            {
                "fact_id": "f1",
                "statement": "a",
                "provenance_ids": ["p1"],
            },
        ),
        provenance=({"provenance_id": "p1", "source": "s"},),
    )
    after = CrossCategoryEnvelope(
        **{
            **before.to_dict(),
            "recommendation": {"action": "hold", "certainty": "CONDITIONAL", "kind": "recommendation"},
            "authority_state": AuthorityState(level=5, status="GRANTED", grants=("execute",)),
            "category_trace": before.category_trace + ("CAT:C01",),
            "failures": before.failures,
        }
    )
    # Rebuild properly — to_dict flattens authority
    after = CrossCategoryEnvelope(
        envelope_id=before.envelope_id,
        goal_identity=before.goal_identity,
        facts=before.facts,
        provenance=before.provenance,
        uncertainties=before.uncertainties,
        hard_constraints=before.hard_constraints,
        user_preferences=before.user_preferences,
        analysis=before.analysis,
        recommendation={"action": "hold", "certainty": "CONDITIONAL", "kind": "recommendation"},
        rendering=None,
        authority_state=AuthorityState(level=5, status="GRANTED", grants=("execute",)),
        execution_grants=(),
        failures=before.failures,
        taint_labels=before.taint_labels,
        sensitivity_labels=before.sensitivity_labels,
        category_trace=before.category_trace + ("CAT:C01",),
    )
    assert validate_c01_output(before, after) is False


def test_c01_cannot_add_execution_grants():
    before = _seed(
        category_trace=("CAT:C02", "CAT:C06"),
        analysis={"summary": "a", "kind": "analysis"},
        facts=(
            {
                "fact_id": "f1",
                "statement": "a",
                "provenance_ids": ["p1"],
            },
        ),
        provenance=({"provenance_id": "p1", "source": "s"},),
    )
    after = CrossCategoryEnvelope(
        envelope_id=before.envelope_id,
        goal_identity=before.goal_identity,
        facts=before.facts,
        provenance=before.provenance,
        uncertainties=before.uncertainties,
        hard_constraints=before.hard_constraints,
        user_preferences=before.user_preferences,
        analysis=before.analysis,
        recommendation={"action": "hold", "certainty": "CONDITIONAL", "kind": "recommendation"},
        rendering=None,
        authority_state=before.authority_state,
        execution_grants=({"grant_id": "g1", "from_recommendation": True},),
        failures=before.failures,
        taint_labels=before.taint_labels,
        sensitivity_labels=before.sensitivity_labels,
        category_trace=before.category_trace + ("CAT:C01",),
    )
    assert validate_c01_output(before, after) is False


# ---------------------------------------------------------------------------
# C03 cannot change recommendation / strengthen certainty
# ---------------------------------------------------------------------------


def test_c03_cannot_change_recommendation():
    before = _seed(
        category_trace=("CAT:C02", "CAT:C06", "CAT:C01"),
        analysis={"summary": "a", "kind": "analysis"},
        recommendation={
            "action": "consider_purchase",
            "certainty": "CONDITIONAL",
            "kind": "recommendation",
        },
        facts=(
            {
                "fact_id": "f1",
                "statement": "a",
                "provenance_ids": ["p1"],
            },
        ),
        provenance=({"provenance_id": "p1", "source": "s"},),
    )
    with pytest.raises(ValueError, match="recommendation|C03|ownership"):
        communicate(
            before,
            rendering={"format": "text", "body": "Buy now!", "certainty": "CERTAIN"},
            illicit_recommendation={
                "action": "buy_now",
                "certainty": "CERTAIN",
                "kind": "recommendation",
            },
        )


def test_c03_cannot_strengthen_conditional_to_certain():
    before = _seed(
        category_trace=("CAT:C02", "CAT:C06", "CAT:C01"),
        analysis={"summary": "a", "kind": "analysis"},
        recommendation={
            "action": "consider_purchase",
            "certainty": "CONDITIONAL",
            "kind": "recommendation",
        },
        facts=(
            {
                "fact_id": "f1",
                "statement": "a",
                "provenance_ids": ["p1"],
            },
        ),
        provenance=({"provenance_id": "p1", "source": "s"},),
    )
    with pytest.raises(ValueError, match="certainty|strengthen|CONDITIONAL|CERTAIN"):
        communicate(
            before,
            rendering={
                "format": "text",
                "body": "Definitely buy.",
                "certainty": "CERTAIN",  # illicit upgrade in presentation
            },
        )


def test_c03_output_validator_rejects_rec_mutation():
    before = _seed(
        category_trace=("CAT:C02", "CAT:C06", "CAT:C01"),
        analysis={"summary": "a", "kind": "analysis"},
        recommendation={
            "action": "consider_purchase",
            "certainty": "CONDITIONAL",
            "kind": "recommendation",
        },
        facts=(
            {
                "fact_id": "f1",
                "statement": "a",
                "provenance_ids": ["p1"],
            },
        ),
        provenance=({"provenance_id": "p1", "source": "s"},),
    )
    after = CrossCategoryEnvelope(
        envelope_id=before.envelope_id,
        goal_identity=before.goal_identity,
        facts=before.facts,
        provenance=before.provenance,
        uncertainties=before.uncertainties,
        hard_constraints=before.hard_constraints,
        user_preferences=before.user_preferences,
        analysis=before.analysis,
        recommendation={
            "action": "buy_now",
            "certainty": "CERTAIN",
            "kind": "recommendation",
        },
        rendering={"format": "text", "body": "x", "certainty": "CERTAIN"},
        authority_state=before.authority_state,
        execution_grants=(),
        failures=before.failures,
        taint_labels=before.taint_labels,
        sensitivity_labels=before.sensitivity_labels,
        category_trace=before.category_trace + ("CAT:C03",),
    )
    assert validate_c03_output(before, after) is False


# ---------------------------------------------------------------------------
# Preservation across stages
# ---------------------------------------------------------------------------


def test_constraints_provenance_uncertainty_prefs_taint_preserved():
    seed = _seed(
        uncertainties=({"uncertainty_id": "u0", "description": "seed uncertainty"},),
    )
    after_c02 = research(
        seed,
        facts=(
            {
                "fact_id": "f1",
                "statement": "a",
                "provenance_ids": ["p1"],
            },
        ),
        provenance=({"provenance_id": "p1", "source": "s"},),
        uncertainties=({"uncertainty_id": "u1", "description": "new"},),
    )
    after_c06 = analyze(after_c02, analysis={"summary": "s", "kind": "analysis"})
    after_c01 = decide(
        after_c06,
        recommendation={"action": "hold", "certainty": "CONDITIONAL", "kind": "recommendation"},
    )
    after_c03 = communicate(
        after_c01,
        rendering={"format": "text", "body": "hold (conditional)", "certainty": "CONDITIONAL"},
    )

    for stage in (after_c02, after_c06, after_c01, after_c03):
        assert stage.hard_constraints == seed.hard_constraints
        assert stage.user_preferences == seed.user_preferences
        assert set(seed.taint_labels) <= set(stage.taint_labels)
        assert set(seed.sensitivity_labels) <= set(stage.sensitivity_labels)
        assert {"u0"} <= {u["uncertainty_id"] for u in stage.uncertainties}
        assert stage.goal_identity == seed.goal_identity


# ---------------------------------------------------------------------------
# UNKNOWN != PASS / recommendation != execution / no authority minting
# ---------------------------------------------------------------------------


def test_unknown_not_laundered_to_pass():
    seed = _seed()
    after_c02 = research(
        seed,
        facts=(
            {
                "fact_id": "f1",
                "statement": "a",
                "provenance_ids": ["p1"],
            },
        ),
        provenance=({"provenance_id": "p1", "source": "s"},),
        uncertainties=(),
    )
    # Engine must preserve UNKNOWN failure
    assert any(f.status == "UNKNOWN" for f in after_c02.failures)
    # Hand-built laundering must fail c02 validator
    laundered = CrossCategoryEnvelope(
        envelope_id=after_c02.envelope_id,
        goal_identity=after_c02.goal_identity,
        facts=after_c02.facts,
        provenance=after_c02.provenance,
        uncertainties=after_c02.uncertainties,
        hard_constraints=after_c02.hard_constraints,
        user_preferences=after_c02.user_preferences,
        analysis=None,
        recommendation=None,
        rendering=None,
        authority_state=after_c02.authority_state,
        execution_grants=(),
        failures=(FailureRecord("f-unk", "PASS", "laundered"),),
        taint_labels=after_c02.taint_labels,
        sensitivity_labels=after_c02.sensitivity_labels,
        category_trace=("CAT:C02",),
    )
    assert validate_c02_output(seed, laundered) is False
    assert validate_handoff(seed, laundered, "CAT:C02", "CAT:C06") == HandoffResult.BLOCKED


def test_recommendation_not_execution_across_chain():
    seed = _seed()
    after_c02 = research(
        seed,
        facts=(
            {
                "fact_id": "f1",
                "statement": "a",
                "provenance_ids": ["p1"],
            },
        ),
        provenance=({"provenance_id": "p1", "source": "s"},),
        uncertainties=(),
    )
    after_c06 = analyze(after_c02, analysis={"summary": "s", "kind": "analysis"})
    after_c01 = decide(
        after_c06,
        recommendation={"action": "hold", "certainty": "CONDITIONAL", "kind": "recommendation"},
    )
    assert after_c01.execution_grants == ()
    after_c03 = communicate(
        after_c01,
        rendering={"format": "text", "body": "hold", "certainty": "CONDITIONAL"},
    )
    assert after_c03.execution_grants == ()
    assert after_c03.recommendation is not None
    assert after_c03.recommendation != after_c03.execution_grants


def test_no_category_mints_permits_or_verified_outcomes():
    """Engines must refuse illicit keys that look like authority/permits/receipts."""
    seed = _seed()
    after_c02 = research(
        seed,
        facts=(
            {
                "fact_id": "f1",
                "statement": "a",
                "provenance_ids": ["p1"],
            },
        ),
        provenance=({"provenance_id": "p1", "source": "s"},),
        uncertainties=(),
    )
    for engine_call in (
        lambda: analyze(
            after_c02,
            analysis={"summary": "s", "kind": "analysis", "verified_outcome": "PASS"},
        ),
        lambda: decide(
            after_c02,  # even from wrong prior — still must not mint
            recommendation={
                "action": "hold",
                "certainty": "CONDITIONAL",
                "kind": "recommendation",
                "permit": "EXECUTE",
            },
        ),
    ):
        # Either raises or produces no permit/verified fields on protected surfaces
        try:
            out = engine_call()
        except ValueError:
            continue
        # If it returned, protected fields must remain empty / non-escalated
        assert out.execution_grants == ()
        assert out.authority_state.level == 0
        assert out.authority_state.status == "NONE"
        if out.recommendation is not None:
            assert "permit" not in out.recommendation
            assert "verified_outcome" not in out.recommendation
        if out.analysis is not None:
            assert "verified_outcome" not in out.analysis
            assert "permit" not in out.analysis


# ---------------------------------------------------------------------------
# C02 ownership: may add facts+prov+uncertainty only
# ---------------------------------------------------------------------------


def test_c02_cannot_add_analysis_or_recommendation():
    seed = _seed()
    with pytest.raises(ValueError, match="analysis|recommendation|ownership|C02"):
        research(
            seed,
            facts=(
                {
                    "fact_id": "f1",
                    "statement": "a",
                    "provenance_ids": ["p1"],
                },
            ),
            provenance=({"provenance_id": "p1", "source": "s"},),
            uncertainties=(),
            illicit_analysis={"summary": "smuggled"},
        )


def test_c02_facts_require_provenance():
    seed = _seed()
    with pytest.raises(ValueError, match="provenance"):
        research(
            seed,
            facts=({"fact_id": "f1", "statement": "orphan", "provenance_ids": []},),
            provenance=(),
            uncertainties=(),
        )


# ---------------------------------------------------------------------------
# Category IDs namespaced
# ---------------------------------------------------------------------------


def test_category_trace_uses_namespaced_ids():
    seed = _seed()
    after_c02 = research(
        seed,
        facts=(
            {
                "fact_id": "f1",
                "statement": "a",
                "provenance_ids": ["p1"],
            },
        ),
        provenance=({"provenance_id": "p1", "source": "s"},),
        uncertainties=(),
    )
    assert "CAT:C02" in after_c02.category_trace
    assert "C02" not in after_c02.category_trace
