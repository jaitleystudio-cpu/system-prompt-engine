"""K7 QualificationEvidence — sole canonical writer: record_qualification_evidence."""

from __future__ import annotations

from spe_runtime.error_registry import ErrorCode, SpeTypedError
from spe_runtime.proof.types import content_digest
from spe_runtime.qualification.models import (
    ClaimScope,
    EvidenceKind,
    EvidenceVerdict,
    IndependenceClass,
    QualificationEvidence,
)

_ALLOWED_REF_PREFIXES = (
    "spe-",
    "rcpt-",
    "pad-",
    "snap-",
    "led-",
    "qe-",
    "sha256:",
)


def _validate_ref(ref: str | None) -> None:
    if ref is None:
        return
    if not isinstance(ref, str) or not ref:
        raise SpeTypedError(ErrorCode.K7_INVALID_EVIDENCE, "artifact_ref must be non-empty str")
    if not any(ref.startswith(p) for p in _ALLOWED_REF_PREFIXES):
        # Allow bare 64-hex digest as content reference
        if not (len(ref) == 64 and all(c in "0123456789abcdef" for c in ref)):
            raise SpeTypedError(
                ErrorCode.K7_INVALID_EVIDENCE,
                f"artifact_ref domain/shape invalid: {ref[:32]!r}",
            )


def record_qualification_evidence(
    *,
    evidence_kind: EvidenceKind | str,
    subject_id: str,
    claim_key: str,
    scope: ClaimScope,
    verdict: EvidenceVerdict | str,
    independence: IndependenceClass | str,
    producer_class: str,
    artifact_ref: str | None = None,
    evidence_digest: str | None = None,
    limitations: tuple[str, ...] | list[str] = (),
) -> QualificationEvidence:
    """ONE canonical QualificationEvidence / qualification_evidence writer (K7).

    Structural/scope completeness only — does not perform external experiments.
    Enum values alone do not prove independence or production observation.
    """
    kind = EvidenceKind(evidence_kind)
    verd = EvidenceVerdict(verdict)
    indep = IndependenceClass(independence)
    if not isinstance(scope, ClaimScope):
        raise SpeTypedError(ErrorCode.K7_INVALID_EVIDENCE, "scope must be ClaimScope")
    if not subject_id or not isinstance(subject_id, str):
        raise SpeTypedError(ErrorCode.K7_INVALID_EVIDENCE, "subject_id required")
    if not claim_key or not isinstance(claim_key, str):
        raise SpeTypedError(ErrorCode.K7_INVALID_EVIDENCE, "claim_key required")
    if not producer_class or not isinstance(producer_class, str):
        raise SpeTypedError(ErrorCode.K7_INVALID_EVIDENCE, "producer_class required")
    _validate_ref(artifact_ref)

    # Kind-specific structural requirements (not self-proof of truth).
    if kind is EvidenceKind.INDEPENDENT_REPLICATION and indep is not IndependenceClass.INDEPENDENT:
        raise SpeTypedError(
            ErrorCode.K7_INVALID_EVIDENCE,
            "INDEPENDENT_REPLICATION evidence requires independence=INDEPENDENT",
        )
    if kind is EvidenceKind.PRODUCTION_OBSERVATION and verd is EvidenceVerdict.PASS:
        if scope.environment in ("local", "unit_test", "staging"):
            raise SpeTypedError(
                ErrorCode.K7_INVALID_EVIDENCE,
                "PRODUCTION_OBSERVATION PASS cannot use local/unit_test/staging environment",
            )
    if kind is EvidenceKind.FORMAL_MODEL_CHECK and verd is EvidenceVerdict.PASS and not evidence_digest:
        raise SpeTypedError(
            ErrorCode.K7_INVALID_EVIDENCE,
            "FORMAL_MODEL_CHECK PASS requires evidence_digest of model-check output",
        )

    lim = tuple(str(x) for x in limitations)
    stub = QualificationEvidence(
        evidence_id="qe-pending",
        evidence_kind=kind,
        subject_id=subject_id,
        claim_key=claim_key,
        scope=scope,
        verdict=verd,
        independence=indep,
        producer_class=producer_class,
        artifact_ref=artifact_ref,
        evidence_digest=evidence_digest,
        limitations=lim,
    )
    eid = content_digest(stub.to_identity_preimage(), prefix="qe-", length=64)
    return QualificationEvidence(
        evidence_id=eid,
        evidence_kind=kind,
        subject_id=subject_id,
        claim_key=claim_key,
        scope=scope,
        verdict=verd,
        independence=indep,
        producer_class=producer_class,
        artifact_ref=artifact_ref,
        evidence_digest=evidence_digest,
        limitations=lim,
    )


__all__ = ["record_qualification_evidence"]
