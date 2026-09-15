"""ABI version + implementation declaration contract."""

from __future__ import annotations

import json
from pathlib import Path

import jsonschema
import pytest

from spe_runtime.portability.abi import (
    ABI_ID,
    ABI_MAJOR,
    ABI_MINOR,
    ABI_PATCH,
    AbiVersion,
    declare_reference_implementation,
)
from spe_runtime.portability.capability import CAPABILITY_IDS


SCHEMA = Path(__file__).resolve().parents[2] / "schemas" / "spe_universal_abi.schema.json"


def test_abi_id_is_spe_universal_abi_v1():
    assert ABI_ID == "spe.universal-abi.v1"


def test_abi_semver_major_minor_patch():
    assert ABI_MAJOR == 1
    assert ABI_MINOR == 0
    assert ABI_PATCH == 0
    v = AbiVersion(ABI_ID, ABI_MAJOR, ABI_MINOR, ABI_PATCH)
    assert v.as_tuple() == (1, 0, 0)


def test_reference_declaration_honest_status_and_offline():
    decl = declare_reference_implementation(CAPABILITY_IDS)
    assert decl.abi_version.abi_id == "spe.universal-abi.v1"
    assert decl.platform_id == "PLATFORM:PYTHON_REFERENCE"
    assert decl.network_mode == "NONE"
    assert decl.status in {"IMPLEMENTING", "CONFORMANCE_PARTIAL"}
    assert decl.status not in {"RELEASED", "CONFORMANCE_PASS"}


def test_schema_const_abi_id():
    schema = json.loads(SCHEMA.read_text(encoding="utf-8"))
    assert schema["properties"]["abi_id"]["const"] == "spe.universal-abi.v1"
    doc = {
        "abi_id": "spe.universal-abi.v1",
        "major": 1,
        "minor": 0,
        "patch": 0,
        "implementation": {
            "implementation_id": "spe-python-reference",
            "platform_id": "PLATFORM:PYTHON_REFERENCE",
            "status": "CONFORMANCE_PARTIAL",
            "network_mode": "NONE",
            "capabilities": sorted(CAPABILITY_IDS),
        },
        "capabilities": sorted(CAPABILITY_IDS),
        "network_mode": "NONE",
        "payload": {"envelope_id": "e1", "goal_identity": "g1"},
    }
    jsonschema.validate(doc, schema)


def test_schema_rejects_wrong_abi_id():
    schema = json.loads(SCHEMA.read_text(encoding="utf-8"))
    doc = {
        "abi_id": "spe.broken-abi.v0",
        "major": 1,
        "minor": 0,
        "patch": 0,
        "implementation": {
            "implementation_id": "x",
            "platform_id": "PLATFORM:PYTHON_REFERENCE",
            "status": "PLANNED",
            "network_mode": "NONE",
            "capabilities": [],
        },
        "capabilities": [],
        "network_mode": "NONE",
        "payload": {},
    }
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.validate(doc, schema)
