"""CAT:C09 Code — specializes category_payload only."""

from __future__ import annotations

from typing import Any, Mapping

from spe_runtime.categories.apply import apply_category_payload
from spe_runtime.categories.c09_code.validate import validate_code_output
from spe_runtime.xcat.models import CrossCategoryEnvelope

CATEGORY_ID = "CAT:C09"


def code(
    envelope: CrossCategoryEnvelope,
    *,
    payload: Mapping[str, Any],
    proof_obligation_proposals: tuple[Mapping[str, Any], ...] | list[Mapping[str, Any]] = (),
    **kwargs: Any,
) -> CrossCategoryEnvelope:
    """Produce an immutable envelope update owned by CAT:C09."""
    if kwargs:
        raise ValueError(
            f"C09 ownership violation: unexpected kwargs {sorted(kwargs)}"
        )
    after = apply_category_payload(
        envelope,
        CATEGORY_ID,
        payload,
        proof_obligation_proposals=proof_obligation_proposals,
    )
    if not validate_code_output(envelope, after):
        raise ValueError("C09 ownership/validation failed")
    return after
