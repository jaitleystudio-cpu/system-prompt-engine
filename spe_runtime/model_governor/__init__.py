"""
SPE Ω Model Governor - Active 2026 Frontier Currency Enforcement
"""

from .currency_kernel import (
    FRONTIER_ACTIVE_YEAR,
    FRONTIER_MIN_RELEASE_DATE,
    FRONTIER_MODELS_2026,
    LEGACY_TO_FRONTIER_MAPPING,
    auto_upgrade_legacy_model,
    assert_model_currency,
    is_model_current,
    get_default_frontier_model,
    get_active_frontier_models,
)

__all__ = [
    "FRONTIER_ACTIVE_YEAR",
    "FRONTIER_MIN_RELEASE_DATE",
    "FRONTIER_MODELS_2026",
    "LEGACY_TO_FRONTIER_MAPPING",
    "auto_upgrade_legacy_model",
    "assert_model_currency",
    "is_model_current",
    "get_default_frontier_model",
    "get_active_frontier_models",
]
