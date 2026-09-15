"""Independent portability oracle (fixture-grounded structural predicates).

This module must not import the SUT detector from conformance. Cross-checks in
tests compare oracle predictions to the SUT detector for independence.
"""

from __future__ import annotations

from typing import Any, Mapping

from spe_runtime.portability.canonical import canonicalize
from spe_runtime.portability.reasons import PortabilityReason


def _ids(items: Any, key: str) -> set[str]:
    if not isinstance(items, (list, tuple)):
        return set()
    out: set[str] = set()
    for item in items:
        if isinstance(item, Mapping) and key in item:
            out.add(str(item[key]))
    return out


def _auth(payload: Mapping[str, Any]) -> Mapping[str, Any]:
    auth = payload.get("authority_state") or {}
    return auth if isinstance(auth, Mapping) else {}


def oracle_detect(before: Mapping[str, Any], after: Mapping[str, Any]) -> str | None:
    """Structural oracle — separate implementation from conformance.detect_attack."""
    b = canonicalize(before)
    a = canonicalize(after)
    if not isinstance(b, dict) or not isinstance(a, dict):
        return PortabilityReason.SEMANTIC_NONEQUIVALENT.value

    # operation_id mutation
    if "operation_id" in b or "operation_id" in a:
        if b.get("operation_id") != a.get("operation_id"):
            return PortabilityReason.OPERATION_ID_MUTATION.value

    # outcome escalation ranks
    _OUTCOME_RANK = {
        "FAILED": 0,
        "BLOCKED": 1,
        "PARTIAL": 2,
        "SUCCESS": 3,
        "VERIFIED_SUCCESS": 4,
    }
    if "outcome" in b or "outcome" in a:
        br = _OUTCOME_RANK.get(str(b.get("outcome")), -1)
        ar = _OUTCOME_RANK.get(str(a.get("outcome")), -1)
        if br >= 0 and ar > br:
            return PortabilityReason.OUTCOME_ESCALATION.value

    if _ids(b.get("provenance"), "provenance_id") - _ids(a.get("provenance"), "provenance_id"):
        return PortabilityReason.PROVENANCE_REMOVED.value

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
            # Same or different statement — laundering either way
            return PortabilityReason.HARD_TO_PREFERENCE.value

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

    if _ids(b.get("uncertainties"), "uncertainty_id") - _ids(
        a.get("uncertainties"), "uncertainty_id"
    ):
        return PortabilityReason.UNCERTAINTY_ERASED.value

    b_auth, a_auth = _auth(b), _auth(a)
    if str(b_auth.get("status")) == "DENIED" and str(a_auth.get("status")) == "GRANTED":
        return PortabilityReason.DENIED_TO_GRANTED.value
    if str(b_auth.get("status")) != "GRANTED" and str(a_auth.get("status")) == "GRANTED":
        if int(a_auth.get("level", 0) or 0) > int(b_auth.get("level", 0) or 0):
            return PortabilityReason.AUTHORITY_ESCALATION.value

    b_sens = set(b.get("sensitivity_labels") or [])
    a_sens = set(a.get("sensitivity_labels") or [])
    if "USER_PRIVATE" in b_sens and "USER_PRIVATE" not in a_sens:
        return PortabilityReason.PRIVACY_ESCALATION.value

    b_taint = set(b.get("taint_labels") or [])
    a_taint = set(a.get("taint_labels") or [])
    if "external_untrusted" in b_taint and "external_untrusted" not in a_taint:
        return PortabilityReason.TRUST_ESCALATION.value

    from spe_runtime.portability.canonical import strict_equal

    if not strict_equal(b, a):
        return PortabilityReason.SEMANTIC_NONEQUIVALENT.value
    return None
