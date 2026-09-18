"""Canonical K4 authority-event validation (fail-closed)."""

from __future__ import annotations

from spe_runtime.authority.event import ALLOWED_AUTHORITY_EVENT_KINDS, AuthorityEvent
from spe_runtime.xcat.models import CrossCategoryEnvelope


def validate_authority_event(
    event: object | None,
    before: CrossCategoryEnvelope,
    after: CrossCategoryEnvelope,
) -> bool:
    """Return True only for a typed AuthorityEvent that authorizes the change.

    Rejects None, object(), {}, dicts, strings, and malformed events.
    """
    if not isinstance(event, AuthorityEvent):
        return False
    if event.kind not in ALLOWED_AUTHORITY_EVENT_KINDS:
        return False
    if not str(event.subject).strip():
        return False
    if event.target != before.envelope_id:
        return False
    if after.envelope_id != before.envelope_id:
        return False
    if str(event.revocation_state).upper() != "ACTIVE":
        return False
    try:
        max_level = int(event.max_level)
    except (TypeError, ValueError):
        return False
    if max_level < 0:
        return False
    proposed = after.authority_state
    if proposed.level > max_level:
        return False
    # Required/proposed grants must be ⊆ current ∪ event.scope
    allowed_grants = set(before.authority_state.grants) | set(event.scope)
    if not set(proposed.grants) <= allowed_grants:
        return False
    # Scope itself must be a non-None iterable of strings (empty OK for level-only)
    try:
        scope = tuple(event.scope)
    except TypeError:
        return False
    if any(not isinstance(s, str) or not s for s in scope):
        return False
    return True


__all__ = ["validate_authority_event"]
