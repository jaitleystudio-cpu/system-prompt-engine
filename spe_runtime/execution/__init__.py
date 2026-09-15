"""Execution package — ExecutionIntent + outcomes (Sprint 3)."""

from spe_runtime.execution.models import (
    ExecutionIntent,
    OutcomeState,
    canonical_arguments_digest,
    stable_operation_id,
)
from spe_runtime.execution.outcomes import retry_eligible, transition_outcome

__all__ = [
    "ExecutionIntent",
    "OutcomeState",
    "canonical_arguments_digest",
    "stable_operation_id",
    "retry_eligible",
    "transition_outcome",
]
