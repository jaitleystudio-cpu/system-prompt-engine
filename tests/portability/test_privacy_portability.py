"""Privacy portability: USER_PRIVATE≠PUBLIC, UNTRUSTED≠TRUSTED, DENIED≠GRANTED."""

from __future__ import annotations

from spe_runtime.portability.conformance import detect_attack, semantic_equivalent
from spe_runtime.portability.reasons import PortabilityReason


def test_user_private_not_public():
    a = {
        "sensitivity_labels": ["USER_PRIVATE"],
        "taint_labels": [],
        "authority_state": {"status": "NONE", "level": 0, "grants": []},
        "provenance": [],
        "facts": [],
        "hard_constraints": [],
        "user_preferences": [],
        "uncertainties": [],
        "failures": [],
    }
    b = dict(a)
    b["sensitivity_labels"] = ["PUBLIC"]
    assert semantic_equivalent(a, b) is False
    assert detect_attack(a, b) == PortabilityReason.PRIVACY_ESCALATION.value


def test_untrusted_not_trusted():
    a = {
        "sensitivity_labels": ["USER_PRIVATE"],
        "taint_labels": ["external_untrusted"],
        "authority_state": {"status": "NONE", "level": 0, "grants": []},
        "provenance": [],
        "facts": [],
        "hard_constraints": [],
        "user_preferences": [],
        "uncertainties": [],
        "failures": [],
    }
    b = dict(a)
    b["taint_labels"] = []
    assert semantic_equivalent(a, b) is False
    assert detect_attack(a, b) == PortabilityReason.TRUST_ESCALATION.value


def test_denied_not_granted():
    a = {
        "sensitivity_labels": [],
        "taint_labels": [],
        "authority_state": {"status": "DENIED", "level": 0, "grants": []},
        "provenance": [],
        "facts": [],
        "hard_constraints": [],
        "user_preferences": [],
        "uncertainties": [],
        "failures": [],
    }
    b = dict(a)
    b["authority_state"] = {"status": "GRANTED", "level": 1, "grants": ["g"]}
    assert semantic_equivalent(a, b) is False
    assert detect_attack(a, b) == PortabilityReason.DENIED_TO_GRANTED.value
