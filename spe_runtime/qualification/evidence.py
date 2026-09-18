"""K7 QualificationEvidence — sole canonical writer: record_qualification_evidence.

Independence enum alone is DECLARED assertion, not independent reality.
STRUCTURAL_BOUND requires digest + artifact_ref (custody, not crypto auth).
"""

from __future__ import annotations

from spe_runtime.error_registry import ErrorCode, SpeTypedError
from spe_runtime.proof.types import content_digest
from spe_runtime.qualification.models import (
    NON_PRODUCTION_ENVIRONMENTS,
    PRODUCTION_ENVIRONMENT,
    ClaimScope,
    EvidenceKind,
    EvidenceVerdict,
    IndependenceBasis,
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
    "review:",
    "manifest:",
    "obs:",
    "study:",
)

# Producer classes that are never treated as real user / production / independent sources.
_SYNTHETIC_PRODUCER_MARKERS = (
    "model_generated",
    "synthetic",
    "fake_user",
    "llm_simulated",
    "i_say_so",
)


def _validate_ref(ref: str | None) -> None:
    if ref is None:
        return
    if not isinstance(ref, str) or not ref:
        raise SpeTypedError(ErrorCode.K7_INVALID_EVIDENCE, "artifact_ref must be non-empty str")
    if not any(ref.startswith(p) for p in _ALLOWED_REF_PREFIXES):
        if not (len(ref) == 64 and all(c in "0123456789abcdef" for c in ref)):
            raise SpeTypedError(
                ErrorCode.K7_INVALID_EVIDENCE,
                f"artifact_ref domain/shape invalid: {ref[:32]!r}",
            )


def _structural_bound(artifact_ref: str | None, evidence_digest: str | None) -> bool:
    return bool(artifact_ref) and bool(evidence_digest)


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

    lim: list[str] = [str(x) for x in limitations]
    pc_l = producer_class.lower()

    # K2 receipt cannot self-upgrade to EXTERNAL/INDEPENDENT via wrapper metadata.
    if kind is EvidenceKind.VERIFICATION_RECEIPT and indep is not IndependenceClass.INTERNAL:
        raise SpeTypedError(
            ErrorCode.K7_INVALID_EVIDENCE,
            "VERIFICATION_RECEIPT independence cannot exceed INTERNAL (K2≠external review)",
        )

    # K6 spe- hash alone is not external review.
    if kind is EvidenceKind.EXTERNAL_REVIEW and artifact_ref and artifact_ref.startswith("spe-"):
        if not evidence_digest or not artifact_ref.startswith("spe-"):
            pass
        # spe- ref without a separate review: digest must be review digest, not merely spe id
        if evidence_digest is None:
            raise SpeTypedError(
                ErrorCode.K7_INVALID_EVIDENCE,
                "EXTERNAL_REVIEW bound only to spe- artifact hash is not review evidence",
            )

    if kind is EvidenceKind.INDEPENDENT_REPLICATION and indep is not IndependenceClass.INDEPENDENT:
        raise SpeTypedError(
            ErrorCode.K7_INVALID_EVIDENCE,
            "INDEPENDENT_REPLICATION evidence requires independence=INDEPENDENT",
        )

    if kind is EvidenceKind.PRODUCTION_OBSERVATION and verd is EvidenceVerdict.PASS:
        env = scope.environment
        if env in NON_PRODUCTION_ENVIRONMENTS or env != PRODUCTION_ENVIRONMENT:
            raise SpeTypedError(
                ErrorCode.K7_INVALID_EVIDENCE,
                "PRODUCTION_OBSERVATION PASS requires environment='production' "
                f"(got {env!r}; non-local≠production)",
            )
        if not _structural_bound(artifact_ref, evidence_digest):
            raise SpeTypedError(
                ErrorCode.K7_INVALID_EVIDENCE,
                "PRODUCTION_OBSERVATION PASS requires artifact_ref + evidence_digest "
                "(production label alone is not observation)",
            )
        lim.append("production_environment_structurally_declared_not_live_attested")

    if kind is EvidenceKind.FORMAL_MODEL_CHECK and verd is EvidenceVerdict.PASS:
        if not evidence_digest or not artifact_ref:
            raise SpeTypedError(
                ErrorCode.K7_INVALID_EVIDENCE,
                "FORMAL_MODEL_CHECK PASS requires artifact_ref + evidence_digest of model-check output",
            )

    if kind is EvidenceKind.USER_VALIDATION and verd is EvidenceVerdict.PASS:
        if any(m in pc_l for m in _SYNTHETIC_PRODUCER_MARKERS):
            raise SpeTypedError(
                ErrorCode.K7_INVALID_EVIDENCE,
                "USER_VALIDATION rejects synthetic/model-generated producer_class",
            )
        if not pc_l.startswith(("user_study:", "user_validation:", "human_user:")):
            raise SpeTypedError(
                ErrorCode.K7_INVALID_EVIDENCE,
                "USER_VALIDATION requires producer_class prefix "
                "user_study:|user_validation:|human_user:",
            )
        if not _structural_bound(artifact_ref, evidence_digest):
            raise SpeTypedError(
                ErrorCode.K7_INVALID_EVIDENCE,
                "USER_VALIDATION PASS requires artifact_ref + evidence_digest",
            )

    if kind is EvidenceKind.INDEPENDENT_REPLICATION and verd is EvidenceVerdict.PASS:
        if any(m in pc_l for m in _SYNTHETIC_PRODUCER_MARKERS):
            raise SpeTypedError(
                ErrorCode.K7_INVALID_EVIDENCE,
                "INDEPENDENT_REPLICATION rejects self-asserted producer markers",
            )
        if not _structural_bound(artifact_ref, evidence_digest):
            raise SpeTypedError(
                ErrorCode.K7_INVALID_EVIDENCE,
                "INDEPENDENT_REPLICATION PASS requires artifact_ref + evidence_digest",
            )
        lim.append("independence_structurally_bound_not_cryptographically_authenticated")

    if kind is EvidenceKind.EXTERNAL_REVIEW and verd is EvidenceVerdict.PASS:
        if indep is IndependenceClass.INDEPENDENT:
            # External review is not automatically independent replication.
            raise SpeTypedError(
                ErrorCode.K7_INVALID_EVIDENCE,
                "EXTERNAL_REVIEW cannot declare independence=INDEPENDENT "
                "(use INDEPENDENT_REPLICATION kind)",
            )
        if indep is IndependenceClass.EXTERNAL and not _structural_bound(artifact_ref, evidence_digest):
            # Allow record as DECLARED, but force independence down for trust.
            indep = IndependenceClass.INTERNAL
            lim.append("external_independence_downgraded_missing_custody_binding")

    # Basis: STRUCTURAL_BOUND only with digest+ref; else DECLARED.
    if _structural_bound(artifact_ref, evidence_digest):
        basis = IndependenceBasis.STRUCTURAL_BOUND
        if indep is not IndependenceClass.INTERNAL:
            lim.append("independence_structurally_bound_not_cryptographically_authenticated")
    else:
        basis = IndependenceBasis.DECLARED
        if indep is not IndependenceClass.INTERNAL:
            # Caller-declared EXTERNAL/INDEPENDENT without custody → INTERNAL for trust.
            indep = IndependenceClass.INTERNAL
            lim.append("independence_declared_only_not_trusted_for_external_obligations")

    lim_t = tuple(sorted(set(lim)))
    stub = QualificationEvidence(
        evidence_id="qe-pending",
        evidence_kind=kind,
        subject_id=subject_id,
        claim_key=claim_key,
        scope=scope,
        verdict=verd,
        independence=indep,
        independence_basis=basis,
        producer_class=producer_class,
        artifact_ref=artifact_ref,
        evidence_digest=evidence_digest,
        limitations=lim_t,
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
        independence_basis=basis,
        producer_class=producer_class,
        artifact_ref=artifact_ref,
        evidence_digest=evidence_digest,
        limitations=lim_t,
    )


__all__ = ["record_qualification_evidence"]
