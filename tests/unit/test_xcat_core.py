"""XCAT core unit tests — schema + invariants X01–X10 + handoff.

RED→GREEN: these tests must fail against non-enforcing validators and pass
against the real XCAT kernel. Includes negative controls so weak detectors
cannot fake-pass.
"""

from __future__ import annotations

import copy
from pathlib import Path

import pytest

from spe_runtime.xcat.handoff import HandoffResult, validate_handoff
from spe_runtime.xcat.invariants import (
    validate_authority_non_escalation,
    validate_constraint_monotonicity,
    validate_failure_preservation,
    validate_preference_immutability,
    validate_provenance_monotonicity,
    validate_taint_preservation,
    validate_uncertainty_preservation,
)
from spe_runtime.xcat.models import (
    CATEGORY_IDS,
    AuthorityState,
    CrossCategoryEnvelope,
    FailureRecord,
)
from spe_runtime.xcat.reasons import ReasonCode
from spe_runtime.xcat.validator import load_envelope_schema, validate_envelope_dict

REPO_ROOT = Path(__file__).resolve().parents[2]
SCHEMA_PATH = REPO_ROOT / "schemas" / "xcat_envelope.schema.json"


def _base_envelope(**overrides) -> CrossCategoryEnvelope:
    base = dict(
        envelope_id="env-001",
        goal_identity="goal-alpha",
        facts=(
            {
                "fact_id": "f1",
                "statement": "sky is blue",
                "provenance_ids": ["p1"],
            },
        ),
        provenance=({"provenance_id": "p1", "source": "observation"},),
        uncertainties=(
            {"uncertainty_id": "u1", "description": "lighting may vary"},
        ),
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
        analysis={"summary": "neutral analysis"},
        recommendation=None,
        rendering=None,
        authority_state=AuthorityState(level=1, status="GRANTED", grants=("read",)),
        execution_grants=(),
        failures=(),
        taint_labels=("external_untrusted",),
        sensitivity_labels=("PII_NONE",),
        category_trace=("CAT:C02",),
    )
    base.update(overrides)
    return CrossCategoryEnvelope(**base)


# ---------------------------------------------------------------------------
# Schema validity
# ---------------------------------------------------------------------------


def test_schema_file_exists_and_loads():
    assert SCHEMA_PATH.is_file()
    schema = load_envelope_schema()
    assert schema["title"] == "CrossCategoryEnvelope"
    assert "envelope_id" in schema["required"]


def test_valid_envelope_passes_schema():
    env = _base_envelope()
    errors = validate_envelope_dict(env.to_dict())
    assert errors == [], errors


def test_invalid_envelope_missing_required_fails_schema():
    bad = {"envelope_id": "x"}  # missing required fields
    errors = validate_envelope_dict(bad)
    assert len(errors) > 0


def test_category_ids_are_namespaced():
    assert "C01" not in CATEGORY_IDS
    assert "CAT:C01" in CATEGORY_IDS
    assert len(CATEGORY_IDS) == 12
    for cid in CATEGORY_IDS:
        assert cid.startswith("CAT:C")


def test_schema_rejects_naked_category_in_trace():
    env = _base_envelope(category_trace=("C01",))  # naked — invalid
    errors = validate_envelope_dict(env.to_dict())
    assert len(errors) > 0


# ---------------------------------------------------------------------------
# X01 — constraints never silently weaken
# ---------------------------------------------------------------------------


def test_constraint_loss_detected():
    before = _base_envelope()
    after = _base_envelope(hard_constraints=())  # dropped constraint
    assert validate_constraint_monotonicity(before, after) is False


def test_constraint_preserved_ok():
    before = _base_envelope()
    after = _base_envelope(
        hard_constraints=before.hard_constraints
        + (
            {
                "constraint_id": "c2",
                "statement": "cite sources",
                "strength": "HARD",
            },
        )
    )
    assert validate_constraint_monotonicity(before, after) is True


def test_constraint_weakened_strength_detected():
    before = _base_envelope()
    weakened = (
        {
            "constraint_id": "c1",
            "statement": "never invent facts",
            "strength": "SOFT",  # HARD → SOFT
        },
    )
    after = _base_envelope(hard_constraints=weakened)
    assert validate_constraint_monotonicity(before, after) is False


# ---------------------------------------------------------------------------
# X02 — provenance never disappears
# ---------------------------------------------------------------------------


def test_provenance_loss_detected():
    before = _base_envelope()
    after = _base_envelope(provenance=())
    assert validate_provenance_monotonicity(before, after) is False


def test_provenance_preserved_ok():
    before = _base_envelope()
    after = _base_envelope(
        provenance=before.provenance
        + ({"provenance_id": "p2", "source": "doc"},)
    )
    assert validate_provenance_monotonicity(before, after) is True


# ---------------------------------------------------------------------------
# X03 — uncertainty never silently disappears
# ---------------------------------------------------------------------------


def test_uncertainty_erasure_detected():
    before = _base_envelope()
    after = _base_envelope(uncertainties=())
    assert validate_uncertainty_preservation(before, after) is False


def test_uncertainty_preserved_ok():
    before = _base_envelope()
    after = _base_envelope(uncertainties=before.uncertainties)
    assert validate_uncertainty_preservation(before, after) is True


# ---------------------------------------------------------------------------
# X04 — preference immutability
# ---------------------------------------------------------------------------


def test_preference_drift_detected():
    before = _base_envelope()
    after = _base_envelope(
        user_preferences=(
            {"preference_id": "pref1", "statement": "prefer verbose answers"},
        )
    )
    assert validate_preference_immutability(before, after) is False


def test_preference_removed_detected():
    before = _base_envelope()
    after = _base_envelope(user_preferences=())
    assert validate_preference_immutability(before, after) is False


def test_preference_unchanged_ok():
    before = _base_envelope()
    after = _base_envelope(user_preferences=before.user_preferences)
    assert validate_preference_immutability(before, after) is True


# ---------------------------------------------------------------------------
# Taint preservation (supporting invariant)
# ---------------------------------------------------------------------------


def test_taint_loss_detected():
    before = _base_envelope()
    after = _base_envelope(taint_labels=())
    assert validate_taint_preservation(before, after) is False


def test_taint_preserved_ok():
    before = _base_envelope()
    after = _base_envelope(
        taint_labels=before.taint_labels + ("derived",)
    )
    assert validate_taint_preservation(before, after) is True


# ---------------------------------------------------------------------------
# X09 — authority never self-escalates
# ---------------------------------------------------------------------------


def test_authority_escalation_detected():
    before = _base_envelope(
        authority_state=AuthorityState(level=1, status="GRANTED", grants=("read",))
    )
    after = _base_envelope(
        authority_state=AuthorityState(
            level=5, status="GRANTED", grants=("read", "execute", "admin")
        )
    )
    assert (
        validate_authority_non_escalation(before, after, authority_event=None) is False
    )


def test_authority_stable_ok():
    before = _base_envelope()
    after = _base_envelope(authority_state=before.authority_state)
    assert (
        validate_authority_non_escalation(before, after, authority_event=None) is True
    )


def test_authority_escalation_with_external_event_allowed():
    before = _base_envelope(
        authority_state=AuthorityState(level=1, status="GRANTED", grants=("read",))
    )
    after = _base_envelope(
        authority_state=AuthorityState(
            level=3, status="GRANTED", grants=("read", "write")
        )
    )
    # Explicit external authority event may permit escalation
    assert (
        validate_authority_non_escalation(
            before, after, authority_event={"type": "EXTERNAL_GRANT", "by": "operator"}
        )
        is True
    )


# ---------------------------------------------------------------------------
# X10 — FAIL/UNKNOWN cannot become PASS via handoff
# ---------------------------------------------------------------------------


def test_fail_to_pass_laundering_blocked_by_invariant():
    before = _base_envelope(
        failures=(FailureRecord(failure_id="fail-1", status="FAIL", message="broke"),)
    )
    after = _base_envelope(
        failures=(FailureRecord(failure_id="fail-1", status="PASS", message="broke"),)
    )
    assert validate_failure_preservation(before, after) is False


def test_fail_to_pass_laundering_refused_by_handoff():
    before = _base_envelope(
        failures=(FailureRecord(failure_id="fail-1", status="FAIL", message="broke"),),
        category_trace=("CAT:C06",),
    )
    after = _base_envelope(
        failures=(FailureRecord(failure_id="fail-1", status="PASS", message="broke"),),
        category_trace=("CAT:C06", "CAT:C01"),
    )
    result = validate_handoff(
        before, after, source_category="CAT:C06", destination_category="CAT:C01"
    )
    assert result in (
        HandoffResult.REFUSE,
        HandoffResult.BLOCKED,
        HandoffResult.REVALIDATION_REQUIRED,
    )
    assert result != HandoffResult.VALID
    # Must never invent promotion/execution success codes
    assert result.value not in ("PROMOTE", "EXECUTED", "VERIFIED_SUCCESS")


def test_unknown_to_pass_laundering_refused():
    before = _base_envelope(
        failures=(
            FailureRecord(failure_id="u-1", status="UNKNOWN", message="unclear"),
        )
    )
    after = _base_envelope(
        failures=(FailureRecord(failure_id="u-1", status="PASS", message="unclear"),)
    )
    result = validate_handoff(
        before, after, source_category="CAT:C02", destination_category="CAT:C06"
    )
    assert result != HandoffResult.VALID


def test_clean_handoff_valid():
    before = _base_envelope(category_trace=("CAT:C02",))
    after = _base_envelope(category_trace=("CAT:C02", "CAT:C06"))
    result = validate_handoff(
        before, after, source_category="CAT:C02", destination_category="CAT:C06"
    )
    assert result == HandoffResult.VALID


def test_constraint_loss_handoff_refused():
    before = _base_envelope()
    after = _base_envelope(hard_constraints=())
    result = validate_handoff(
        before, after, source_category="CAT:C02", destination_category="CAT:C06"
    )
    assert result != HandoffResult.VALID


def test_provenance_loss_handoff_refused():
    before = _base_envelope()
    after = _base_envelope(provenance=())
    result = validate_handoff(
        before, after, source_category="CAT:C02", destination_category="CAT:C06"
    )
    assert result != HandoffResult.VALID


def test_taint_loss_handoff_refused():
    before = _base_envelope()
    after = _base_envelope(taint_labels=())
    result = validate_handoff(
        before, after, source_category="CAT:C02", destination_category="CAT:C06"
    )
    assert result != HandoffResult.VALID


def test_authority_escalation_handoff_blocked():
    before = _base_envelope(
        authority_state=AuthorityState(level=1, status="GRANTED", grants=("read",))
    )
    after = _base_envelope(
        authority_state=AuthorityState(
            level=9, status="GRANTED", grants=("read", "admin")
        )
    )
    result = validate_handoff(
        before,
        after,
        source_category="CAT:C01",
        destination_category="CAT:C07",
        authority_event=None,
    )
    assert result in (HandoffResult.REFUSE, HandoffResult.BLOCKED)


def test_naked_category_handoff_refused():
    before = _base_envelope()
    after = _base_envelope()
    result = validate_handoff(
        before, after, source_category="C02", destination_category="C06"
    )
    assert result != HandoffResult.VALID


# ---------------------------------------------------------------------------
# Reason codes exist and are stable strings
# ---------------------------------------------------------------------------


def test_reason_codes_stable():
    assert ReasonCode.CONSTRAINT_WEAKENED.value == "X01_CONSTRAINT_WEAKENED"
    assert ReasonCode.PROVENANCE_LOST.value == "X02_PROVENANCE_LOST"
    assert ReasonCode.FAILURE_LAUNDERED.value == "X10_FAILURE_LAUNDERED"
    assert ReasonCode.AUTHORITY_SELF_ESCALATION.value == "X09_AUTHORITY_SELF_ESCALATION"


# ---------------------------------------------------------------------------
# Negative controls — weak/wrong detectors must not fake-pass
# ---------------------------------------------------------------------------


def test_negative_control_always_true_detector_is_insufficient():
    """A detector that always returns True must not satisfy loss cases.

    This test encodes the contract: loss cases must be False. If someone
    replaces validators with `return True`, this suite fails (RED evidence).
    """
    before = _base_envelope()
    after_no_constraints = _base_envelope(hard_constraints=())
    after_no_prov = _base_envelope(provenance=())
    after_no_unc = _base_envelope(uncertainties=())
    after_pref_drift = _base_envelope(
        user_preferences=(
            {"preference_id": "pref1", "statement": "CHANGED"},
        )
    )
    after_no_taint = _base_envelope(taint_labels=())
    after_escalated = _base_envelope(
        authority_state=AuthorityState(level=99, status="GRANTED", grants=("god",))
    )
    after_launder = _base_envelope(
        failures=(FailureRecord(failure_id="fail-1", status="PASS", message="x"),)
    )
    before_fail = _base_envelope(
        failures=(FailureRecord(failure_id="fail-1", status="FAIL", message="x"),)
    )

    failures = []
    if validate_constraint_monotonicity(before, after_no_constraints) is not False:
        failures.append("constraint")
    if validate_provenance_monotonicity(before, after_no_prov) is not False:
        failures.append("provenance")
    if validate_uncertainty_preservation(before, after_no_unc) is not False:
        failures.append("uncertainty")
    if validate_preference_immutability(before, after_pref_drift) is not False:
        failures.append("preference")
    if validate_taint_preservation(before, after_no_taint) is not False:
        failures.append("taint")
    if (
        validate_authority_non_escalation(before, after_escalated, None) is not False
    ):
        failures.append("authority")
    if validate_failure_preservation(before_fail, after_launder) is not False:
        failures.append("failure_launder")

    assert failures == [], f"weak detectors fake-passed: {failures}"


def test_handoff_result_enum_has_no_promote_executed():
    values = {m.value for m in HandoffResult}
    assert "PROMOTE" not in values
    assert "EXECUTED" not in values
    assert "VERIFIED_SUCCESS" not in values
    assert values == {"VALID", "REFUSE", "BLOCKED", "REVALIDATION_REQUIRED"}


def test_envelope_is_frozen():
    env = _base_envelope()
    with pytest.raises(Exception):
        env.envelope_id = "mutated"  # type: ignore[misc]
