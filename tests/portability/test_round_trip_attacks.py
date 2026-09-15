"""Round-trip law + named semantic attacks."""

from __future__ import annotations

from spe_runtime.portability.canonical import canonicalize, canonical_dumps, canonical_loads
from spe_runtime.portability.conformance import detect_attack, semantic_equivalent, validate_round_trip
from spe_runtime.portability.reasons import PortabilityReason


def test_round_trip_law_holds_for_portable_dict():
    payload = {
        "b": 2,
        "a": {"z": [1, 2, 3], "y": "hi"},
        "tags": ("x", "y"),  # must not leak
    }
    result = validate_round_trip(payload)
    assert result["ok"] is True
    assert result["reason"] is None
    back = result["round_trip"]
    assert isinstance(back["tags"], list)
    assert semantic_equivalent(canonicalize(payload), back)


def test_attack_provenance_remove():
    before = {
        "provenance": [{"provenance_id": "p1", "source": "s"}],
        "facts": [{"fact_id": "f1", "statement": "s", "provenance_ids": ["p1"]}],
        "authority_state": {"status": "NONE", "level": 0, "grants": []},
        "hard_constraints": [],
        "user_preferences": [],
        "uncertainties": [],
        "failures": [],
        "taint_labels": [],
        "sensitivity_labels": ["USER_PRIVATE"],
    }
    after = dict(before)
    after["provenance"] = []
    assert detect_attack(before, after) == PortabilityReason.PROVENANCE_REMOVED.value


def test_attack_unknown_to_null():
    before = {
        "provenance": [],
        "facts": [],
        "authority_state": {"status": "NONE", "level": 0, "grants": []},
        "hard_constraints": [],
        "user_preferences": [],
        "uncertainties": [{"uncertainty_id": "u", "description": "d"}],
        "failures": [{"failure_id": "f", "status": "UNKNOWN", "message": ""}],
        "taint_labels": [],
        "sensitivity_labels": [],
    }
    after = dict(before)
    after["failures"] = [{"failure_id": "f", "status": None, "message": ""}]
    assert detect_attack(before, after) == PortabilityReason.UNKNOWN_NULLIFIED.value


def test_attack_hard_to_preference():
    before = {
        "provenance": [],
        "facts": [],
        "authority_state": {"status": "NONE", "level": 0, "grants": []},
        "hard_constraints": [
            {"constraint_id": "c1", "statement": "no", "strength": "HARD"}
        ],
        "user_preferences": [],
        "uncertainties": [],
        "failures": [],
        "taint_labels": [],
        "sensitivity_labels": [],
    }
    after = dict(before)
    after["hard_constraints"] = []
    after["user_preferences"] = [{"preference_id": "c1", "statement": "no"}]
    assert detect_attack(before, after) == PortabilityReason.HARD_TO_PREFERENCE.value


def test_attack_denied_to_granted():
    before = {
        "provenance": [],
        "facts": [],
        "authority_state": {"status": "DENIED", "level": 0, "grants": []},
        "hard_constraints": [],
        "user_preferences": [],
        "uncertainties": [],
        "failures": [],
        "taint_labels": [],
        "sensitivity_labels": [],
    }
    after = dict(before)
    after["authority_state"] = {"status": "GRANTED", "level": 1, "grants": ["g"]}
    assert detect_attack(before, after) == PortabilityReason.DENIED_TO_GRANTED.value


def test_canonical_bytes_stable_across_dumps():
    payload = {"k": [1, 2], "m": {"a": 1, "b": 2}}
    t1 = canonical_dumps(payload)
    t2 = canonical_dumps(canonical_loads(t1))
    assert t1 == t2
