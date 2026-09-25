"""K3 PromptArtifact — sole package for prompt_artifact ownership.

Contract owner: K3 (Strategy + Prompt).
Canonical writer: build_prompt_artifact.
C01 recommendation and C03 rendering remain separate semantic facts.
"""

from spe_runtime.prompt.build import build_prompt_artifact
from spe_runtime.prompt.models import (
    PromptArtifact,
    PromptSegment,
    PromptSegmentKind,
    PromptSourceBinding,
)

__all__ = [
    "PromptSegmentKind",
    "PromptSourceBinding",
    "PromptSegment",
    "PromptArtifact",
    "build_prompt_artifact",
]
