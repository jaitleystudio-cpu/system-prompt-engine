"""CAT:C01 Decide — may add recommendation ONLY; never authority/execution."""

from __future__ import annotations

from spe_runtime.categories._common import (
    authority_unchanged,
    failures_not_laundered,
    mapping_equal,
)
from spe_runtime.xcat.invariants import (
    validate_analysis_not_recommendation,
    validate_constraint_monotonicity,
    validate_preference_immutability,
    validate_provenance_monotonicity,
    validate_recommendation_not_execution,
    validate_sensitivity_preservation,
    validate_taint_preservation,
    validate_uncertainty_preservation,
)
from spe_runtime.xcat.models import CrossCategoryEnvelope

CATEGORY_ID = "CAT:C01"


def validate_c01_output(
    before: CrossCategoryEnvelope, after: CrossCategoryEnvelope
) -> bool:
    """C01 may only set recommendation (+ trace). Cannot manufacture authority."""
    if not authority_unchanged(before.authority_state, after.authority_state):
        return False
    if after.execution_grants != before.execution_grants:
        return False
    if after.execution_grants:
        # Decide must not mint grants even if before somehow had them unchanged —
        # still require recommendation != execution invariant.
        pass
    if after.facts != before.facts:
        return False
    if after.provenance != before.provenance:
        return False
    if after.uncertainties != before.uncertainties:
        return False
    if not mapping_equal(before.analysis, after.analysis):
        return False
    if after.rendering is not None and before.rendering is None:
        return False
    if after.rendering is not None and not mapping_equal(before.rendering, after.rendering):
        return False
    if after.recommendation is None:
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
    if not validate_analysis_not_recommendation(after):
        return False
    if not validate_recommendation_not_execution(after):
        return False
    if after.goal_identity != before.goal_identity:
        return False
    if CATEGORY_ID not in after.category_trace:
        return False
    return True
