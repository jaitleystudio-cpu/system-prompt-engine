"""CAT:C02 Research — may add facts + provenance + research uncertainty ONLY."""

from __future__ import annotations

from typing import Any, Mapping

from spe_runtime.categories._common import reject_forbidden_keys, replace_envelope
from spe_runtime.categories.c02_research.validate import validate_c02_output
from spe_runtime.xcat.models import CrossCategoryEnvelope

CATEGORY_ID = "CAT:C02"


def research(
    envelope: CrossCategoryEnvelope,
    *,
    facts: tuple[Mapping[str, Any], ...] = (),
    provenance: tuple[Mapping[str, Any], ...] = (),
    uncertainties: tuple[Mapping[str, Any], ...] = (),
    **kwargs: Any,
) -> CrossCategoryEnvelope:
    """Produce an immutable envelope update owned by CAT:C02."""
    if kwargs:
        raise ValueError(
            f"C02 ownership violation: unexpected kwargs {sorted(kwargs)} "
            "(analysis/recommendation/authority not allowed)"
        )
    for fact in facts:
        reject_forbidden_keys(fact, label="C02 fact")
        pids = fact.get("provenance_ids") or []
        if not pids:
            raise ValueError("C02 facts require provenance_ids (provenance)")
    for p in provenance:
        reject_forbidden_keys(p, label="C02 provenance")
    for u in uncertainties:
        reject_forbidden_keys(u, label="C02 uncertainty")

    known = {str(p["provenance_id"]) for p in envelope.provenance} | {
        str(p["provenance_id"]) for p in provenance if "provenance_id" in p
    }
    for fact in facts:
        pids = {str(p) for p in (fact.get("provenance_ids") or [])}
        if not pids <= known:
            raise ValueError("C02 facts require provenance (unknown provenance_id)")

    after = replace_envelope(
        envelope,
        facts=envelope.facts + tuple(dict(f) for f in facts),
        provenance=envelope.provenance + tuple(dict(p) for p in provenance),
        uncertainties=envelope.uncertainties + tuple(dict(u) for u in uncertainties),
        category_trace=envelope.category_trace + (CATEGORY_ID,),
    )
    if not validate_c02_output(envelope, after):
        raise ValueError("C02 ownership/validation failed")
    return after


def research_from_grounding(
    envelope: CrossCategoryEnvelope,
    bundle: Any,
) -> CrossCategoryEnvelope:
    """Apply a GroundingBundle through C02 ownership — no authority bypass.

    Conversion lives in the grounding compiler; this entry point only forwards
    the resulting facts/provenance/uncertainties into ``research`` so all C02
    invariants (provenance linkage, forbidden keys, authority freeze) still run.
    """
    # Local import keeps grounding optional for pure C02 call sites and avoids
    # an import cycle if grounding ever needs category helpers.
    from spe_runtime.grounding.compiler import (
        GroundingBundle,
        research_capsules_to_c02_inputs,
    )

    if not isinstance(bundle, GroundingBundle):
        raise TypeError("bundle must be a GroundingBundle")
    facts, provenance, uncertainties = research_capsules_to_c02_inputs(bundle)
    return research(
        envelope,
        facts=facts,
        provenance=provenance,
        uncertainties=uncertainties,
    )
