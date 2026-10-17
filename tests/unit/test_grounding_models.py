from dataclasses import FrozenInstanceError
import pytest
from spe_runtime.grounding.models import ContextNeed, ContextCapsule


def test_context_need_is_immutable_and_deterministic():
    need = ContextNeed(
        need_id="need-1",
        domain_tags=("research",),
        context_types=("SCHOLARLY_EVIDENCE",),
        freshness_required=True,
        risk_level="HIGH",
        privacy_class="PRIVATE",
        query_minimization_required=True,
        required_source_classes=("peer_reviewed",),
        optional_source_classes=("preprint",),
        max_sources=12,
        max_context_bytes=65536,
        abstain_if_missing=True,
        reason_codes=("CURRENT_EVIDENCE_REQUIRED",),
    )
    assert need.to_dict()["need_id"] == "need-1"
    with pytest.raises(FrozenInstanceError):
        need.max_sources = 20


def test_context_capsule_keeps_provenance_and_taint():
    capsule = ContextCapsule(
        capsule_id="cap-1",
        domain_id="research",
        context_type="SCHOLARLY_EVIDENCE",
        claim_or_observation="Finding",
        value="Result",
        source_id="doi:10.1/example",
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
        provenance_digest="sha256:abc",
        taint_labels=("UNTRUSTED_SOURCE",),
        sensitivity_labels=(),
    )
    assert "UNTRUSTED_SOURCE" in capsule.to_dict()["taint_labels"]
