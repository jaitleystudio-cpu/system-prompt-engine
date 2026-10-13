"""
Unit & Adversarial Tests for DeepWriter 100,000-Word Hierarchical Generator
"""

import pytest
from spe_runtime.research.agi_brain.types import ProvenanceType
from spe_runtime.research.agi_brain.long_horizon_writer import LongHorizonWriterEngine

def test_hierarchical_planning_and_compilation():
    writer = LongHorizonWriterEngine()
    chapters = [
        "Chapter 1: Foundational Theoretical Framework",
        "Chapter 2: Computational World Modeling",
        "Chapter 3: Empirical Experiments and Verification",
        "Chapter 4: Scalable Applications & Open Challenges",
    ]

    doc = writer.plan_document(
        title="Comprehensive Treatise on Autonomous Scientific Intelligence",
        target_words=100_000,
        chapter_titles=chapters,
        sections_per_chapter=4,
    )

    assert doc.target_word_count == 100_000
    assert len(doc.chapters) == 4
    for ch in doc.chapters:
        assert len(ch.sections) == 4
        for sec in ch.sections:
            assert sec.target_words == 6_250

    # Generate section content with claim provenance
    sec_1 = doc.chapters[0].sections[0]
    writer.attach_claim(
        section=sec_1,
        claim_id="cl-01",
        statement="Thermodynamic entropy bounds information processing.",
        provenance=ProvenanceType.CITED_PEER_REVIEWED,
        evidence_ref="Landauer (1961)",
    )
    writer.generate_section_content(sec_1, content_template="Detailed derivation of Landauer limit.")

    result = writer.compile_final_document(doc)
    assert result["doc_id"] == doc.doc_id
    assert result["is_consistent"] is True
    assert "Landauer (1961)" in result["manuscript"]
    assert "[CITED_PEER_REVIEWED: Landauer (1961)]" in result["manuscript"]

def test_blocks_false_claim_of_experimental_proof():
    writer = LongHorizonWriterEngine()
    doc = writer.plan_document(
        title="Proposed Quantum Engine",
        target_words=10_000,
        chapter_titles=["Architecture"],
        sections_per_chapter=1,
    )

    sec = doc.chapters[0].sections[0]
    # Attempting to declare an unexecuted proposed experiment as "experimentally proven"
    writer.attach_claim(
        section=sec,
        claim_id="cl-fake-01",
        statement="Our device is experimentally proven to violate Carnot efficiency.",
        provenance=ProvenanceType.PROPOSED_UNEXECUTED,
        evidence_ref="Hypothetical run",
    )

    is_consistent = writer.check_consistency(doc)
    assert is_consistent is False
    assert doc.is_consistent is False
