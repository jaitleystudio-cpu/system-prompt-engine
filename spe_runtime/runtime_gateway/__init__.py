"""SPE Ω — SPE Runtime Gateway & Capability Firewall (M11 & M12)."""

from .a2a_delegation import A2APolicyEngine
from .firewall import CapabilityFirewall
from .mcp_adapter import McpCapabilityAdapter
from .models import (
    A2ADelegationContract,
    CapabilityGrant,
    CapabilityRequest,
    CapabilityType,
    Decision,
    PolicyEvaluationResult,
)

__all__ = [
    "CapabilityType",
    "Decision",
    "CapabilityGrant",
    "CapabilityRequest",
    "A2ADelegationContract",
    "PolicyEvaluationResult",
    "CapabilityFirewall",
    "McpCapabilityAdapter",
    "A2APolicyEngine",
]
