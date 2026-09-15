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
from spe_runtime.xcat.handoff import HandoffResult, diagnose_refusal_reason, validate_handoff
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


# ===========================================================================
# MERGE-GATE hardening: S2-01..S2-07, ownership +/- pairs, deep immutability,
# reason-code determinism, overblocking, side effects, schema↔model,
# adversarial edges 1–15, full-chain valid + attack fixtures A–H.
# ===========================================================================

from types import MappingProxyType

from spe_runtime.xcat.reasons import ReasonCode
from spe_runtime.xcat.validator import validate_envelope_dict


def _chain_valid():
    """Full-chain valid fixture helper: C02→C06→C01→C03."""
    seed = _seed()
    c02 = research(
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
    c06 = analyze(
        c02, analysis={"summary": "catalog supports widget X", "kind": "analysis"}
    )
    c01 = decide(
        c06,
        recommendation={
            "action": "consider_purchase",
            "certainty": "CONDITIONAL",
            "kind": "recommendation",
        },
    )
    c03 = communicate(
        c01,
        rendering={
            "format": "text",
            "body": "Conditional: consider purchase of widget X.",
            "certainty": "CONDITIONAL",
        },
    )
    return seed, c02, c06, c01, c03


# --- S2 hard invariants -----------------------------------------------------


def test_S2_01_c06_cannot_manufacture_recommendation():
    """S2-01: C06 cannot manufacture recommendation."""
    seed = _seed()
    after_c02 = research(
        seed,
        facts=(
            {"fact_id": "f1", "statement": "a", "provenance_ids": ["p1"]},
        ),
        provenance=({"provenance_id": "p1", "source": "s"},),
        uncertainties=(),
    )
    with pytest.raises(ValueError, match="recommendation|ownership|C06"):
        analyze(
            after_c02,
            analysis={"summary": "ok", "kind": "analysis"},
            illicit_recommendation={"action": "buy", "certainty": "CERTAIN"},
        )


def test_S2_02_c01_cannot_manufacture_authority_or_grants():
    """S2-02: C01 cannot manufacture authority / execution grants."""
    before = _seed(
        category_trace=("CAT:C02", "CAT:C06"),
        analysis={"summary": "a", "kind": "analysis"},
        facts=(
            {"fact_id": "f1", "statement": "a", "provenance_ids": ["p1"]},
        ),
        provenance=({"provenance_id": "p1", "source": "s"},),
    )
    with pytest.raises(ValueError, match="authority|ownership|C01"):
        decide(
            before,
            recommendation={
                "action": "hold",
                "certainty": "CONDITIONAL",
                "kind": "recommendation",
            },
            illicit_authority=AuthorityState(level=9, status="GRANTED", grants=("execute",)),
        )


def test_S2_03_c03_cannot_mutate_rec_or_strengthen_certainty():
    """S2-03: C03 cannot change recommendation or strengthen certainty."""
    before = _seed(
        category_trace=("CAT:C02", "CAT:C06", "CAT:C01"),
        analysis={"summary": "a", "kind": "analysis"},
        recommendation={
            "action": "consider_purchase",
            "certainty": "CONDITIONAL",
            "kind": "recommendation",
        },
        facts=(
            {"fact_id": "f1", "statement": "a", "provenance_ids": ["p1"]},
        ),
        provenance=({"provenance_id": "p1", "source": "s"},),
    )
    with pytest.raises(ValueError, match="certainty|strengthen|CONDITIONAL|CERTAIN"):
        communicate(
            before,
            rendering={"format": "text", "body": "Buy!", "certainty": "CERTAIN"},
        )


def test_S2_04_preservation_across_chain():
    """S2-04: constraints, provenance, uncertainty, prefs, taint/sensitivity preserved."""
    _, _, _, _, c03 = _chain_valid()
    seed = _seed(
        uncertainties=({"uncertainty_id": "u0", "description": "seed uncertainty"},),
    )
    # re-run with seed uncertainty
    after_c02 = research(
        seed,
        facts=(
            {"fact_id": "f1", "statement": "a", "provenance_ids": ["p1"]},
        ),
        provenance=({"provenance_id": "p1", "source": "s"},),
        uncertainties=({"uncertainty_id": "u1", "description": "new"},),
    )
    after_c06 = analyze(after_c02, analysis={"summary": "s", "kind": "analysis"})
    after_c01 = decide(
        after_c06,
        recommendation={
            "action": "hold",
            "certainty": "CONDITIONAL",
            "kind": "recommendation",
        },
    )
    after_c03 = communicate(
        after_c01,
        rendering={"format": "text", "body": "hold", "certainty": "CONDITIONAL"},
    )
    assert after_c03.hard_constraints == seed.hard_constraints
    assert after_c03.user_preferences == seed.user_preferences
    assert set(seed.taint_labels) <= set(after_c03.taint_labels)
    assert set(seed.sensitivity_labels) <= set(after_c03.sensitivity_labels)
    assert "u0" in {u["uncertainty_id"] for u in after_c03.uncertainties}
    assert after_c03.provenance[0]["provenance_id"] == "p1"


def test_S2_05_unknown_not_pass():
    """S2-05: UNKNOWN != PASS (failure laundering blocked)."""
    seed = _seed()
    after_c02 = research(
        seed,
        facts=(
            {"fact_id": "f1", "statement": "a", "provenance_ids": ["p1"]},
        ),
        provenance=({"provenance_id": "p1", "source": "s"},),
        uncertainties=(),
    )
    laundered = CrossCategoryEnvelope(
        envelope_id=after_c02.envelope_id,
        goal_identity=after_c02.goal_identity,
        facts=after_c02.facts,
        provenance=after_c02.provenance,
        uncertainties=after_c02.uncertainties,
        hard_constraints=after_c02.hard_constraints,
        user_preferences=after_c02.user_preferences,
        analysis={"summary": "x", "kind": "analysis"},
        recommendation=None,
        rendering=None,
        authority_state=after_c02.authority_state,
        execution_grants=(),
        failures=(FailureRecord("f-unk", "PASS", "laundered"),),
        taint_labels=after_c02.taint_labels,
        sensitivity_labels=after_c02.sensitivity_labels,
        category_trace=("CAT:C02", "CAT:C06"),
    )
    assert validate_c06_output(after_c02, laundered) is False
    assert validate_handoff(after_c02, laundered, "CAT:C02", "CAT:C06") == HandoffResult.BLOCKED
    assert (
        diagnose_refusal_reason(after_c02, laundered, "CAT:C02", "CAT:C06")
        == ReasonCode.FAILURE_LAUNDERED
    )


def test_S2_06_recommendation_not_execution():
    """S2-06: recommendation != execution."""
    _, _, _, c01, c03 = _chain_valid()
    assert c01.execution_grants == ()
    assert c03.execution_grants == ()
    assert c03.recommendation is not None


def test_S2_07_no_permits_verified_authority_mint_namespaced():
    """S2-07: no permits/verified outcomes/authority minting; CAT:Cxx IDs."""
    seed, c02, c06, c01, c03 = _chain_valid()
    for stage in (c02, c06, c01, c03):
        assert all(t.startswith("CAT:C") for t in stage.category_trace)
        assert stage.authority_state.level == 0
        assert stage.authority_state.status == "NONE"
        assert stage.execution_grants == ()
    with pytest.raises(ValueError, match="forbidden|permit|verified|ownership|C01"):
        decide(
            c06,
            recommendation={
                "action": "hold",
                "certainty": "CONDITIONAL",
                "kind": "recommendation",
                "permit": "EXECUTE",
            },
        )


# --- Ownership positive + negative pairs ------------------------------------


def test_c02_ownership_positive_adds_facts_prov_uncertainty():
    seed = _seed()
    after = research(
        seed,
        facts=(
            {"fact_id": "f1", "statement": "a", "provenance_ids": ["p1"]},
        ),
        provenance=({"provenance_id": "p1", "source": "s"},),
        uncertainties=({"uncertainty_id": "u1", "description": "u"},),
    )
    assert validate_c02_output(seed, after) is True
    assert len(after.facts) == 1
    assert len(after.provenance) == 1
    assert any(u["uncertainty_id"] == "u1" for u in after.uncertainties)
    assert after.analysis is None and after.recommendation is None


def test_c02_ownership_negative_rejects_analysis_kwarg():
    seed = _seed()
    with pytest.raises(ValueError, match="ownership|C02|analysis"):
        research(
            seed,
            facts=(
                {"fact_id": "f1", "statement": "a", "provenance_ids": ["p1"]},
            ),
            provenance=({"provenance_id": "p1", "source": "s"},),
            uncertainties=(),
            illicit_analysis={"summary": "nope"},
        )


def test_c06_ownership_positive_adds_analysis_only():
    seed = _seed()
    c02 = research(
        seed,
        facts=(
            {"fact_id": "f1", "statement": "a", "provenance_ids": ["p1"]},
        ),
        provenance=({"provenance_id": "p1", "source": "s"},),
        uncertainties=(),
    )
    c06 = analyze(c02, analysis={"summary": "ok", "kind": "analysis"})
    assert validate_c06_output(c02, c06) is True
    assert c06.analysis is not None
    assert c06.recommendation is None
    assert c06.facts == c02.facts


def test_c06_ownership_negative_rejects_kind_recommendation():
    seed = _seed()
    c02 = research(
        seed,
        facts=(
            {"fact_id": "f1", "statement": "a", "provenance_ids": ["p1"]},
        ),
        provenance=({"provenance_id": "p1", "source": "s"},),
        uncertainties=(),
    )
    with pytest.raises(ValueError, match="recommendation|ownership|C06"):
        analyze(c02, analysis={"summary": "x", "kind": "recommendation"})


def test_c06_ownership_negative_rejects_recommendation_shaped():
    seed = _seed()
    c02 = research(
        seed,
        facts=(
            {"fact_id": "f1", "statement": "a", "provenance_ids": ["p1"]},
        ),
        provenance=({"provenance_id": "p1", "source": "s"},),
        uncertainties=(),
    )
    with pytest.raises(ValueError, match="recommendation|ownership|C06|action"):
        analyze(
            c02,
            analysis={
                "summary": "x",
                "kind": "analysis",
                "action": "buy",
                "certainty": "CERTAIN",
            },
        )


def test_c01_ownership_positive_adds_recommendation_only():
    seed = _seed()
    c02 = research(
        seed,
        facts=(
            {"fact_id": "f1", "statement": "a", "provenance_ids": ["p1"]},
        ),
        provenance=({"provenance_id": "p1", "source": "s"},),
        uncertainties=(),
    )
    c06 = analyze(c02, analysis={"summary": "ok", "kind": "analysis"})
    c01 = decide(
        c06,
        recommendation={
            "action": "hold",
            "certainty": "CONDITIONAL",
            "kind": "recommendation",
        },
    )
    assert validate_c01_output(c06, c01) is True
    assert c01.recommendation is not None
    assert c01.authority_state == c06.authority_state
    assert c01.execution_grants == ()


def test_c01_ownership_negative_rejects_authority_kwarg():
    before = _seed(
        category_trace=("CAT:C02", "CAT:C06"),
        analysis={"summary": "a", "kind": "analysis"},
        facts=(
            {"fact_id": "f1", "statement": "a", "provenance_ids": ["p1"]},
        ),
        provenance=({"provenance_id": "p1", "source": "s"},),
    )
    with pytest.raises(ValueError, match="authority|ownership|C01"):
        decide(
            before,
            recommendation={
                "action": "hold",
                "certainty": "CONDITIONAL",
                "kind": "recommendation",
            },
            illicit_authority=AuthorityState(level=3, status="GRANTED", grants=("x",)),
        )


def test_c03_ownership_positive_adds_rendering_only():
    _, _, _, c01, c03 = _chain_valid()
    assert validate_c03_output(c01, c03) is True
    assert c03.rendering is not None
    assert c03.recommendation == c01.recommendation


def test_c03_ownership_negative_rejects_rec_kwarg():
    before = _seed(
        category_trace=("CAT:C02", "CAT:C06", "CAT:C01"),
        analysis={"summary": "a", "kind": "analysis"},
        recommendation={
            "action": "consider_purchase",
            "certainty": "CONDITIONAL",
            "kind": "recommendation",
        },
        facts=(
            {"fact_id": "f1", "statement": "a", "provenance_ids": ["p1"]},
        ),
        provenance=({"provenance_id": "p1", "source": "s"},),
    )
    with pytest.raises(ValueError, match="recommendation|ownership|C03"):
        communicate(
            before,
            rendering={"format": "text", "body": "x", "certainty": "CONDITIONAL"},
            illicit_recommendation={
                "action": "buy_now",
                "certainty": "CERTAIN",
                "kind": "recommendation",
            },
        )


# --- Deep immutability ------------------------------------------------------


def test_deep_immutability_nested_fact_meta_not_mutable():
    seed = _seed()
    after = research(
        seed,
        facts=(
            {
                "fact_id": "f1",
                "statement": "a",
                "provenance_ids": ["p1"],
                "meta": {"nested": 1},
            },
        ),
        provenance=({"provenance_id": "p1", "source": "s"},),
        uncertainties=(),
    )
    assert isinstance(after.facts[0], MappingProxyType)
    with pytest.raises(TypeError):
        after.facts[0]["statement"] = "mutated"  # type: ignore[index]
    nested = after.facts[0]["meta"]
    assert isinstance(nested, MappingProxyType)
    with pytest.raises(TypeError):
        nested["nested"] = 99  # type: ignore[index]


def test_deep_immutability_nested_analysis_details_not_mutable():
    seed = _seed()
    c02 = research(
        seed,
        facts=(
            {"fact_id": "f1", "statement": "a", "provenance_ids": ["p1"]},
        ),
        provenance=({"provenance_id": "p1", "source": "s"},),
        uncertainties=(),
    )
    c06 = analyze(
        c02,
        analysis={"summary": "ok", "kind": "analysis", "details": {"score": 1}},
    )
    with pytest.raises(TypeError):
        c06.analysis["details"]["score"] = 2  # type: ignore[index]


# --- Reason-code determinism ------------------------------------------------


def test_reason_code_determinism_provenance_lost():
    # Drop an unused provenance record so X02 fires without X05 (facts still rooted).
    before = _seed(
        category_trace=("CAT:C02",),
        facts=(
            {"fact_id": "f1", "statement": "a", "provenance_ids": ["p1"]},
        ),
        provenance=(
            {"provenance_id": "p1", "source": "s"},
            {"provenance_id": "p2", "source": "extra"},
        ),
    )
    after = CrossCategoryEnvelope(
        envelope_id=before.envelope_id,
        goal_identity=before.goal_identity,
        facts=before.facts,
        provenance=({"provenance_id": "p1", "source": "s"},),
        uncertainties=before.uncertainties,
        hard_constraints=before.hard_constraints,
        user_preferences=before.user_preferences,
        analysis={"summary": "x", "kind": "analysis"},
        recommendation=None,
        rendering=None,
        authority_state=before.authority_state,
        execution_grants=(),
        failures=before.failures,
        taint_labels=before.taint_labels,
        sensitivity_labels=before.sensitivity_labels,
        category_trace=("CAT:C02", "CAT:C06"),
    )
    assert validate_handoff(before, after, "CAT:C02", "CAT:C06") == HandoffResult.REFUSE
    expected = ReasonCode.PROVENANCE_LOST
    actual = diagnose_refusal_reason(before, after, "CAT:C02", "CAT:C06")
    assert expected == actual


def test_reason_code_determinism_authority_escalation():
    before = _seed(
        category_trace=("CAT:C02", "CAT:C06"),
        analysis={"summary": "a", "kind": "analysis"},
        facts=(
            {"fact_id": "f1", "statement": "a", "provenance_ids": ["p1"]},
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
            "action": "hold",
            "certainty": "CONDITIONAL",
            "kind": "recommendation",
        },
        rendering=None,
        authority_state=AuthorityState(level=5, status="GRANTED", grants=("execute",)),
        execution_grants=(),
        failures=before.failures,
        taint_labels=before.taint_labels,
        sensitivity_labels=before.sensitivity_labels,
        category_trace=("CAT:C02", "CAT:C06", "CAT:C01"),
    )
    assert validate_handoff(before, after, "CAT:C06", "CAT:C01") == HandoffResult.BLOCKED
    assert (
        diagnose_refusal_reason(before, after, "CAT:C06", "CAT:C01")
        == ReasonCode.AUTHORITY_SELF_ESCALATION
    )


# --- Overblocking check -----------------------------------------------------


def test_overblocking_valid_certainty_weaken_allowed():
    """Valid CERTAIN→CONDITIONAL weaken in rendering must NOT be blocked."""
    seed = _seed()
    c02 = research(
        seed,
        facts=(
            {"fact_id": "f1", "statement": "a", "provenance_ids": ["p1"]},
        ),
        provenance=({"provenance_id": "p1", "source": "s"},),
        uncertainties=(),
    )
    c06 = analyze(c02, analysis={"summary": "ok", "kind": "analysis"})
    c01 = decide(
        c06,
        recommendation={
            "action": "hold",
            "certainty": "CERTAIN",
            "kind": "recommendation",
        },
    )
    c03 = communicate(
        c01,
        rendering={"format": "text", "body": "maybe hold", "certainty": "CONDITIONAL"},
    )
    assert c03.rendering["certainty"] == "CONDITIONAL"
    assert validate_handoff(c01, c03, "CAT:C01", "CAT:C03") == HandoffResult.VALID


def test_overblocking_happy_path_handoffs_all_valid():
    seed, c02, c06, c01, c03 = _chain_valid()
    assert validate_handoff(seed, c02, "CAT:C02", "CAT:C02") == HandoffResult.VALID
    assert validate_handoff(c02, c06, "CAT:C02", "CAT:C06") == HandoffResult.VALID
    assert validate_handoff(c06, c01, "CAT:C06", "CAT:C01") == HandoffResult.VALID
    assert validate_handoff(c01, c03, "CAT:C01", "CAT:C03") == HandoffResult.VALID


# --- No hidden side effects -------------------------------------------------


def test_no_hidden_side_effects_on_input_envelope():
    seed = _seed()
    facts_before = seed.facts
    trace_before = seed.category_trace
    c02 = research(
        seed,
        facts=(
            {"fact_id": "f1", "statement": "a", "provenance_ids": ["p1"]},
        ),
        provenance=({"provenance_id": "p1", "source": "s"},),
        uncertainties=(),
    )
    assert seed.facts == facts_before
    assert seed.category_trace == trace_before
    assert c02 is not seed
    c06 = analyze(c02, analysis={"summary": "ok", "kind": "analysis"})
    assert c02.analysis is None
    assert c06 is not c02


# --- Schema ↔ model consistency ---------------------------------------------


def test_schema_model_consistency_full_chain_to_dict():
    _, _, _, _, c03 = _chain_valid()
    errors = validate_envelope_dict(c03.to_dict())
    assert errors == [], errors
    assert set(c03.to_dict().keys()) >= {
        "envelope_id",
        "goal_identity",
        "facts",
        "provenance",
        "uncertainties",
        "hard_constraints",
        "user_preferences",
        "analysis",
        "recommendation",
        "rendering",
        "authority_state",
        "execution_grants",
        "failures",
        "taint_labels",
        "sensitivity_labels",
        "category_trace",
    }


# --- Adversarial edge cases 1–15 --------------------------------------------


def test_adversarial_01_orphan_provenance_ids_rejected():
    seed = _seed()
    with pytest.raises(ValueError, match="provenance"):
        research(
            seed,
            facts=(
                {"fact_id": "f1", "statement": "orphan", "provenance_ids": ["missing"]},
            ),
            provenance=({"provenance_id": "p1", "source": "s"},),
            uncertainties=(),
        )


def test_adversarial_02_empty_provenance_ids_rejected():
    seed = _seed()
    with pytest.raises(ValueError, match="provenance"):
        research(
            seed,
            facts=({"fact_id": "f1", "statement": "orphan", "provenance_ids": []},),
            provenance=(),
            uncertainties=(),
        )


def test_adversarial_03_naked_category_id_refused():
    seed, c02, *_ = _chain_valid()
    assert validate_handoff(seed, c02, "C02", "C06") == HandoffResult.REFUSE
    assert diagnose_refusal_reason(seed, c02, "C02", "C06") == ReasonCode.INVALID_CATEGORY


def test_adversarial_04_goal_identity_rewrite_blocked():
    before = _seed(
        category_trace=("CAT:C02", "CAT:C06", "CAT:C01"),
        analysis={"summary": "a", "kind": "analysis"},
        recommendation={
            "action": "hold",
            "certainty": "CONDITIONAL",
            "kind": "recommendation",
        },
        facts=(
            {"fact_id": "f1", "statement": "a", "provenance_ids": ["p1"]},
        ),
        provenance=({"provenance_id": "p1", "source": "s"},),
    )
    after = CrossCategoryEnvelope(
        envelope_id=before.envelope_id,
        goal_identity="hijacked-goal",
        facts=before.facts,
        provenance=before.provenance,
        uncertainties=before.uncertainties,
        hard_constraints=before.hard_constraints,
        user_preferences=before.user_preferences,
        analysis=before.analysis,
        recommendation=before.recommendation,
        rendering={"format": "text", "body": "x", "certainty": "CONDITIONAL"},
        authority_state=before.authority_state,
        execution_grants=(),
        failures=before.failures,
        taint_labels=before.taint_labels,
        sensitivity_labels=before.sensitivity_labels,
        category_trace=before.category_trace + ("CAT:C03",),
    )
    assert validate_c03_output(before, after) is False
    assert validate_handoff(before, after, "CAT:C01", "CAT:C03") == HandoffResult.REFUSE


def test_adversarial_05_constraint_weaken_hard_to_soft():
    before = _seed(
        category_trace=("CAT:C02",),
        facts=(
            {"fact_id": "f1", "statement": "a", "provenance_ids": ["p1"]},
        ),
        provenance=({"provenance_id": "p1", "source": "s"},),
    )
    after = CrossCategoryEnvelope(
        envelope_id=before.envelope_id,
        goal_identity=before.goal_identity,
        facts=before.facts,
        provenance=before.provenance,
        uncertainties=before.uncertainties,
        hard_constraints=(
            {
                "constraint_id": "c1",
                "statement": "never invent facts",
                "strength": "SOFT",
            },
        ),
        user_preferences=before.user_preferences,
        analysis={"summary": "x", "kind": "analysis"},
        recommendation=None,
        rendering=None,
        authority_state=before.authority_state,
        execution_grants=(),
        failures=before.failures,
        taint_labels=before.taint_labels,
        sensitivity_labels=before.sensitivity_labels,
        category_trace=("CAT:C02", "CAT:C06"),
    )
    assert validate_c06_output(before, after) is False
    assert (
        diagnose_refusal_reason(before, after, "CAT:C02", "CAT:C06")
        == ReasonCode.CONSTRAINT_WEAKENED
    )


def test_adversarial_06_preference_statement_rewrite():
    before = _seed(
        category_trace=("CAT:C02",),
        facts=(
            {"fact_id": "f1", "statement": "a", "provenance_ids": ["p1"]},
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
        user_preferences=(
            {"preference_id": "pref1", "statement": "prefer verbose answers"},
        ),
        analysis={"summary": "x", "kind": "analysis"},
        recommendation=None,
        rendering=None,
        authority_state=before.authority_state,
        execution_grants=(),
        failures=before.failures,
        taint_labels=before.taint_labels,
        sensitivity_labels=before.sensitivity_labels,
        category_trace=("CAT:C02", "CAT:C06"),
    )
    assert (
        diagnose_refusal_reason(before, after, "CAT:C02", "CAT:C06")
        == ReasonCode.PREFERENCE_MUTATED
    )


def test_adversarial_07_taint_label_drop():
    before = _seed(
        category_trace=("CAT:C02",),
        facts=(
            {"fact_id": "f1", "statement": "a", "provenance_ids": ["p1"]},
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
        analysis={"summary": "x", "kind": "analysis"},
        recommendation=None,
        rendering=None,
        authority_state=before.authority_state,
        execution_grants=(),
        failures=before.failures,
        taint_labels=(),
        sensitivity_labels=before.sensitivity_labels,
        category_trace=("CAT:C02", "CAT:C06"),
    )
    assert diagnose_refusal_reason(before, after, "CAT:C02", "CAT:C06") == ReasonCode.TAINT_LOST


def test_adversarial_08_sensitivity_label_drop():
    before = _seed(
        category_trace=("CAT:C02",),
        facts=(
            {"fact_id": "f1", "statement": "a", "provenance_ids": ["p1"]},
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
        analysis={"summary": "x", "kind": "analysis"},
        recommendation=None,
        rendering=None,
        authority_state=before.authority_state,
        execution_grants=(),
        failures=before.failures,
        taint_labels=before.taint_labels,
        sensitivity_labels=(),
        category_trace=("CAT:C02", "CAT:C06"),
    )
    assert (
        diagnose_refusal_reason(before, after, "CAT:C02", "CAT:C06")
        == ReasonCode.SENSITIVITY_LOST
    )


def test_adversarial_09_uncertainty_erasure():
    before = _seed(
        category_trace=("CAT:C02",),
        facts=(
            {"fact_id": "f1", "statement": "a", "provenance_ids": ["p1"]},
        ),
        provenance=({"provenance_id": "p1", "source": "s"},),
        uncertainties=({"uncertainty_id": "u1", "description": "price"},),
    )
    after = CrossCategoryEnvelope(
        envelope_id=before.envelope_id,
        goal_identity=before.goal_identity,
        facts=before.facts,
        provenance=before.provenance,
        uncertainties=(),
        hard_constraints=before.hard_constraints,
        user_preferences=before.user_preferences,
        analysis={"summary": "x", "kind": "analysis"},
        recommendation=None,
        rendering=None,
        authority_state=before.authority_state,
        execution_grants=(),
        failures=before.failures,
        taint_labels=before.taint_labels,
        sensitivity_labels=before.sensitivity_labels,
        category_trace=("CAT:C02", "CAT:C06"),
    )
    assert (
        diagnose_refusal_reason(before, after, "CAT:C02", "CAT:C06")
        == ReasonCode.UNCERTAINTY_ERASED
    )


def test_adversarial_10_fail_to_pass_via_c03_handoff():
    before = _seed(
        category_trace=("CAT:C02", "CAT:C06", "CAT:C01"),
        analysis={"summary": "a", "kind": "analysis"},
        recommendation={
            "action": "hold",
            "certainty": "CONDITIONAL",
            "kind": "recommendation",
        },
        facts=(
            {"fact_id": "f1", "statement": "a", "provenance_ids": ["p1"]},
        ),
        provenance=({"provenance_id": "p1", "source": "s"},),
        failures=(FailureRecord("f-fail", "FAIL", "bad"),),
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
        recommendation=before.recommendation,
        rendering={"format": "text", "body": "ok", "certainty": "CONDITIONAL"},
        authority_state=before.authority_state,
        execution_grants=(),
        failures=(FailureRecord("f-fail", "PASS", "laundered"),),
        taint_labels=before.taint_labels,
        sensitivity_labels=before.sensitivity_labels,
        category_trace=before.category_trace + ("CAT:C03",),
    )
    assert validate_handoff(before, after, "CAT:C01", "CAT:C03") == HandoffResult.BLOCKED


def test_adversarial_11_unknown_to_certain_strengthen_in_rendering():
    before = _seed(
        category_trace=("CAT:C02", "CAT:C06", "CAT:C01"),
        analysis={"summary": "a", "kind": "analysis"},
        recommendation={
            "action": "hold",
            "certainty": "UNKNOWN",
            "kind": "recommendation",
        },
        facts=(
            {"fact_id": "f1", "statement": "a", "provenance_ids": ["p1"]},
        ),
        provenance=({"provenance_id": "p1", "source": "s"},),
    )
    with pytest.raises(ValueError, match="certainty|strengthen"):
        communicate(
            before,
            rendering={"format": "text", "body": "sure", "certainty": "CERTAIN"},
        )


def test_adversarial_12_c01_rejects_analysis_kind_on_recommendation():
    before = _seed(
        category_trace=("CAT:C02", "CAT:C06"),
        analysis={"summary": "a", "kind": "analysis"},
        facts=(
            {"fact_id": "f1", "statement": "a", "provenance_ids": ["p1"]},
        ),
        provenance=({"provenance_id": "p1", "source": "s"},),
    )
    with pytest.raises(ValueError, match="ownership|analysis|C01"):
        decide(
            before,
            recommendation={
                "action": "hold",
                "certainty": "CONDITIONAL",
                "kind": "analysis",
            },
        )


def test_adversarial_13_rendering_with_verified_success_key_rejected():
    before = _seed(
        category_trace=("CAT:C02", "CAT:C06", "CAT:C01"),
        analysis={"summary": "a", "kind": "analysis"},
        recommendation={
            "action": "hold",
            "certainty": "CONDITIONAL",
            "kind": "recommendation",
        },
        facts=(
            {"fact_id": "f1", "statement": "a", "provenance_ids": ["p1"]},
        ),
        provenance=({"provenance_id": "p1", "source": "s"},),
    )
    with pytest.raises(ValueError, match="forbidden|VERIFIED|verified"):
        communicate(
            before,
            rendering={
                "format": "text",
                "body": "x",
                "certainty": "CONDITIONAL",
                "VERIFIED_SUCCESS": True,
            },
        )


def test_adversarial_14_destination_missing_from_trace_revalidation():
    before = _seed(
        category_trace=("CAT:C02",),
        facts=(
            {"fact_id": "f1", "statement": "a", "provenance_ids": ["p1"]},
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
        analysis={"summary": "x", "kind": "analysis"},
        recommendation=None,
        rendering=None,
        authority_state=before.authority_state,
        execution_grants=(),
        failures=before.failures,
        taint_labels=before.taint_labels,
        sensitivity_labels=before.sensitivity_labels,
        category_trace=("CAT:C02",),  # missing CAT:C06
    )
    assert (
        validate_handoff(before, after, "CAT:C02", "CAT:C06")
        == HandoffResult.REVALIDATION_REQUIRED
    )


def test_adversarial_15_list_nested_in_analysis_deep_frozen():
    seed = _seed()
    c02 = research(
        seed,
        facts=(
            {"fact_id": "f1", "statement": "a", "provenance_ids": ["p1"]},
        ),
        provenance=({"provenance_id": "p1", "source": "s"},),
        uncertainties=(),
    )
    c06 = analyze(
        c02,
        analysis={"summary": "ok", "kind": "analysis", "items": [{"a": 1}]},
    )
    items = c06.analysis["items"]
    assert isinstance(items, tuple)
    with pytest.raises(TypeError):
        items[0]["a"] = 2  # type: ignore[index]


# --- Full-chain valid fixture -----------------------------------------------


def test_full_chain_valid_fixture():
    seed, c02, c06, c01, c03 = _chain_valid()
    assert c02.category_trace[-1] == "CAT:C02"
    assert c06.category_trace[-1] == "CAT:C06"
    assert c01.category_trace[-1] == "CAT:C01"
    assert c03.category_trace[-1] == "CAT:C03"
    assert c03.recommendation["certainty"] == "CONDITIONAL"
    assert validate_envelope_dict(c03.to_dict()) == []


# --- Attack fixtures A–H ----------------------------------------------------


def test_attack_A_c06_manufactures_recommendation():
    seed = _seed()
    c02 = research(
        seed,
        facts=(
            {"fact_id": "f1", "statement": "a", "provenance_ids": ["p1"]},
        ),
        provenance=({"provenance_id": "p1", "source": "s"},),
        uncertainties=(),
    )
    after = CrossCategoryEnvelope(
        envelope_id=c02.envelope_id,
        goal_identity=c02.goal_identity,
        facts=c02.facts,
        provenance=c02.provenance,
        uncertainties=c02.uncertainties,
        hard_constraints=c02.hard_constraints,
        user_preferences=c02.user_preferences,
        analysis={"summary": "x", "kind": "analysis"},
        recommendation={"action": "buy", "certainty": "CERTAIN", "kind": "recommendation"},
        rendering=None,
        authority_state=c02.authority_state,
        execution_grants=(),
        failures=c02.failures,
        taint_labels=c02.taint_labels,
        sensitivity_labels=c02.sensitivity_labels,
        category_trace=("CAT:C02", "CAT:C06"),
    )
    assert validate_c06_output(c02, after) is False


def test_attack_B_c01_mints_authority():
    before = _seed(
        category_trace=("CAT:C02", "CAT:C06"),
        analysis={"summary": "a", "kind": "analysis"},
        facts=(
            {"fact_id": "f1", "statement": "a", "provenance_ids": ["p1"]},
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
            "action": "hold",
            "certainty": "CONDITIONAL",
            "kind": "recommendation",
        },
        rendering=None,
        authority_state=AuthorityState(level=9, status="GRANTED", grants=("execute",)),
        execution_grants=(),
        failures=before.failures,
        taint_labels=before.taint_labels,
        sensitivity_labels=before.sensitivity_labels,
        category_trace=before.category_trace + ("CAT:C01",),
    )
    assert validate_c01_output(before, after) is False


def test_attack_C_c01_mints_execution_grants():
    before = _seed(
        category_trace=("CAT:C02", "CAT:C06"),
        analysis={"summary": "a", "kind": "analysis"},
        facts=(
            {"fact_id": "f1", "statement": "a", "provenance_ids": ["p1"]},
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
            "action": "hold",
            "certainty": "CONDITIONAL",
            "kind": "recommendation",
        },
        rendering=None,
        authority_state=before.authority_state,
        execution_grants=({"grant_id": "g1", "from_recommendation": True},),
        failures=before.failures,
        taint_labels=before.taint_labels,
        sensitivity_labels=before.sensitivity_labels,
        category_trace=before.category_trace + ("CAT:C01",),
    )
    assert validate_c01_output(before, after) is False


def test_attack_D_c03_mutates_recommendation():
    before = _seed(
        category_trace=("CAT:C02", "CAT:C06", "CAT:C01"),
        analysis={"summary": "a", "kind": "analysis"},
        recommendation={
            "action": "consider_purchase",
            "certainty": "CONDITIONAL",
            "kind": "recommendation",
        },
        facts=(
            {"fact_id": "f1", "statement": "a", "provenance_ids": ["p1"]},
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
        rendering={"format": "text", "body": "buy", "certainty": "CERTAIN"},
        authority_state=before.authority_state,
        execution_grants=(),
        failures=before.failures,
        taint_labels=before.taint_labels,
        sensitivity_labels=before.sensitivity_labels,
        category_trace=before.category_trace + ("CAT:C03",),
    )
    assert validate_c03_output(before, after) is False


def test_attack_E_c03_strengthens_conditional_to_certain():
    before = _seed(
        category_trace=("CAT:C02", "CAT:C06", "CAT:C01"),
        analysis={"summary": "a", "kind": "analysis"},
        recommendation={
            "action": "consider_purchase",
            "certainty": "CONDITIONAL",
            "kind": "recommendation",
        },
        facts=(
            {"fact_id": "f1", "statement": "a", "provenance_ids": ["p1"]},
        ),
        provenance=({"provenance_id": "p1", "source": "s"},),
    )
    with pytest.raises(ValueError, match="certainty|strengthen"):
        communicate(
            before,
            rendering={"format": "text", "body": "definitely", "certainty": "CERTAIN"},
        )


def test_attack_F_unknown_to_pass_laundering():
    seed = _seed()
    c02 = research(
        seed,
        facts=(
            {"fact_id": "f1", "statement": "a", "provenance_ids": ["p1"]},
        ),
        provenance=({"provenance_id": "p1", "source": "s"},),
        uncertainties=(),
    )
    laundered = CrossCategoryEnvelope(
        envelope_id=c02.envelope_id,
        goal_identity=c02.goal_identity,
        facts=c02.facts,
        provenance=c02.provenance,
        uncertainties=c02.uncertainties,
        hard_constraints=c02.hard_constraints,
        user_preferences=c02.user_preferences,
        analysis=None,
        recommendation=None,
        rendering=None,
        authority_state=c02.authority_state,
        execution_grants=(),
        failures=(FailureRecord("f-unk", "PASS", "laundered"),),
        taint_labels=c02.taint_labels,
        sensitivity_labels=c02.sensitivity_labels,
        category_trace=("CAT:C02",),
    )
    assert validate_c02_output(seed, laundered) is False
    assert validate_handoff(seed, laundered, "CAT:C02", "CAT:C06") == HandoffResult.BLOCKED


def test_attack_G_provenance_erasure_across_handoff():
    # Full provenance wipe with surviving facts: first detector is X05 (facts lack
    # provenance), which is the deterministic ordered reason — still blocks erasure.
    before = _seed(
        category_trace=("CAT:C02",),
        facts=(
            {"fact_id": "f1", "statement": "a", "provenance_ids": ["p1"]},
        ),
        provenance=({"provenance_id": "p1", "source": "s"},),
    )
    after = CrossCategoryEnvelope(
        envelope_id=before.envelope_id,
        goal_identity=before.goal_identity,
        facts=before.facts,
        provenance=(),
        uncertainties=before.uncertainties,
        hard_constraints=before.hard_constraints,
        user_preferences=before.user_preferences,
        analysis={"summary": "x", "kind": "analysis"},
        recommendation=None,
        rendering=None,
        authority_state=before.authority_state,
        execution_grants=(),
        failures=before.failures,
        taint_labels=before.taint_labels,
        sensitivity_labels=before.sensitivity_labels,
        category_trace=("CAT:C02", "CAT:C06"),
    )
    assert validate_handoff(before, after, "CAT:C02", "CAT:C06") == HandoffResult.REFUSE
    assert (
        diagnose_refusal_reason(before, after, "CAT:C02", "CAT:C06")
        == ReasonCode.FACT_MISSING_PROVENANCE
    )
    # Isolated X02: drop unused provenance only
    before2 = _seed(
        category_trace=("CAT:C02",),
        facts=(
            {"fact_id": "f1", "statement": "a", "provenance_ids": ["p1"]},
        ),
        provenance=(
            {"provenance_id": "p1", "source": "s"},
            {"provenance_id": "p2", "source": "extra"},
        ),
    )
    after2 = CrossCategoryEnvelope(
        envelope_id=before2.envelope_id,
        goal_identity=before2.goal_identity,
        facts=before2.facts,
        provenance=({"provenance_id": "p1", "source": "s"},),
        uncertainties=before2.uncertainties,
        hard_constraints=before2.hard_constraints,
        user_preferences=before2.user_preferences,
        analysis={"summary": "x", "kind": "analysis"},
        recommendation=None,
        rendering=None,
        authority_state=before2.authority_state,
        execution_grants=(),
        failures=before2.failures,
        taint_labels=before2.taint_labels,
        sensitivity_labels=before2.sensitivity_labels,
        category_trace=("CAT:C02", "CAT:C06"),
    )
    assert (
        diagnose_refusal_reason(before2, after2, "CAT:C02", "CAT:C06")
        == ReasonCode.PROVENANCE_LOST
    )


def test_attack_H_permit_verified_outcome_keys_in_payloads():
    seed = _seed()
    c02 = research(
        seed,
        facts=(
            {"fact_id": "f1", "statement": "a", "provenance_ids": ["p1"]},
        ),
        provenance=({"provenance_id": "p1", "source": "s"},),
        uncertainties=(),
    )
    with pytest.raises(ValueError, match="forbidden|verified"):
        analyze(
            c02,
            analysis={
                "summary": "s",
                "kind": "analysis",
                "verified_outcome": "PASS",
            },
        )
    c06 = analyze(c02, analysis={"summary": "s", "kind": "analysis"})
    with pytest.raises(ValueError, match="forbidden|permit"):
        decide(
            c06,
            recommendation={
                "action": "hold",
                "certainty": "CONDITIONAL",
                "kind": "recommendation",
                "permits": ["EXECUTE"],
            },
        )
