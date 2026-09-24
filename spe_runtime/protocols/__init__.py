"""Adaptive category protocol registry — structure-only compiler inputs."""

from spe_runtime.protocols.capability_routing import (
    CapabilityProfile,
    build_auto_route_node,
)
from spe_runtime.protocols.compiler import (
    ExecutionContract,
    compile_execution_contract,
)
from spe_runtime.protocols.depth import DepthSignals, select_protocol_depth
from spe_runtime.protocols.evaluators import (
    EvaluatorResult,
    EvaluatorStatus,
    evaluate_result,
    list_evaluator_domains,
)
from spe_runtime.protocols.merge import ProtocolMergeConflict, merge_protocol_graphs
from spe_runtime.protocols.models import ProtocolDepth, ProtocolGraph, ProtocolNode
from spe_runtime.protocols.optimize import (
    ALLOWED_MUTATION_FIELDS,
    FORBIDDEN_MUTATION_FIELDS,
    OptimizationResult,
    PromptCandidate,
    optimize_prompt,
)
from spe_runtime.protocols.quality_record import QualityRecord
from spe_runtime.protocols.registry import list_protocol_domains, load_protocol

__all__ = [
    "ALLOWED_MUTATION_FIELDS",
    "FORBIDDEN_MUTATION_FIELDS",
    "CapabilityProfile",
    "DepthSignals",
    "EvaluatorResult",
    "EvaluatorStatus",
    "ExecutionContract",
    "OptimizationResult",
    "PromptCandidate",
    "ProtocolDepth",
    "ProtocolGraph",
    "ProtocolMergeConflict",
    "ProtocolNode",
    "QualityRecord",
    "build_auto_route_node",
    "compile_execution_contract",
    "evaluate_result",
    "list_evaluator_domains",
    "list_protocol_domains",
    "load_protocol",
    "merge_protocol_graphs",
    "optimize_prompt",
    "select_protocol_depth",
]
