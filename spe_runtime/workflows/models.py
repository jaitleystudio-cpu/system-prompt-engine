"""
Business Workflow Data Models for SPE Ω Verified Workflows Exchange.

Provides reproducible contracts for recurring business operations and document
automation tasks, defining required skills, input/output schemas, permission
ceilings, and deterministic acceptance criteria.
"""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple


class WorkflowCategory(str, Enum):
    BUSINESS_OPERATIONS = "business-operations"
    DOCUMENT_AUTOMATION = "document-automation"
    ENGINEERING_OPS = "engineering-ops"
    CUSTOMER_SUCCESS = "customer-success"
    MARKETING_BRIEFS = "marketing-briefs"


@dataclass(frozen=True)
class PermissionCeiling:
    """
    Maximum allowable authority boundary for a workflow.
    Zero-egress and local-first by default.
    """
    allow_network: bool = False
    allow_credentials: bool = False
    allowed_filesystem_paths: List[str] = field(default_factory=lambda: ["./"])
    max_cost_nanousd: int = 0  # Default 0 NanoUSD for local execution

    def violates_policy(self, requested_permissions: Set[str]) -> Tuple[bool, List[str]]:
        violations = []
        if "NETWORK" in requested_permissions and not self.allow_network:
            violations.append("Network egress prohibited by workflow permission ceiling")
        if "CREDENTIALS" in requested_permissions and not self.allow_credentials:
            violations.append("Ambient credentials access prohibited by workflow ceiling")
        return len(violations) > 0, violations


@dataclass
class WorkflowStep:
    """
    An atomic verifiable phase inside a business workflow.
    """
    step_id: str
    title: str
    instruction: str
    recommended_skill: Optional[str] = None
    verification_probe: Optional[str] = None
    required_inputs: List[str] = field(default_factory=list)
    produced_outputs: List[str] = field(default_factory=list)


@dataclass
class BusinessWorkflow:
    """
    A verified, reproducible business job contract.
    """
    workflow_id: str
    slug: str
    title: str
    job_category: WorkflowCategory
    summary: str
    required_capabilities: List[str]
    input_artifacts: List[str]
    output_artifacts: List[str]
    max_permissions: PermissionCeiling
    steps: List[WorkflowStep]
    verification_fixture_id: str
    top_skills: List[str] = field(default_factory=list)
    average_token_savings_pct: float = 0.0
    reproducibility_rate: float = 1.0

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        d["job_category"] = self.job_category.value
        return d

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> BusinessWorkflow:
        steps = [WorkflowStep(**s) for s in data.get("steps", [])]
        ceiling_data = data.get("max_permissions", {})
        ceiling = PermissionCeiling(**ceiling_data)
        category = WorkflowCategory(data.get("job_category", WorkflowCategory.BUSINESS_OPERATIONS.value))

        return cls(
            workflow_id=data["workflow_id"],
            slug=data["slug"],
            title=data["title"],
            job_category=category,
            summary=data["summary"],
            required_capabilities=data.get("required_capabilities", []),
            input_artifacts=data.get("input_artifacts", []),
            output_artifacts=data.get("output_artifacts", []),
            max_permissions=ceiling,
            steps=steps,
            verification_fixture_id=data.get("verification_fixture_id", ""),
            top_skills=data.get("top_skills", []),
            average_token_savings_pct=data.get("average_token_savings_pct", 0.0),
            reproducibility_rate=data.get("reproducibility_rate", 1.0),
        )

    def compile_agent_instructions(self, target_agent: str = "claude-code") -> str:
        """
        Compiles the workflow into a ready-to-run instruction package
        formatted for Claude Code, Cursor, Gilden, or Codex.
        """
        skill_tags = ", ".join(self.top_skills) if self.top_skills else "none"
        inputs_list = ", ".join(self.input_artifacts)
        outputs_list = ", ".join(self.output_artifacts)

        lines = [
            f"# SPE Ω VERIFIED WORKFLOW: {self.title.upper()}",
            f"**Job Category**: {self.job_category.value}",
            f"**Target Agent**: {target_agent}",
            f"**Verified Top Skills**: {skill_tags}",
            f"**Expected Inputs**: {inputs_list}",
            f"**Guaranteed Outputs**: {outputs_list}",
            "",
            "## CONSTITUTIONAL SAFETY BOUNDARY",
            f"- Network Access: {'ALLOWED' if self.max_permissions.allow_network else 'PROHIBITED ($0 / LOCAL-FIRST)'}",
            f"- Credential Access: {'ALLOWED' if self.max_permissions.allow_credentials else 'PROHIBITED'}",
            f"- Allowed Scopes: {', '.join(self.max_permissions.allowed_filesystem_paths)}",
            "",
            "## VERIFIABLE EXECUTION STEPS",
        ]

        for i, step in enumerate(self.steps, start=1):
            lines.append(f"### Step {i}: {step.title}")
            lines.append(f"- **Directive**: {step.instruction}")
            if step.recommended_skill:
                lines.append(f"- **Specialized Skill**: `{step.recommended_skill}`")
            if step.verification_probe:
                lines.append(f"- **Verification Check**: `{step.verification_probe}`")
            lines.append("")

        lines.extend([
            "## ACCEPTANCE & EVIDENCE CLOSURE",
            f"Verification Fixture: `{self.verification_fixture_id}`",
            "Upon completion, emit tangible execution artifacts and verify against schema before closing.",
        ])

        return "\n".join(lines)


class BusinessWorkflowCatalog:
    """
    Catalog of verified business workflows with querying and filtering.
    """
    def __init__(self, workflows: Optional[List[BusinessWorkflow]] = None):
        self._workflows: Dict[str, BusinessWorkflow] = {}
        if workflows:
            for w in workflows:
                self.register(w)

    def register(self, workflow: BusinessWorkflow) -> None:
        self._workflows[workflow.slug] = workflow

    def get_by_slug(self, slug: str) -> Optional[BusinessWorkflow]:
        return self._workflows.get(slug)

    def list_all(self) -> List[BusinessWorkflow]:
        return list(self._workflows.values())

    def filter_by_category(self, category: WorkflowCategory) -> List[BusinessWorkflow]:
        return [w for w in self._workflows.values() if w.job_category == category]

    def search_by_intent(self, query: str) -> List[BusinessWorkflow]:
        import re
        q = query.lower().strip()
        terms = [t for t in re.findall(r"\w+", q) if len(t) > 2]
        scored: List[Tuple[int, BusinessWorkflow]] = []
        for w in self._workflows.values():
            score = 0
            w_text = f"{w.title} {w.summary} {' '.join(w.required_capabilities)} {' '.join(w.top_skills)}".lower()
            if q in w.title.lower():
                score += 20
            for term in terms:
                if term in w.title.lower():
                    score += 6
                elif term in w_text:
                    score += 2
            if score > 0:
                scored.append((score, w))

        scored.sort(key=lambda x: x[0], reverse=True)
        return [w for _, w in scored]

    @classmethod
    def load_from_json(cls, filepath: Path) -> BusinessWorkflowCatalog:
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)
        workflows = [BusinessWorkflow.from_dict(item) for item in data]
        return cls(workflows)
