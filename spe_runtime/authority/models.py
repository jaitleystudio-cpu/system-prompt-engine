"""AuthorityGrant — immutable external authority (C07 never mints these)."""

from __future__ import annotations

from dataclasses import dataclass
from types import MappingProxyType
from typing import Any, Mapping


def _deep_freeze(value: Any) -> Any:
    if isinstance(value, Mapping):
        return MappingProxyType({k: _deep_freeze(v) for k, v in value.items()})
    if isinstance(value, (list, tuple)):
        return tuple(_deep_freeze(v) for v in value)
    return value


@dataclass(frozen=True)
class AuthorityGrant:
    """Scoped, time-bounded, use-limited authority grant.

    Distinct from envelope AuthorityState. C07 consumes grants for validation
    only — it never creates or expands them.
    """

    grant_id: str
    principal: str
    capability: str
    target: str
    argument_constraints: Mapping[str, Any]
    purpose: str
    issued_at: str
    expires_at: str
    use_limit: int
    uses_consumed: int = 0
    revocation_state: str = "ACTIVE"  # ACTIVE | REVOKED

    def __post_init__(self) -> None:
        object.__setattr__(
            self, "argument_constraints", _deep_freeze(dict(self.argument_constraints))
        )
        object.__setattr__(self, "uses_consumed", int(self.uses_consumed))
        object.__setattr__(self, "use_limit", int(self.use_limit))
