"""CAT:C01 legacy compatibility writer.

OWNERSHIP_CLASS = LEGACY_COMPATIBILITY
DOMAIN v2 production must use spe_runtime.categories.domain.apply_domain_category.
This function directly commits envelope.recommendation and is not a DOMAIN writer.
"""

from __future__ import annotations

from typing import Any, Mapping

from spe_runtime.categories._common import reject_forbidden_keys, replace_envelope
from spe_runtime.categories.c01_decide.validate import validate_c01_output
from spe_runtime.xcat.models import CrossCategoryEnvelope

CATEGORY_ID = "CAT:C01"
OWNERSHIP_CLASS = "LEGACY_COMPATIBILITY"
DOMAIN_PRODUCTION = False


def decide(
    envelope: CrossCategoryEnvelope,
    *,
    recommendation: Mapping[str, Any],
    **kwargs: Any,
) -> CrossCategoryEnvelope:
    """Produce an immutable envelope update owned by CAT:C01."""
    if kwargs:
        raise ValueError(
            f"C01 ownership violation: unexpected kwargs {sorted(kwargs)} "
            "(authority not allowed)"
        )
    payload = dict(recommendation)
    reject_forbidden_keys(payload, label="C01 recommendation")
    if "kind" not in payload:
        payload["kind"] = "recommendation"
    if payload.get("kind") == "analysis":
        raise ValueError("C01 ownership violation: recommendation kind cannot be analysis")

    after = replace_envelope(
        envelope,
        recommendation=payload,
        category_trace=envelope.category_trace + (CATEGORY_ID,),
    )
    if not validate_c01_output(envelope, after):
        raise ValueError("C01 ownership/validation failed")
    return after
