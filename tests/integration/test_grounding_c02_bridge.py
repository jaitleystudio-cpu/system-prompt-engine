"""Grounding compiler → C02 research ownership bridge.

Capsules become C02 facts/provenance/uncertainties without bypassing C02
ownership or mutating authority_state.
"""

from __future__ import annotations

from dataclasses import replace

import pytest

from spe_runtime.categories.c02_research.engine import research, research_from_grounding
from spe_runtime.grounding.compiler import (
    GroundingBundle,
    compile_context,
    research_capsules_to_c02_inputs,
)
from spe_runtime.grounding.models import ContextCapsule
from spe_runtime.xcat.models import AuthorityState, CrossCategoryEnvelope, FailureRecord


@pytest.fixture
def base_envelope() -> CrossCategoryEnvelope:
    return CrossCategoryEnvelope(
        envelope_id="env-grounding-c02-001",
        goal_identity="goal-grounding-bridge",
        facts=(),
        provenance=(),
        uncertainties=(),
        hard_constraints=(
            {
                "constraint_id": "c1",
                "statement": "never invent facts",
                "strength": "HARD",
            },
        ),
        user_preferences=(),
        analysis=None,
        recommendation=None,
        rendering=None,
        authority_state=AuthorityState(level=0, status="NONE", grants=()),
        execution_grants=(),
        failures=(FailureRecord("f-unk", "UNKNOWN", "pending research"),),
        taint_labels=("external_untrusted",),
        sensitivity_labels=("PII_NONE",),
        category_trace=(),
    )


@pytest.fixture
def research_capsule() -> ContextCapsule:
    return ContextCapsule(
        capsule_id="cap-research-1",
        domain_id="research",
        context_type="SCHOLARLY_EVIDENCE",
        claim_or_observation="Blue light exposure in the evening can delay melatonin onset",
        value="Melatonin onset delayed under evening blue-enriched light in controlled studies",
        source_id="doi:10.1/example-blue-light",
        source_class="peer_reviewed",
        authority_class="REFERENCE",
        retrieved_at="2026-09-24T00:00:00Z",
        valid_as_of="2026-09-24T00:00:00Z",
        fresh_until=None,
        license="CC-BY-4.0",
        allowed_use="SUMMARIZE_WITH_ATTRIBUTION",
        confidence=0.9,
        support_status="SUPPORTED",
        contradiction_group=None,
        provenance_digest="sha256:blue-light-cap-1",
        taint_labels=("UNTRUSTED_SOURCE",),
        sensitivity_labels=(),
    )


def test_research_capsule_becomes_c02_fact_with_provenance(
    base_envelope, research_capsule
):
    bundle = compile_context("research task", (research_capsule,))
    assert isinstance(bundle, GroundingBundle)
    facts, provenance, uncertainties = research_capsules_to_c02_inputs(bundle)
    after = research(
        base_envelope,
        facts=facts,
        provenance=provenance,
        uncertainties=uncertainties,
    )
    assert after.facts[-1]["provenance_ids"]
    assert after.authority_state == base_envelope.authority_state
    # Provenance retained on the envelope and linked from the new fact.
    fact_pids = {str(p) for p in after.facts[-1]["provenance_ids"]}
    known = {str(p["provenance_id"]) for p in after.provenance}
    assert fact_pids <= known
    assert "CAT:C02" in after.category_trace


def test_research_from_grounding_preserves_authority(
    base_envelope, research_capsule
):
    bundle = compile_context("research task", (research_capsule,))
    after = research_from_grounding(base_envelope, bundle)
    assert after.facts[-1]["provenance_ids"]
    assert after.authority_state == base_envelope.authority_state
    assert after.execution_grants == base_envelope.execution_grants


def test_compile_context_rejects_authority_class_violation(research_capsule):
    hostile = replace(research_capsule, authority_class="EXECUTION_GRANT")
    with pytest.raises(ValueError, match="authority|firewall|DATA-only"):
        compile_context("research task", (hostile,))


def test_compile_context_rejects_missing_taint(research_capsule):
    untainted = replace(research_capsule, taint_labels=())
    with pytest.raises(ValueError, match="taint|UNTRUSTED_SOURCE|firewall"):
        compile_context("research task", (untainted,))


def test_uncertain_support_emits_c02_uncertainty(research_capsule):
    weak = replace(research_capsule, support_status="UNVERIFIED", capsule_id="cap-u")
    bundle = compile_context("research task", (weak,))
    _facts, _prov, uncertainties = research_capsules_to_c02_inputs(bundle)
    assert uncertainties
    assert uncertainties[0]["uncertainty_id"] == "u:cap-u"
