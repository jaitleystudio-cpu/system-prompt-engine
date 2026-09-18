"""K7 qualification — ClaimQualification + QualificationEvidence (G1R-9 / G1R-9R).

Canonical writers:
  record_qualification_evidence  — qualification_evidence
  qualify_claim                  — claim_qualification

Epistemic claim state only. Does not mint proof, authority, artifact identity,
or mutate K0/K1/K3. Import of marketing text is not evidence.
Caller-supplied ClaimPolicy objects are not policy authority.
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
    IndependenceBasis,
    IndependenceClass,
    NON_PRODUCTION_ENVIRONMENTS,
    PRODUCTION_ENVIRONMENT,
    QualificationEvidence,
    QualificationVerdict,
    UNSUPPORTED_MARKETING_CLAIM_KEYS,
    stage_rank,
)
from spe_runtime.qualification.policy import (
    CLAIM_POLICY_BINDINGS,
    STAGE_FLOORS,
    ClaimPolicy,
    StageObligation,
    bound_policy_for_claim,
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
    "IndependenceBasis",
    "EvidenceVerdict",
    "QualificationVerdict",
    "UNSUPPORTED_MARKETING_CLAIM_KEYS",
    "NON_PRODUCTION_ENVIRONMENTS",
    "PRODUCTION_ENVIRONMENT",
    "ClaimScope",
    "ClaimCandidate",
    "QualificationEvidence",
    "ClaimQualification",
    "record_qualification_evidence",
    "qualify_claim",
    "scope_covers",
    "ClaimPolicy",
    "StageObligation",
    "STAGE_FLOORS",
    "CLAIM_POLICY_BINDINGS",
    "default_ring0_policy",
    "subsystem_pass_external_policy",
    "validate_policy",
    "get_policy",
    "bound_policy_for_claim",
]
