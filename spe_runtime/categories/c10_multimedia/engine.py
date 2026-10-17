"""CAT:C10 Multimedia — specializes category_payload only."""

from __future__ import annotations

from typing import Any, Mapping

from spe_runtime.categories.apply import apply_category_payload
from spe_runtime.categories.c10_multimedia.validate import validate_multimedia_output
from spe_runtime.xcat.models import CrossCategoryEnvelope

CATEGORY_ID = "CAT:C10"


def multimedia(
    envelope: CrossCategoryEnvelope,
    *,
    payload: Mapping[str, Any],
    proof_obligation_proposals: tuple[Mapping[str, Any], ...] | list[Mapping[str, Any]] = (),
    **kwargs: Any,
) -> CrossCategoryEnvelope:
    """Produce an immutable envelope update owned by CAT:C10."""
    if kwargs:
        raise ValueError(
            f"C10 ownership violation: unexpected kwargs {sorted(kwargs)}"
        )
    after = apply_category_payload(
        envelope,
        CATEGORY_ID,
        payload,
        proof_obligation_proposals=proof_obligation_proposals,
    )
    if not validate_multimedia_output(envelope, after):
        raise ValueError("C10 ownership/validation failed")
    return after
