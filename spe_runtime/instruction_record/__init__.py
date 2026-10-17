"""SPE Ω — Instruction System of Record (M1).

The persistent semantic identity layer for AI instructions.
Tracks human objectives, ProtectedIntent snapshots, RequirementGraph,
PromptEffectPlan, PromptArtifacts, approvals, and deployments.
"""

from .models import (
    ApprovalIdentity,
    ConstraintIdentity,
    DeploymentIdentity,
    EvidenceIdentity,
    InstructionIdentity,
    InstructionProject,
    InstructionVersion,
    ModelExecutionIdentity,
    PromptArtifactIdentity,
    ProtectedIntentSnapshot,
    RequirementIdentity,
)
from .store import InstructionStore, TamperError, VersionNotFoundError

__all__ = [
    "ApprovalIdentity",
    "ConstraintIdentity",
    "DeploymentIdentity",
    "EvidenceIdentity",
    "InstructionIdentity",
    "InstructionProject",
    "InstructionVersion",
    "ModelExecutionIdentity",
    "PromptArtifactIdentity",
    "ProtectedIntentSnapshot",
    "RequirementIdentity",
    "InstructionStore",
    "TamperError",
    "VersionNotFoundError",
]
