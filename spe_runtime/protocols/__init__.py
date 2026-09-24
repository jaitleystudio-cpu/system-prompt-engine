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
from spe_runtime.protocols.merge import ProtocolMergeConflict, merge_protocol_graphs
from spe_runtime.protocols.models import ProtocolDepth, ProtocolGraph, ProtocolNode
from spe_runtime.protocols.registry import list_protocol_domains, load_protocol

__all__ = [
    "CapabilityProfile",
    "DepthSignals",
    "ExecutionContract",
    "ProtocolDepth",
    "ProtocolGraph",
    "ProtocolMergeConflict",
    "ProtocolNode",
    "build_auto_route_node",
    "compile_execution_contract",
    "list_protocol_domains",
    "load_protocol",
    "merge_protocol_graphs",
    "select_protocol_depth",
]
