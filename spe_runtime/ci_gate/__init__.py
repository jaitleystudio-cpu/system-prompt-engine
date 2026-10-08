"""SPE Ω — CI/CD Evidence Gate & Cryptographic Receipts (M5)."""

from .gate import GatePolicy, GateResult, evaluate_ci_gate
from .receipt import (
    AuthenticatedReceipt,
    generate_authenticated_receipt,
    rfc8785_canonicalize,
    verify_receipt_signature,
)

__all__ = [
    "GatePolicy",
    "GateResult",
    "evaluate_ci_gate",
    "AuthenticatedReceipt",
    "generate_authenticated_receipt",
    "rfc8785_canonicalize",
    "verify_receipt_signature",
]
