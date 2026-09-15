"""Outcome transition rules — no blind UNKNOWN→FAILED / PARTIAL→SUCCESS."""

from __future__ import annotations

from typing import Any

from spe_runtime.execution.models import OutcomeState
from spe_runtime.xcat.reasons import ReasonCode

# Allowed transitions (from -> frozenset of to)
_ALLOWED: dict[OutcomeState, frozenset[OutcomeState]] = {
    OutcomeState.NOT_EXECUTED: frozenset(
        {
            OutcomeState.DISPATCHING,
            OutcomeState.NOT_EXECUTED,
            OutcomeState.FAILED,
        }
    ),
    OutcomeState.DISPATCHING: frozenset(
        {
            OutcomeState.OUTCOME_UNKNOWN,
            OutcomeState.PARTIAL,
            OutcomeState.COMPLETED,
            OutcomeState.FAILED,
            OutcomeState.RECONCILIATION_REQUIRED,
        }
    ),
    OutcomeState.OUTCOME_UNKNOWN: frozenset(
        {
            OutcomeState.RECONCILIATION_REQUIRED,
            OutcomeState.OUTCOME_UNKNOWN,
        }
    ),
    OutcomeState.PARTIAL: frozenset(
        {
            OutcomeState.RECONCILIATION_REQUIRED,
            OutcomeState.FAILED,
            OutcomeState.PARTIAL,
        }
    ),
    OutcomeState.COMPLETED: frozenset({OutcomeState.COMPLETED}),
    OutcomeState.FAILED: frozenset({OutcomeState.FAILED, OutcomeState.RECONCILIATION_REQUIRED}),
    OutcomeState.RECONCILIATION_REQUIRED: frozenset(
        {
            OutcomeState.RECONCILIATION_REQUIRED,
            OutcomeState.COMPLETED,
            OutcomeState.FAILED,
            OutcomeState.NOT_EXECUTED,
        }
    ),
}


def retry_eligible(current: OutcomeState) -> bool:
    """Proven NOT_EXECUTED is retry-eligible; UNKNOWN is not (blind retry banned)."""
    return current == OutcomeState.NOT_EXECUTED


def transition_outcome(
    current: OutcomeState,
    proposed: OutcomeState,
    *,
    evidence: dict[str, Any] | None = None,
) -> tuple[bool, OutcomeState | None, tuple[str, ...]]:
    """Validate outcome transition. Never promotes tool OK to VERIFIED_SUCCESS."""
    evidence = evidence or {}

    # Explicit illegal patterns with dedicated reason codes
    if (
        current == OutcomeState.OUTCOME_UNKNOWN
        and proposed == OutcomeState.FAILED
        and not evidence.get("reconcile")
    ):
        return False, None, (ReasonCode.UNKNOWN_OUTCOME_RETRY.value,)

    if current == OutcomeState.PARTIAL and proposed in (
        OutcomeState.COMPLETED,
    ):
        return False, None, (ReasonCode.PARTIAL_TO_SUCCESS.value,)

    # Tool success alone cannot become COMPLETED without verified evidence
    if proposed == OutcomeState.COMPLETED:
        if evidence.get("tool_status") == "OK" and not evidence.get("verified"):
            return False, None, (ReasonCode.TOOL_SUCCESS_TO_OUTCOME.value,)
        if evidence.get("verified") is False and evidence.get("tool_status") == "OK":
            return False, None, (ReasonCode.TOOL_SUCCESS_TO_OUTCOME.value,)

    allowed = _ALLOWED.get(current, frozenset())
    if proposed not in allowed:
        # Map common illegal cases
        if current == OutcomeState.OUTCOME_UNKNOWN and proposed == OutcomeState.FAILED:
            return False, None, (ReasonCode.UNKNOWN_OUTCOME_RETRY.value,)
        if current == OutcomeState.PARTIAL and proposed == OutcomeState.COMPLETED:
            return False, None, (ReasonCode.PARTIAL_TO_SUCCESS.value,)
        return False, None, (ReasonCode.TOOL_SUCCESS_TO_OUTCOME.value,)

    # DISPATCHING → COMPLETED requires verified evidence when tool_status present
    if (
        current == OutcomeState.DISPATCHING
        and proposed == OutcomeState.COMPLETED
        and "tool_status" in evidence
        and not evidence.get("verified")
    ):
        return False, None, (ReasonCode.TOOL_SUCCESS_TO_OUTCOME.value,)

    return True, proposed, ()
