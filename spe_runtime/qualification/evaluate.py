"""K7 claim qualification evaluator — sole ClaimQualification writer: qualify_claim.

CLAIM STRENGTH <= EVIDENCE STRENGTH
CLAIM SCOPE <= EVIDENCE SCOPE
Does not mint proof, authority, artifact identity, or mutate K0–K6 sources.
"""

from __future__ import annotations

from spe_runtime.error_registry import ErrorCode, SpeTypedError
from spe_runtime.proof.types import content_digest
from spe_runtime.qualification.models import (
    ClaimCandidate,
    ClaimQualification,
    ClaimStage,
    EvidenceKind,
    EvidenceVerdict,
    IndependenceClass,
    QualificationEvidence,
    QualificationVerdict,
    STAGE_ORDER,
    stage_rank,
)
from spe_runtime.qualification.policy import ClaimPolicy, StageObligation, get_policy
from spe_runtime.qualification.scope import scope_covers

_INDEP_RANK = {
    IndependenceClass.INTERNAL: 0,
    IndependenceClass.EXTERNAL: 1,
    IndependenceClass.INDEPENDENT: 2,
}


def _dedupe_evidence(evidence: tuple[QualificationEvidence, ...] | list[QualificationEvidence]) -> tuple[QualificationEvidence, ...]:
    seen: set[str] = set()
    out: list[QualificationEvidence] = []
    for e in evidence:
        if not isinstance(e, QualificationEvidence):
            raise SpeTypedError(ErrorCode.K7_INVALID_EVIDENCE, "evidence must be QualificationEvidence")
        if e.evidence_id in seen:
            continue
        seen.add(e.evidence_id)
        out.append(e)
    # Stable canonical order by evidence_id
    out.sort(key=lambda x: x.evidence_id)
    return tuple(out)


def _usable(
    e: QualificationEvidence,
    *,
    subject_id: str,
    claim_key: str,
    claim_scope,
) -> bool:
    if e.subject_id != subject_id:
        return False
    if e.claim_key != claim_key:
        return False
    if not scope_covers(e.scope, claim_scope):
        return False
    return True


def _satisfies_obligation(
    usable: tuple[QualificationEvidence, ...],
    obl: StageObligation,
) -> bool:
    for e in usable:
        if e.verdict is not EvidenceVerdict.PASS:
            continue
        if e.evidence_kind not in obl.evidence_kinds:
            continue
        if _INDEP_RANK[e.independence] < _INDEP_RANK[obl.min_independence]:
            continue
        return True
    return False


def _blocking_fail(
    usable: tuple[QualificationEvidence, ...],
    stage: ClaimStage,
    policy: ClaimPolicy,
) -> str | None:
    """Mandatory FAIL evidence for an obligation kind blocks that stage."""
    for obl in policy.obligations[stage]:
        for e in usable:
            if e.verdict is EvidenceVerdict.FAIL and e.evidence_kind in obl.evidence_kinds:
                return f"BLOCKED_BY_FAIL:{e.evidence_kind.value}:{e.evidence_id}"
    return None


def _strongest_earned(
    candidate: ClaimCandidate,
    usable: tuple[QualificationEvidence, ...],
    policy: ClaimPolicy,
) -> tuple[ClaimStage | None, list[str]]:
    unmet: list[str] = []
    earned: ClaimStage | None = None
    for stage in STAGE_ORDER:
        if stage_rank(stage) > stage_rank(candidate.requested_stage):
            break
        block = _blocking_fail(usable, stage, policy)
        if block:
            unmet.append(block)
            break
        stage_unmet: list[str] = []
        for obl in policy.obligations[stage]:
            if not _satisfies_obligation(usable, obl):
                code = obl.code or f"NEED_{obl.evidence_kinds[0].value}"
                stage_unmet.append(code)
        if stage_unmet:
            unmet.extend(stage_unmet)
            break
        earned = stage
    return earned, unmet


def qualify_claim(
    candidate: ClaimCandidate,
    evidence: tuple[QualificationEvidence, ...] | list[QualificationEvidence],
    policy: ClaimPolicy | str | None = None,
) -> ClaimQualification:
    """ONE canonical ClaimQualification / claim_qualification writer (K7)."""
    if not isinstance(candidate, ClaimCandidate):
        raise SpeTypedError(ErrorCode.K7_INVALID_POLICY, "candidate must be ClaimCandidate")

    if policy is None:
        pol = get_policy(candidate.policy_id)
    elif isinstance(policy, str):
        pol = get_policy(policy)
    elif isinstance(policy, ClaimPolicy):
        pol = policy
    else:
        raise SpeTypedError(ErrorCode.K7_INVALID_POLICY, "policy must be ClaimPolicy|str|None")

    # Unsupported marketing / world leadership / formal-without-evidence claims
    if (
        candidate.claim_key in pol.unsupported_claim_keys
        or candidate.claim_code in pol.unsupported_claim_keys
    ):
        qid = content_digest(
            {
                "claim_key": candidate.claim_key,
                "subject_id": candidate.subject_id,
                "requested": candidate.requested_stage.value,
                "verdict": QualificationVerdict.UNQUALIFIABLE_UNDER_POLICY.value,
                "policy_id": pol.policy_id,
            },
            prefix="qual-",
            length=64,
        )
        return ClaimQualification(
            qualification_id=qid,
            claim_key=candidate.claim_key,
            subject_id=candidate.subject_id,
            scope=candidate.scope,
            requested_stage=candidate.requested_stage,
            earned_stage=None,
            evidence_ids=(),
            unmet_requirements=("UNQUALIFIABLE_UNDER_CURRENT_POLICY",),
            limitations=("competitive_or_marketing_claim_requires_dedicated_future_policy",),
            verdict=QualificationVerdict.UNQUALIFIABLE_UNDER_POLICY,
            policy_id=pol.policy_id,
        )

    deduped = _dedupe_evidence(evidence)

    if deduped:
        subject_hits = [e for e in deduped if e.subject_id == candidate.subject_id]
        if not subject_hits:
            raise SpeTypedError(
                ErrorCode.K7_SUBJECT_MISMATCH,
                "no evidence binds the claim subject_id",
            )
        usable = tuple(
            e
            for e in subject_hits
            if e.claim_key == candidate.claim_key and scope_covers(e.scope, candidate.scope)
        )
        if not usable:
            raise SpeTypedError(
                ErrorCode.K7_SCOPE_MISMATCH,
                "evidence does not cover claimed scope / claim_key",
            )
    else:
        usable = ()

    earned, unmet = _strongest_earned(candidate, usable, pol)

    lims: list[str] = []
    for e in usable:
        lims.extend(e.limitations)
    lims = sorted(set(lims))

    if earned is None:
        verdict = QualificationVerdict.NOT_EARNED
    elif stage_rank(earned) < stage_rank(candidate.requested_stage):
        verdict = QualificationVerdict.PARTIALLY_EARNED
    else:
        verdict = QualificationVerdict.EARNED

    evidence_ids = tuple(e.evidence_id for e in usable)
    stub = ClaimQualification(
        qualification_id="qual-pending",
        claim_key=candidate.claim_key,
        subject_id=candidate.subject_id,
        scope=candidate.scope,
        requested_stage=candidate.requested_stage,
        earned_stage=earned,
        evidence_ids=evidence_ids,
        unmet_requirements=tuple(sorted(set(unmet))),
        limitations=tuple(lims),
        verdict=verdict,
        policy_id=pol.policy_id,
    )
    qid = content_digest(stub.to_identity_preimage(), prefix="qual-", length=64)
    return ClaimQualification(
        qualification_id=qid,
        claim_key=candidate.claim_key,
        subject_id=candidate.subject_id,
        scope=candidate.scope,
        requested_stage=candidate.requested_stage,
        earned_stage=earned,
        evidence_ids=evidence_ids,
        unmet_requirements=tuple(sorted(set(unmet))),
        limitations=tuple(lims),
        verdict=verdict,
        policy_id=pol.policy_id,
    )


__all__ = ["qualify_claim"]
