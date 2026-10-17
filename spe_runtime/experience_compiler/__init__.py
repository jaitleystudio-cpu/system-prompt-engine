"""
SPE Ω — Intent-to-Experience Compiler & Agent Gateway
Python Runtime Parity
"""

from .intent_compiler import (
    CapabilityParameter,
    VerifiedCapabilityContract,
    HumanExperienceContract,
    SearchExperienceContract,
    AgentExperienceContract,
    TriViewCompilationResult,
    IntentToExperienceCompiler,
    STANDARD_CAPABILITIES,
)
from .firewall import ExperienceConsistencyFirewall, FirewallVerificationReport
from .agent_gateway import AgentPermissionShield, WebMcpAgentGateway
from .shadow_world import (
    CANONICAL_PERSONAS,
    SyntheticVisitorLab,
    FutureFailureRadar,
    ShadowWorldMatrixResult,
)
from .task_to_answer import TaskToAnswerEngine

__all__ = [
    "CapabilityParameter",
    "VerifiedCapabilityContract",
    "HumanExperienceContract",
    "SearchExperienceContract",
    "AgentExperienceContract",
    "TriViewCompilationResult",
    "IntentToExperienceCompiler",
    "STANDARD_CAPABILITIES",
    "ExperienceConsistencyFirewall",
    "FirewallVerificationReport",
    "AgentPermissionShield",
    "WebMcpAgentGateway",
    "CANONICAL_PERSONAS",
    "SyntheticVisitorLab",
    "FutureFailureRadar",
    "ShadowWorldMatrixResult",
    "TaskToAnswerEngine",
]
