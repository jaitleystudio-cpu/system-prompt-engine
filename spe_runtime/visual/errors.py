"""Fail-closed errors for the visual input layer."""

from __future__ import annotations


class VisualInputError(ValueError):
    """Malformed visual input. Callers must not treat this as a pass."""


class VisualAuthorityError(VisualInputError):
    """A media payload tried to mint or carry authority."""


class UnknownLaunderError(VisualInputError):
    """An UNKNOWN, absent, or judgment claim was reported as PASS."""
