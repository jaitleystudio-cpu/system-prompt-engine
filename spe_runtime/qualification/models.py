"""K7 claim qualification models — epistemic claim state only.

Laws:
  CLAIM STRENGTH <= EVIDENCE STRENGTH
  CLAIM SCOPE <= EVIDENCE SCOPE
  CLAIM INDEPENDENCE <= EVIDENCE INDEPENDENCE
  ARTIFACT HASH != QUALIFICATION
  PROOF RECEIPT != QUALIFICATION
  TEST PASS != PRODUCTION QUALIFICATION
  CALLER POLICY != POLICY AUTHORITY
  INDEPENDENCE ENUM != INDEPENDENT REALITY

K7 does not mint K2 proof, K4 authority, K6 identity, or mutate K0/K1/K3.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Any


class ClaimStage(str, Enum):
    """Evidence-maturity ladder — not marketing language."""

    SPECIFIED = "SPECIFIED"
    IMPLEMENTED = "IMPLEMENTED"
    TESTED = "TESTED"
    VERIFIED_WITHIN_SCOPE = "VERIFIED_WITHIN_SCOPE"
    QUALIFIED = "QUALIFIED"
    VALIDATED_WITH_USERS = "VALIDATED_WITH_USERS"
    PRODUCTION_OBSERVED = "PRODUCTION_OBSERVED"
    INDEPENDENTLY_REPLICATED = "INDEPENDENTLY_REPLICATED"


STAGE_ORDER: tuple[ClaimStage, ...] = (
    ClaimStage.SPECIFIED,
    ClaimStage.IMPLEMENTED,
    ClaimStage.TESTED,
    ClaimStage.VERIFIED_WITHIN_SCOPE,
    ClaimStage.QUALIFIED,
    ClaimStage.VALIDATED_WITH_USERS,
    ClaimStage.PRODUCTION_OBSERVED,
    ClaimStage.INDEPENDENTLY_REPLICATED,
)


def stage_rank(stage: ClaimStage | None) -> int:
    if stage is None:
        return -1
    return STAGE_ORDER.index(stage)


class EvidenceKind(str, Enum):
    SPECIFICATION = "SPECIFICATION"
    IMPLEMENTATION_BINDING = "IMPLEMENTATION_BINDING"
    TEST_RESULT = "TEST_RESULT"
    VERIFICATION_RECEIPT = "VERIFICATION_RECEIPT"
    EXTERNAL_REVIEW = "EXTERNAL_REVIEW"
    USER_VALIDATION = "USER_VALIDATION"
    PRODUCTION_OBSERVATION = "PRODUCTION_OBSERVATION"
    INDEPENDENT_REPLICATION = "INDEPENDENT_REPLICATION"
    SECURITY_REVIEW = "SECURITY_REVIEW"
    FORMAL_MODEL_CHECK = "FORMAL_MODEL_CHECK"
    BENCHMARK_RESULT = "BENCHMARK_RESULT"


class IndependenceClass(str, Enum):
    """Declared independence class — not path/process/branch coincidence."""

    INTERNAL = "INTERNAL"
    EXTERNAL = "EXTERNAL"
    INDEPENDENT = "INDEPENDENT"


class IndependenceBasis(str, Enum):
    """How independence was established.

    DECLARED: caller supplied the enum only — never satisfies EXTERNAL/INDEPENDENT
              obligations for qualification.
    STRUCTURAL_BOUND: digest + artifact_ref present. Structural custody only —
              NOT cryptographically authenticated reviewer identity.
    """

    DECLARED = "DECLARED"
    STRUCTURAL_BOUND = "STRUCTURAL_BOUND"


class EvidenceVerdict(str, Enum):
    """Evidence record verdict — distinct from K2 proof Verdict ownership."""

    PASS = "PASS"
    FAIL = "FAIL"
    UNKNOWN = "UNKNOWN"


class QualificationVerdict(str, Enum):
    EARNED = "EARNED"
    PARTIALLY_EARNED = "PARTIALLY_EARNED"
    NOT_EARNED = "NOT_EARNED"
    UNQUALIFIABLE_UNDER_POLICY = "UNQUALIFIABLE_UNDER_POLICY"


# Marketing / competitive claim codes — never auto-ladder stages.
UNSUPPORTED_MARKETING_CLAIM_KEYS: frozenset[str] = frozenset(
    {
        "WORLD_1",
        "WORLD_NUMBER_ONE",
        "BEST_PROMPT_ENGINE",
        "BEST_IN_WORLD",
        "GLOBAL_BEST",
        "UNBEATABLE",
        "GLOBAL_LEADER",
        "TEN_OUT_OF_TEN",
        "10_OUT_OF_10",
        "PRODUCTION_READY",
        "SECURE_UNHACKABLE",
        "BULLETPROOF",
        "UNHACKABLE",
        "FORMALLY_VERIFIED",
        "FORMAL_MODEL_VERIFIED",
        "TLC_PASS",
        "SELF_CONTAINED_FULL_REPLAY",
        "SUPER_GOD_MODE_VERIFIED",
    }
)

# Environments that are never production (non-local ≠ production).
NON_PRODUCTION_ENVIRONMENTS: frozenset[str] = frozenset(
    {
        "local",
        "unit_test",
        "staging",
        "remote_ci",
        "ci",
        "qa",
        "preview",
        "test",
        "test_server",
        "dev_cloud",
        "developer_cloud_vm",
        "unspecified",
    }
)

# Exact production environment token required for PRODUCTION_OBSERVATION PASS.
PRODUCTION_ENVIRONMENT = "production"


@dataclass(frozen=True, slots=True)
class ClaimScope:
    """Deterministic claim/evidence scope boundary.

    UNBOUND (None revision / unspecified dims) != ALL.
    Missing candidate dimensions must not broaden evidence coverage.
    """

    component: str
    platform: str = "unspecified"
    runtime: str = "unspecified"
    environment: str = "unspecified"
    revision: str | None = None

    def to_canonical_dict(self) -> dict[str, Any]:
        return {
            "component": self.component,
            "platform": self.platform,
            "runtime": self.runtime,
            "environment": self.environment,
            "revision": self.revision,
        }


@dataclass(frozen=True, slots=True)
class ClaimCandidate:
    """Typed claim request — free text does not control earned stage."""

    claim_key: str
    subject_id: str
    requested_stage: ClaimStage
    scope: ClaimScope
    claim_code: str
    policy_id: str = "default_ring0"

    def __post_init__(self) -> None:
        object.__setattr__(self, "requested_stage", ClaimStage(self.requested_stage))
        if not isinstance(self.scope, ClaimScope):
            raise TypeError("scope must be ClaimScope")


@dataclass(frozen=True, slots=True)
class QualificationEvidence:
    """One immutable evidence record — not self-verifying by enum alone."""

    evidence_id: str
    evidence_kind: EvidenceKind
    subject_id: str
    claim_key: str
    scope: ClaimScope
    verdict: EvidenceVerdict
    independence: IndependenceClass
    independence_basis: IndependenceBasis
    producer_class: str
    artifact_ref: str | None = None
    evidence_digest: str | None = None
    limitations: tuple[str, ...] = ()
    schema_version: str = "qualification_evidence.v2"

    def __post_init__(self) -> None:
        object.__setattr__(self, "evidence_kind", EvidenceKind(self.evidence_kind))
        object.__setattr__(self, "verdict", EvidenceVerdict(self.verdict))
        object.__setattr__(self, "independence", IndependenceClass(self.independence))
        object.__setattr__(self, "independence_basis", IndependenceBasis(self.independence_basis))
        object.__setattr__(self, "limitations", tuple(self.limitations))
        if not self.evidence_id.startswith("qe-"):
            raise ValueError("evidence_id must use qe- prefix")

    def source_key(self) -> str | None:
        """Underlying source identity for anti-wrapper-diversity checks."""
        if self.evidence_digest:
            return f"digest:{self.evidence_digest}"
        if self.artifact_ref:
            return f"ref:{self.artifact_ref}"
        return None

    def to_identity_preimage(self) -> dict[str, Any]:
        return {
            "schema_version": self.schema_version,
            "evidence_kind": self.evidence_kind.value,
            "subject_id": self.subject_id,
            "claim_key": self.claim_key,
            "scope": self.scope.to_canonical_dict(),
            "verdict": self.verdict.value,
            "independence": self.independence.value,
            "independence_basis": self.independence_basis.value,
            "producer_class": self.producer_class,
            "artifact_ref": self.artifact_ref,
            "evidence_digest": self.evidence_digest,
            "limitations": list(self.limitations),
        }


@dataclass(frozen=True, slots=True)
class ClaimQualification:
    """Immutable qualification decision — epistemic only."""

    qualification_id: str
    claim_key: str
    subject_id: str
    scope: ClaimScope
    requested_stage: ClaimStage
    earned_stage: ClaimStage | None
    evidence_ids: tuple[str, ...]
    unmet_requirements: tuple[str, ...]
    limitations: tuple[str, ...]
    verdict: QualificationVerdict
    policy_id: str
    schema_version: str = "claim_qualification.v1"

    def __post_init__(self) -> None:
        object.__setattr__(self, "requested_stage", ClaimStage(self.requested_stage))
        if self.earned_stage is not None:
            object.__setattr__(self, "earned_stage", ClaimStage(self.earned_stage))
        object.__setattr__(self, "verdict", QualificationVerdict(self.verdict))
        object.__setattr__(self, "evidence_ids", tuple(self.evidence_ids))
        object.__setattr__(self, "unmet_requirements", tuple(self.unmet_requirements))
        object.__setattr__(self, "limitations", tuple(self.limitations))
        if not self.qualification_id.startswith("qual-"):
            raise ValueError("qualification_id must use qual- prefix")

    def to_identity_preimage(self) -> dict[str, Any]:
        return {
            "schema_version": self.schema_version,
            "claim_key": self.claim_key,
            "subject_id": self.subject_id,
            "scope": self.scope.to_canonical_dict(),
            "requested_stage": self.requested_stage.value,
            "earned_stage": self.earned_stage.value if self.earned_stage else None,
            "evidence_ids": list(self.evidence_ids),
            "unmet_requirements": list(self.unmet_requirements),
            "limitations": list(self.limitations),
            "verdict": self.verdict.value,
            "policy_id": self.policy_id,
        }


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
]
