"""Canonical writer for envelope authority_state mutations."""

from __future__ import annotations

from spe_runtime.authority.event import AuthorityEvent
from spe_runtime.authority.event_validate import validate_authority_event
from spe_runtime.error_registry import ErrorCode, SpeTypedError
from spe_runtime.xcat.models import AuthorityState, CrossCategoryEnvelope


def apply_authority_event(
    envelope: CrossCategoryEnvelope,
    event: AuthorityEvent,
    *,
    status: str | None = None,
) -> CrossCategoryEnvelope:
    """Apply a typed AuthorityEvent; sole writer of authority_state on envelopes.

    Produces a new envelope whose authority_state reflects the event's max_level
    and scope unioned with existing grants. Does not use replace_envelope.
    """
    if not isinstance(event, AuthorityEvent):
        raise SpeTypedError(
            ErrorCode.GENERIC_AUTHORITY_MUTATION,
            "apply_authority_event requires a typed AuthorityEvent",
        )
    new_grants = tuple(
        sorted(set(envelope.authority_state.grants) | set(event.scope))
    )
    new_status = status if status is not None else (
        "GRANTED" if event.max_level > 0 or new_grants else envelope.authority_state.status
    )
    new_state = AuthorityState(
        level=int(event.max_level),
        status=new_status,
        grants=new_grants,
    )
    after = CrossCategoryEnvelope(
        envelope_id=envelope.envelope_id,
        goal_identity=envelope.goal_identity,
        facts=envelope.facts,
        provenance=envelope.provenance,
        uncertainties=envelope.uncertainties,
        hard_constraints=envelope.hard_constraints,
        user_preferences=envelope.user_preferences,
        analysis=envelope.analysis,
        recommendation=envelope.recommendation,
        rendering=envelope.rendering,
        authority_state=new_state,
        execution_grants=envelope.execution_grants,
        failures=envelope.failures,
        taint_labels=envelope.taint_labels,
        sensitivity_labels=envelope.sensitivity_labels,
        category_trace=envelope.category_trace,
    )
    if not validate_authority_event(event, envelope, after):
        raise SpeTypedError(
            ErrorCode.AUTHORITY_SELF_ESCALATION,
            "authority event failed validation",
        )
    return after


__all__ = ["apply_authority_event"]
