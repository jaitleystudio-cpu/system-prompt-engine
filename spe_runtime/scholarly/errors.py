"""Fail-closed errors for the scholarly evidence lane.

UNKNOWN is never coerced into a successful literature state. Callers receive
an evidence package whose status is REFUSED or PARTIAL, or a typed error when
the process must not continue (egress, broken registry).
"""

from __future__ import annotations


class ScholarlyError(Exception):
    """Base error for the scholarly fabric."""


class RegistryError(ScholarlyError):
    """The on-disk source registry is missing or violates its contract."""


class EgressDenied(ScholarlyError):
    """A URL host is outside the documented public-API allowlist."""


class ShapeError(ScholarlyError):
    """A payload does not match the expected public-API shape."""

    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code
