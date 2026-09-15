"""CAT:C06 Analyze — may add analysis ONLY."""

from __future__ import annotations

from typing import Any, Mapping

from spe_runtime.categories._common import reject_forbidden_keys, replace_envelope
from spe_runtime.categories.c06_analyze.validate import validate_c06_output
from spe_runtime.xcat.models import CrossCategoryEnvelope

CATEGORY_ID = "CAT:C06"


def analyze(
    envelope: CrossCategoryEnvelope,
    *,
    analysis: Mapping[str, Any],
    **kwargs: Any,
) -> CrossCategoryEnvelope:
    """Produce an immutable envelope update owned by CAT:C06."""
    if kwargs:
        raise ValueError(
            f"C06 ownership violation: unexpected kwargs {sorted(kwargs)} "
            "(recommendation not allowed)"
        )
    payload = dict(analysis)
    reject_forbidden_keys(payload, label="C06 analysis")
    if "kind" not in payload:
        payload["kind"] = "analysis"

    after = replace_envelope(
        envelope,
        analysis=payload,
        category_trace=envelope.category_trace + (CATEGORY_ID,),
    )
    if not validate_c06_output(envelope, after):
        raise ValueError("C06 ownership/validation failed")
    return after
