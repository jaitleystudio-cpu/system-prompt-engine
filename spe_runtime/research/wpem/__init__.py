"""
SPE Ω — Witness-Preserving Execution Morphing (WPEM).
Provides dynamic computation plan rewriting across varying device hardware states
while strictly preserving mandatory obligations, privacy boundaries, and 2PC isolation.
"""

from .types import (
    TransformationType,
    AdmissibilityStatus,
    HardwareEnvelope,
    TransformationRecord,
    ExecutionPlanNode,
    CandidateExecutionPlan,
)
from .hysteresis_filter import ThermalHysteresisFilter
from .compositional_guard import CompositionalGuard
from .admissibility_solver import AdmissibilitySolver
from .graph_rewriter import ExecutionGraphRewriter

__all__ = [
    "TransformationType",
    "AdmissibilityStatus",
    "HardwareEnvelope",
    "TransformationRecord",
    "ExecutionPlanNode",
    "CandidateExecutionPlan",
    "ThermalHysteresisFilter",
    "CompositionalGuard",
    "AdmissibilitySolver",
    "ExecutionGraphRewriter",
]
