"""
Canonical Types and Invariants for WDIC-VCT (Verified Continuation Transactions).
Part of SPE Ω Research Quarantine.

Enforces:
1. Kleene-4 claim classification (VERIFIED, UNVERIFIED, CONTRADICTED, STALE).
2. Explicit proof deficit derivation.
3. 6-clause Next Task Contract schema.
4. Exact integer NanoUSD cost and token savings tracking.
"""

from enum import Enum
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field


class ClaimStatus(str, Enum):
    VERIFIED = "VERIFIED"
    UNVERIFIED = "UNVERIFIED"
    CONTRADICTED = "CONTRADICTED"
    STALE = "STALE"


@dataclass(frozen=True)
class TaskClaim:
    """
    A single factual or functional claim made in an agent's task report.
    """
    id: str
    requirement_id: str
    description: str
    status: ClaimStatus
    evidence_details: str = ""


@dataclass
class TaskReport:
    """
    Structured ingestion of an agent's execution report.
    """
    task_id: str
    summary: str
    files_modified: List[str] = field(default_factory=list)
    tests_passed: int = 0
    tests_failed: int = 0
    tests_skipped: int = 0
    claims: List[TaskClaim] = field(default_factory=list)
    commit_sha: str = ""
    raw_text: str = ""


@dataclass(frozen=True)
class ProofDeficit:
    """
    The set of unfulfilled or contradicted obligations preventing completion.
    """
    open_requirements: List[str]
    contradicted_requirements: List[str]
    deficit_count: int


@dataclass(frozen=True)
class NextTaskContract:
    """
    The 6-clause executable task contract compiled by WDIC-VCT.
    """
    task_title: str
    baseline_ref: str
    objective: str
    allowed_files: List[str]
    prohibited_files: List[str]
    execution_steps: List[str]
    acceptance_criteria: str
    stop_boundaries: List[str]
    tier_used: str = "T0_DETERMINISTIC"
    cost_nano_usd: int = 0
    saved_tokens: int = 4000

    def to_markdown(self) -> str:
        """Emits copy-pasteable task contract formatted for Gilden / Cursor / Claude Code."""
        steps = "\n".join(f"{i+1}. {s}" for i, s in enumerate(self.execution_steps))
        allowed = ", ".join(self.allowed_files) if self.allowed_files else "None"
        prohibited = ", ".join(self.prohibited_files) if self.prohibited_files else "None"
        stops = "\n".join(f"- {b}" for b in self.stop_boundaries)

        return (
            f"```spe-task\n"
            f"TASK: {self.task_title}\n"
            f"BASELINE: {self.baseline_ref}\n\n"
            f"OBJECTIVE:\n{self.objective}\n\n"
            f"SCOPE:\n"
            f"- Allowed Files: {allowed}\n"
            f"- Prohibited Files: {prohibited}\n\n"
            f"EXECUTION PLAN:\n{steps}\n\n"
            f"ACCEPTANCE CRITERIA:\n{self.acceptance_criteria}\n\n"
            f"STOP BOUNDARIES:\n{stops}\n"
            f"```"
        )


@dataclass(frozen=True)
class ReviewSummary:
    """
    The 4-part review summary eliminating the need for ChatGPT report reviews.
    """
    total_requirements: int
    verified_count: int
    unverified_count: int
    contradicted_count: int
    verdict: str  # QUALIFIED, DEFICIT_DETECTED, BLOCKED_CONTRADICTION
    deficit: ProofDeficit
    next_contract: Optional[NextTaskContract]
    tier_used: str
    cost_nano_usd: int
    estimated_savings_tokens: int
    estimated_savings_usd: float
