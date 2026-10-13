"""
Unit & Adversarial Tests for Intelligence I: Scientific Knowledge Reconstruction
"""

import pytest
from spe_runtime.research.agi_brain.types import ScientificObjective, DomainType
from spe_runtime.research.agi_brain.knowledge_reconstruction import KnowledgeReconstructionEngine

def test_empirical_vs_citation_chain_separation():
    engine = KnowledgeReconstructionEngine()
    objective = ScientificObjective(
        objective_id="obj-01",
        description="Investigate high-efficiency thermoelectric materials",
        domain=DomainType.MATERIALS_SCIENCE,
        frozen_intent="Discover zT > 3.0 material composition",
    )

    raw_claims = [
        {
            "statement": "Bi2Te3 exhibits zT=1.1 at 300K via direct laser-flash measurement.",
            "direct_measurement": True,
            "citation_hops": 0,
        },
        {
            "statement": "Skutterudites are widely reported to reach zT=1.7.",
            "direct_measurement": False,
            "citation_hops": 3,
        },
        {
            "statement": "Phonon scattering follows Callaway lattice model.",
            "is_assumption": True,
        },
    ]

    state = engine.reconstruct(objective, raw_claims)
    assert len(state.direct_evidence_claims) == 1
    assert "Bi2Te3" in state.direct_evidence_claims[0]
    assert len(state.citation_chain_claims) == 2
    assert "Skutterudites" in state.citation_chain_claims[0]
    assert len(state.theoretical_assumptions) == 1
    assert "Callaway" in state.theoretical_assumptions[0]

def test_divergent_prediction_detection():
    engine = KnowledgeReconstructionEngine()
    objective = ScientificObjective(
        objective_id="obj-02",
        description="Compare competing models of high-Tc superconductivity",
        domain=DomainType.PHYSICS,
        frozen_intent="Identify pairing mechanism",
    )

    raw_claims = [
        {
            "theory_id": "Theory_A_SpinFluctuation",
            "condition": "Underdoped YBCO at 150K",
            "predicted_outcome": "D-wave pairing symmetry",
        },
        {
            "theory_id": "Theory_B_PhononMediated",
            "condition": "Underdoped YBCO at 150K",
            "predicted_outcome": "S-wave pairing symmetry",
        },
    ]

    state = engine.reconstruct(objective, raw_claims)
    assert len(state.divergent_predictions) == 1
    div = state.divergent_predictions[0]
    assert div["condition"] == "Underdoped YBCO at 150K"
    assert div["prediction_a"] == "D-wave pairing symmetry"
    assert div["prediction_b"] == "S-wave pairing symmetry"
    assert len(state.unresolved_gaps) >= 1
    assert "Divergence under condition" in state.unresolved_gaps[0]
