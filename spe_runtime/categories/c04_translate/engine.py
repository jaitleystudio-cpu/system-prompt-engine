"""CAT:C04 LanguageTransfer — specializes category_payload only."""

from __future__ import annotations

from typing import Any, Mapping

from spe_runtime.categories.apply import apply_category_payload
from spe_runtime.categories.c04_translate.validate import validate_translate_output
from spe_runtime.xcat.models import CrossCategoryEnvelope

CATEGORY_ID = "CAT:C04"


def translate(
    envelope: CrossCategoryEnvelope,
    *,
    payload: Mapping[str, Any],
    proof_obligation_proposals: tuple[Mapping[str, Any], ...] | list[Mapping[str, Any]] = (),
    **kwargs: Any,
) -> CrossCategoryEnvelope:
    """Produce an immutable envelope update owned by CAT:C04."""
    if kwargs:
        raise ValueError(
            f"C04 ownership violation: unexpected kwargs {sorted(kwargs)}"
        )
    after = apply_category_payload(
        envelope,
        CATEGORY_ID,
        payload,
        proof_obligation_proposals=proof_obligation_proposals,
    )
    if not validate_translate_output(envelope, after):
        raise ValueError("C04 ownership/validation failed")
    return after
