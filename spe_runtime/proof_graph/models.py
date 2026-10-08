"""Models for Causal Proof Graph."""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any


class NodeType(str, Enum):
    HUMAN_SPAN = "HUMAN_SPAN"
    PROTECTED_INTENT = "PROTECTED_INTENT"
    REQUIREMENT = "REQUIREMENT"
    CONSTRAINT = "CONSTRAINT"
    XCAT_NODE = "XCAT_NODE"
    K3_TRANSFORM = "K3_TRANSFORM"
    EFFECT_PLAN_OP = "EFFECT_PLAN_OP"
    PROMPT_CLAUSE = "PROMPT_CLAUSE"
    TEST_CASE = "TEST_CASE"
    RUNTIME_POLICY = "RUNTIME_POLICY"
    EXECUTION = "EXECUTION"
    RESULT = "RESULT"
    EVIDENCE = "EVIDENCE"


class EdgeType(str, Enum):
    DERIVES_FROM = "DERIVES_FROM"
    ENFORCES = "ENFORCES"
    TRANSFORMS = "TRANSFORMS"
    PRODUCES = "PRODUCES"
    VALIDATES_WITH = "VALIDATES_WITH"
    MONITORS = "MONITORS"
    EVIDENCED_BY = "EVIDENCED_BY"
    REGRESSED_BY = "REGRESSED_BY"


@dataclass(frozen=True)
class CausalEvidence:
    evidence_id: str
    evidence_class: str  # OBSERVED_REMOTE, OBSERVED_LOCAL, SIMULATED, CALIBRATED_ESTIMATE, STATIC_ANALYSIS
    metric: str
    value: Any
    observed_at: str


@dataclass(frozen=True)
class CausalNode:
    node_id: str
    node_type: NodeType
    label: str
    payload: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class CausalEdge:
    edge_id: str
    source_id: str
    target_id: str
    edge_type: EdgeType
    metadata: dict[str, Any] = field(default_factory=dict)
