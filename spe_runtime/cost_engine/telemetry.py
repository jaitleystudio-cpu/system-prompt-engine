"""Honest telemetry and evidence classification models for SPE Ω."""

from __future__ import annotations

from enum import Enum
from typing import Dict, Tuple


class TelemetryEvidence(str, Enum):
    """Evidence classes classifying telemetry provenance without manufactured metrics."""
    OBSERVED_USAGE = "OBSERVED_USAGE"
    CALIBRATED_ESTIMATE = "CALIBRATED_ESTIMATE"
    THEORETICAL_BOUND = "THEORETICAL_BOUND"
    NOT_OBSERVABLE = "NOT_OBSERVABLE"
    UNKNOWN = "UNKNOWN"


class CostSource(str, Enum):
    """Source authority for cost calculations."""
    LOCAL_PINNED_PRICE_TABLE = "LOCAL_PINNED_PRICE_TABLE"
    BACKEND_REPORTED = "BACKEND_REPORTED"
    USER_SUPPLIED = "USER_SUPPLIED"
    UNKNOWN = "UNKNOWN"


# Pinned local price table (USD per 1M tokens) - explicitly pinned offline artifact.
# Prevents evidence contamination from arbitrary dynamic / manufactured pricing.
PINNED_LOCAL_PRICE_TABLE: Dict[str, Dict[str, float]] = {
    "default": {"prompt": 2.50, "completion": 10.00},
    "spe-omega-supercompiler": {"prompt": 0.00, "completion": 0.00},
    # Late 2026 Frontier Models
    "claude-5-5-sonnet": {"prompt": 3.00, "completion": 15.00},
    "claude-5-5-haiku": {"prompt": 0.80, "completion": 4.00},
    "claude-5-5-opus": {"prompt": 15.00, "completion": 75.00},
    "claude-code-2-1": {"prompt": 3.00, "completion": 15.00},
    "gpt-6-1-sol": {"prompt": 2.50, "completion": 10.00},
    "gpt-6-astra": {"prompt": 3.00, "completion": 12.00},
    "gemini-3-8-pro": {"prompt": 1.25, "completion": 5.00},
    "gemini-3-8-flash": {"prompt": 0.10, "completion": 0.40},
    "aragon-4": {"prompt": 0.85, "completion": 3.40},
    # LEGACY historical compatibility fallback entries
    "gpt-4o": {"prompt": 2.50, "completion": 10.00},  # historical
    "gpt-4o-mini": {"prompt": 0.15, "completion": 0.60},  # historical
    "claude-3-5-sonnet": {"prompt": 3.00, "completion": 15.00},  # historical
    "claude-3-5-haiku": {"prompt": 0.25, "completion": 1.25},  # historical
}


def compute_pinned_cost(
    prompt_tokens: int,
    completion_tokens: int,
    model: str = "default",
) -> Tuple[float, CostSource, TelemetryEvidence]:
    """Computes cost strictly against the pinned local price table.
    
    Returns (cost_usd, cost_source, evidence_class).
    """
    price_entry = PINNED_LOCAL_PRICE_TABLE.get(model, PINNED_LOCAL_PRICE_TABLE["default"])
    p_rate = price_entry.get("prompt", 2.50) / 1_000_000.0
    c_rate = price_entry.get("completion", 10.00) / 1_000_000.0
    cost = round((prompt_tokens * p_rate) + (completion_tokens * c_rate), 6)
    return cost, CostSource.LOCAL_PINNED_PRICE_TABLE, TelemetryEvidence.THEORETICAL_BOUND
