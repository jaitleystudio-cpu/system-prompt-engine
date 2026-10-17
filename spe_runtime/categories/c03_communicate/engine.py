"""CAT:C03 legacy compatibility writer.

OWNERSHIP_CLASS = LEGACY_COMPATIBILITY
DOMAIN v2 production must use apply_domain_category.
This function directly commits envelope.rendering and is not a DOMAIN writer.
"""

from __future__ import annotations

from typing import Any, Mapping

from spe_runtime.categories._common import (
    certainty_rank,
    reject_forbidden_keys,
    replace_envelope,
)
from spe_runtime.categories.c03_communicate.validate import validate_c03_output
from spe_runtime.xcat.models import CrossCategoryEnvelope

CATEGORY_ID = "CAT:C03"
OWNERSHIP_CLASS = "LEGACY_COMPATIBILITY"
DOMAIN_PRODUCTION = False


def communicate(
    envelope: CrossCategoryEnvelope,
    *,
    rendering: Mapping[str, Any],
    **kwargs: Any,
) -> CrossCategoryEnvelope:
    """Produce an immutable envelope update owned by CAT:C03."""
    if kwargs:
        raise ValueError(
            f"C03 ownership violation: unexpected kwargs {sorted(kwargs)} "
            "(recommendation mutation not allowed)"
        )
    payload = dict(rendering)
    reject_forbidden_keys(payload, label="C03 rendering")

    if envelope.recommendation is not None:
        rec_c = envelope.recommendation.get("certainty")
        rend_c = payload.get("certainty")
        if rend_c is not None and certainty_rank(rend_c) > certainty_rank(rec_c):
            raise ValueError(
                "C03 cannot strengthen certainty CONDITIONAL→CERTAIN "
                f"(recommendation={rec_c!r}, rendering={rend_c!r})"
            )

    after = replace_envelope(
        envelope,
        rendering=payload,
        category_trace=envelope.category_trace + (CATEGORY_ID,),
    )
    if not validate_c03_output(envelope, after):
        raise ValueError("C03 ownership/validation failed")
    return after
