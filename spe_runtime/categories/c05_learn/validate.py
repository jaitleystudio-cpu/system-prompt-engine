"""CAT:C05 Learning — payload specialization only."""

from __future__ import annotations

from spe_runtime.categories.validate import validate_payload_category_output
from spe_runtime.xcat.models import CrossCategoryEnvelope

CATEGORY_ID = "CAT:C05"


def validate_learn_output(
    before: CrossCategoryEnvelope, after: CrossCategoryEnvelope
) -> bool:
    return validate_payload_category_output(before, after, CATEGORY_ID)
