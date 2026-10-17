"""
SPE Ω — Evidence-Gated Adaptive Compute (EGAC-1)
October 12, 2026 | Research Quarantine Track
"""

from spe_runtime.research.egac.types import (
    NANOS_PER_USD,
    InformationClass,
    TechniqueType,
    TechniqueSetting,
    ExperienceLevel,
    ConservationStatus,
    InformationNode,
    SemanticDiff,
    OptimizationCandidate,
    ComputationalAction,
    ExecutionStrategy,
    CounterfactualScenario,
    VsodMetrics,
    EGACE01Task,
    EGACE01Result,
)
from spe_runtime.research.egac.semantic_conservation import SemanticConservationSystem
from spe_runtime.research.egac.compute_allocation import ValueOfInformationAllocator
from spe_runtime.research.egac.counterfactual_optimizer import CounterfactualOptimizer
from spe_runtime.research.egac.technique_evaluator import TechniqueEvaluator
from spe_runtime.research.egac.vsod_calculator import VsodCalculator
from spe_runtime.research.egac.engine import SpeEgacEngine

__all__ = [
    "NANOS_PER_USD",
    "InformationClass",
    "TechniqueType",
    "TechniqueSetting",
    "ExperienceLevel",
    "ConservationStatus",
    "InformationNode",
    "SemanticDiff",
    "OptimizationCandidate",
    "ComputationalAction",
    "ExecutionStrategy",
    "CounterfactualScenario",
    "VsodMetrics",
    "EGACE01Task",
    "EGACE01Result",
    "SemanticConservationSystem",
    "ValueOfInformationAllocator",
    "CounterfactualOptimizer",
    "TechniqueEvaluator",
    "VsodCalculator",
    "SpeEgacEngine",
]
