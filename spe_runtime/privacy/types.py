"""K4 privacy projection — types.

Contract owner for privacy projection is K4 (RING0_WORKING_CONTRACT).
Projection is a read-model; it does not mutate semantic truth or mint authority.
"""

from __future__ import annotations

from enum import Enum


class PrivacyClass(str, Enum):
    """Sensitivity classes aligned with existing portability vocabulary."""

    PUBLIC = "PUBLIC"
    USER_PRIVATE = "USER_PRIVATE"
    UNKNOWN = "UNKNOWN"


class ProjectionAction(str, Enum):
    """Deterministic projection actions for a disclosure scope."""

    INCLUDE = "INCLUDE"
    REDACT = "REDACT"
    OMIT = "OMIT"


class ProjectionScope(str, Enum):
    """Disclosure / output scopes for privacy projection binding."""

    INTERNAL = "INTERNAL"
    USER_VISIBLE = "USER_VISIBLE"
    EXPORT = "EXPORT"
    MODEL = "MODEL"


__all__ = ["PrivacyClass", "ProjectionAction", "ProjectionScope"]
