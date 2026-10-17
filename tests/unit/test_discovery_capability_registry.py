"""
tests/unit/test_discovery_capability_registry.py

Tests for SPE Ω Dynamic Capability & Universal AI Discovery Registry (Python).
"""

import pytest
from spe_runtime.discovery.capability_registry import (
    SPE_CAPABILITIES,
    get_spe_capability_metrics,
    match_capabilities_by_intent,
)


def test_spe_capability_metrics_truthfulness():
    metrics = get_spe_capability_metrics()
    assert metrics["total_capabilities"] == 13
    assert metrics["free_capabilities_count"] == 12
    assert metrics["pro_capabilities_count"] == 1
    assert metrics["host_dependent_count"] == 2
    assert metrics["verified_free_percentage"] == 92.3


def test_match_capabilities_by_intent():
    # Screenshot to code
    res_code = match_capabilities_by_intent("convert this screenshot into code")
    assert len(res_code) >= 1
    assert res_code[0].id == "screenshot_to_code"
    assert res_code[0].path == "/code"

    # Website
    res_web = match_capabilities_by_intent("help me design a website")
    assert len(res_web) >= 1
    assert res_web[0].id == "website_studio"
    assert res_web[0].path == "/website"

    # Skill builder
    res_skill = match_capabilities_by_intent("build a reusable AI agent skill")
    assert len(res_skill) >= 1
    assert res_skill[0].id == "skill_builder"
    assert res_skill[0].path == "/build-skill"

    # Prompt optimization
    res_prompt = match_capabilities_by_intent("create a system prompt")
    assert len(res_prompt) >= 1
    assert res_prompt[0].id == "ai_creation"
    assert res_prompt[0].path == "/create"


def test_capability_free_tier_entitlements():
    for cap in SPE_CAPABILITIES:
        assert cap.path.startswith("/")
        assert cap.status in {"FREE", "PRO", "HOST_DEPENDENT", "EXPERIMENTAL", "UNAVAILABLE"}
        assert len(cap.user_intent_triggers) >= 1
        assert cap.free_tier_entitlement
