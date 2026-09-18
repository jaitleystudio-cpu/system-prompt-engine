"""K7 qualification — ClaimQualification + QualificationEvidence (G1R-9).

Canonical writers:
  record_qualification_evidence  — qualification_evidence
  qualify_claim                  — claim_qualification

Epistemic claim state only. Does not mint proof, authority, artifact identity,
or mutate K0/K1/K3. Import of marketing text is not evidence.
"""

from spe_runtime.qualification.evidence import record_qualification_evidence
from spe_runtime.qualification.evaluate import qualify_claim
from spe_runtime.qualification.models import (
    STAGE_ORDER,
    ClaimCandidate,
    ClaimQualification,
    ClaimScope,
    ClaimStage,
    EvidenceKind,
    EvidenceVerdict,
    IndependenceClass,
    QualificationEvidence,
    QualificationVerdict,
    UNSUPPORTED_MARKETING_CLAIM_KEYS,
    stage_rank,
)
from spe_runtime.qualification.policy import (
    ClaimPolicy,
    StageObligation,
    default_ring0_policy,
    get_policy,
    subsystem_pass_external_policy,
    validate_policy,
)
from spe_runtime.qualification.scope import scope_covers

__all__ = [
    "ClaimStage",
    "STAGE_ORDER",
    "stage_rank",
    "EvidenceKind",
    "IndependenceClass",
    "EvidenceVerdict",
    "QualificationVerdict",
    "UNSUPPORTED_MARKETING_CLAIM_KEYS",
    "ClaimScope",
    "ClaimCandidate",
    "QualificationEvidence",
    "ClaimQualification",
    "record_qualification_evidence",
    "qualify_claim",
    "scope_covers",
    "ClaimPolicy",
    "StageObligation",
    "default_ring0_policy",
    "subsystem_pass_external_policy",
    "validate_policy",
    "get_policy",
]
