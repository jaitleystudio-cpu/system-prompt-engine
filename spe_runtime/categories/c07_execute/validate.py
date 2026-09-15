"""CAT:C07 Execute — may record intent trace ONLY; never mint authority."""

from __future__ import annotations

from spe_runtime.categories._common import (
    authority_unchanged,
    failures_not_laundered,
    mapping_equal,
)
from spe_runtime.xcat.invariants import (
    validate_constraint_monotonicity,
    validate_no_semantic_rewrite,
    validate_preference_immutability,
    validate_provenance_monotonicity,
    validate_recommendation_not_execution,
    validate_sensitivity_preservation,
    validate_taint_preservation,
    validate_uncertainty_preservation,
)
from spe_runtime.xcat.models import CrossCategoryEnvelope

CATEGORY_ID = "CAT:C07"


def validate_c07_output(
    before: CrossCategoryEnvelope, after: CrossCategoryEnvelope
) -> bool:
    """C07 must not mutate recommendation, weaken constraints, or escalate authority."""
    if not mapping_equal(before.recommendation, after.recommendation):
        return False
    if not mapping_equal(before.rendering, after.rendering):
        return False
    if not mapping_equal(before.analysis, after.analysis):
        return False
    if after.facts != before.facts:
        return False
    if after.provenance != before.provenance:
        return False
    if after.uncertainties != before.uncertainties:
        return False
    if after.hard_constraints != before.hard_constraints:
        return False
    if after.user_preferences != before.user_preferences:
        return False
    if not authority_unchanged(before.authority_state, after.authority_state):
        return False
    # C07 must never mint/broaden/refresh execution_grants (authorized=True is NOT a bypass)
    if tuple(after.execution_grants) != tuple(before.execution_grants):
        return False
    if not failures_not_laundered(before.failures, after.failures):
        return False
    if not validate_constraint_monotonicity(before, after):
        return False
    if not validate_provenance_monotonicity(before, after):
        return False
    if not validate_uncertainty_preservation(before, after):
        return False
    if not validate_preference_immutability(before, after):
        return False
    if not validate_taint_preservation(before, after):
        return False
    if not validate_sensitivity_preservation(before, after):
        return False
    if not validate_no_semantic_rewrite(before, after):
        return False
    if not validate_recommendation_not_execution(after):
        return False
    if after.goal_identity != before.goal_identity:
        return False
    if CATEGORY_ID not in after.category_trace:
        return False
    return True
