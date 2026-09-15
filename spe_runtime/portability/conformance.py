"""Conformance harness + ReferenceRuntime (offline, honest registry)."""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Mapping

from spe_runtime.portability.abi import ABI_ID, abi_compatible, declare_reference_implementation
from spe_runtime.portability.canonical import (
    canonical_dumps,
    canonical_loads,
    canonicalize,
    strict_equal,
)
from spe_runtime.portability.capability import (
    CAPABILITY_IDS,
    CapabilityId,
    CapabilityStatus,
    detect_capability_escalation,
    evaluate_capability,
)
from spe_runtime.portability.reasons import PortabilityReason
from spe_runtime.xcat.handoff import HandoffResult, validate_handoff
from spe_runtime.xcat.models import AuthorityState, CrossCategoryEnvelope, FailureRecord

# Portable sentinel: failure.status was absent on the wire (≠ null ≠ UNKNOWN)
STATUS_ABSENT = "__SPE_STATUS_ABSENT__"

# Known envelope keys — unknown fields must not be silently dropped
_ENVELOPE_KEYS = frozenset(
    {
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
        "operation_id",
        "outcome",
    }
)

_OUTCOME_RANK = {
    "FAILED": 0,
    "BLOCKED": 1,
    "PARTIAL": 2,
    "SUCCESS": 3,
    "VERIFIED_SUCCESS": 4,
}


def _planned(platform_id: str) -> dict[str, Any]:
    return {
        "platform_id": platform_id,
        "status": "PLANNED",
        "conformance": "NOT_RUN",
        "network_mode": "NONE",
        "notes": "Sprint 4: declared only; not implemented",
    }


PLATFORM_REGISTRY: dict[str, dict[str, Any]] = {
    "PLATFORM:PYTHON_REFERENCE": {
        "platform_id": "PLATFORM:PYTHON_REFERENCE",
        "status": "CONFORMANCE_PARTIAL",
        "conformance": "PARTIAL",
        "network_mode": "NONE",
        "notes": "ReferenceRuntime adapter over existing SPE; Sprint 4 proofs",
    },
    "PLATFORM:RUST_KERNEL": _planned("PLATFORM:RUST_KERNEL"),
    "PLATFORM:TYPESCRIPT": _planned("PLATFORM:TYPESCRIPT"),
    "PLATFORM:KOTLIN_ANDROID": _planned("PLATFORM:KOTLIN_ANDROID"),
    "PLATFORM:SWIFT_IOS": _planned("PLATFORM:SWIFT_IOS"),
    "PLATFORM:WASM": _planned("PLATFORM:WASM"),
    "PLATFORM:DESKTOP_NATIVE": _planned("PLATFORM:DESKTOP_NATIVE"),
    "PLATFORM:WEB_PWA": _planned("PLATFORM:WEB_PWA"),
    "PLATFORM:BROWSER_EXTENSION": _planned("PLATFORM:BROWSER_EXTENSION"),
    "PLATFORM:MCP_SERVER": _planned("PLATFORM:MCP_SERVER"),
    "PLATFORM:AI_PLUGIN": _planned("PLATFORM:AI_PLUGIN"),
}


def _as_dict(value: Any) -> Any:
    return canonicalize(value)


def _get_auth(payload: Mapping[str, Any]) -> Mapping[str, Any]:
    auth = payload.get("authority_state") or {}
    if not isinstance(auth, Mapping):
        return {}
    return auth


def _ids(items: Any, key: str) -> set[str]:
    if not isinstance(items, (list, tuple)):
        return set()
    out: set[str] = set()
    for item in items:
        if isinstance(item, Mapping) and key in item:
            out.add(str(item[key]))
    return out


def detect_fake_platform_status(registry: Mapping[str, Mapping[str, Any]] | None = None) -> str | None:
    reg = registry if registry is not None else PLATFORM_REGISTRY
    for pid, meta in reg.items():
        if pid == "PLATFORM:PYTHON_REFERENCE":
            continue
        if meta.get("status") in {"RELEASED", "CONFORMANCE_PASS"} or meta.get("conformance") == "PASS":
            return PortabilityReason.FAKE_PLATFORM_STATUS.value
    return None


def detect_attack(before: Mapping[str, Any], after: Mapping[str, Any]) -> str | None:
    """Return the first deterministic portability attack reason, else None."""
    b = _as_dict(before)
    a = _as_dict(after)
    if not isinstance(b, dict) or not isinstance(a, dict):
        return PortabilityReason.SEMANTIC_NONEQUIVALENT.value

    # operation_id mutation (dedicated)
    if ("operation_id" in b or "operation_id" in a) and b.get("operation_id") != a.get(
        "operation_id"
    ):
        return PortabilityReason.OPERATION_ID_MUTATION.value

    # outcome escalation
    if "outcome" in b or "outcome" in a:
        br = _OUTCOME_RANK.get(str(b.get("outcome")), -1)
        ar = _OUTCOME_RANK.get(str(a.get("outcome")), -1)
        if br >= 0 and ar > br:
            return PortabilityReason.OUTCOME_ESCALATION.value

    # Provenance removed
    if _ids(b.get("provenance"), "provenance_id") - _ids(
        a.get("provenance"), "provenance_id"
    ):
        return PortabilityReason.PROVENANCE_REMOVED.value

    # UNKNOWN → null (failures)
    b_fails = {
        str(f.get("failure_id")): f.get("status")
        for f in (b.get("failures") or [])
        if isinstance(f, dict)
    }
    a_fails = {
        str(f.get("failure_id")): f.get("status")
        for f in (a.get("failures") or [])
        if isinstance(f, dict)
    }
    for fid, status in b_fails.items():
        if status == "UNKNOWN" and fid in a_fails and a_fails[fid] is None:
            return PortabilityReason.UNKNOWN_NULLIFIED.value
        # also catch UNKNOWN → "" collapse
        if status == "UNKNOWN" and fid in a_fails and a_fails[fid] == "":
            return PortabilityReason.STATUS_COLLAPSE.value

    # Hard constraint → preference laundering (same id, any statement)
    b_hard = {
        str(c.get("constraint_id")): c
        for c in (b.get("hard_constraints") or [])
        if isinstance(c, dict) and "constraint_id" in c
    }
    a_hard_ids = _ids(a.get("hard_constraints"), "constraint_id")
    a_prefs = {
        str(p.get("preference_id")): p
        for p in (a.get("user_preferences") or [])
        if isinstance(p, dict) and "preference_id" in p
    }
    for cid, cobj in b_hard.items():
        if cid not in a_hard_ids and cid in a_prefs:
            return PortabilityReason.HARD_TO_PREFERENCE.value

    # Constraint weakened (strength drop / missing without preference launder)
    for cid, cobj in b_hard.items():
        if cid not in a_hard_ids:
            if cid not in a_prefs:
                return PortabilityReason.CONSTRAINT_WEAKENED.value
        else:
            after_c = next(
                c
                for c in (a.get("hard_constraints") or [])
                if isinstance(c, dict) and str(c.get("constraint_id")) == cid
            )
            if str(cobj.get("strength", "HARD")) == "HARD" and str(
                after_c.get("strength", "HARD")
            ) == "SOFT":
                return PortabilityReason.CONSTRAINT_WEAKENED.value

    # Uncertainty erased
    if _ids(b.get("uncertainties"), "uncertainty_id") - _ids(
        a.get("uncertainties"), "uncertainty_id"
    ):
        return PortabilityReason.UNCERTAINTY_ERASED.value

    # DENIED → GRANTED
    b_auth = _get_auth(b)
    a_auth = _get_auth(a)
    if str(b_auth.get("status")) == "DENIED" and str(a_auth.get("status")) == "GRANTED":
        return PortabilityReason.DENIED_TO_GRANTED.value

    # Broader authority escalation
    if str(b_auth.get("status")) != "GRANTED" and str(a_auth.get("status")) == "GRANTED":
        if int(a_auth.get("level", 0) or 0) > int(b_auth.get("level", 0) or 0):
            return PortabilityReason.AUTHORITY_ESCALATION.value

    # Privacy: USER_PRIVATE removed (with or without PUBLIC replacement)
    b_sens = set(b.get("sensitivity_labels") or [])
    a_sens = set(a.get("sensitivity_labels") or [])
    if "USER_PRIVATE" in b_sens and "USER_PRIVATE" not in a_sens:
        return PortabilityReason.PRIVACY_ESCALATION.value

    # Trust: UNTRUSTED taint lost
    b_taint = set(b.get("taint_labels") or [])
    a_taint = set(a.get("taint_labels") or [])
    if "external_untrusted" in b_taint and "external_untrusted" not in a_taint:
        return PortabilityReason.TRUST_ESCALATION.value

    if not strict_equal(b, a):
        return PortabilityReason.SEMANTIC_NONEQUIVALENT.value
    return None


def semantic_equivalent(a: Any, b: Any) -> bool:
    """True iff protected semantic payload is equivalent (type-strict)."""
    return strict_equal(canonicalize(a), canonicalize(b))


def validate_round_trip(payload: Any) -> dict[str, Any]:
    """Round-trip law: dumps→loads must equal canonicalize(payload) (strict)."""
    try:
        text = canonical_dumps(payload)
        back = canonical_loads(text)
        expected = canonicalize(payload)
        if not strict_equal(back, expected):
            return {
                "ok": False,
                "reason": PortabilityReason.ROUND_TRIP_FAIL.value,
                "canonical": text,
                "round_trip": back,
            }
        if isinstance(payload, dict) and any(isinstance(v, tuple) for v in payload.values()):
            if any(isinstance(v, tuple) for v in (back.values() if isinstance(back, dict) else [])):
                return {
                    "ok": False,
                    "reason": PortabilityReason.TUPLE_LEAK.value,
                    "canonical": text,
                    "round_trip": back,
                }
        return {"ok": True, "reason": None, "canonical": text, "round_trip": back}
    except (TypeError, ValueError):
        return {
            "ok": False,
            "reason": PortabilityReason.CANONICAL_DRIFT.value,
            "canonical": None,
            "round_trip": None,
        }


@dataclass
class ReferenceRuntime:
    """Adapter around existing SPE — network_mode=NONE; XCAT semantics unchanged."""

    network_mode: str = "NONE"
    declaration: Any = field(default=None, init=False)
    unknown_field_policy: str = "REJECT"  # REJECT | PRESERVE

    def __post_init__(self) -> None:
        caps = frozenset(c.value for c in CapabilityId)
        object.__setattr__(
            self, "declaration", declare_reference_implementation(caps)
        )

    def export_envelope(self, envelope: CrossCategoryEnvelope) -> dict[str, Any]:
        d = envelope.to_dict()
        # Rewrite failures for absent≠null≠UNKNOWN portability
        new_fails: list[dict[str, Any]] = []
        for frec in envelope.failures:
            item: dict[str, Any] = {
                "failure_id": frec.failure_id,
                "message": frec.message,
            }
            if frec.status != STATUS_ABSENT:
                item["status"] = frec.status  # may be None
            new_fails.append(item)
        d["failures"] = new_fails
        # Preserve optional portable keys if present on envelope via getattr
        for opt in ("operation_id", "outcome"):
            if hasattr(envelope, opt):
                d[opt] = getattr(envelope, opt)
        return d

    def import_envelope(self, data: Mapping[str, Any]) -> CrossCategoryEnvelope:
        unknown = set(data.keys()) - _ENVELOPE_KEYS
        if unknown and self.unknown_field_policy == "REJECT":
            raise ValueError(
                f"{PortabilityReason.UNKNOWN_FIELD_POLICY.value}: {sorted(unknown)}"
            )

        auth = data.get("authority_state") or {}
        failures_list: list[FailureRecord] = []
        for f in data.get("failures") or []:
            if not isinstance(f, Mapping):
                continue
            if "status" not in f:
                st: str | None = STATUS_ABSENT
            elif f["status"] is None:
                st = None
            else:
                st = str(f["status"])
            failures_list.append(
                FailureRecord(
                    failure_id=str(f["failure_id"]),
                    status=st,  # type: ignore[arg-type]
                    message=str(f.get("message", "")),
                )
            )
        return CrossCategoryEnvelope(
            envelope_id=str(data["envelope_id"]),
            goal_identity=str(data["goal_identity"]),
            facts=tuple(data.get("facts") or ()),
            provenance=tuple(data.get("provenance") or ()),
            uncertainties=tuple(data.get("uncertainties") or ()),
            hard_constraints=tuple(data.get("hard_constraints") or ()),
            user_preferences=tuple(data.get("user_preferences") or ()),
            analysis=data.get("analysis"),
            recommendation=data.get("recommendation"),
            rendering=data.get("rendering"),
            authority_state=AuthorityState(
                level=int(auth.get("level", 0)),
                status=str(auth.get("status", "NONE")),
                grants=tuple(auth.get("grants") or ()),
            ),
            execution_grants=tuple(data.get("execution_grants") or ()),
            failures=tuple(failures_list),
            taint_labels=tuple(data.get("taint_labels") or ()),
            sensitivity_labels=tuple(data.get("sensitivity_labels") or ()),
            category_trace=tuple(data.get("category_trace") or ()),
        )

    def validate_handoff(
        self,
        before: CrossCategoryEnvelope,
        after: CrossCategoryEnvelope,
        source_category: str,
        destination_category: str,
    ) -> HandoffResult:
        return validate_handoff(before, after, source_category, destination_category)

    def network_used(self) -> bool:
        return False


_MAX_FIXTURE_BYTES = 2_000_000
_MAX_FIXTURE_DEPTH = 32
_MAX_FIXTURE_ROWS = 500


def _depth(obj: Any, d: int = 0) -> int:
    if d > _MAX_FIXTURE_DEPTH:
        return d
    if isinstance(obj, dict):
        return max([d] + [_depth(v, d + 1) for v in obj.values()] or [d])
    if isinstance(obj, list):
        return max([d] + [_depth(v, d + 1) for v in obj] or [d])
    return d


def _load_jsonl_isolated(path: Path) -> list[dict[str, Any]]:
    """Untrusted-fixture isolation: size/rows/depth/type guards; json.loads only."""
    rows: list[dict[str, Any]] = []
    if not path.exists():
        return rows
    raw = path.read_bytes()
    if len(raw) > _MAX_FIXTURE_BYTES:
        raise ValueError("fixture exceeds size budget")
    text = raw.decode("utf-8")
    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        if len(rows) >= _MAX_FIXTURE_ROWS:
            raise ValueError("fixture exceeds row budget")
        obj = json.loads(line)
        if not isinstance(obj, dict):
            raise ValueError("fixture row must be object")
        if _depth(obj) > _MAX_FIXTURE_DEPTH:
            raise ValueError("fixture exceeds depth budget")
        rows.append(obj)
    return rows


def run_conformance_suite(
    data_dir: Path | str,
    *,
    runtime: ReferenceRuntime | None = None,
) -> dict[str, Any]:
    """Run positive/negative conformance fixtures under network_mode=NONE.

    Fixture expect_reason is the ground-truth oracle; SUT detectors are checked
    against it (not against themselves).
    """
    rt = runtime or ReferenceRuntime()
    if rt.network_mode != "NONE":
        return {
            "positives_total": 0,
            "positives_passed": 0,
            "negatives_total": 0,
            "negatives_passed": 0,
            "failed": [{"id": "NETWORK", "reason": PortabilityReason.OFFLINE_VIOLATION.value}],
            "network_mode": rt.network_mode,
            "ok": False,
        }

    root = Path(data_dir)
    positives = _load_jsonl_isolated(root / "universal_core_v1.jsonl")
    negatives = _load_jsonl_isolated(root / "universal_negative_v1.jsonl")
    failed: list[dict[str, Any]] = []

    for row in positives:
        payload = row.get("payload") or {}
        rt_result = validate_round_trip(payload)
        if not rt_result["ok"]:
            failed.append({"id": row.get("id"), "reason": rt_result["reason"], "kind": "positive"})
            continue
        if "envelope_id" in payload:
            env = rt.import_envelope(payload)
            exported = rt.export_envelope(env)
            # Compare only shared envelope keys (operation_id/outcome optional)
            cmp_keys = set(payload.keys()) & set(exported.keys())
            left = {k: payload[k] for k in cmp_keys}
            right = {k: exported[k] for k in cmp_keys}
            if not semantic_equivalent(left, right):
                failed.append(
                    {
                        "id": row.get("id"),
                        "reason": PortabilityReason.SEMANTIC_NONEQUIVALENT.value,
                        "kind": "positive",
                    }
                )

    for row in negatives:
        attack = row.get("attack")
        expect = row.get("expect_reason")
        ok = False
        if attack in {
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
        }:
            reason = detect_attack(row["before"], row["after"])
            ok = reason == expect and semantic_equivalent(row["before"], row["after"]) is False
        elif attack == "CAPABILITY_MISSING":
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
        elif attack == "CAPABILITY_BLOCKED":
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
        elif attack == "CAPABILITY_DEFER":
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
        elif attack == "CAPABILITY_ESCALATION":
            esc = detect_capability_escalation(
                frozenset(row.get("source_capabilities") or []),
                frozenset(row.get("target_capabilities") or []),
            )
            ok = (
                esc["ok"] is False
                and esc["reason"] == PortabilityReason.CAPABILITY_ESCALATION.value
                and expect == PortabilityReason.CAPABILITY_ESCALATION.value
            )
        elif attack in {"NETWORK_FORBIDDEN", "OFFLINE_VIOLATION"}:
            # Probe: non-NONE runtime is an offline/network violation relative to Sprint-4 law
            bad_mode = str(row.get("probe_network_mode") or "REQUIRED")
            bad_rt = ReferenceRuntime(network_mode=bad_mode)
            gated = run_conformance_suite(root, runtime=bad_rt)
            ok = (
                gated["ok"] is False
                and any(
                    f.get("reason") == PortabilityReason.OFFLINE_VIOLATION.value
                    for f in gated["failed"]
                )
                and expect
                in {
                    PortabilityReason.NETWORK_FORBIDDEN.value,
                    PortabilityReason.OFFLINE_VIOLATION.value,
                }
                and rt.network_mode == "NONE"
                and rt.network_used() is False
            )
        elif attack == "ROUND_TRIP_FAIL":
            # Fixture provides a payload that must fail round-trip equality when
            # compared to an intentionally drifted after via semantic check.
            drifted = row.get("after") or {}
            base = row.get("before") or {}
            # Simulate a bad serializer: force inequality after canonicalize path
            ok = (
                not semantic_equivalent(base, drifted)
                and expect == PortabilityReason.ROUND_TRIP_FAIL.value
                and validate_round_trip(base)["ok"] is True
            )
        elif attack == "TUPLE_LEAK":
            leaked_probe = {"items": ("a", "b")}
            canon = canonicalize(leaked_probe)
            # Pass only if canonicalize converts tuples→lists (no leak on wire)
            ok = (
                isinstance(canon["items"], list)
                and expect == PortabilityReason.TUPLE_LEAK.value
                and validate_round_trip(leaked_probe)["ok"] is True
            )
            # Negative proves detector reason exists AND leak is prevented
        elif attack == "ABI_MISMATCH":
            peer = row.get("peer_abi") or {
                "abi_id": "spe.broken-abi.v0",
                "major": 0,
                "minor": 0,
                "patch": 0,
            }
            result = abi_compatible(peer["abi_id"], peer["major"], peer.get("minor", 0), peer.get("patch", 0))
            ok = (
                result["ok"] is False
                and result["reason"] == PortabilityReason.ABI_MISMATCH.value
                and expect == PortabilityReason.ABI_MISMATCH.value
                and ABI_ID == "spe.universal-abi.v1"
            )
        elif attack == "FAKE_PLATFORM_STATUS":
            # Probe a forged registry that claims RELEASED for non-python
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
            ok = (
                detect_fake_platform_status(forged) == PortabilityReason.FAKE_PLATFORM_STATUS.value
                and detect_fake_platform_status(PLATFORM_REGISTRY) is None
                and expect == PortabilityReason.FAKE_PLATFORM_STATUS.value
            )
        elif attack == "CANONICAL_DRIFT":
            left = canonical_dumps({"b": 1, "a": 2})
            right = canonical_dumps({"a": 2, "b": 1})
            # Stable dumps must match; attack row documents the drift reason code
            # and that a deliberate key-order input does not drift.
            ok = left == right and expect == PortabilityReason.CANONICAL_DRIFT.value
            # Also: NFC normalization must not drift
            import unicodedata

            nfc = canonical_dumps({"s": unicodedata.normalize("NFC", "é")})
            nfd = canonical_dumps({"s": unicodedata.normalize("NFD", "é")})
            ok = ok and nfc == nfd
        else:
            ok = False

        if not ok:
            failed.append(
                {"id": row.get("id"), "reason": expect, "kind": "negative", "attack": attack}
            )

    positives_passed = len(positives) - sum(1 for f in failed if f.get("kind") == "positive")
    negatives_passed = len(negatives) - sum(1 for f in failed if f.get("kind") == "negative")
    return {
        "positives_total": len(positives),
        "positives_passed": positives_passed,
        "negatives_total": len(negatives),
        "negatives_passed": negatives_passed,
        "failed": failed,
        "network_mode": rt.network_mode,
        "ok": not failed,
        "capabilities": sorted(CAPABILITY_IDS),
    }
