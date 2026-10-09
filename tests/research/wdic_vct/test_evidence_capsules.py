"""
Tests for Evidence Capsules (S-Capsules) in WDIC-VCT.
Verifies proactive open-science research retrieval, domain classification,
and compact prompt section generation.
"""

import pytest
from spe_runtime.research.wdic_vct.evidence_capsules import (
    EvidenceCapsule,
    EvidenceCapsuleRetriever,
)


def test_curated_bank_loaded():
    retriever = EvidenceCapsuleRetriever()
    assert "continuation" in retriever._curated_capsules
    assert "verification" in retriever._curated_capsules
    assert "offline_storage" in retriever._curated_capsules
    assert "security" in retriever._curated_capsules
    assert "concurrency" in retriever._curated_capsules


def test_domain_matching_heuristics():
    retriever = EvidenceCapsuleRetriever()

    # Offline storage / CRDT
    cap1 = retriever.fetch_solution_blueprint("Implement offline-first sync with SQLite")
    assert cap1.domain == "offline_storage"
    assert "CRDT" in cap1.paper_title or "Local-First" in cap1.paper_title

    # Concurrency / Vector clocks
    cap2 = retriever.fetch_solution_blueprint("Fix async race condition between background workers")
    assert cap2.domain == "concurrency"
    assert "Causal" in cap2.paper_title or "Distributed" in cap2.paper_title

    # Security / Auth
    cap3 = retriever.fetch_solution_blueprint("Restrict permission egress and validate auth tokens")
    assert cap3.domain == "security"
    assert "capability" in cap3.proven_architecture_pattern.lower() or "affine" in cap3.proven_architecture_pattern.lower()

    # Continuation
    cap4 = retriever.fetch_solution_blueprint("Reduce token costs for long continuation sessions")
    assert cap4.domain == "continuation"
    assert "Ledger" in cap4.paper_title


def test_capsule_prompt_section_format():
    retriever = EvidenceCapsuleRetriever()
    cap = retriever.fetch_solution_blueprint("verify unit test assertions")
    prompt_sec = cap.to_prompt_section()

    assert "EMPIRICAL RESEARCH BLUEPRINT" in prompt_sec
    assert cap.paper_title in prompt_sec
    assert cap.identifier in prompt_sec
    assert cap.proven_architecture_pattern in prompt_sec
    assert cap.failure_genome in prompt_sec
    assert cap.quantitative_metric in prompt_sec
    # Verify non-bloating length (under 1500 chars / ~300 tokens)
    assert len(prompt_sec) < 1500


def test_custom_capsule_synthesis():
    retriever = EvidenceCapsuleRetriever()
    custom = retriever.synthesize_custom_capsule(
        domain="quantum",
        paper_title="Fault-Tolerant Quantum State Verification",
        identifier="arXiv:2609.99999",
        pattern="Syndrome measurement stabilizer codes",
        failure="Decoherence during intermediate gate application",
        metric="Threshold error rate below 1e-4",
        provider="arXiv",
    )

    assert custom.capsule_id.startswith("SCAP-")
    assert custom.domain == "quantum"
    assert custom.source_provider == "arXiv"
    assert "Syndrome" in custom.to_prompt_section()
