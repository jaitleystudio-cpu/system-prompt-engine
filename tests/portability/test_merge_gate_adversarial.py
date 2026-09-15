"""PR #4 merge-gate adversarial repairs — gates that were green-but-bypassable."""

from __future__ import annotations

import subprocess
import sys
import unicodedata
from pathlib import Path

import pytest

from spe_runtime.portability.abi import ABI_ID, ABI_MAJOR, abi_compatible
from spe_runtime.portability.canonical import canonical_dumps, canonicalize, strict_equal
from spe_runtime.portability.capability import detect_capability_escalation, evaluate_capability
from spe_runtime.portability.conformance import (
    PLATFORM_REGISTRY,
    ReferenceRuntime,
    STATUS_ABSENT,
    detect_attack,
    detect_fake_platform_status,
    semantic_equivalent,
    validate_round_trip,
)
from spe_runtime.portability.oracle import oracle_detect
from spe_runtime.portability.reasons import PortabilityReason
from spe_runtime.xcat.models import FailureRecord


def test_abi_compatible_rejects_major_mismatch():
    bad = abi_compatible("spe.broken-abi.v0", 0)
    assert bad["ok"] is False
    assert bad["reason"] == PortabilityReason.ABI_MISMATCH.value
    good = abi_compatible(ABI_ID, ABI_MAJOR)
    assert good["ok"] is True


def test_absent_null_unknown_preserved_on_round_trip():
    rt = ReferenceRuntime()
    base = {
        "envelope_id": "e",
        "goal_identity": "g",
        "facts": [],
        "provenance": [],
        "uncertainties": [],
        "hard_constraints": [],
        "user_preferences": [],
        "analysis": None,
        "recommendation": None,
        "rendering": None,
        "authority_state": {"level": 0, "status": "NONE", "grants": []},
        "execution_grants": [],
        "taint_labels": [],
        "sensitivity_labels": [],
        "category_trace": [],
    }
    # UNKNOWN
    u = dict(base)
    u["failures"] = [{"failure_id": "f1", "status": "UNKNOWN", "message": "m"}]
    eu = rt.export_envelope(rt.import_envelope(u))
    assert eu["failures"][0]["status"] == "UNKNOWN"
    # explicit null
    n = dict(base)
    n["failures"] = [{"failure_id": "f1", "status": None, "message": "m"}]
    en = rt.export_envelope(rt.import_envelope(n))
    assert "status" in en["failures"][0]
    assert en["failures"][0]["status"] is None
    # absent
    a = dict(base)
    a["failures"] = [{"failure_id": "f1", "message": "m"}]
    ea = rt.export_envelope(rt.import_envelope(a))
    assert "status" not in ea["failures"][0]
    # distinctions hold
    assert eu["failures"][0] != en["failures"][0]
    assert en["failures"][0] != ea["failures"][0]
    assert eu["failures"][0] != ea["failures"][0]


def test_int_not_equivalent_to_float():
    assert semantic_equivalent({"n": 1}, {"n": 1.0}) is False
    assert strict_equal(1, 1.0) is False
    assert canonical_dumps({"n": 1}) != canonical_dumps({"n": 1.0})


def test_unicode_nfc_nfd_same_canonical():
    nfc = {"s": unicodedata.normalize("NFC", "é")}
    nfd = {"s": unicodedata.normalize("NFD", "é")}
    assert canonical_dumps(nfc) == canonical_dumps(nfd)
    assert semantic_equivalent(nfc, nfd) is True


def test_time_z_and_offset_equivalent():
    a = {"ts": "2026-09-15T12:00:00Z"}
    b = {"ts": "2026-09-15T12:00:00+00:00"}
    assert semantic_equivalent(a, b) is True
    assert canonical_dumps(a) == canonical_dumps(b)


def test_unknown_fields_rejected():
    rt = ReferenceRuntime()
    payload = {
        "envelope_id": "e",
        "goal_identity": "g",
        "facts": [],
        "provenance": [],
        "uncertainties": [],
        "hard_constraints": [],
        "user_preferences": [],
        "authority_state": {"level": 0, "status": "NONE", "grants": []},
        "execution_grants": [],
        "failures": [],
        "taint_labels": [],
        "sensitivity_labels": [],
        "category_trace": [],
        "evil_unknown": 1,
    }
    with pytest.raises(ValueError, match="P_UNKNOWN_FIELD_POLICY"):
        rt.import_envelope(payload)


def test_privacy_drop_without_public_is_escalation():
    before = {
        "provenance": [],
        "facts": [],
        "hard_constraints": [],
        "user_preferences": [],
        "uncertainties": [],
        "failures": [],
        "taint_labels": [],
        "sensitivity_labels": ["USER_PRIVATE"],
        "authority_state": {"status": "NONE", "level": 0, "grants": []},
    }
    after = dict(before)
    after["sensitivity_labels"] = []
    assert detect_attack(before, after) == PortabilityReason.PRIVACY_ESCALATION.value


def test_hard_to_pref_different_statement_detected():
    before = {
        "provenance": [],
        "facts": [],
        "hard_constraints": [
            {"constraint_id": "c1", "statement": "MUST X", "strength": "HARD"}
        ],
        "user_preferences": [],
        "uncertainties": [],
        "failures": [],
        "taint_labels": [],
        "sensitivity_labels": [],
        "authority_state": {"status": "NONE", "level": 0, "grants": []},
    }
    after = dict(before)
    after["hard_constraints"] = []
    after["user_preferences"] = [{"preference_id": "c1", "statement": "DIFFERENT"}]
    assert detect_attack(before, after) == PortabilityReason.HARD_TO_PREFERENCE.value


def test_outcome_and_operation_id_attacks():
    b = {
        "provenance": [],
        "facts": [],
        "hard_constraints": [],
        "user_preferences": [],
        "uncertainties": [],
        "failures": [],
        "taint_labels": [],
        "sensitivity_labels": [],
        "authority_state": {"status": "NONE", "level": 0, "grants": []},
        "outcome": "PARTIAL",
        "operation_id": "op-1",
    }
    a1 = dict(b)
    a1["outcome"] = "SUCCESS"
    assert detect_attack(b, a1) == PortabilityReason.OUTCOME_ESCALATION.value
    a2 = dict(b)
    a2["operation_id"] = "op-2"
    assert detect_attack(b, a2) == PortabilityReason.OPERATION_ID_MUTATION.value


def test_capability_escalation_guard():
    esc = detect_capability_escalation(
        {"CORE_CONTRACT"},
        {"CORE_CONTRACT", "LOCAL_EXECUTION"},
    )
    assert esc["ok"] is False
    assert esc["reason"] == PortabilityReason.CAPABILITY_ESCALATION.value
    ok = detect_capability_escalation({"CORE_CONTRACT", "OFFLINE_MODE"}, {"CORE_CONTRACT"})
    assert ok["ok"] is True


def test_fake_platform_detector():
    assert detect_fake_platform_status(PLATFORM_REGISTRY) is None
    forged = {
        **PLATFORM_REGISTRY,
        "PLATFORM:WASM": {
            "platform_id": "PLATFORM:WASM",
            "status": "RELEASED",
            "conformance": "PASS",
            "network_mode": "NONE",
            "notes": "FORGED",
        },
    }
    assert detect_fake_platform_status(forged) == PortabilityReason.FAKE_PLATFORM_STATUS.value


def test_oracle_independence_agrees_on_critical_attacks():
    cases = [
        (
            {"provenance": [{"provenance_id": "p", "source": "s"}], "facts": [], "hard_constraints": [], "user_preferences": [], "uncertainties": [], "failures": [], "taint_labels": [], "sensitivity_labels": [], "authority_state": {"status": "NONE", "level": 0, "grants": []}},
            {"provenance": [], "facts": [], "hard_constraints": [], "user_preferences": [], "uncertainties": [], "failures": [], "taint_labels": [], "sensitivity_labels": [], "authority_state": {"status": "NONE", "level": 0, "grants": []}},
            PortabilityReason.PROVENANCE_REMOVED.value,
        ),
        (
            {"provenance": [], "facts": [], "hard_constraints": [], "user_preferences": [], "uncertainties": [], "failures": [{"failure_id": "f", "status": "UNKNOWN", "message": ""}], "taint_labels": [], "sensitivity_labels": [], "authority_state": {"status": "NONE", "level": 0, "grants": []}},
            {"provenance": [], "facts": [], "hard_constraints": [], "user_preferences": [], "uncertainties": [], "failures": [{"failure_id": "f", "status": None, "message": ""}], "taint_labels": [], "sensitivity_labels": [], "authority_state": {"status": "NONE", "level": 0, "grants": []}},
            PortabilityReason.UNKNOWN_NULLIFIED.value,
        ),
    ]
    for before, after, expect in cases:
        assert detect_attack(before, after) == expect
        assert oracle_detect(before, after) == expect
        # Independence: oracle module source must not import detect_attack
    oracle_src = Path("spe_runtime/portability/oracle.py").read_text(encoding="utf-8")
    assert "from spe_runtime.portability.conformance" not in oracle_src
    assert "import detect_attack" not in oracle_src


def test_ten_cycle_round_trip_campaign():
    payload = {
        "b": 2,
        "a": {"z": [1, 2, 3], "y": "café"},
        "tags": ("x", "y"),
        "n": 1,
        "f": 1.5,
        "ts": "2026-09-15T12:00:00+00:00",
    }
    cur = payload
    for _ in range(10):
        text = canonical_dumps(cur)
        cur = __import__("spe_runtime.portability.canonical", fromlist=["canonical_loads"]).canonical_loads(text)
    assert strict_equal(cur, canonicalize(payload))
    rt = ReferenceRuntime()
    env_payload = {
        "envelope_id": "e",
        "goal_identity": "g",
        "facts": [{"fact_id": "f1", "statement": "s", "provenance_ids": ["p1"]}],
        "provenance": [{"provenance_id": "p1", "source": "s"}],
        "uncertainties": [],
        "hard_constraints": [{"constraint_id": "c1", "statement": "h", "strength": "HARD"}],
        "user_preferences": [],
        "analysis": None,
        "recommendation": None,
        "rendering": None,
        "authority_state": {"level": 0, "status": "NONE", "grants": []},
        "execution_grants": [],
        "failures": [{"failure_id": "f", "status": "UNKNOWN", "message": "m"}],
        "taint_labels": ["external_untrusted"],
        "sensitivity_labels": ["USER_PRIVATE"],
        "category_trace": ["CAT:C02"],
    }
    env = rt.import_envelope(env_payload)
    for _ in range(10):
        d = rt.export_envelope(env)
        env = rt.import_envelope(d)
    final = rt.export_envelope(env)
    assert final["failures"][0]["status"] == "UNKNOWN"
    assert semantic_equivalent(
        {k: env_payload[k] for k in final if k in env_payload},
        final,
    )


def test_cross_process_canonical_determinism():
    script = (
        "from spe_runtime.portability.canonical import canonical_dumps\n"
        "print(canonical_dumps({'b':1,'a':2,'n':1.5,'s':'café','e':None,'L':[3,1,2],"
        "'t':'2026-09-15T12:00:00+00:00'}))"
    )
    outs = []
    for _ in range(3):
        r = subprocess.run(
            [sys.executable, "-c", script],
            capture_output=True,
            text=True,
            cwd=str(Path(__file__).resolve().parents[2]),
            check=True,
        )
        outs.append(r.stdout.strip())
    assert len(set(outs)) == 1


def test_protected_semantics_manifest_present():
    import json

    man = json.loads(
        (Path(__file__).resolve().parents[2] / "data/conformance/universal_manifest_v1.json").read_text()
    )
    assert "protected_semantics" in man
    assert "provenance" in man["protected_semantics"]["fields"]
    assert man["not_a_release"] is True
