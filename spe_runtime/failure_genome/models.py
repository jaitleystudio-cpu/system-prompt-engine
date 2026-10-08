"""Models for Failure Genome Ω."""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any


class Severity(str, Enum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class FailureClass(str, Enum):
    PROMPT_INJECTION = "PROMPT_INJECTION"
    INSECURE_OUTPUT = "INSECURE_OUTPUT"
    AUTHORITY_ESCALATION = "AUTHORITY_ESCALATION"
    GOAL_HIJACKING = "GOAL_HIJACKING"
    PII_DATA_LEAKAGE = "PII_DATA_LEAKAGE"
    SCHEMA_VIOLATION = "SCHEMA_VIOLATION"
    CRESCENDO_MULTI_TURN = "CRESCENDO_MULTI_TURN"
    HAL_HALLUCINATION = "HAL_HALLUCINATION"
    REFUSAL_SUPPRESSION = "REFUSAL_SUPPRESSION"
    TOOL_CONFUSION = "TOOL_CONFUSION"


@dataclass
class FailureGenomeEntry:
    failure_id: str  # SPE-FG-YYYY-NNNNNN
    scope: str       # GLOBAL or PRIVATE
    source: str
    consent: bool
    model: str
    model_version: str
    prompt_digest: str
    protected_intent_digest: str
    minimal_reproducer: str
    failure_class: FailureClass
    severity: Severity
    affected_capability: str
    observations: list[str]
    reproduction_count: int
    root_cause: str
    candidate_repairs: list[str]
    regression_tests: list[str]
    first_seen: str
    last_seen: str
    owasp_mapping: str | None = None
    mitre_atlas_mapping: str | None = None
    cwe_mapping: str | None = None
    capec_mapping: str | None = None
    cve_id: str | None = None  # Genuine CVE only if exists
    is_verified_by_reproduction: bool = False
    metadata: dict[str, Any] = field(default_factory=dict)
