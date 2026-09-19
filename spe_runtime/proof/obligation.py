"""K2 ProofObligation — typed required evidence for a semantic claim."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from spe_runtime.proof.types import ObligationStatus, ProofType, content_digest


@dataclass(frozen=True)
class ProofObligation:
    """Explicit obligation stating what evidence is required.

    Status is informational for callers; commit uses receipts and does not
    mutate historical obligation objects.
    """

    obligation_id: str
    obligation_type: str
    subject: str
    required_proof_type: ProofType
    scope: str
    status: ObligationStatus = ObligationStatus.OPEN

    def to_identity_payload(self) -> dict[str, Any]:
        return {
            "obligation_type": self.obligation_type,
            "required_proof_type": self.required_proof_type.value
            if isinstance(self.required_proof_type, ProofType)
            else self.required_proof_type,
            "subject": self.subject,
            "scope": self.scope,
        }


def make_obligation(
    *,
    obligation_type: str,
    subject: str,
    required_proof_type: ProofType | str,
    scope: str,
    status: ObligationStatus | str = ObligationStatus.OPEN,
) -> ProofObligation:
    """Deterministic ProofObligation factory."""
    rpt = (
        required_proof_type
        if isinstance(required_proof_type, ProofType)
        else ProofType(required_proof_type)
    )
    st = status if isinstance(status, ObligationStatus) else ObligationStatus(status)
    payload = {
        "obligation_type": obligation_type,
        "required_proof_type": rpt.value,
        "subject": subject,
        "scope": scope,
    }
    oid = content_digest(payload, prefix="obl-")
    return ProofObligation(
        obligation_id=oid,
        obligation_type=obligation_type,
        subject=subject,
        required_proof_type=rpt,
        scope=scope,
        status=st,
    )


__all__ = ["ProofObligation", "make_obligation"]
