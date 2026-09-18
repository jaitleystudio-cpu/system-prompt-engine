"""K7 claim policy — registered policies only; global stage floors irreducible.

Caller-supplied ClaimPolicy objects cannot weaken SPE qualification semantics.
Custom policies may only ADD obligations above STAGE_FLOORS.
"""

from __future__ import annotations

from dataclasses import dataclass

from spe_runtime.error_registry import ErrorCode, SpeTypedError
from spe_runtime.qualification.models import (
    ClaimStage,
    EvidenceKind,
    IndependenceClass,
    STAGE_ORDER,
    UNSUPPORTED_MARKETING_CLAIM_KEYS,
    stage_rank,
)


@dataclass(frozen=True, slots=True)
class StageObligation:
    """One mandatory evidence obligation for a stage."""

    evidence_kinds: tuple[EvidenceKind, ...]
    min_independence: IndependenceClass = IndependenceClass.INTERNAL
    code: str = ""
    # When True (default), evidence used here cannot satisfy a later distinct obligation.
    consume: bool = True
    # When True, same underlying source_key cannot satisfy this if already used.
    unique_source: bool = True


@dataclass(frozen=True, slots=True)
class ClaimPolicy:
    """Deterministic registered policy for a claim domain."""

    policy_id: str
    obligations: dict[ClaimStage, tuple[StageObligation, ...]]
    unsupported_claim_keys: frozenset[str] = UNSUPPORTED_MARKETING_CLAIM_KEYS
    # Max stage this policy may award (QUALIFIED requires domain policy).
    max_stage: ClaimStage = ClaimStage.INDEPENDENTLY_REPLICATED
    policy_version: str = "1"


def _obl(
    *kinds: EvidenceKind,
    indep: IndependenceClass = IndependenceClass.INTERNAL,
    code: str = "",
    consume: bool = True,
    unique_source: bool = True,
) -> StageObligation:
    return StageObligation(
        evidence_kinds=tuple(kinds),
        min_independence=indep,
        code=code or kinds[0].value,
        consume=consume,
        unique_source=unique_source,
    )


# Irreducible global floors — no registered policy may weaken these.
STAGE_FLOORS: dict[ClaimStage, tuple[StageObligation, ...]] = {
    ClaimStage.SPECIFIED: (
        _obl(EvidenceKind.SPECIFICATION, code="NEED_SPECIFICATION"),
    ),
    ClaimStage.IMPLEMENTED: (
        _obl(EvidenceKind.IMPLEMENTATION_BINDING, code="NEED_IMPLEMENTATION_BINDING"),
    ),
    ClaimStage.TESTED: (
        _obl(EvidenceKind.TEST_RESULT, code="NEED_TEST_RESULT"),
    ),
    ClaimStage.VERIFIED_WITHIN_SCOPE: (
        _obl(
            EvidenceKind.EXTERNAL_REVIEW,
            EvidenceKind.SECURITY_REVIEW,
            indep=IndependenceClass.EXTERNAL,
            code="NEED_SCOPED_VERIFICATION",
        ),
    ),
    ClaimStage.QUALIFIED: (
        # Distinct from VERIFIED: domain qualification review (consumed separately).
        _obl(
            EvidenceKind.EXTERNAL_REVIEW,
            EvidenceKind.SECURITY_REVIEW,
            indep=IndependenceClass.EXTERNAL,
            code="NEED_QUALIFICATION_REVIEW",
        ),
    ),
    ClaimStage.VALIDATED_WITH_USERS: (
        _obl(
            EvidenceKind.USER_VALIDATION,
            indep=IndependenceClass.EXTERNAL,
            code="NEED_USER_VALIDATION",
        ),
    ),
    ClaimStage.PRODUCTION_OBSERVED: (
        _obl(
            EvidenceKind.PRODUCTION_OBSERVATION,
            indep=IndependenceClass.EXTERNAL,
            code="NEED_PRODUCTION_OBSERVATION",
        ),
    ),
    ClaimStage.INDEPENDENTLY_REPLICATED: (
        _obl(
            EvidenceKind.INDEPENDENT_REPLICATION,
            indep=IndependenceClass.INDEPENDENT,
            code="NEED_INDEPENDENT_REPLICATION",
        ),
    ),
}


def _indep_rank(i: IndependenceClass) -> int:
    return {
        IndependenceClass.INTERNAL: 0,
        IndependenceClass.EXTERNAL: 1,
        IndependenceClass.INDEPENDENT: 2,
    }[i]


def _obligation_covers_floor(obl: StageObligation, floor: StageObligation) -> bool:
    """True if obl is at least as strong as floor."""
    if not set(obl.evidence_kinds) & set(floor.evidence_kinds):
        if not set(obl.evidence_kinds).issubset(
            set(floor.evidence_kinds)
            | {
                EvidenceKind.SECURITY_REVIEW,
                EvidenceKind.FORMAL_MODEL_CHECK,
            }
        ):
            return False
    if _indep_rank(obl.min_independence) < _indep_rank(floor.min_independence):
        return False
    return True


def _stage_meets_floor(
    policy_obls: tuple[StageObligation, ...], floors: tuple[StageObligation, ...]
) -> bool:
    for floor in floors:
        if not any(_obligation_covers_floor(o, floor) for o in policy_obls):
            return False
    return True


def validate_policy(policy: ClaimPolicy) -> ClaimPolicy:
    if not policy.policy_id:
        raise SpeTypedError(ErrorCode.K7_INVALID_POLICY, "policy_id required")
    if not policy.policy_version:
        raise SpeTypedError(ErrorCode.K7_INVALID_POLICY, "policy_version required")
    for stage in STAGE_ORDER:
        if stage not in policy.obligations:
            raise SpeTypedError(
                ErrorCode.K7_INVALID_POLICY,
                f"policy missing obligations for {stage.value}",
            )
        obls = policy.obligations[stage]
        if not obls:
            raise SpeTypedError(
                ErrorCode.K7_INVALID_POLICY,
                f"empty obligations for {stage.value}",
            )
        for o in obls:
            if not o.evidence_kinds:
                raise SpeTypedError(ErrorCode.K7_INVALID_POLICY, "obligation kinds empty")
        if not _stage_meets_floor(obls, STAGE_FLOORS[stage]):
            raise SpeTypedError(
                ErrorCode.K7_INVALID_POLICY,
                f"policy weakens global stage floor for {stage.value}",
            )
    if stage_rank(policy.max_stage) < 0:
        raise SpeTypedError(ErrorCode.K7_INVALID_POLICY, "invalid max_stage")
    return policy


def default_ring0_policy() -> ClaimPolicy:
    """Minimum Ring-0 ladder. Generic max_stage=VERIFIED_WITHIN_SCOPE."""
    obligations: dict[ClaimStage, tuple[StageObligation, ...]] = {
        st: STAGE_FLOORS[st] for st in STAGE_ORDER
    }
    return ClaimPolicy(
        policy_id="default_ring0",
        obligations=obligations,
        unsupported_claim_keys=UNSUPPORTED_MARKETING_CLAIM_KEYS,
        max_stage=ClaimStage.VERIFIED_WITHIN_SCOPE,
        policy_version="2",
    )


def subsystem_pass_external_policy() -> ClaimPolicy:
    """PASS_EXTERNAL-style subsystem claims.

    Historical PASS_EXTERNAL ≈ VERIFIED_WITHIN_SCOPE.
    QUALIFIED requires a distinct second EXTERNAL_REVIEW (consume=True).
    """
    obligations: dict[ClaimStage, tuple[StageObligation, ...]] = {
        st: STAGE_FLOORS[st] for st in STAGE_ORDER
    }
    return ClaimPolicy(
        policy_id="subsystem_pass_external",
        obligations=obligations,
        unsupported_claim_keys=UNSUPPORTED_MARKETING_CLAIM_KEYS,
        max_stage=ClaimStage.QUALIFIED,
        policy_version="2",
    )


CLAIM_POLICY_BINDINGS: dict[str, str] = {
    "PORTABLE_SEMANTIC_BINDING_ARTIFACT": "subsystem_pass_external",
    "G1R7_K3_STRATEGY": "subsystem_pass_external",
    "G1R8_K6_ARTIFACT": "subsystem_pass_external",
}


_POLICIES: dict[str, ClaimPolicy] = {
    "default_ring0": validate_policy(default_ring0_policy()),
    "subsystem_pass_external": validate_policy(subsystem_pass_external_policy()),
}


def get_policy(policy_id: str) -> ClaimPolicy:
    if policy_id not in _POLICIES:
        raise SpeTypedError(ErrorCode.K7_INVALID_POLICY, f"unknown policy_id: {policy_id}")
    return _POLICIES[policy_id]


def resolve_registered_policy(policy_id: str) -> ClaimPolicy:
    """Only registered policies are authorization — never caller-constructed objects."""
    return get_policy(policy_id)


def bound_policy_for_claim(claim_key: str, requested_policy_id: str) -> ClaimPolicy:
    """Enforce claim_key → canonical policy binding when registered."""
    required = CLAIM_POLICY_BINDINGS.get(claim_key)
    if required is not None and requested_policy_id != required:
        raise SpeTypedError(
            ErrorCode.K7_INVALID_POLICY,
            f"claim_key {claim_key!r} requires policy_id={required!r}, got {requested_policy_id!r}",
        )
    return get_policy(requested_policy_id)


__all__ = [
    "StageObligation",
    "ClaimPolicy",
    "STAGE_FLOORS",
    "CLAIM_POLICY_BINDINGS",
    "default_ring0_policy",
    "subsystem_pass_external_policy",
    "validate_policy",
    "get_policy",
    "resolve_registered_policy",
    "bound_policy_for_claim",
]
