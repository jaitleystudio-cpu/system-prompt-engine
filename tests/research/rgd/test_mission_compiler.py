"""
Tests for SPE Ω PRO Mission Compiler (RGD-1)
"""

import pytest
from spe_runtime.research.rgd.types import ResponseSpeedClass
from spe_runtime.research.rgd.mission_compiler import compile_research_mission


def test_mission_compiler_audio_codec():
    user_request = "Invent a radically more efficient mobile audio codec with low latency."
    mission = compile_research_mission(user_request, speed_class=ResponseSpeedClass.EVIDENCE_ANSWER)

    assert mission.mission_id.startswith("mission_")
    assert mission.target_domain == "AUDIO_ENGINEERING"
    assert mission.speed_class == ResponseSpeedClass.EVIDENCE_ANSWER
    assert any("latency" in c.lower() for c in mission.measurable_constraints)
    assert any("bit rate" in c.lower() or "efficiency" in c.lower() for c in mission.measurable_constraints)
    assert any("sample rate" in a.lower() for a in mission.unresolved_assumptions)
    assert len(mission.execution_plan) >= 5
    assert "PRIMARY SCIENTIFIC OBJECTIVE" in mission.compiled_prompt
    assert "UNRESOLVED ASSUMPTIONS" in mission.compiled_prompt


def test_mission_compiler_biotech():
    user_request = "Design a de novo binding protein with high affinity and low immunogenicity."
    mission = compile_research_mission(user_request, speed_class=ResponseSpeedClass.DEEP_DISCOVERY)

    assert mission.target_domain == "BIOTECHNOLOGY"
    assert mission.speed_class == ResponseSpeedClass.DEEP_DISCOVERY
    assert any("affinity" in c.lower() or "kd" in c.lower() for c in mission.measurable_constraints)
    assert any("expression" in a.lower() for a in mission.unresolved_assumptions)
    assert any("100k-Word" in s for s in mission.execution_plan)


def test_mission_compiler_unresolved_assumptions_not_fabricated():
    """Verify that assumptions are flagged as unresolved rather than fabricated as truths."""
    mission = compile_research_mission("Optimize lithium-sulfur battery cathode morphology.")
    assert mission.target_domain == "MATERIALS_SCIENCE"
    assert len(mission.unresolved_assumptions) >= 2
    for assumption in mission.unresolved_assumptions:
        assert assumption.startswith("Assumed")
