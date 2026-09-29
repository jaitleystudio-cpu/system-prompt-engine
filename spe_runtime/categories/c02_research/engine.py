"""CAT:C02 legacy direct writer plus DOMAIN grounding proposal.

``research`` is LEGACY_COMPATIBILITY: it appends canonical facts, provenance,
and uncertainties. DOMAIN v2 production must not call it.

``research_from_grounding`` is the DOMAIN bridge: it proposes a
ResearchProjectIR payload and epistemic candidates. It does not commit
canonical epistemic state. Commit fails closed — no epistemic owner service
exists in this runtime.
"""

from __future__ import annotations

from typing import Any, Mapping

from spe_runtime.categories._common import reject_forbidden_keys, replace_envelope
from spe_runtime.categories.c02_research.validate import validate_c02_output
from spe_runtime.xcat.models import CrossCategoryEnvelope

CATEGORY_ID = "CAT:C02"
OWNERSHIP_CLASS = "LEGACY_COMPATIBILITY"
DOMAIN_PRODUCTION = False


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
    """Propose C02 research payload from grounding. Do not commit epistemic state.

    grounding → ResearchProjectIR + epistemic proposal
    not grounding → canonical facts/provenance/uncertainty writer.
    """
    from spe_runtime.categories.domain import apply_domain_category
    from spe_runtime.grounding.compiler import (
        GroundingBundle,
        research_capsules_to_c02_inputs,
    )

    if not isinstance(bundle, GroundingBundle):
        raise TypeError("bundle must be a GroundingBundle")
    facts, provenance, uncertainties = research_capsules_to_c02_inputs(bundle)
    source_classes = sorted(
        {
            str(item.get("source_class"))
            for item in provenance
            if item.get("source_class")
        }
    )
    payload = {
        "question": str(bundle.request_text),
        "search_strategy": "grounding_capsules",
        "source_classes": source_classes,
        "freshness": "UNCOMMITTED",
        "contradiction_map": [],
        "gaps": ["EPISTEMIC_COMMIT_UNAVAILABLE"],
        "synthesis": "PROPOSAL_ONLY",
    }
    proposals = (
        {
            "proposal_kind": "EPISTEMIC_CANDIDATE",
            "facts": [dict(item) for item in facts],
            "provenance": [dict(item) for item in provenance],
            "uncertainties": [dict(item) for item in uncertainties],
            "commit": "NOT_COMMITTED",
        },
    )
    after = apply_domain_category(
        envelope,
        CATEGORY_ID,
        payload,
        proof_obligation_proposals=proposals,
    )
    if after.facts != envelope.facts or after.provenance != envelope.provenance:
        raise ValueError("C02 DOMAIN path must not commit canonical epistemic state")
    if after.uncertainties != envelope.uncertainties:
        raise ValueError("C02 DOMAIN path must not commit canonical uncertainty")
    return after


def commit_epistemic_proposal(
    envelope: CrossCategoryEnvelope,
    proposal: Mapping[str, Any],
) -> CrossCategoryEnvelope:
    """Fail closed. No epistemic owner commit service is available."""
    _ = envelope, proposal
    raise ValueError(
        "EPISTEMIC_OWNER_UNAVAILABLE: category cannot commit canonical "
        "facts, provenance, or uncertainty"
    )
