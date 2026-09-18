"""Shared helpers for category engines — immutable envelope updates."""

from __future__ import annotations

from typing import Any, Mapping

from spe_runtime.error_registry import ErrorCode, SpeTypedError
from spe_runtime.xcat.invariants import failures_not_laundered
from spe_runtime.xcat.models import AuthorityState, CrossCategoryEnvelope

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

# DATA != AUTHORITY: generic mutator must not write these.
AUTHORITY_CONTROLLED_FIELDS = frozenset(
    {
        "authority_state",
        "authority_event",
        "grant",
        "permission",
        "consent",
        "execution_grants",
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
    """Build a new frozen envelope from an existing one with field overrides.

    Rejects authority-controlled kwargs. Authority mutations must go through
    spe_runtime.authority.apply.apply_authority_event.
    """
    controlled = AUTHORITY_CONTROLLED_FIELDS & set(changes.keys())
    if controlled:
        raise SpeTypedError(
            ErrorCode.GENERIC_AUTHORITY_MUTATION,
            f"replace_envelope cannot write authority-controlled fields: "
            f"{sorted(controlled)}",
        )
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


def mapping_equal(a: Mapping[str, Any] | None, b: Mapping[str, Any] | None) -> bool:
    if a is None and b is None:
        return True
    if a is None or b is None:
        return False
    return dict(a) == dict(b)


__all__ = [
    "FORBIDDEN_PAYLOAD_KEYS",
    "AUTHORITY_CONTROLLED_FIELDS",
    "certainty_rank",
    "reject_forbidden_keys",
    "replace_envelope",
    "authority_unchanged",
    "failures_not_laundered",
    "mapping_equal",
]
