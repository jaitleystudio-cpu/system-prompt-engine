"""
SPE Ω PRO — Research Verification Certificate (RVC) Generator & Truth Conservation
October 12, 2026 | Research Quarantine Track
"""

from __future__ import annotations
import hashlib
import json
import time
from typing import List, Optional
from spe_runtime.research.rgd.types import (
    EvidenceAccessLevel,
    EvidenceRelationship,
    ReproductionStatus,
    ResearchVerificationCertificate,
    ResearchVerificationStatus,
    ScholarlyRecord,
    StructuredEvidence,
)


def compute_certificate_seal(
    certificate_id: str,
    claim: str,
    source_identity: str,
    evidence_location: str,
    evidence_relationship: str,
    methodology_check: bool,
    statistical_check: bool,
    reproduction_state: str,
    contradictions: List[str],
    freshness_state: str,
    qualification: str,
) -> str:
    """
    Computes deterministic SHA-256 seal over canonical JSON certificate payload.
    """
    payload = {
        "certificate_id": certificate_id,
        "claim": claim.strip(),
        "contradictions": sorted(contradictions),
        "evidence_location": evidence_location.strip(),
        "evidence_relationship": evidence_relationship,
        "freshness_state": freshness_state,
        "methodology_check": methodology_check,
        "qualification": qualification,
        "reproduction_state": reproduction_state,
        "source_identity": source_identity.strip(),
        "statistical_check": statistical_check,
    }
    canonical_bytes = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(canonical_bytes).hexdigest()


def issue_verification_certificate(
    claim: str,
    record: ScholarlyRecord,
    evidence: StructuredEvidence,
    reproduction_state: ReproductionStatus = ReproductionStatus.UNTESTED,
    contradictions: Optional[List[str]] = None,
    methodology_check: Optional[bool] = None,
    statistical_check: Optional[bool] = None,
) -> ResearchVerificationCertificate:
    """
    Issues an immutable Research Verification Certificate (RVC).
    Enforces the Law of Truth Conservation:
    Never promotes NOT_VERIFIED to SUPPORTED through self-assessment or absence of evidence.
    """
    contradiction_list = contradictions or []
    certificate_id = f"rvc_{hashlib.sha256((claim + record.doi).encode('utf-8')).hexdigest()[:12]}"

    # Default methodology & statistical checks if not supplied
    if methodology_check is None:
        # Full text with quality > 0.85 passes methodology check
        methodology_check = (evidence.access_level == EvidenceAccessLevel.FULL_TEXT and record.quality_score >= 0.85)

    if statistical_check is None:
        # Full text with explicit statistical evidence passes
        statistical_check = (evidence.access_level == EvidenceAccessLevel.FULL_TEXT and bool(evidence.statistical_evidence))

    freshness_state = "VERIFIED_RETRACTED" if record.is_retracted else f"ACTIVE_INDEXED_{record.year}"

    # TRUTH CONSERVATION GATES:
    if record.is_retracted:
        qualification = ResearchVerificationStatus.CONTRADICTED
    elif reproduction_state == ReproductionStatus.FAILED:
        qualification = ResearchVerificationStatus.CONTRADICTED
    elif evidence.access_level == EvidenceAccessLevel.METADATA:
        # Metadata alone cannot substantiate empirical claims
        qualification = ResearchVerificationStatus.NOT_VERIFIED
    elif not methodology_check or not statistical_check:
        qualification = ResearchVerificationStatus.INCONCLUSIVE
    elif contradiction_list and reproduction_state == ReproductionStatus.UNTESTED:
        # Unresolved contradictions without independent reproduction
        qualification = ResearchVerificationStatus.INCONCLUSIVE
    elif reproduction_state == ReproductionStatus.REPRODUCED:
        qualification = ResearchVerificationStatus.SUPPORTED_WITHIN_TESTED_SCOPE
    elif evidence.access_level == EvidenceAccessLevel.FULL_TEXT and record.quality_score >= 0.90 and not contradiction_list:
        qualification = ResearchVerificationStatus.SUPPORTED_WITHIN_TESTED_SCOPE
    else:
        qualification = ResearchVerificationStatus.NOT_VERIFIED

    seal = compute_certificate_seal(
        certificate_id=certificate_id,
        claim=claim,
        source_identity=record.doi,
        evidence_location=evidence.provenance,
        evidence_relationship=evidence.scientific_relationship.value,
        methodology_check=methodology_check,
        statistical_check=statistical_check,
        reproduction_state=reproduction_state.value,
        contradictions=contradiction_list,
        freshness_state=freshness_state,
        qualification=qualification.value,
    )

    return ResearchVerificationCertificate(
        certificate_id=certificate_id,
        claim=claim,
        source_identity=record.doi,
        evidence_location=evidence.provenance,
        evidence_relationship=evidence.scientific_relationship,
        methodology_check=methodology_check,
        statistical_check=statistical_check,
        reproduction_state=reproduction_state,
        contradictions=contradiction_list,
        freshness_state=freshness_state,
        qualification=qualification,
        sha256_seal=seal,
        timestamp=time.time(),
    )


def verify_certificate_integrity(cert: ResearchVerificationCertificate) -> bool:
    """
    Verifies that the SHA-256 cryptographic seal is valid and matches the certificate data.
    Also asserts that no invalid promotion from NOT_VERIFIED has occurred.
    """
    expected_seal = compute_certificate_seal(
        certificate_id=cert.certificate_id,
        claim=cert.claim,
        source_identity=cert.source_identity,
        evidence_location=cert.evidence_location,
        evidence_relationship=cert.evidence_relationship.value,
        methodology_check=cert.methodology_check,
        statistical_check=cert.statistical_check,
        reproduction_state=cert.reproduction_state.value,
        contradictions=cert.contradictions,
        freshness_state=cert.freshness_state,
        qualification=cert.qualification.value,
    )
    if cert.sha256_seal != expected_seal:
        return False

    # Check truth conservation invariant
    if cert.qualification == ResearchVerificationStatus.SUPPORTED_WITHIN_TESTED_SCOPE:
        if cert.reproduction_state == ReproductionStatus.FAILED:
            return False
        if not cert.methodology_check or not cert.statistical_check:
            return False
        if cert.freshness_state.startswith("VERIFIED_RETRACTED"):
            return False

    return True


def prevent_self_assessment_promotion(
    existing_cert: ResearchVerificationCertificate,
    proposed_verdict: ResearchVerificationStatus,
    has_external_reproduction_artifact: bool,
) -> ResearchVerificationCertificate:
    """
    Explicitly blocks any model or self-assessment loop from promoting an unverified claim
    unless an authentic external replication/proof witness is provided.
    If authentic external replication artifact is provided and the claim is not retracted/contradicted,
    issues an upgraded certificate with SUPPORTED_WITHIN_TESTED_SCOPE, REPRODUCED, and a fresh SHA-256 seal.
    """
    # Retracted or contradicted claims CANNOT be promoted
    if existing_cert.freshness_state.startswith("VERIFIED_RETRACTED") or existing_cert.qualification == ResearchVerificationStatus.CONTRADICTED:
        return existing_cert

    if existing_cert.qualification in (
        ResearchVerificationStatus.NOT_VERIFIED,
        ResearchVerificationStatus.INCONCLUSIVE,
    ) and proposed_verdict == ResearchVerificationStatus.SUPPORTED_WITHIN_TESTED_SCOPE:
        if not has_external_reproduction_artifact:
            # Illegal self-promotion rejected!
            return existing_cert

        # Authentic external reproduction artifact provided: promote and reseal!
        new_reproduction = ReproductionStatus.REPRODUCED
        new_qualification = ResearchVerificationStatus.SUPPORTED_WITHIN_TESTED_SCOPE
        new_seal = compute_certificate_seal(
            certificate_id=existing_cert.certificate_id,
            claim=existing_cert.claim,
            source_identity=existing_cert.source_identity,
            evidence_location=existing_cert.evidence_location,
            evidence_relationship=existing_cert.evidence_relationship.value,
            methodology_check=True,
            statistical_check=True,
            reproduction_state=new_reproduction.value,
            contradictions=existing_cert.contradictions,
            freshness_state=existing_cert.freshness_state,
            qualification=new_qualification.value,
        )
        return ResearchVerificationCertificate(
            certificate_id=existing_cert.certificate_id,
            claim=existing_cert.claim,
            source_identity=existing_cert.source_identity,
            evidence_location=existing_cert.evidence_location,
            evidence_relationship=existing_cert.evidence_relationship,
            methodology_check=True,
            statistical_check=True,
            reproduction_state=new_reproduction,
            contradictions=existing_cert.contradictions,
            freshness_state=existing_cert.freshness_state,
            qualification=new_qualification,
            sha256_seal=new_seal,
            timestamp=time.time(),
        )

    return existing_cert
