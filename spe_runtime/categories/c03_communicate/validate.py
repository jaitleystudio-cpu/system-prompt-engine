"""CAT:C03 Communicate — may add rendering ONLY; cannot change recommendation."""

from __future__ import annotations

from spe_runtime.categories._common import (
    authority_unchanged,
    certainty_rank,
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

CATEGORY_ID = "CAT:C03"


def validate_c03_output(
    before: CrossCategoryEnvelope, after: CrossCategoryEnvelope
) -> bool:
    """C03 may only set rendering (+ trace). Recommendation is immutable here."""
    if not mapping_equal(before.recommendation, after.recommendation):
        return False
    if after.facts != before.facts:
        return False
    if after.provenance != before.provenance:
        return False
    if after.uncertainties != before.uncertainties:
        return False
    if not mapping_equal(before.analysis, after.analysis):
        return False
    if not authority_unchanged(before.authority_state, after.authority_state):
        return False
    if after.execution_grants != before.execution_grants:
        return False
    if after.rendering is None:
        return False
    # Cannot strengthen conditional → certain in rendering vs recommendation
    if before.recommendation is not None:
        rec_c = before.recommendation.get("certainty")
        rend_c = after.rendering.get("certainty") if after.rendering else None
        if rend_c is not None and certainty_rank(rend_c) > certainty_rank(rec_c):
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
