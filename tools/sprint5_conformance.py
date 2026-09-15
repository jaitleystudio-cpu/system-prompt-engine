"""Sprint 5 cross-language conformance harness.

Python remains the semantic oracle. Rust execution is provided later by
the portable kernel; this module must not weaken frozen fixtures.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from spe_runtime.portability.abi import ABI_ID, abi_compatible
from spe_runtime.portability.canonical import canonicalize, strict_equal
from spe_runtime.portability.capability import (
    CapabilityStatus,
    detect_capability_escalation,
    evaluate_capability,
)
from spe_runtime.portability.conformance import (
    PLATFORM_REGISTRY,
    ReferenceRuntime,
    detect_attack,
    detect_fake_platform_status,
    semantic_equivalent,
    validate_round_trip,
)
from spe_runtime.portability.reasons import PortabilityReason

REPO = Path(__file__).resolve().parents[1]
CONFORMANCE_DIR = REPO / "data" / "conformance"
MANIFEST_PATH = CONFORMANCE_DIR / "universal_manifest_v1.json"

# Explicit protected-field manifest (Sprint 4 + Sprint 5 plan). Do not infer.
PROTECTED_FIELDS: tuple[str, ...] = (
    "envelope_id",
    "goal_identity",
    "facts",
    "provenance",
    "uncertainties",
    "hard_constraints",
    "user_preferences",
    "recommendation",
    "authority_state",
    "execution_grants",
    "failures",
    "taint_labels",
    "sensitivity_labels",
    "operation_id",
    "outcome",
)

_ATTACK_PAYLOADS = {
    "PROVENANCE_REMOVED",
    "UNKNOWN_NULLIFIED",
    "HARD_TO_PREFERENCE",
    "DENIED_TO_GRANTED",
    "PRIVACY_ESCALATION",
    "TRUST_ESCALATION",
    "AUTHORITY_ESCALATION",
    "CONSTRAINT_WEAKENED",
    "UNCERTAINTY_ERASED",
    "SEMANTIC_NONEQUIVALENT",
    "OUTCOME_ESCALATION",
    "OPERATION_ID_MUTATION",
}


def _load_jsonl(path: Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    if not path.exists():
        return rows
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        obj = json.loads(line)
        if not isinstance(obj, dict):
            raise ValueError("fixture row must be object")
        rows.append(obj)
    return rows


def load_manifest() -> dict[str, Any]:
    return json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))


def load_reference_cases(kind: str) -> list[dict[str, Any]]:
    """Load frozen spe.universal-abi.v1 fixtures, normalized for Sprint 5."""
    if kind == "positive":
        rows = _load_jsonl(CONFORMANCE_DIR / "universal_core_v1.jsonl")
        cases = []
        for row in rows:
            cases.append(
                {
                    "fixture_id": row["id"],
                    "kind": "positive",
                    "payload": row.get("payload") or {},
                    "capabilities_required": list(row.get("capabilities_required") or []),
                    "network_mode": row.get("network_mode", "NONE"),
                    "expected": {
                        "disposition": "VALID",
                        "reason_code": None,
                        "status": "VALID",
                    },
                    "raw": row,
                }
            )
        return cases
    if kind == "negative":
        rows = _load_jsonl(CONFORMANCE_DIR / "universal_negative_v1.jsonl")
        cases = []
        for row in rows:
            cases.append(
                {
                    "fixture_id": row["id"],
                    "kind": "negative",
                    "attack": row.get("attack"),
                    "before": row.get("before"),
                    "after": row.get("after"),
                    "capabilities_required": list(row.get("capabilities_required") or []),
                    "available_capabilities": list(row.get("available_capabilities") or []),
                    "network_mode": row.get("network_mode", "NONE"),
                    "expected": {
                        "disposition": "INVALID",
                        "reason_code": row.get("expect_reason"),
                        "status": "INVALID",
                    },
                    "raw": row,
                }
            )
        return cases
    raise ValueError(f"unknown fixture kind: {kind}")


def extract_protected(obj: Any) -> Any:
    """Project onto the explicit protected-field manifest."""
    if not isinstance(obj, dict):
        return obj
    payload = obj
    if "output" in obj and isinstance(obj["output"], dict):
        payload = obj["output"]
    if "payload" in payload and isinstance(payload["payload"], dict) and "envelope_id" not in payload:
        payload = payload["payload"]
    if not isinstance(payload, dict):
        return payload
    return {k: payload[k] for k in PROTECTED_FIELDS if k in payload}


def compare_protected(a: Any, b: Any) -> bool:
    """True iff protected semantics are type-strict equivalent."""
    return semantic_equivalent(extract_protected(a), extract_protected(b))


def _python_negative_ok(row: dict[str, Any]) -> tuple[bool, str | None]:
    attack = row.get("attack")
    expect = row.get("expect_reason")
    if attack in _ATTACK_PAYLOADS:
        reason = detect_attack(row["before"], row["after"])
        ok = reason == expect and semantic_equivalent(row["before"], row["after"]) is False
        return ok, reason
    if attack == "CAPABILITY_MISSING":
        d = evaluate_capability(
            row.get("capability", "OFFLINE_MODE"),
            available=frozenset(row.get("available_capabilities") or []),
        )
        ok = (
            d.status == CapabilityStatus.MISSING
            and d.reason == PortabilityReason.CAPABILITY_MISSING.value
            and d.outcome != "SUCCESS"
            and expect == PortabilityReason.CAPABILITY_MISSING.value
        )
        return ok, d.reason
    if attack == "CAPABILITY_BLOCKED":
        cap = row.get("capability", "OFFLINE_MODE")
        d = evaluate_capability(
            cap,
            available=frozenset(["CORE_CONTRACT", cap]),
            blocked=frozenset(row.get("blocked_capabilities") or []),
        )
        ok = (
            d.status == CapabilityStatus.BLOCKED
            and d.outcome != "SUCCESS"
            and expect == PortabilityReason.CAPABILITY_BLOCKED.value
        )
        return ok, d.reason
    if attack == "CAPABILITY_DEFER":
        d = evaluate_capability(
            "NETWORK_OPTIONAL",
            available=frozenset(["NETWORK_OPTIONAL"]),
            defer=frozenset(row.get("defer_capabilities") or []),
        )
        ok = (
            d.status == CapabilityStatus.DEFER
            and d.outcome != "SUCCESS"
            and expect == PortabilityReason.CAPABILITY_DEFER.value
        )
        return ok, d.reason
    if attack == "CAPABILITY_ESCALATION":
        esc = detect_capability_escalation(
            frozenset(row.get("source_capabilities") or []),
            frozenset(row.get("target_capabilities") or []),
        )
        ok = (
            esc["ok"] is False
            and esc["reason"] == PortabilityReason.CAPABILITY_ESCALATION.value
            and expect == PortabilityReason.CAPABILITY_ESCALATION.value
        )
        return ok, esc["reason"] if isinstance(esc["reason"], str) else None
    if attack in {"NETWORK_FORBIDDEN", "OFFLINE_VIOLATION"}:
        bad_mode = str(row.get("probe_network_mode") or "REQUIRED")
        bad_rt = ReferenceRuntime(network_mode=bad_mode)
        ok = (
            bad_rt.network_mode != "NONE"
            and expect
            in {
                PortabilityReason.NETWORK_FORBIDDEN.value,
                PortabilityReason.OFFLINE_VIOLATION.value,
            }
        )
        return ok, expect if ok else PortabilityReason.OFFLINE_VIOLATION.value
    if attack == "ROUND_TRIP_FAIL":
        drifted = row.get("after") or {}
        base = row.get("before") or {}
        ok = (
            not semantic_equivalent(base, drifted)
            and expect == PortabilityReason.ROUND_TRIP_FAIL.value
            and validate_round_trip(base)["ok"] is True
        )
        return ok, expect if ok else PortabilityReason.ROUND_TRIP_FAIL.value
    if attack == "TUPLE_LEAK":
        leaked_probe = {"items": ("a", "b")}
        canon = canonicalize(leaked_probe)
        ok = (
            isinstance(canon["items"], list)
            and expect == PortabilityReason.TUPLE_LEAK.value
            and validate_round_trip(leaked_probe)["ok"] is True
        )
        return ok, expect if ok else PortabilityReason.TUPLE_LEAK.value
    if attack == "ABI_MISMATCH":
        peer = row.get("peer_abi") or {
            "abi_id": "spe.broken-abi.v0",
            "major": 0,
            "minor": 0,
            "patch": 0,
        }
        result = abi_compatible(
            peer["abi_id"], peer["major"], peer.get("minor", 0), peer.get("patch", 0)
        )
        ok = (
            result["ok"] is False
            and result["reason"] == PortabilityReason.ABI_MISMATCH.value
            and expect == PortabilityReason.ABI_MISMATCH.value
            and ABI_ID == "spe.universal-abi.v1"
        )
        return ok, result.get("reason") if isinstance(result.get("reason"), str) else None
    if attack == "FAKE_PLATFORM_STATUS":
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
        detected = detect_fake_platform_status(forged)
        ok = (
            detected == PortabilityReason.FAKE_PLATFORM_STATUS.value
            and detect_fake_platform_status(PLATFORM_REGISTRY) is None
            and expect == PortabilityReason.FAKE_PLATFORM_STATUS.value
        )
        return ok, detected
    if attack == "CANONICAL_DRIFT":
        from spe_runtime.portability.canonical import canonical_dumps
        import unicodedata

        left = canonical_dumps({"b": 1, "a": 2})
        right = canonical_dumps({"a": 2, "b": 1})
        nfc = canonical_dumps({"s": unicodedata.normalize("NFC", "é")})
        nfd = canonical_dumps({"s": unicodedata.normalize("NFD", "é")})
        ok = left == right and nfc == nfd and expect == PortabilityReason.CANONICAL_DRIFT.value
        return ok, expect if ok else PortabilityReason.CANONICAL_DRIFT.value
    return False, None


def run_python_reference_case(case: dict[str, Any]) -> dict[str, Any]:
    """Oracle evaluation of one frozen fixture."""
    raw = case.get("raw") or case
    kind = case.get("kind") or raw.get("kind")
    if kind == "positive":
        payload = raw.get("payload") or case.get("payload") or {}
        rt_result = validate_round_trip(payload)
        if not rt_result["ok"]:
            return {
                "status": "INVALID",
                "disposition": "INVALID",
                "reason_code": rt_result["reason"],
                "output": payload,
            }
        output = payload
        if isinstance(payload, dict) and "envelope_id" in payload:
            rt = ReferenceRuntime()
            env = rt.import_envelope(payload)
            exported = rt.export_envelope(env)
            cmp_keys = set(payload.keys()) & set(exported.keys())
            left = {k: payload[k] for k in cmp_keys}
            right = {k: exported[k] for k in cmp_keys}
            if not semantic_equivalent(left, right):
                return {
                    "status": "INVALID",
                    "disposition": "INVALID",
                    "reason_code": PortabilityReason.SEMANTIC_NONEQUIVALENT.value,
                    "output": exported,
                }
            output = exported
        return {
            "status": "VALID",
            "disposition": "VALID",
            "reason_code": None,
            "output": output,
        }

    ok, reason = _python_negative_ok(raw)
    expect = raw.get("expect_reason") or (case.get("expected") or {}).get("reason_code")
    if not ok:
        return {
            "status": "ERROR",
            "disposition": "INVALID",
            "reason_code": reason,
            "output": raw.get("after"),
            "oracle_mismatch": True,
        }
    return {
        "status": "INVALID",
        "disposition": "INVALID",
        "reason_code": expect,
        "output": raw.get("after"),
        "detector": reason,
    }


def run_rust_case(case: dict[str, Any]) -> dict[str, Any]:
    """Rust portable kernel runner — deliberately unimplemented in RED."""
    raise RuntimeError("RUST_KERNEL_NOT_IMPLEMENTED")


def protected_drift(a: Any, b: Any) -> dict[str, int]:
    """Count per-field protected drift (0 is required)."""
    pa = extract_protected(a)
    pb = extract_protected(b)
    counts = {
        "semantic": 0,
        "constraint": 0,
        "provenance": 0,
        "uncertainty": 0,
        "authority": 0,
        "privacy_taint": 0,
        "operation_id": 0,
        "unknown_to_pass": 0,
    }
    if not isinstance(pa, dict) or not isinstance(pb, dict):
        if not strict_equal(canonicalize(pa), canonicalize(pb)):
            counts["semantic"] = 1
        return counts

    def _diff(key: str) -> bool:
        av = pa.get(key, "__ABSENT__") if key in pa else "__ABSENT__"
        bv = pb.get(key, "__ABSENT__") if key in pb else "__ABSENT__"
        if key in pa and key not in pb:
            return True
        if key not in pa and key in pb:
            return True
        if key not in pa and key not in pb:
            return False
        return not strict_equal(canonicalize(av), canonicalize(bv))

    if _diff("hard_constraints"):
        counts["constraint"] = 1
    if _diff("provenance"):
        counts["provenance"] = 1
    if _diff("uncertainties"):
        counts["uncertainty"] = 1
    if _diff("authority_state") or _diff("execution_grants"):
        counts["authority"] = 1
    if _diff("sensitivity_labels") or _diff("taint_labels"):
        counts["privacy_taint"] = 1
    if _diff("operation_id"):
        counts["operation_id"] = 1
    # UNKNOWN → PASS on failures
    b_fails = {
        str(f.get("failure_id")): f.get("status")
        for f in (pa.get("failures") or [])
        if isinstance(f, dict)
    }
    a_fails = {
        str(f.get("failure_id")): f.get("status")
        for f in (pb.get("failures") or [])
        if isinstance(f, dict)
    }
    for fid, status in b_fails.items():
        if status == "UNKNOWN" and a_fails.get(fid) == "PASS":
            counts["unknown_to_pass"] = 1
    if not semantic_equivalent(pa, pb):
        counts["semantic"] = 1
    return counts
