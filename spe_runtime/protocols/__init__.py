"""Adaptive category protocol registry — structure-only compiler inputs."""

from spe_runtime.protocols.depth import DepthSignals, select_protocol_depth
from spe_runtime.protocols.models import ProtocolDepth, ProtocolGraph, ProtocolNode
from spe_runtime.protocols.registry import list_protocol_domains, load_protocol

__all__ = [
    "DepthSignals",
    "ProtocolDepth",
    "ProtocolGraph",
    "ProtocolNode",
    "list_protocol_domains",
    "load_protocol",
    "select_protocol_depth",
]
