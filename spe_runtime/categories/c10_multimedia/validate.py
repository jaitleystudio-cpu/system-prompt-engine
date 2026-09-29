"""CAT:C10 Multimedia — payload specialization only."""

from __future__ import annotations

from spe_runtime.categories.validate import validate_payload_category_output
from spe_runtime.xcat.models import CrossCategoryEnvelope

CATEGORY_ID = "CAT:C10"


def validate_multimedia_output(
    before: CrossCategoryEnvelope, after: CrossCategoryEnvelope
) -> bool:
    return validate_payload_category_output(before, after, CATEGORY_ID)
