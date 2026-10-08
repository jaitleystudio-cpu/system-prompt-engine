"""Models for AI Reliability Platform."""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any


@dataclass
class ReliabilitySLO:
    task_success_min: float = 0.95
    constraint_retention_min: float = 0.98
    schema_validity_min: float = 0.99
    max_security_failure_rate: float = 0.00
    max_latency_p95_ms: float = 1500.0
    max_cost_per_query_usd: float = 0.05


@dataclass
class SLOEvaluation:
    compliant: bool
    violations: list[str]
    metrics_evaluated: dict[str, float]


@dataclass
class ShadowExecutionRecord:
    production_version_id: str
    candidate_version_id: str
    request_id: str
    production_output: str
    shadow_output: str
    candidate_score: float
    divergence_metric: float  # Difference between prod and candidate


class DriftType(str, Enum):
    MODEL_DRIFT = "MODEL_DRIFT"
    PROMPT_CHANGE = "PROMPT_CHANGE"
    TOOL_CHANGE = "TOOL_CHANGE"
    INPUT_MIX_DRIFT = "INPUT_MIX_DRIFT"
    ORACLE_CHANGE = "ORACLE_CHANGE"
    STABLE = "STABLE"


@dataclass
class IncidentRCA:
    incident_id: str
    timestamp: str
    request_id: str
    instruction_version: str
    model: str
    tools_invoked: list[str]
    capabilities_active: list[str]
    failure_class: str
    root_cause_reconstruction: str
    evidence_chain: list[str]
