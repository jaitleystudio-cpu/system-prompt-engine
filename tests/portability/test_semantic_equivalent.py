"""semantic_equivalent protects critical semantics."""

from __future__ import annotations

from spe_runtime.portability.conformance import detect_attack, semantic_equivalent
from spe_runtime.portability.reasons import PortabilityReason


def _base(**over):
    d = {
        "envelope_id": "e1",
        "goal_identity": "g1",
        "facts": [{"fact_id": "f1", "statement": "s", "provenance_ids": ["p1"]}],
        "provenance": [{"provenance_id": "p1", "source": "src"}],
        "uncertainties": [{"uncertainty_id": "u1", "description": "maybe"}],
        "hard_constraints": [
            {"constraint_id": "c1", "statement": "hard", "strength": "HARD"}
        ],
        "user_preferences": [{"preference_id": "pref1", "statement": "concise"}],
        "analysis": None,
        "recommendation": None,
        "rendering": None,
        "authority_state": {"level": 0, "status": "DENIED", "grants": []},
        "execution_grants": [],
        "failures": [{"failure_id": "x", "status": "UNKNOWN", "message": ""}],
        "taint_labels": ["external_untrusted"],
        "sensitivity_labels": ["USER_PRIVATE"],
        "category_trace": ["CAT:C02"],
    }
    d.update(over)
    return d


def test_identical_equivalent():
    a = _base()
    assert semantic_equivalent(a, a) is True


def test_provenance_remove_not_equivalent():
    a = _base()
    b = _base(provenance=[])
    assert semantic_equivalent(a, b) is False
    assert detect_attack(a, b) == PortabilityReason.PROVENANCE_REMOVED.value


def test_unknown_to_null_not_equivalent():
    a = _base()
    b = _base(failures=[{"failure_id": "x", "status": None, "message": ""}])
    assert semantic_equivalent(a, b) is False
    assert detect_attack(a, b) in {
        PortabilityReason.UNKNOWN_NULLIFIED.value,
        PortabilityReason.SEMANTIC_NONEQUIVALENT.value,
    }


def test_hard_to_preference_not_equivalent():
    a = _base()
    b = _base(
        hard_constraints=[],
        user_preferences=[
            {"preference_id": "pref1", "statement": "concise"},
            {"preference_id": "c1", "statement": "hard"},
        ],
    )
    assert semantic_equivalent(a, b) is False
    assert detect_attack(a, b) == PortabilityReason.HARD_TO_PREFERENCE.value


def test_denied_to_granted_not_equivalent():
    a = _base()
    b = _base(authority_state={"level": 1, "status": "GRANTED", "grants": ["g"]})
    assert semantic_equivalent(a, b) is False
    assert detect_attack(a, b) in {
        PortabilityReason.DENIED_TO_GRANTED.value,
        PortabilityReason.AUTHORITY_ESCALATION.value,
    }
