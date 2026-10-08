"""Models for Observed Model Atlas and Model Passport."""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any


class ExecutionClass(str, Enum):
    OBSERVED_REMOTE = "OBSERVED_REMOTE"
    OBSERVED_LOCAL = "OBSERVED_LOCAL"
    SIMULATED = "SIMULATED"
    CALIBRATED_ESTIMATE = "CALIBRATED_ESTIMATE"
    NOT_RUN = "NOT_RUN"


@dataclass
class ExecutionProvenance:
    execution_id: str
    provider: str
    model_id: str
    execution_class: ExecutionClass
    timestamp: str
    input_digest: str
    output_digest: str
    latency_ms: float
    input_tokens: int
    output_tokens: int
    cost_usd: float
    score: float
    oracle_id: str
    provider_model_version: str | None = None
    tokenizer: str | None = None
    seed: int | None = None
    failure_id: str | None = None
    raw_artifact_location: str | None = None


@dataclass
class ModelPassport:
    model_id: str
    provider: str
    passport_version: str
    execution_class: ExecutionClass
    structured_output_success: float  # 0.0 - 1.0
    constraint_retention: float       # 0.0 - 1.0
    tool_argument_validity: float     # 0.0 - 1.0
    long_context_recall: float        # 0.0 - 1.0
    latency_p50_ms: float
    latency_p95_ms: float
    cost_per_million_input: float
    cost_per_million_output: float
    known_failure_clusters: list[str] = field(default_factory=list)
    last_tested: str = ""
    sample_count: int = 0


@dataclass
class ModelAtlas:
    passports: dict[str, ModelPassport] = field(default_factory=dict)
    provenance_log: list[ExecutionProvenance] = field(default_factory=list)
