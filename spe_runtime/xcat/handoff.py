"""Category handoff validation.

Returns ONLY: VALID | REFUSE | BLOCKED | REVALIDATION_REQUIRED
Never: PROMOTE | EXECUTED | VERIFIED_SUCCESS
"""

from __future__ import annotations

from enum import Enum

from spe_runtime.xcat.invariants import (
    validate_analysis_not_recommendation,
    validate_authority_non_escalation,
    validate_category_ownership,
    validate_constraint_monotonicity,
    validate_facts_have_provenance,
    validate_failure_preservation,
    validate_no_semantic_rewrite,
    validate_preference_immutability,
    validate_provenance_monotonicity,
    validate_recommendation_not_execution,
    validate_sensitivity_preservation,
    validate_taint_preservation,
    validate_uncertainty_preservation,
)
from spe_runtime.xcat.models import CrossCategoryEnvelope
from spe_runtime.xcat.reasons import ReasonCode


class HandoffResult(str, Enum):
    VALID = "VALID"
    REFUSE = "REFUSE"
    BLOCKED = "BLOCKED"
    REVALIDATION_REQUIRED = "REVALIDATION_REQUIRED"


def validate_handoff(
    before: CrossCategoryEnvelope,
    after: CrossCategoryEnvelope,
    source_category: str,
    destination_category: str,
    authority_event: object | None = None,
) -> HandoffResult:
    """Validate a cross-category handoff.

    Returns a HandoffResult. Does not promote, execute, or claim verified success.
    """
    if not validate_category_ownership(source_category):
        return HandoffResult.REFUSE
    if not validate_category_ownership(destination_category):
        return HandoffResult.REFUSE

    # Hard safety blocks (authority / failure laundering)
    if not validate_authority_non_escalation(before, after, authority_event):
        return HandoffResult.BLOCKED
    if not validate_failure_preservation(before, after):
        return HandoffResult.BLOCKED

    # Semantic integrity refusals (single-envelope + before/after)
    # Order matters for deterministic reason association in diagnose helpers.
    checks: list[tuple[bool, ReasonCode]] = [
        (validate_facts_have_provenance(after), ReasonCode.FACT_MISSING_PROVENANCE),
        (validate_analysis_not_recommendation(after), ReasonCode.ANALYSIS_AS_RECOMMENDATION),
        (validate_recommendation_not_execution(after), ReasonCode.RECOMMENDATION_AS_EXECUTION),
        (validate_constraint_monotonicity(before, after), ReasonCode.CONSTRAINT_WEAKENED),
        (validate_provenance_monotonicity(before, after), ReasonCode.PROVENANCE_LOST),
        (validate_uncertainty_preservation(before, after), ReasonCode.UNCERTAINTY_ERASED),
        (validate_preference_immutability(before, after), ReasonCode.PREFERENCE_MUTATED),
        (validate_taint_preservation(before, after), ReasonCode.TAINT_LOST),
        (validate_sensitivity_preservation(before, after), ReasonCode.SENSITIVITY_LOST),
        (validate_no_semantic_rewrite(before, after), ReasonCode.SEMANTIC_REWRITE),
    ]
    for ok, _reason in checks:
        if not ok:
            return HandoffResult.REFUSE

    # Destination must appear in after.category_trace for clean handoffs;
    # if missing, require revalidation rather than silent accept.
    if destination_category not in after.category_trace:
        return HandoffResult.REVALIDATION_REQUIRED

    return HandoffResult.VALID


def diagnose_refusal_reason(
    before: CrossCategoryEnvelope,
    after: CrossCategoryEnvelope,
    source_category: str,
    destination_category: str,
    authority_event: object | None = None,
) -> ReasonCode | None:
    """Return the first deterministic reason code for a non-VALID handoff.

    Used so callers can distinguish provenance loss from schema/category failures.
    Does not promote, execute, or mint permits/receipts.
    """
    if not validate_category_ownership(source_category):
        return ReasonCode.INVALID_CATEGORY
    if not validate_category_ownership(destination_category):
        return ReasonCode.INVALID_CATEGORY
    if not validate_authority_non_escalation(before, after, authority_event):
        return ReasonCode.AUTHORITY_SELF_ESCALATION
    if not validate_failure_preservation(before, after):
        return ReasonCode.FAILURE_LAUNDERED

    ordered: list[tuple[bool, ReasonCode]] = [
        (validate_facts_have_provenance(after), ReasonCode.FACT_MISSING_PROVENANCE),
        (validate_analysis_not_recommendation(after), ReasonCode.ANALYSIS_AS_RECOMMENDATION),
        (validate_recommendation_not_execution(after), ReasonCode.RECOMMENDATION_AS_EXECUTION),
        (validate_constraint_monotonicity(before, after), ReasonCode.CONSTRAINT_WEAKENED),
        (validate_provenance_monotonicity(before, after), ReasonCode.PROVENANCE_LOST),
        (validate_uncertainty_preservation(before, after), ReasonCode.UNCERTAINTY_ERASED),
        (validate_preference_immutability(before, after), ReasonCode.PREFERENCE_MUTATED),
        (validate_taint_preservation(before, after), ReasonCode.TAINT_LOST),
        (validate_sensitivity_preservation(before, after), ReasonCode.SENSITIVITY_LOST),
        (validate_no_semantic_rewrite(before, after), ReasonCode.SEMANTIC_REWRITE),
    ]
    for ok, reason in ordered:
        if not ok:
            return reason
    if destination_category not in after.category_trace:
        return ReasonCode.CATEGORY_OWNERSHIP
    return None
