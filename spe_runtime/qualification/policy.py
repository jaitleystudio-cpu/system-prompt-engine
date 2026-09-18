"""K7 claim policy — mandatory evidence obligations per stage / claim domain."""

from __future__ import annotations

from dataclasses import dataclass

from spe_runtime.error_registry import ErrorCode, SpeTypedError
from spe_runtime.qualification.models import (
    ClaimStage,
    EvidenceKind,
    IndependenceClass,
    STAGE_ORDER,
    UNSUPPORTED_MARKETING_CLAIM_KEYS,
)


@dataclass(frozen=True, slots=True)
class StageObligation:
    """One mandatory evidence obligation for a stage."""

    evidence_kinds: tuple[EvidenceKind, ...]
    min_independence: IndependenceClass = IndependenceClass.INTERNAL
    code: str = ""


@dataclass(frozen=True, slots=True)
class ClaimPolicy:
    """Deterministic policy for a claim domain."""

    policy_id: str
    # Cumulative obligations keyed by stage — each stage requires prior stages too.
    obligations: dict[ClaimStage, tuple[StageObligation, ...]]
    unsupported_claim_keys: frozenset[str] = UNSUPPORTED_MARKETING_CLAIM_KEYS


def _obl(*kinds: EvidenceKind, indep: IndependenceClass = IndependenceClass.INTERNAL, code: str = "") -> StageObligation:
    return StageObligation(evidence_kinds=tuple(kinds), min_independence=indep, code=code or kinds[0].value)


def default_ring0_policy() -> ClaimPolicy:
    """Minimum Ring-0 claim ladder policy (not production/world leadership)."""
    obligations: dict[ClaimStage, tuple[StageObligation, ...]] = {
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
                EvidenceKind.VERIFICATION_RECEIPT,
                indep=IndependenceClass.EXTERNAL,
                code="NEED_SCOPED_VERIFICATION",
            ),
        ),
        ClaimStage.QUALIFIED: (
            _obl(
                EvidenceKind.EXTERNAL_REVIEW,
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
    return ClaimPolicy(
        policy_id="default_ring0",
        obligations=obligations,
        unsupported_claim_keys=UNSUPPORTED_MARKETING_CLAIM_KEYS,
    )


def subsystem_pass_external_policy() -> ClaimPolicy:
    """Policy for PASS_EXTERNAL-style subsystem claims (≠ production / ≠ world #1)."""
    base = default_ring0_policy()
    # QUALIFIED for this domain requires EXTERNAL_REVIEW PASS (same as default).
    return ClaimPolicy(
        policy_id="subsystem_pass_external",
        obligations=base.obligations,
        unsupported_claim_keys=UNSUPPORTED_MARKETING_CLAIM_KEYS,
    )


def validate_policy(policy: ClaimPolicy) -> ClaimPolicy:
    if not policy.policy_id:
        raise SpeTypedError(ErrorCode.K7_INVALID_POLICY, "policy_id required")
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
    return policy


_POLICIES: dict[str, ClaimPolicy] = {
    "default_ring0": validate_policy(default_ring0_policy()),
    "subsystem_pass_external": validate_policy(subsystem_pass_external_policy()),
}


def get_policy(policy_id: str) -> ClaimPolicy:
    if policy_id not in _POLICIES:
        raise SpeTypedError(ErrorCode.K7_INVALID_POLICY, f"unknown policy_id: {policy_id}")
    return _POLICIES[policy_id]


__all__ = [
    "StageObligation",
    "ClaimPolicy",
    "default_ring0_policy",
    "subsystem_pass_external_policy",
    "validate_policy",
    "get_policy",
]
