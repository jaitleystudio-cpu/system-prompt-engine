"""SPE Ω Top-Level Drop-In Module for 'import spe'."""

from spe_runtime.sdk import (
    SPEReceipt,
    SPEResult,
    audit_savings,
    execute_guarded,
    grant_capability,
    protect,
    wrap,
)

__all__ = [
    "protect",
    "wrap",
    "execute_guarded",
    "grant_capability",
    "audit_savings",
    "SPEResult",
    "SPEReceipt",
]
