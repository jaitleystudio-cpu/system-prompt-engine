"""K3 Prompt package — PromptArtifact + strategy intelligence (G1R-6/G1R-7).

Canonical writers:
  build_cognitive_plan
  select_prompt_techniques
  build_prompt_strategy
  build_prompt_artifact
C01 recommendation and C03 rendering remain separate semantic facts.
"""

from spe_runtime.prompt.build import build_prompt_artifact
from spe_runtime.prompt.hints import PlanningHints
from spe_runtime.prompt.models import (
    PromptArtifact,
    PromptSegment,
    PromptSegmentKind,
    PromptSourceBinding,
)
from spe_runtime.prompt.plan import CognitivePlan, CognitivePlanKind, build_cognitive_plan
from spe_runtime.prompt.strategy import PromptStrategy, build_prompt_strategy
from spe_runtime.prompt.techniques import (
    STANDARD_MAX_TECHNIQUES,
    PromptTechnique,
    TechniqueJustification,
    TechniqueSelection,
    select_prompt_techniques,
)

__all__ = [
    "PlanningHints",
    "CognitivePlanKind",
    "CognitivePlan",
    "build_cognitive_plan",
    "PromptTechnique",
    "TechniqueJustification",
    "TechniqueSelection",
    "STANDARD_MAX_TECHNIQUES",
    "select_prompt_techniques",
    "PromptStrategy",
    "build_prompt_strategy",
    "PromptSegmentKind",
    "PromptSourceBinding",
    "PromptSegment",
    "PromptArtifact",
    "build_prompt_artifact",
]
