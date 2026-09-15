"""Shared helpers for category engines — immutable envelope updates."""

from __future__ import annotations

from typing import Any, Mapping

from spe_runtime.xcat.models import AuthorityState, CrossCategoryEnvelope, FailureRecord

# Fields no category may introduce on recommendation/analysis/rendering payloads.
FORBIDDEN_PAYLOAD_KEYS = frozenset(
    {
        "permit",
        "permits",
        "verified_outcome",
        "verified_success",
        "execution_grant",
        "authority",
        "receipt",
        "receipts",
        "EXECUTED",
        "VERIFIED_SUCCESS",
        "PROMOTE",
    }
)

_CERTAINTY_RANK = {"UNKNOWN": 0, "CONDITIONAL": 1, "CERTAIN": 2}


def certainty_rank(value: object) -> int:
    return _CERTAINTY_RANK.get(str(value).upper(), -1)


def reject_forbidden_keys(payload: Mapping[str, Any] | None, *, label: str) -> None:
    if payload is None:
        return
    bad = FORBIDDEN_PAYLOAD_KEYS & set(payload.keys())
    if bad:
        raise ValueError(f"{label} contains forbidden keys: {sorted(bad)}")


def replace_envelope(
    envelope: CrossCategoryEnvelope,
    **changes: Any,
) -> CrossCategoryEnvelope:
    """Build a new frozen envelope from an existing one with field overrides."""
    data = {
        "envelope_id": envelope.envelope_id,
        "goal_identity": envelope.goal_identity,
        "facts": envelope.facts,
        "provenance": envelope.provenance,
        "uncertainties": envelope.uncertainties,
        "hard_constraints": envelope.hard_constraints,
        "user_preferences": envelope.user_preferences,
        "analysis": envelope.analysis,
        "recommendation": envelope.recommendation,
        "rendering": envelope.rendering,
        "authority_state": envelope.authority_state,
        "execution_grants": envelope.execution_grants,
        "failures": envelope.failures,
        "taint_labels": envelope.taint_labels,
        "sensitivity_labels": envelope.sensitivity_labels,
        "category_trace": envelope.category_trace,
    }
    data.update(changes)
    return CrossCategoryEnvelope(**data)


def authority_unchanged(before: AuthorityState, after: AuthorityState) -> bool:
    return (
        after.level == before.level
        and after.status == before.status
        and tuple(after.grants) == tuple(before.grants)
    )


def failures_not_laundered(
    before: tuple[FailureRecord, ...], after: tuple[FailureRecord, ...]
) -> bool:
    before_map = {f.failure_id: f for f in before}
    after_map = {f.failure_id: f for f in after}
    if not before_map.keys() <= after_map.keys():
        return False
    for fid, b in before_map.items():
        a = after_map[fid]
        if b.status in ("FAIL", "UNKNOWN") and a.status == "PASS":
            return False
        if b.status == "FAIL" and a.status == "UNKNOWN":
            return False
    return True


def mapping_equal(a: Mapping[str, Any] | None, b: Mapping[str, Any] | None) -> bool:
    if a is None and b is None:
        return True
    if a is None or b is None:
        return False
    return dict(a) == dict(b)
