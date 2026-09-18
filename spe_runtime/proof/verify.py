"""K2 verification boundary — sole VerificationReceipt minting path."""

from __future__ import annotations

from typing import Any, Callable, Mapping

from spe_runtime.error_registry import ErrorCode, SpeTypedError
from spe_runtime.portability.canonical import canonical_dumps
from spe_runtime.proof.obligation import ProofObligation
from spe_runtime.proof.receipt import VerificationReceipt, receipt_identity
from spe_runtime.proof.types import ProofType, Verdict, content_digest, proof_type_compatible

VerifierFn = Callable[[ProofObligation, Any], Mapping[str, Any]]


def _coerce_proof_type(value: Any) -> ProofType:
    if isinstance(value, ProofType):
        return value
    return ProofType(value)


def _coerce_verdict(value: Any) -> Verdict:
    if isinstance(value, Verdict):
        return value
    return Verdict(value)


def verify_obligation(
    obligation: ProofObligation,
    candidate: Any,
    verifier: VerifierFn,
) -> VerificationReceipt:
    """ONE canonical receipt writer.

    ``verifier`` must return a typed result dict with:
      proof_type, verdict, evidence, subject_id (or subject),
      and optionally snapshot_id, patch_id, verifier_id, details.

    K2 owns receipt construction. Proof types cannot be silently upgraded —
    the receipt records the verifier-declared type as-is (exact match at commit).
    """
    if not callable(verifier):
        raise SpeTypedError(
            ErrorCode.K2_VERIFICATION_FAILED,
            "verifier must be a callable",
        )

    raw = verifier(obligation, candidate)
    if not isinstance(raw, Mapping):
        raise SpeTypedError(
            ErrorCode.K2_VERIFICATION_FAILED,
            "verifier must return a typed mapping result",
        )

    try:
        proof_type = _coerce_proof_type(raw["proof_type"])
        verdict = _coerce_verdict(raw["verdict"])
    except (KeyError, ValueError, TypeError) as exc:
        raise SpeTypedError(
            ErrorCode.K2_VERIFICATION_FAILED,
            f"verifier result missing/invalid typed fields: {exc}",
        ) from exc

    # Do not rewrite / upgrade proof types to match the obligation.
    if not proof_type_compatible(obligation.required_proof_type, proof_type):
        # Still allow minting a typed receipt that records the mismatch;
        # commit will reject. Recording the declared type prevents laundering.
        pass

    subject_id = raw.get("subject_id", raw.get("subject"))
    if subject_id is None:
        subject_id = obligation.subject

    snapshot_id = raw.get("snapshot_id")
    if snapshot_id is None and isinstance(candidate, Mapping):
        snapshot_id = candidate.get("snapshot_id")
    if snapshot_id is None:
        snapshot_id = obligation.subject

    patch_id = raw.get("patch_id")
    if patch_id is None and isinstance(candidate, Mapping):
        patch_id = candidate.get("patch_id")

    verifier_id = raw.get("verifier_id")
    if not verifier_id:
        verifier_id = getattr(verifier, "__name__", None) or "anonymous_verifier"

    evidence = raw.get("evidence")
    evidence_digest = content_digest(evidence, prefix="evd-", length=64)
    details = raw.get("details")

    payload = {
        "obligation_id": obligation.obligation_id,
        "proof_type": proof_type.value,
        "subject_id": subject_id,
        "snapshot_id": snapshot_id,
        "patch_id": patch_id,
        "verifier_id": verifier_id,
        "verdict": verdict.value,
        "evidence_digest": evidence_digest,
        "details": details,
    }
    # Ensure canonical path is exercised for identity
    _ = canonical_dumps(payload)
    receipt_id = receipt_identity(payload)
    return VerificationReceipt(
        receipt_id=receipt_id,
        obligation_id=obligation.obligation_id,
        proof_type=proof_type,
        subject_id=str(subject_id),
        snapshot_id=str(snapshot_id),
        patch_id=str(patch_id) if patch_id is not None else None,
        verifier_id=str(verifier_id),
        verdict=verdict,
        evidence_digest=evidence_digest,
        details=details,
    )


__all__ = ["verify_obligation", "VerifierFn"]
