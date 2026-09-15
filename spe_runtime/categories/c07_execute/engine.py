"""CAT:C07 Execute — form ExecutionIntent under authority; never mint authority.

Hard law: recommendation SEND + C03 rendering + authority NONE (no grant)
= BLOCKED. No external side effects here (adapter is separate).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Mapping

from spe_runtime.authority.models import AuthorityGrant
from spe_runtime.authority.validate import validate_grant_compatibility
from spe_runtime.categories._common import replace_envelope
from spe_runtime.categories.c07_execute.validate import validate_c07_output
from spe_runtime.execution.models import (
    ExecutionIntent,
    canonical_arguments_digest,
    stable_operation_id,
)
from spe_runtime.xcat.models import CrossCategoryEnvelope
from spe_runtime.xcat.reasons import ReasonCode

CATEGORY_ID = "CAT:C07"


@dataclass(frozen=True)
class C07Result:
    status: str  # INTENT_FORMED | BLOCKED
    intent: ExecutionIntent | None
    reason_codes: tuple[str, ...]
    envelope: CrossCategoryEnvelope
    outcome: str = "NOT_EXECUTED"


def _decision_matches(
    envelope: CrossCategoryEnvelope, decision_ref: str | None
) -> bool:
    if decision_ref is None:
        return True
    rec = envelope.recommendation
    if rec is None:
        return False
    rid = rec.get("decision_id")
    if rid is None:
        return False
    return str(rid) == str(decision_ref)


def form_execution_intent(
    envelope: CrossCategoryEnvelope,
    *,
    grant: AuthorityGrant | None = None,
    action_type: str = "NO_OP",
    canonical_target: str = "",
    canonical_arguments: Mapping[str, Any] | None = None,
    expected_effect: str = "",
    reversibility_class: str = "REVERSIBLE",
    recommendation_ref: str | None = None,
    decision_ref: str | None = None,
    now: str | None = None,
    operation_id: str | None = None,
    mutate_recommendation: Mapping[str, Any] | None = None,
    weaken_constraints: bool = False,
    illicit_authority: object | None = None,
    expand_authority: bool = False,
) -> C07Result:
    """Validate authority compatibility and form an immutable ExecutionIntent.

    Attack kwargs (mutate_recommendation, weaken_constraints, illicit_authority,
    expand_authority) are accepted only so tests can prove rejection — they always
    yield BLOCKED and never apply to the returned envelope.
    """
    args = dict(canonical_arguments or {})
    clock = now or "1970-01-01T00:00:00+00:00"

    # Attack attempts: refuse without mutating envelope
    if (
        mutate_recommendation is not None
        or weaken_constraints
        or illicit_authority is not None
        or expand_authority
    ):
        after = replace_envelope(
            envelope,
            category_trace=envelope.category_trace + (CATEGORY_ID,),
        )
        # Still append trace for observability but fail ownership
        reasons: list[str] = []
        if mutate_recommendation is not None:
            reasons.append(ReasonCode.SEMANTIC_REWRITE.value)
        if weaken_constraints:
            reasons.append(ReasonCode.CONSTRAINT_WEAKENED.value)
        if illicit_authority is not None or expand_authority:
            reasons.append(ReasonCode.AUTHORITY_SELF_ESCALATION.value)
        # Ownership check: if someone somehow mutated, validator fails
        if not validate_c07_output(envelope, after):
            return C07Result(
                status="BLOCKED",
                intent=None,
                reason_codes=tuple(reasons),
                envelope=envelope,
                outcome="NOT_EXECUTED",
            )
        return C07Result(
            status="BLOCKED",
            intent=None,
            reason_codes=tuple(reasons),
            envelope=envelope,  # unchanged authority/recommendation/constraints
            outcome="NOT_EXECUTED",
        )

    ok, grant_reasons = validate_grant_compatibility(
        grant,
        capability=action_type,
        target=canonical_target,
        arguments=args,
        now=clock,
    )
    if not ok:
        return C07Result(
            status="BLOCKED",
            intent=None,
            reason_codes=grant_reasons,
            envelope=envelope,
            outcome="NOT_EXECUTED",
        )

    if not _decision_matches(envelope, decision_ref):
        return C07Result(
            status="BLOCKED",
            intent=None,
            reason_codes=(ReasonCode.DECISION_DRIFT.value,),
            envelope=envelope,
            outcome="NOT_EXECUTED",
        )

    digest = canonical_arguments_digest(args)
    grant_ref = grant.grant_id if grant is not None else None
    oid = operation_id or stable_operation_id(
        action_type=action_type,
        canonical_target=canonical_target,
        arguments_digest=digest,
        recommendation_ref=recommendation_ref,
        decision_ref=decision_ref,
        authority_grant_ref=grant_ref,
    )
    intent = ExecutionIntent(
        operation_id=oid,
        action_type=action_type,
        canonical_target=canonical_target,
        canonical_arguments=args,
        arguments_digest=digest,
        expected_effect=expected_effect,
        reversibility_class=reversibility_class,
        recommendation_ref=recommendation_ref,
        decision_ref=decision_ref,
        authority_grant_ref=grant_ref,
    )

    after = replace_envelope(
        envelope,
        category_trace=envelope.category_trace + (CATEGORY_ID,),
    )
    if not validate_c07_output(envelope, after):
        return C07Result(
            status="BLOCKED",
            intent=None,
            reason_codes=(ReasonCode.CATEGORY_OWNERSHIP.value,),
            envelope=envelope,
            outcome="NOT_EXECUTED",
        )

    return C07Result(
        status="INTENT_FORMED",
        intent=intent,
        reason_codes=(),
        envelope=after,
        outcome="NOT_EXECUTED",
    )


def retry_form_execution_intent(
    envelope: CrossCategoryEnvelope,
    previous: ExecutionIntent,
    *,
    grant: AuthorityGrant | None = None,
    now: str | None = None,
    replace_operation_id: str | None = None,
) -> C07Result:
    """Retry must preserve operation_id; replacement is BLOCKED."""
    if replace_operation_id is not None and replace_operation_id != previous.operation_id:
        return C07Result(
            status="BLOCKED",
            intent=None,
            reason_codes=(ReasonCode.OPERATION_ID_REPLACED.value,),
            envelope=envelope,
            outcome="NOT_EXECUTED",
        )

    result = form_execution_intent(
        envelope,
        grant=grant,
        action_type=previous.action_type,
        canonical_target=previous.canonical_target,
        canonical_arguments=dict(previous.canonical_arguments),
        expected_effect=previous.expected_effect,
        reversibility_class=previous.reversibility_class,
        recommendation_ref=previous.recommendation_ref,
        decision_ref=previous.decision_ref,
        now=now,
        operation_id=previous.operation_id,
    )
    if result.status == "INTENT_FORMED" and result.intent is not None:
        if result.intent.operation_id != previous.operation_id:
            return C07Result(
                status="BLOCKED",
                intent=None,
                reason_codes=(ReasonCode.OPERATION_ID_REPLACED.value,),
                envelope=envelope,
                outcome="NOT_EXECUTED",
            )
    return result
