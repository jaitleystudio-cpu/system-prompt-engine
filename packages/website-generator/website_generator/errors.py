"""Errors for the static website generator.

A raised error is a refusal. It is not a PASS.
"""

from __future__ import annotations


class WebsiteSpecError(ValueError):
    """The spec is rejected. Rejection is not PASS."""


class StaticWriteError(ValueError):
    """Refused to write a file outside the destination directory."""
