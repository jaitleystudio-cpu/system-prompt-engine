"""
Integration tests for SpeEgacEngine orchestrator.
"""

import pytest
from spe_runtime.research.egac.types import (
    ExperienceLevel,
    TechniqueType,
    ConservationStatus,
)
from spe_runtime.research.egac.engine import SpeEgacEngine

def test_engine_task_analysis():
    engine = SpeEgacEngine()
    prompt = """
    # Security Rule
    You must never transmit customer data externally.
    { "account_id": 49021, "balance": 15000 }
    Empirical measurements showed 99.2% accuracy.
    Explain the results to the auditor.
    """
    analysis = engine.analyze_task(prompt, experience_level=ExperienceLevel.EXPERT)

    assert analysis["nodes_count"] >= 4
    assert analysis["class_distribution"]["PROTECTED_REQUIREMENTS"] >= 1
    assert analysis["class_distribution"]["EXACT_BYTE_MATERIAL"] >= 1
    assert analysis["strategy"].experience_level == ExperienceLevel.EXPERT

def test_engine_optimizes_safe_json():
    engine = SpeEgacEngine()
    prompt = 'Process payload: { "id": 101, "name": "Test" } with strict privacy.'
    result = engine.optimize_prompt(
        prompt=prompt,
        technique=TechniqueType.JSON_MINIFICATION,
        experience_level=ExperienceLevel.EXPERT,
    )

    assert result["is_approved"] is True
    assert result["failed_scenarios_count"] == 0
    assert result["vsod_metrics"].critical_failures == 0

def test_engine_blocks_unsafe_token_cap_on_long_form():
    engine = SpeEgacEngine()
    prompt = "Write a complete 100,000-word dissertation on quantum decoherence."
    result = engine.optimize_prompt(
        prompt=prompt,
        technique=TechniqueType.OUTPUT_TOKEN_BUDGET_2048,
        experience_level=ExperienceLevel.DISCOVERY,
        is_long_form=True,
    )

    assert result["is_approved"] is False
    assert "REJECTED" in result["rejection_reason"]

def test_engine_e01_controlled_experiment():
    engine = SpeEgacEngine()
    res = engine.run_e01_experiment()
    assert res.experiment_name == "SPE-PRO-EGAC-E01-JSON"
    assert res.passed_promotion_gate is True
    assert res.canary_failures == 0
