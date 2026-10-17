"""ZTES-10: Zero-Trust Epistemic Sandbox & AST Taint-Tracking Kernel."""

from spe_runtime.ztes.kernel import (
    ASTTaintResult,
    HaltPermissionEscalationError,
    PolyglotCheckResult,
    PolyglotDisqualificationError,
    ProvenanceForgeryError,
    SanitizationResult,
    TaintStatus,
    TaintedValue,
    ZTESAuditReport,
    ZTESKernel,
)

__all__ = [
    "ZTESKernel",
    "TaintStatus",
    "TaintedValue",
    "SanitizationResult",
    "PolyglotCheckResult",
    "PolyglotDisqualificationError",
    "HaltPermissionEscalationError",
    "ProvenanceForgeryError",
    "ASTTaintResult",
    "ZTESAuditReport",
]
