"""
SPE Ω — Constraint-and-Evidence Conservation (CEC).
The 100-Year Protocol Standard for Model-Independent AI Execution.
Preserves obligations, authority, privacy, and evidence across heterogeneous model handoffs.
"""

from .types import (
    Disposition,
    InformationLabel,
    EnvironmentFingerprint,
    ObligationRecord,
    ConservedContract,
    TransitionWitness,
)
from .assumption_tracker import AssumptionTracker
from .transition_validator import TransitionValidator
from .handoff_protocol import HandoffProtocol

__all__ = [
    "Disposition",
    "InformationLabel",
    "EnvironmentFingerprint",
    "ObligationRecord",
    "ConservedContract",
    "TransitionWitness",
    "AssumptionTracker",
    "TransitionValidator",
    "HandoffProtocol",
]
