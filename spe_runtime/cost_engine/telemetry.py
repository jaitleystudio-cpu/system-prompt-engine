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
    "gpt-4o": {"prompt": 2.50, "completion": 10.00},
    "gpt-4o-mini": {"prompt": 0.15, "completion": 0.60},
    "claude-3-5-sonnet": {"prompt": 3.00, "completion": 15.00},
    "claude-3-5-haiku": {"prompt": 0.25, "completion": 1.25},
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
