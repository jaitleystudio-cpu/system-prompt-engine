"""K2 VerificationReceipt — immutable typed verification record.

Receipts are minted ONLY by verify_obligation in verify.py.
There is no public mint_pass_receipt.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from spe_runtime.proof.types import ProofType, Verdict, content_digest


@dataclass(frozen=True)
class VerificationReceipt:
    """PASS only proves this verifier passed this obligation in this type/scope.

    Does not imply universal truth, real-world success, or execution authority.
    """

    receipt_id: str
    obligation_id: str
    proof_type: ProofType
    subject_id: str
    snapshot_id: str
    patch_id: str | None
    verifier_id: str
    verdict: Verdict
    evidence_digest: str
    details: Any = None

    def to_canonical_payload(self) -> dict[str, Any]:
        return {
            "obligation_id": self.obligation_id,
            "proof_type": self.proof_type.value
            if isinstance(self.proof_type, ProofType)
            else self.proof_type,
            "subject_id": self.subject_id,
            "snapshot_id": self.snapshot_id,
            "patch_id": self.patch_id,
            "verifier_id": self.verifier_id,
            "verdict": self.verdict.value if isinstance(self.verdict, Verdict) else self.verdict,
            "evidence_digest": self.evidence_digest,
            "details": self.details,
        }


def receipt_identity(payload: dict[str, Any]) -> str:
    return content_digest(payload, prefix="rcpt-")


__all__ = ["VerificationReceipt", "receipt_identity"]
