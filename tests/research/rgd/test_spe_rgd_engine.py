"""
Tests for SPE Ω PRO Unified Engine Orchestrator (RGD-1)
"""

import pytest
from spe_runtime.research.rgd.types import ResponseSpeedClass, NANOS_PER_USD
from spe_runtime.research.rgd.engine import SpeRgdEngine


def test_spe_rgd_engine_end_to_end_discovery():
    engine = SpeRgdEngine()
    prompt = "Invent a radically more efficient mobile audio codec with low latency."

    result = engine.execute_discovery(
        raw_prompt=prompt,
        speed_class=ResponseSpeedClass.EVIDENCE_ANSWER,
        budget_nanos=5_000_000_000,  # $5.00 USD
    )

    assert result.result_id.startswith("rgd_")
    assert result.mission.target_domain == "AUDIO_ENGINEERING"
    assert result.records_scanned >= 2
    assert len(result.structured_evidences) >= 2

    # Evidence Graph check
    assert len(result.evidence_graph.nodes) >= 2
    assert result.evidence_graph.contradiction_edges or result.evidence_graph.support_edges

    # Theories check
    assert len(result.competing_theories) == 3

    # Selected experiments check
    assert len(result.selected_experiments) >= 1
    assert result.total_cost_nanos <= 5_000_000_000

    # Verification Certificates check
    assert len(result.certificates) >= 2
    for cert in result.certificates:
        assert len(cert.sha256_seal) == 64
        # Truth conservation check: retracted papers must NOT be supported
        if "retracted" in cert.source_identity.lower() or "retracted" in cert.freshness_state.lower():
            assert cert.qualification.value != "SUPPORTED_WITHIN_TESTED_SCOPE"

    # Compounding check
    assert result.compounding_procedure_id is not None


def test_spe_rgd_engine_deep_research_job_dispatch():
    engine = SpeRgdEngine()
    prompt = "Biotechnology de novo antibody design with high binding specificity."

    result = engine.execute_discovery(
        raw_prompt=prompt,
        speed_class=ResponseSpeedClass.DEEP_DISCOVERY,
    )
    job = engine.start_deep_research_job(result.mission, target_total_words=50_000)

    assert job.mission_id == result.mission.mission_id
    assert job.target_total_words == 50_000
    assert len(job.sections) == 8
