"""K2 VerificationReceipt — immutable typed verification record.

PASS (and all verdict) receipts are content-addressed and issuance-bound.
Canonical minting happens only via ``_mint_canonical_receipt``, called
exclusively from ``verify_obligation``.

Issuance uses a process-local secret so that recomputing
``receipt_identity`` alone cannot fabricate a commit-valid PASS receipt.
``commit_semantic_patch`` rejects any receipt that fails
``assert_receipt_integrity``.
"""

from __future__ import annotations

import secrets
from dataclasses import dataclass
from typing import Any

from spe_runtime.error_registry import ErrorCode, SpeTypedError
from spe_runtime.proof.types import ProofType, Verdict, content_digest

# In-process issuance binding — process-local secret (not a durable key).
# Prevents API bypass / proof laundering by direct dataclass construction.
_ISSUER_ID = "spe_runtime.proof.verify.verify_obligation"
_ISSUANCE_SECRET = secrets.token_bytes(32)


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
    issuance_digest: str
    details: Any = None

    def to_canonical_payload(self) -> dict[str, Any]:
        """Identity payload — excludes issuance_digest (bound separately)."""
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


def _compute_issuance_digest(payload: dict[str, Any]) -> str:
    """Content-addressed issuance binding using the process-local secret."""
    return content_digest(
        {
            "issuer": _ISSUER_ID,
            "secret": _ISSUANCE_SECRET.hex(),
            "payload": payload,
        },
        prefix="iss-",
        length=64,
    )


def _mint_canonical_receipt(
    *,
    obligation_id: str,
    proof_type: ProofType,
    subject_id: str,
    snapshot_id: str,
    patch_id: str | None,
    verifier_id: str,
    verdict: Verdict,
    evidence_digest: str,
    details: Any = None,
) -> VerificationReceipt:
    """Canonical mint — call site: verify_obligation only.

    Not exported from spe_runtime.proof package __all__.
    """
    payload = {
        "obligation_id": obligation_id,
        "proof_type": proof_type.value if isinstance(proof_type, ProofType) else proof_type,
        "subject_id": subject_id,
        "snapshot_id": snapshot_id,
        "patch_id": patch_id,
        "verifier_id": verifier_id,
        "verdict": verdict.value if isinstance(verdict, Verdict) else verdict,
        "evidence_digest": evidence_digest,
        "details": details,
    }
    return VerificationReceipt(
        receipt_id=receipt_identity(payload),
        obligation_id=obligation_id,
        proof_type=proof_type,
        subject_id=subject_id,
        snapshot_id=snapshot_id,
        patch_id=patch_id,
        verifier_id=verifier_id,
        verdict=verdict,
        evidence_digest=evidence_digest,
        issuance_digest=_compute_issuance_digest(payload),
        details=details,
    )


def assert_receipt_integrity(receipt: VerificationReceipt) -> None:
    """Fail closed if receipt identity or issuance binding is invalid.

    Rejects:
    - tampered receipt_id
    - missing/wrong issuance_digest (forged PASS / non-canonical mint)
    - empty evidence for PASS
    """
    if not isinstance(receipt, VerificationReceipt):
        raise SpeTypedError(
            ErrorCode.K2_VERIFICATION_FAILED,
            "receipt must be a VerificationReceipt",
        )
    payload = receipt.to_canonical_payload()
    expected_id = receipt_identity(payload)
    if receipt.receipt_id != expected_id:
        raise SpeTypedError(
            ErrorCode.K2_VERIFICATION_FAILED,
            "receipt_id does not match canonical receipt payload identity",
        )
    expected_iss = _compute_issuance_digest(payload)
    if not receipt.issuance_digest or receipt.issuance_digest != expected_iss:
        raise SpeTypedError(
            ErrorCode.K2_VERIFICATION_FAILED,
            "receipt lacks canonical verify_obligation issuance binding "
            "(direct forged PASS / non-canonical construction rejected)",
        )
    if receipt.verdict is Verdict.PASS and not receipt.evidence_digest:
        raise SpeTypedError(
            ErrorCode.K2_VERIFICATION_FAILED,
            "PASS receipt missing evidence digest",
        )


__all__ = [
    "VerificationReceipt",
    "receipt_identity",
    "assert_receipt_integrity",
]
