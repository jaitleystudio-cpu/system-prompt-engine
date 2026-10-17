"""
Tests for SPE Ω PRO Global Knowledge Reconstruction & 400M+ Scholarly Interface
"""

import pytest
from spe_runtime.research.rgd.types import (
    EvidenceAccessLevel,
    EvidenceRelationship,
    ScholarlyRecord,
)
from spe_runtime.research.rgd.knowledge_reconstruction import (
    DOCUMENTED_CURATED_CORE_COUNT,
    DOCUMENTED_EXPANSION_COUNT,
    DOCUMENTED_TOTAL_CATALOG_COUNT,
    DOCUMENTED_CACHED_FULL_TEXT_COUNT,
    ScholarlyCatalogInterface,
    extract_structured_evidence,
    build_evidence_graph,
)


def test_catalog_corpus_scale_invariants():
    """Verify that catalog documentation maintains exact OpenAlex scale boundaries."""
    assert DOCUMENTED_CURATED_CORE_COUNT == 320_000_000
    assert DOCUMENTED_EXPANSION_COUNT == 190_000_000
    assert DOCUMENTED_TOTAL_CATALOG_COUNT == 510_000_000
    assert DOCUMENTED_CACHED_FULL_TEXT_COUNT == 50_000_000
    # Crucial invariant: full text is significantly smaller than full catalog
    assert DOCUMENTED_CACHED_FULL_TEXT_COUNT < DOCUMENTED_TOTAL_CATALOG_COUNT


def test_catalog_search_and_retraction_filter():
    catalog = ScholarlyCatalogInterface()

    # Search with retractions excluded (default)
    records = catalog.search("audio", exclude_retracted=True)
    assert len(records) >= 2
    for r in records:
        assert not r.is_retracted

    # Search including retracted papers
    all_audio = catalog.search("audio", exclude_retracted=False)
    has_retracted = any(r.is_retracted for r in all_audio)
    assert has_retracted


def test_three_access_levels_extraction_fidelity():
    catalog = ScholarlyCatalogInterface()

    # 1. Full text record
    rec_full = catalog.get_by_id("rec_audio_01")
    assert rec_full.access_level == EvidenceAccessLevel.FULL_TEXT
    ev_full = extract_structured_evidence(rec_full)
    assert ev_full.access_level == EvidenceAccessLevel.FULL_TEXT
    assert "MUSHRA" in ev_full.statistical_evidence
    assert "github.com" in ev_full.reproducibility or "weights" in ev_full.reproducibility

    # 2. Abstract record
    rec_abs = catalog.get_by_id("rec_audio_02")
    assert rec_abs.access_level == EvidenceAccessLevel.ABSTRACT
    ev_abs = extract_structured_evidence(rec_abs)
    assert ev_abs.access_level == EvidenceAccessLevel.ABSTRACT
    assert "Abstract lacks full control-group breakdown" in ev_abs.limitations
    assert ev_abs.scientific_relationship == EvidenceRelationship.CONTRADICTION

    # 3. Metadata record
    rec_meta = catalog.get_by_id("rec_audio_04")
    assert rec_meta.access_level == EvidenceAccessLevel.METADATA
    ev_meta = extract_structured_evidence(rec_meta)
    assert ev_meta.access_level == EvidenceAccessLevel.METADATA
    assert "unavailable without text access" in ev_meta.results
    assert ev_meta.scientific_relationship == EvidenceRelationship.UNKNOWN


def test_11_field_structured_evidence_schema():
    catalog = ScholarlyCatalogInterface()
    rec = catalog.get_by_id("rec_bio_01")
    ev = extract_structured_evidence(rec)

    # 1. Research Question
    assert ev.research_question
    # 2. Hypothesis
    assert ev.hypothesis
    # 3. Method
    assert ev.method
    # 4. Population or Material
    assert ev.population_or_material
    # 5. Intervention or Mechanism
    assert ev.intervention_or_mechanism
    # 6. Results
    assert ev.results
    # 7. Statistical Evidence
    assert "0.42 nM" in ev.statistical_evidence
    # 8. Limitations
    assert ev.limitations
    # 9. Reproducibility
    assert "PDB" in ev.reproducibility or "reproducible" in ev.reproducibility
    # 10. Provenance
    assert rec.doi in ev.provenance
    # 11. Scientific Relationship
    assert ev.scientific_relationship in (
        EvidenceRelationship.SUPPORT,
        EvidenceRelationship.CONTRADICTION,
        EvidenceRelationship.UNKNOWN,
    )


def test_evidence_graph_contradiction_and_support_mapping():
    catalog = ScholarlyCatalogInterface()
    rec1 = catalog.get_by_id("rec_audio_01")  # claims high quality (SUPPORT)
    rec2 = catalog.get_by_id("rec_audio_02")  # claims severe distortion (CONTRADICTION)

    ev1 = extract_structured_evidence(rec1)
    ev2 = extract_structured_evidence(rec2)

    graph = build_evidence_graph([ev1, ev2])

    assert len(graph.nodes) == 2
    assert len(graph.contradiction_edges) == 1
    assert "Contradiction" in graph.contradiction_edges[0]["note"]
    assert len(graph.unresolved_uncertainties) >= 1


def test_domain_search_separation_and_stop_words():
    catalog = ScholarlyCatalogInterface()

    # Query with stop-words and domain filter
    mat_records = catalog.search(
        "develop a battery with high energy density",
        domain="MATERIALS_SCIENCE",
        exclude_retracted=True,
    )
    assert len(mat_records) >= 1
    for r in mat_records:
        assert r.domain == "MATERIALS_SCIENCE"
        assert "audio" not in r.domain.lower()

    # Cryptography domain search
    crypto_records = catalog.search(
        "constant time signature verification",
        domain="CRYPTOGRAPHY",
        exclude_retracted=True,
    )
    assert len(crypto_records) >= 1
    for r in crypto_records:
        assert r.domain == "CRYPTOGRAPHY"


def test_domain_grounded_structured_extraction():
    catalog = ScholarlyCatalogInterface()

    # 1. Biology record must NOT have audio statistics or audio limitations
    rec_bio = catalog.get_by_id("rec_bio_01")
    ev_bio = extract_structured_evidence(rec_bio)
    assert "MUSHRA" not in ev_bio.statistical_evidence
    assert "acoustic noise" not in ev_bio.limitations
    assert "0.42 nM" in ev_bio.statistical_evidence
    assert "in-vivo clearance" in ev_bio.limitations

    # 2. Materials science record must have battery statistics and cycling limitations
    rec_mat = catalog.get_by_id("rec_mat_01")
    ev_mat = extract_structured_evidence(rec_mat)
    assert "Wh/L" in ev_mat.statistical_evidence
    assert "dendrite" in ev_mat.limitations
    assert ev_mat.scientific_relationship == EvidenceRelationship.SUPPORT

    # 3. Cryptography record must have latency and side-channel statistics
    rec_crypto = catalog.get_by_id("rec_crypto_01")
    ev_crypto = extract_structured_evidence(rec_crypto)
    assert "latency" in ev_crypto.statistical_evidence.lower()
    assert "constant-time" in ev_crypto.limitations.lower()
    assert ev_crypto.scientific_relationship == EvidenceRelationship.SUPPORT
