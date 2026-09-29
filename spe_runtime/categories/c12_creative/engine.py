"""CAT:C12 Creative — specializes category_payload only."""

from __future__ import annotations

from typing import Any, Mapping

from spe_runtime.categories.apply import apply_category_payload
from spe_runtime.categories.c12_creative.validate import validate_creative_output
from spe_runtime.xcat.models import CrossCategoryEnvelope

CATEGORY_ID = "CAT:C12"


def creative(
    envelope: CrossCategoryEnvelope,
    *,
    payload: Mapping[str, Any],
    proof_obligation_proposals: tuple[Mapping[str, Any], ...] | list[Mapping[str, Any]] = (),
    **kwargs: Any,
) -> CrossCategoryEnvelope:
    """Produce an immutable envelope update owned by CAT:C12."""
    if kwargs:
        raise ValueError(
            f"C12 ownership violation: unexpected kwargs {sorted(kwargs)}"
        )
    after = apply_category_payload(
        envelope,
        CATEGORY_ID,
        payload,
        proof_obligation_proposals=proof_obligation_proposals,
    )
    if not validate_creative_output(envelope, after):
        raise ValueError("C12 ownership/validation failed")
    return after
