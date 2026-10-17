"""Freshness lifecycle — refresh creates new lineage; never mutates intent."""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from enum import Enum
from typing import Mapping

from spe_runtime.grounding.models import ContextCapsule, ContextType

_VERSION_BOUND_TYPES = frozenset(
    {
        ContextType.OFFICIAL_DOCUMENTATION,
        ContextType.REGULATORY_SOURCE,
    }
)


class FreshnessState(str, Enum):
    FRESH = "FRESH"
    STALE = "STALE"
    VERSION_BOUND = "VERSION_BOUND"
    UNKNOWN = "UNKNOWN"

    def to_dict(self) -> str:
        return self.value


@dataclass(frozen=True)
class RefreshPlan:
    """Suggestion to refresh a capsule into a new lineage snapshot.

    Intentionally omits ProtectedIntent / authority / K3 / proof fields.
    Callers must apply refresh by creating new artifacts — never by mutating
    an existing ProtectedIntent or in-place capsule.
    """

    action: str
    original_capsule_id: str
    new_capsule_id: str
    new_lineage_id: str
    reason: str
    freshness_state: str


def freshness_state(capsule: ContextCapsule, now_iso: str) -> str:
    """Deterministic freshness classification for a ContextCapsule."""
    if capsule.context_type in _VERSION_BOUND_TYPES:
        return FreshnessState.VERSION_BOUND.value

    if capsule.fresh_until is None or not str(capsule.fresh_until).strip():
        return FreshnessState.UNKNOWN.value

    now = str(now_iso)
    until = str(capsule.fresh_until)
    # ISO-8601 timestamps with consistent Z/offset form compare lexicographically.
    if now > until:
        return FreshnessState.STALE.value
    return FreshnessState.FRESH.value


def plan_refresh(
    capsule: ContextCapsule,
    *,
    now_iso: str,
    protected_intent: Mapping[str, object] | None = None,
) -> RefreshPlan | None:
    """Propose a new lineage refresh without mutating ProtectedIntent.

    ``protected_intent`` is accepted only to assert call-site immutability
    contracts in tests; this function never reads or writes its contents into
    the returned plan.
    """
    del protected_intent  # explicitly unused — must not influence plan

    state = freshness_state(capsule, now_iso)
    if state == FreshnessState.FRESH.value:
        return None

    digest = hashlib.sha256(
        f"{capsule.capsule_id}|{now_iso}|{state}".encode("utf-8")
    ).hexdigest()[:16]
    new_capsule_id = f"{capsule.capsule_id}:refresh:{digest}"
    new_lineage_id = f"lineage:{capsule.capsule_id}:{digest}"

    reasons = {
        FreshnessState.STALE.value: "FRESH_UNTIL_ELAPSED",
        FreshnessState.VERSION_BOUND.value: "VERSION_BOUND_REFRESH",
        FreshnessState.UNKNOWN.value: "FRESHNESS_UNKNOWN",
    }
    return RefreshPlan(
        action="REFRESH",
        original_capsule_id=capsule.capsule_id,
        new_capsule_id=new_capsule_id,
        new_lineage_id=new_lineage_id,
        reason=reasons.get(state, "REFRESH_REQUIRED"),
        freshness_state=state,
    )
