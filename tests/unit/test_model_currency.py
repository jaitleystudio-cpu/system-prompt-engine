"""
Unit tests for SPE Ω Frontier Model Currency Governor (FMCG)
Verifies Zero-Stale-Model Invariant and 2026 active frontier model enforcement.
"""

import pytest
from spe_runtime.model_governor import (
    FRONTIER_ACTIVE_YEAR,
    FRONTIER_MODELS_2026,
    is_model_current,
    auto_upgrade_legacy_model,
    assert_model_currency,
    get_default_frontier_model,
    get_active_frontier_models,
)


def test_active_frontier_year():
    """Verify active frontier year is 2026."""
    assert FRONTIER_ACTIVE_YEAR == 2026
    for model_id, model in FRONTIER_MODELS_2026.items():
        assert model["release_date"].startswith("2026"), f"{model_id} has invalid release date {model['release_date']}"
        assert model["generation"] == "2026-frontier"


def test_active_models_current():
    """Verify 2026 frontier models pass currency check."""
    frontier_sample = [
        "claude-4-5-sonnet",
        "claude-4-5-opus",
        "claude-4-5-haiku",
        "gpt-5",
        "gpt-5-codex",
        "o4-mini",
        "o3-pro",
        "gemini-3-8-pro",
        "gemini-3-8-flash",
        "aragon-4",
        "grok-4",
        "deepseek-r2",
        "deepseek-v4",
        "llama-4-405b",
        "llama-4-70b",
    ]
    for mid in frontier_sample:
        assert is_model_current(mid) is True


def test_legacy_models_rejected_as_current():
    """Verify 2024 and early 2025 models fail currency check."""
    obsolete_models = [
        "claude-3-opus",
        "claude-3-5-sonnet",
        "claude-3-7-sonnet",
        "gpt-4",
        "gpt-4o",
        "gpt-4-turbo",
        "gpt-4.5-preview",
        "o1",
        "o1-preview",
        "o3-mini",
        "gemini-1-5-flash",
        "gemini-1-5-pro",
        "gemini-2-0-flash",
        "grok-2",
        "grok-3",
        "deepseek-r1",
        "deepseek-v3",
        "llama-3-3-70b",
    ]
    for mid in obsolete_models:
        assert is_model_current(mid) is False, f"Model {mid} should be flagged as obsolete"


def test_auto_upgrade_mappings():
    """Verify obsolete models are transparently upgraded to 2026 frontier models."""
    upgrades = [
        ("claude-3-7-sonnet", "claude-5-5-sonnet"),
        ("claude-3-5-sonnet", "claude-5-5-sonnet"),
        ("claude-3-opus", "claude-5-5-opus"),
        ("claude-3-5-haiku", "claude-5-5-haiku"),
        ("gpt-4.5-preview", "gpt-6-1-sol"),
        ("gpt-4o", "gpt-6-1-sol"),
        ("o3-mini", "gpt-6-astra"),
        ("gemini-1-5-pro", "gemini-3-8-pro"),
        ("gemini-2-0-flash", "gemini-3-8-flash"),
        ("gemini-3-pro", "gemini-3-8-pro"),
        ("gemini-3-flash", "gemini-3-8-flash"),
        ("grok-3", "grok-4"),
        ("deepseek-r1", "deepseek-r2"),
        ("deepseek-v3", "deepseek-v4"),
        ("llama-3-3-70b", "llama-4-70b"),
    ]
    for legacy_id, expected_2026 in upgrades:
        res = auto_upgrade_legacy_model(legacy_id)
        assert res["was_legacy"] is True
        assert res["upgraded_id"] == expected_2026, f"Expected {legacy_id} -> {expected_2026}, got {res['upgraded_id']}"


def test_assert_model_currency_gate():
    """Verify strict assertion throws ValueError for stale models and passes for 2026 models."""
    # 2026 model passes
    assert_model_currency("claude-4-5-sonnet")
    assert_model_currency("gpt-5")
    assert_model_currency("gemini-3-8-pro")
    assert_model_currency("gemini-3-8-flash")
    assert_model_currency("aragon-4")

    # Obsolete model raises ValueError with clear upgrade guidance
    with pytest.raises(ValueError, match="Obsolete model 'claude-3-7-sonnet' rejected"):
        assert_model_currency("claude-3-7-sonnet")

    with pytest.raises(ValueError, match="Obsolete model 'gpt-4.5-preview' rejected"):
        assert_model_currency("gpt-4.5-preview")


def test_default_frontier_model():
    """Verify default flagship model is Claude 4.5 Sonnet."""
    default_m = get_default_frontier_model()
    assert default_m["id"] == "claude-4-5-sonnet"
    assert default_m["release_date"].startswith("2026")
