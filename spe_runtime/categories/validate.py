"""Shared validation for payload-specializing category engines."""

from __future__ import annotations

from spe_runtime.categories._common import authority_unchanged, mapping_equal
from spe_runtime.xcat.models import CrossCategoryEnvelope

_KERNEL_UNCHANGED = (
    "envelope_id",
    "goal_identity",
    "facts",
    "provenance",
    "uncertainties",
    "hard_constraints",
    "user_preferences",
    "analysis",
    "recommendation",
    "rendering",
    "execution_grants",
    "failures",
    "taint_labels",
    "sensitivity_labels",
    "taxonomy_version",
)


def validate_payload_category_output(
    before: CrossCategoryEnvelope,
    after: CrossCategoryEnvelope,
    category_id: str,
) -> bool:
    """Authority/kernel unchanged; only payload/trace/proposals/active_category may change."""
    if not authority_unchanged(before.authority_state, after.authority_state):
        return False
    for name in _KERNEL_UNCHANGED:
        if getattr(after, name) != getattr(before, name):
            return False
    if after.active_category != category_id:
        return False
    if after.category_payload is None:
        return False
    if category_id not in after.category_trace:
        return False
    if len(after.category_trace) < len(before.category_trace):
        return False
    if after.category_trace[: len(before.category_trace)] != before.category_trace:
        return False
    # analysis/recommendation/rendering already compared; ensure mapping equality helpers
    if not mapping_equal(before.analysis, after.analysis):
        return False
    if not mapping_equal(before.recommendation, after.recommendation):
        return False
    if not mapping_equal(before.rendering, after.rendering):
        return False
    return True
