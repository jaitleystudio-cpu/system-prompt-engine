"""Typed AuthorityEvent — external grant signal for envelope authority changes."""

from __future__ import annotations

from dataclasses import dataclass


ALLOWED_AUTHORITY_EVENT_KINDS = frozenset({"EXTERNAL_GRANT"})


@dataclass(frozen=True)
class AuthorityEvent:
    """Minimal typed external authority event (no epoch invented)."""

    kind: str
    subject: str
    target: str
    scope: tuple[str, ...]
    max_level: int
    revocation_state: str = "ACTIVE"


__all__ = ["AuthorityEvent", "ALLOWED_AUTHORITY_EVENT_KINDS"]
