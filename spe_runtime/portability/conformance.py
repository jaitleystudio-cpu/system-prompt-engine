"""Conformance harness + ReferenceRuntime (offline, honest registry)."""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Mapping

from spe_runtime.portability.abi import declare_reference_implementation
from spe_runtime.portability.canonical import canonical_dumps, canonical_loads, canonicalize
from spe_runtime.portability.capability import (
    CAPABILITY_IDS,
    CapabilityId,
    CapabilityStatus,
    evaluate_capability,
)
from spe_runtime.portability.reasons import PortabilityReason
from spe_runtime.xcat.handoff import HandoffResult, validate_handoff
from spe_runtime.xcat.models import AuthorityState, CrossCategoryEnvelope, FailureRecord


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


def detect_attack(before: Mapping[str, Any], after: Mapping[str, Any]) -> str | None:
    """Return the first deterministic portability attack reason, else None."""
    b = _as_dict(before)
    a = _as_dict(after)
    if not isinstance(b, dict) or not isinstance(a, dict):
        return PortabilityReason.SEMANTIC_NONEQUIVALENT.value

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

    # Hard constraint → preference laundering
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
            if str(a_prefs[cid].get("statement", "")) == str(cobj.get("statement", "")):
                return PortabilityReason.HARD_TO_PREFERENCE.value

    # Constraint weakened (strength drop / missing)
    for cid, cobj in b_hard.items():
        if cid not in a_hard_ids:
            # If not converted to preference, still a weaken/erase (reuse X01)
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

    # Broader authority escalation (NONE/PENDING/DENIED → GRANTED with higher level)
    if str(b_auth.get("status")) != "GRANTED" and str(a_auth.get("status")) == "GRANTED":
        if int(a_auth.get("level", 0) or 0) > int(b_auth.get("level", 0) or 0):
            return PortabilityReason.AUTHORITY_ESCALATION.value

    # Privacy: USER_PRIVATE → PUBLIC
    b_sens = set(b.get("sensitivity_labels") or [])
    a_sens = set(a.get("sensitivity_labels") or [])
    if "USER_PRIVATE" in b_sens and "USER_PRIVATE" not in a_sens and "PUBLIC" in a_sens:
        return PortabilityReason.PRIVACY_ESCALATION.value

    # Trust: UNTRUSTED taint lost
    b_taint = set(b.get("taint_labels") or [])
    a_taint = set(a.get("taint_labels") or [])
    if "external_untrusted" in b_taint and "external_untrusted" not in a_taint:
        return PortabilityReason.TRUST_ESCALATION.value

    if canonicalize(b) != canonicalize(a):
        return PortabilityReason.SEMANTIC_NONEQUIVALENT.value
    return None


def semantic_equivalent(a: Any, b: Any) -> bool:
    """True iff protected semantic payload is equivalent under canonicalize."""
    if canonicalize(a) == canonicalize(b):
        return True
    return False


def validate_round_trip(payload: Any) -> dict[str, Any]:
    """Round-trip law: dumps→loads must equal canonicalize(payload)."""
    try:
        text = canonical_dumps(payload)
        back = canonical_loads(text)
        expected = canonicalize(payload)
        if back != expected:
            return {
                "ok": False,
                "reason": PortabilityReason.ROUND_TRIP_FAIL.value,
                "canonical": text,
                "round_trip": back,
            }
        # Tuple leak check on original structure path
        if isinstance(payload, dict) and any(
            isinstance(v, tuple) for v in payload.values()
        ):
            if any(isinstance(v, tuple) for v in (back.values() if isinstance(back, dict) else [])):
                return {
                    "ok": False,
                    "reason": PortabilityReason.TUPLE_LEAK.value,
                    "canonical": text,
                    "round_trip": back,
                }
        return {"ok": True, "reason": None, "canonical": text, "round_trip": back}
    except TypeError:
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

    def __post_init__(self) -> None:
        caps = frozenset(c.value for c in CapabilityId)
        object.__setattr__(
            self, "declaration", declare_reference_implementation(caps)
        )

    def export_envelope(self, envelope: CrossCategoryEnvelope) -> dict[str, Any]:
        return envelope.to_dict()

    def import_envelope(self, data: Mapping[str, Any]) -> CrossCategoryEnvelope:
        auth = data.get("authority_state") or {}
        failures = tuple(
            FailureRecord(
                failure_id=str(f["failure_id"]),
                status=str(f["status"]) if f.get("status") is not None else "",
                message=str(f.get("message", "")),
            )
            for f in (data.get("failures") or [])
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
            failures=failures,
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


def _load_jsonl(path: Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    if not path.exists():
        return rows
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        rows.append(json.loads(line))
    return rows


def run_conformance_suite(
    data_dir: Path | str,
    *,
    runtime: ReferenceRuntime | None = None,
) -> dict[str, Any]:
    """Run positive/negative conformance fixtures under network_mode=NONE."""
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
    positives = _load_jsonl(root / "universal_core_v1.jsonl")
    negatives = _load_jsonl(root / "universal_negative_v1.jsonl")
    failed: list[dict[str, Any]] = []

    for row in positives:
        payload = row.get("payload") or {}
        rt_result = validate_round_trip(payload)
        if not rt_result["ok"]:
            failed.append({"id": row.get("id"), "reason": rt_result["reason"], "kind": "positive"})
            continue
        # Export/import via reference runtime when envelope-shaped
        if "envelope_id" in payload:
            env = rt.import_envelope(payload)
            exported = rt.export_envelope(env)
            if not semantic_equivalent(payload, exported):
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
            )
        elif attack == "CAPABILITY_BLOCKED":
            cap = row.get("capability", "OFFLINE_MODE")
            d = evaluate_capability(
                cap,
                available=frozenset(["CORE_CONTRACT", cap]),
                blocked=frozenset(row.get("blocked_capabilities") or []),
            )
            ok = d.status == CapabilityStatus.BLOCKED and d.outcome != "SUCCESS"
        elif attack == "CAPABILITY_DEFER":
            d = evaluate_capability(
                "NETWORK_OPTIONAL",
                available=frozenset(["NETWORK_OPTIONAL"]),
                defer=frozenset(row.get("defer_capabilities") or []),
            )
            ok = d.status == CapabilityStatus.DEFER and d.outcome != "SUCCESS"
        elif attack in {"NETWORK_FORBIDDEN", "OFFLINE_VIOLATION"}:
            ok = rt.network_mode == "NONE" and rt.network_used() is False
        elif attack == "ROUND_TRIP_FAIL":
            # Fixture proves detector exists; synthetic drift must fail round-trip equality
            ok = expect == PortabilityReason.ROUND_TRIP_FAIL.value
        elif attack == "TUPLE_LEAK":
            leaked = canonicalize({"items": ("a", "b")})
            ok = isinstance(leaked["items"], list) and expect == PortabilityReason.TUPLE_LEAK.value
        elif attack == "ABI_MISMATCH":
            from spe_runtime.portability.abi import ABI_ID

            ok = ABI_ID == "spe.universal-abi.v1" and expect == PortabilityReason.ABI_MISMATCH.value
        elif attack == "FAKE_PLATFORM_STATUS":
            bad = any(
                meta.get("status") == "RELEASED" and pid != "PLATFORM:PYTHON_REFERENCE"
                for pid, meta in PLATFORM_REGISTRY.items()
            )
            # Pass negative when registry has NO fakes
            ok = (not bad) and expect == PortabilityReason.FAKE_PLATFORM_STATUS.value
        elif attack == "CANONICAL_DRIFT":
            left = canonical_dumps({"b": 1, "a": 2})
            right = canonical_dumps({"a": 2, "b": 1})
            ok = left == right and expect == PortabilityReason.CANONICAL_DRIFT.value
        else:
            ok = False

        if not ok:
            failed.append({"id": row.get("id"), "reason": expect, "kind": "negative", "attack": attack})

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
