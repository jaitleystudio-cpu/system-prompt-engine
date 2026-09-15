"""Deterministic portable JSON canonicalization."""

from __future__ import annotations

import json
from enum import Enum

from spe_runtime.portability.canonical import canonicalize, canonical_dumps, canonical_loads
from spe_runtime.portability.reasons import PortabilityReason


class Color(str, Enum):
    RED = "RED"
    BLUE = "BLUE"


def test_stable_key_order():
    a = canonical_dumps({"b": 1, "a": 2})
    b = canonical_dumps({"a": 2, "b": 1})
    assert a == b == '{"a":2,"b":1}'


def test_utf8_round_trip():
    payload = {"msg": "हिन्दी-日本語-😀", "n": 1}
    text = canonical_dumps(payload)
    assert isinstance(text, str)
    back = canonical_loads(text)
    assert back == payload
    assert text.encode("utf-8").decode("utf-8") == text


def test_no_python_tuple_leak():
    payload = {"items": ("a", "b"), "nested": {"t": (1, 2)}}
    canon = canonicalize(payload)
    assert isinstance(canon["items"], list)
    assert isinstance(canon["nested"]["t"], list)
    text = canonical_dumps(payload)
    # Must be valid JSON with arrays, not tuple repr
    assert "(" not in text
    parsed = json.loads(text)
    assert parsed["items"] == ["a", "b"]


def test_stable_enums():
    assert canonical_dumps({"c": Color.RED}) == '{"c":"RED"}'
    assert canonicalize(PortabilityReason.CAPABILITY_MISSING) == "P_CAPABILITY_MISSING"


def test_nested_determinism():
    left = {"z": [{"b": 1, "a": 2}, {"d": 3, "c": 4}], "y": True}
    right = {"y": True, "z": [{"a": 2, "b": 1}, {"c": 4, "d": 3}]}
    assert canonical_dumps(left) == canonical_dumps(right)
