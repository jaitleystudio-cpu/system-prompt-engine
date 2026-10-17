"""
Tests for SPE Ω PRO Research Verification Certificates & Truth Conservation (RGD-1)
"""

import pytest
from spe_runtime.research.rgd.types import (
    EvidenceAccessLevel,
    EvidenceRelationship,
    ReproductionStatus,
    ResearchVerificationStatus,
    ScholarlyRecord,
    StructuredEvidence,
)
from spe_runtime.research.rgd.verification_certificate import (
    issue_verification_certificate,
    verify_certificate_integrity,
    prevent_self_assessment_promotion,
)


def test_certificate_sha256_seal_integrity():
    rec = ScholarlyRecord(
        record_id="rec_test_1",
        title="Sample Test Record",
        authors=["Author, A."],
        year=2025,
        doi="10.1000/182",
        venue="Test Venue",
        corpus_type="curated_core",
        access_level=EvidenceAccessLevel.FULL_TEXT,
        abstract="Test abstract",
        full_text_snippet="Detailed results: p < 0.001",
        quality_score=0.95,
    )
    ev = StructuredEvidence(
        evidence_id="ev_test_1",
        record_id=rec.record_id,
        research_question="Q1",
        hypothesis="H1",
        method="M1",
        population_or_material="P1",
        intervention_or_mechanism="I1",
        results="R1",
        statistical_evidence="p < 0.001",
        limitations="L1",
        reproducibility="Code available",
        provenance="DOI: 10.1000/182 | Section 1",
        scientific_relationship=EvidenceRelationship.SUPPORT,
        access_level=EvidenceAccessLevel.FULL_TEXT,
    )

    cert = issue_verification_certificate(
        claim="Tested algorithm achieves target efficiency",
        record=rec,
        evidence=ev,
        reproduction_state=ReproductionStatus.REPRODUCED,
    )

    assert cert.qualification == ResearchVerificationStatus.SUPPORTED_WITHIN_TESTED_SCOPE
    assert verify_certificate_integrity(cert) is True

    # Tampering check: altering claim must invalidate SHA-256 seal
    cert.claim = "Tampered claim without re-signing"
    assert verify_certificate_integrity(cert) is False


def test_truth_conservation_retraction_is_contradicted():
    rec = ScholarlyRecord(
        record_id="rec_retracted_1",
        title="Retracted Study",
        authors=["Fraud, X."],
        year=2024,
        doi="10.1000/retracted",
        venue="Fake Journal",
        corpus_type="withdrawn",
        access_level=EvidenceAccessLevel.ABSTRACT,
        is_retracted=True,
    )
    ev = StructuredEvidence(
        evidence_id="ev_retracted_1",
        record_id=rec.record_id,
        research_question="Q",
        hypothesis="H",
        method="M",
        population_or_material="P",
        intervention_or_mechanism="I",
        results="R",
        statistical_evidence="",
        limitations="",
        reproducibility="",
        provenance="DOI: 10.1000/retracted",
        scientific_relationship=EvidenceRelationship.UNKNOWN,
        access_level=EvidenceAccessLevel.ABSTRACT,
    )

    cert = issue_verification_certificate("Fake claim", rec, ev)
    assert cert.qualification == ResearchVerificationStatus.CONTRADICTED


def test_truth_conservation_metadata_only_is_not_verified():
    rec = ScholarlyRecord(
        record_id="rec_meta_1",
        title="Metadata Only Record",
        authors=["Author, B."],
        year=2026,
        doi="10.1000/meta",
        venue="Preprint",
        corpus_type="preprint",
        access_level=EvidenceAccessLevel.METADATA,
    )
    ev = StructuredEvidence(
        evidence_id="ev_meta_1",
        record_id=rec.record_id,
        research_question="Q",
        hypothesis="H",
        method="M",
        population_or_material="P",
        intervention_or_mechanism="I",
        results="R",
        statistical_evidence="",
        limitations="",
        reproducibility="",
        provenance="DOI: 10.1000/meta",
        scientific_relationship=EvidenceRelationship.UNKNOWN,
        access_level=EvidenceAccessLevel.METADATA,
    )

    cert = issue_verification_certificate("Preprint claim", rec, ev)
    assert cert.qualification == ResearchVerificationStatus.NOT_VERIFIED


def test_anti_self_promotion_blocks_unsupported_upgrade():
    rec = ScholarlyRecord(
        record_id="rec_meta_2",
        title="Unverified Study",
        authors=["Author, C."],
        year=2026,
        doi="10.1000/unverified",
        venue="arXiv",
        corpus_type="preprint",
        access_level=EvidenceAccessLevel.METADATA,
    )
    ev = StructuredEvidence(
        evidence_id="ev_meta_2",
        record_id=rec.record_id,
        research_question="Q",
        hypothesis="H",
        method="M",
        population_or_material="P",
        intervention_or_mechanism="I",
        results="R",
        statistical_evidence="",
        limitations="",
        reproducibility="",
        provenance="DOI: 10.1000/unverified",
        scientific_relationship=EvidenceRelationship.UNKNOWN,
        access_level=EvidenceAccessLevel.METADATA,
    )

    cert = issue_verification_certificate("Speculative claim", rec, ev)
    assert cert.qualification == ResearchVerificationStatus.NOT_VERIFIED

    # Attempt illegal promotion via self-assessment (no external replication)
    upgraded = prevent_self_assessment_promotion(
        cert,
        proposed_verdict=ResearchVerificationStatus.SUPPORTED_WITHIN_TESTED_SCOPE,
        has_external_reproduction_artifact=False,
    )

    # Must remain NOT_VERIFIED!
    assert upgraded.qualification == ResearchVerificationStatus.NOT_VERIFIED


def test_authentic_external_reproduction_promotes_and_reseals():
    rec = ScholarlyRecord(
        record_id="rec_meta_auth",
        title="Valid Paper Needing External Reproduction",
        authors=["Author, D."],
        year=2026,
        doi="10.1000/authentic",
        venue="Journal of Reproducible Science",
        corpus_type="curated_core",
        access_level=EvidenceAccessLevel.METADATA,
    )
    ev = StructuredEvidence(
        evidence_id="ev_meta_auth",
        record_id=rec.record_id,
        research_question="Q",
        hypothesis="H",
        method="M",
        population_or_material="P",
        intervention_or_mechanism="I",
        results="R",
        statistical_evidence="",
        limitations="",
        reproducibility="",
        provenance="DOI: 10.1000/authentic",
        scientific_relationship=EvidenceRelationship.SUPPORT,
        access_level=EvidenceAccessLevel.METADATA,
    )

    cert = issue_verification_certificate("Reproducible claim", rec, ev)
    assert cert.qualification == ResearchVerificationStatus.NOT_VERIFIED

    # Authentic external reproduction artifact provided
    promoted = prevent_self_assessment_promotion(
        cert,
        proposed_verdict=ResearchVerificationStatus.SUPPORTED_WITHIN_TESTED_SCOPE,
        has_external_reproduction_artifact=True,
    )

    assert promoted.qualification == ResearchVerificationStatus.SUPPORTED_WITHIN_TESTED_SCOPE
    assert promoted.reproduction_state == ReproductionStatus.REPRODUCED
    assert promoted.methodology_check is True
    assert promoted.statistical_check is True
    assert verify_certificate_integrity(promoted) is True


def test_retracted_and_contradicted_claims_cannot_be_promoted():
    rec_retracted = ScholarlyRecord(
        record_id="rec_ret_blocked",
        title="Retracted Fraud Study",
        authors=["Fraudster, F."],
        year=2023,
        doi="10.1000/fraud",
        venue="Withdrawn Journal",
        corpus_type="withdrawn",
        access_level=EvidenceAccessLevel.METADATA,
        is_retracted=True,
    )
    ev_retracted = StructuredEvidence(
        evidence_id="ev_ret_blocked",
        record_id=rec_retracted.record_id,
        research_question="Q",
        hypothesis="H",
        method="M",
        population_or_material="P",
        intervention_or_mechanism="I",
        results="R",
        statistical_evidence="",
        limitations="",
        reproducibility="",
        provenance="DOI: 10.1000/fraud",
        scientific_relationship=EvidenceRelationship.UNKNOWN,
        access_level=EvidenceAccessLevel.METADATA,
    )
    cert_retracted = issue_verification_certificate("Fraudulent claim", rec_retracted, ev_retracted)
    assert cert_retracted.qualification == ResearchVerificationStatus.CONTRADICTED

    # Even with an alleged artifact, retracted claim CANNOT be promoted
    attempt = prevent_self_assessment_promotion(
        cert_retracted,
        proposed_verdict=ResearchVerificationStatus.SUPPORTED_WITHIN_TESTED_SCOPE,
        has_external_reproduction_artifact=True,
    )
    assert attempt.qualification == ResearchVerificationStatus.CONTRADICTED
