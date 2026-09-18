"""Portability reason codes — re-export of ErrorCode (same object identity)."""

from __future__ import annotations

from spe_runtime.error_registry import ErrorCode as PortabilityReason

__all__ = ["PortabilityReason"]
