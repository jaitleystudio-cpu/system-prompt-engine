"""
Tests for SPE Ω PRO Persistent 100k-Word Deep Research Job Coordinator (RGD-1)
"""

import pytest
from spe_runtime.research.rgd.types import ResearchMission, ResponseSpeedClass
from spe_runtime.research.rgd.deep_research_job import (
    create_deep_research_job,
    checkpoint_section,
    verify_cross_chapter_consistency,
    assemble_final_manuscript,
)


def test_deep_research_job_initialization():
    mission = ResearchMission(
        mission_id="m_100k",
        objective="Ultra-Low Bitrate Neural Audio Compression Monograph",
        target_domain="AUDIO_ENGINEERING",
        measurable_constraints=["MOS >= 4.0", "Latency <= 20ms"],
        unresolved_assumptions=["Mobile NPU capability"],
        compiled_prompt="",
        execution_plan=[],
        speed_class=ResponseSpeedClass.DEEP_DISCOVERY,
        created_at=0.0,
    )

    job = create_deep_research_job(mission, target_total_words=100_000)

    assert job.job_id.startswith("job_")
    assert job.target_total_words == 100_000
    assert len(job.sections) == 8
    assert sum(s.target_word_count for s in job.sections) == 100_000
    assert "U(e)" in job.global_symbol_registry
    assert job.is_completed is False


def test_checkpointing_and_symbol_conflict_detection():
    mission = ResearchMission(
        mission_id="m_100k_2",
        objective="Test Monograph",
        target_domain="AUDIO_ENGINEERING",
        measurable_constraints=[],
        unresolved_assumptions=[],
        compiled_prompt="",
        execution_plan=[],
        speed_class=ResponseSpeedClass.DEEP_DISCOVERY,
        created_at=0.0,
    )
    job = create_deep_research_job(mission, target_total_words=10_000)

    # Checkpoint chapter 1
    content_ch1 = "Chapter 1 text with twenty words to test words count aggregation across chapters in deep research coordinator module."
    ok, msg = checkpoint_section(
        job,
        chapter_index=1,
        content=content_ch1,
        symbols={"Bitrate_R": "Transmission bit rate in kbps"},
        dois=["10.1109/TASLP.2024.330192"],
    )
    assert ok is True
    assert job.sections[0].is_checkpointed is True
    assert job.sections[0].generated_word_count == 18
    assert "10.1109/TASLP.2024.330192" in job.global_reference_registry

    # Conflict check: defining conflicting description for existing symbol
    conflict_ok, conflict_msg = checkpoint_section(
        job,
        chapter_index=2,
        content="Conflicting chapter content",
        symbols={"Bitrate_R": "Conflicting definition: sampling clock frequency in Hz"},
    )
    assert conflict_ok is False
    assert "Symbol conflict" in conflict_msg
    # Crucial pre-flight invariant: failed section remains completely untouched
    assert job.sections[1].is_checkpointed is False
    assert job.sections[1].content == ""
    assert job.sections[1].generated_word_count == 0
    assert job.global_symbol_registry["Bitrate_R"] == "Transmission bit rate in kbps"


def test_cross_chapter_consistency_and_assembly():
    mission = ResearchMission(
        mission_id="m_100k_3",
        objective="Test Monograph 3",
        target_domain="GENERAL_SCIENCE",
        measurable_constraints=[],
        unresolved_assumptions=[],
        compiled_prompt="",
        execution_plan=[],
        speed_class=ResponseSpeedClass.DEEP_DISCOVERY,
        created_at=0.0,
    )
    # Target 800 words for test
    job = create_deep_research_job(mission, target_total_words=800)

    # Checkpoint all 8 sections
    for i in range(1, 9):
        # 100 words per section = 800 words
        dummy_content = " ".join([f"Word_{i}_{k}" for k in range(100)])
        ok, _ = checkpoint_section(
            job,
            chapter_index=i,
            content=dummy_content,
            dois=[f"10.1000/doi_{i}"],
        )
        assert ok is True

    verified, issues = verify_cross_chapter_consistency(job)
    assert verified is True
    assert len(issues) == 0
    assert job.is_completed is True
    assert job.final_word_count == 800

    manuscript = assemble_final_manuscript(job)
    assert "TABLE OF CONTENTS" in manuscript
    assert "CHAPTER 1:" in manuscript
    assert "CHAPTER 8:" in manuscript
    assert "MASTER BIBLIOGRAPHY" in manuscript
    assert "10.1000/doi_1" in manuscript
