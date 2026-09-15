"""Mutation controls — critical escapes must be 0."""

from __future__ import annotations

import copy

import pytest

from spe_runtime.portability.conformance import detect_attack, semantic_equivalent
from spe_runtime.portability.reasons import PortabilityReason


CRITICAL_MUTATIONS = [
    (
        "provenance_drop",
        {"provenance": [{"provenance_id": "p", "source": "s"}]},
        {"provenance": []},
        PortabilityReason.PROVENANCE_REMOVED.value,
    ),
    (
        "unknown_null",
        {"failures": [{"failure_id": "f", "status": "UNKNOWN", "message": ""}]},
        {"failures": [{"failure_id": "f", "status": None, "message": ""}]},
        PortabilityReason.UNKNOWN_NULLIFIED.value,
    ),
    (
        "hard_to_pref",
        {
            "hard_constraints": [
                {"constraint_id": "c", "statement": "x", "strength": "HARD"}
            ],
            "user_preferences": [],
        },
        {
            "hard_constraints": [],
            "user_preferences": [{"preference_id": "c", "statement": "x"}],
        },
        PortabilityReason.HARD_TO_PREFERENCE.value,
    ),
    (
        "denied_granted",
        {"authority_state": {"status": "DENIED", "level": 0, "grants": []}},
        {"authority_state": {"status": "GRANTED", "level": 1, "grants": ["g"]}},
        PortabilityReason.DENIED_TO_GRANTED.value,
    ),
    (
        "private_public",
        {"sensitivity_labels": ["USER_PRIVATE"]},
        {"sensitivity_labels": ["PUBLIC"]},
        PortabilityReason.PRIVACY_ESCALATION.value,
    ),
    (
        "untrusted_trusted",
        {"taint_labels": ["external_untrusted"]},
        {"taint_labels": []},
        PortabilityReason.TRUST_ESCALATION.value,
    ),
]


def _pad(d: dict) -> dict:
    base = {
        "provenance": [],
        "facts": [],
        "hard_constraints": [],
        "user_preferences": [],
        "uncertainties": [],
        "failures": [],
        "taint_labels": [],
        "sensitivity_labels": [],
        "authority_state": {"status": "NONE", "level": 0, "grants": []},
    }
    base.update(d)
    return base


@pytest.mark.parametrize("name,before_part,after_part,expect", CRITICAL_MUTATIONS)
def test_critical_mutation_detected(name, before_part, after_part, expect):
    before = _pad(before_part)
    after = _pad(after_part)
    # Ensure after has unrelated keys stable
    after = copy.deepcopy(after)
    reason = detect_attack(before, after)
    assert reason == expect, f"escape:{name} got={reason}"
    assert semantic_equivalent(before, after) is False


def test_critical_escapes_zero():
    escapes = []
    for name, before_part, after_part, expect in CRITICAL_MUTATIONS:
        before = _pad(before_part)
        after = _pad(after_part)
        reason = detect_attack(before, after)
        if reason != expect or semantic_equivalent(before, after):
            escapes.append(name)
    assert escapes == [], f"critical_escapes={escapes}"
