"""Data models for S-CODE Lab v0 Empirical Benchmark Suite."""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional


class TaskFamily(str, Enum):
    """Task domain categories for seeded failure evaluation."""
    EXTRACTION = "EXTRACTION"
    FINANCIAL_AUTHORITY = "FINANCIAL_AUTHORITY"
    RESEARCH = "RESEARCH"


@dataclass(frozen=True)
class SeededFault:
    """A benchmark failure scenario with ground-truth root cause."""
    fault_id: str
    name: str
    description: str
    task_family: TaskFamily
    ground_truth_root_cause: str
    is_open_world_unseen: bool = False


@dataclass
class ArmEvaluationResult:
    """Comparative empirical evaluation metrics for a specific architecture arm."""
    arm_name: str
    fault_localization_accuracy: float
    diagnostic_model_calls: int
    total_tokens: int
    recovery_compute_usd: float
    false_localization_rate: float
    unknown_rejection_accuracy: float
    cdi_score: float


@dataclass
class SCodeLabReport:
    """Consolidated benchmark report produced by S-CODE Lab v0."""
    timestamp: str
    evidence_class: str
    evaluated_faults_count: int
    arm_results: Dict[str, ArmEvaluationResult]
    summary_verdict: str

    def to_summary(self) -> str:
        lines = [
            f"=== S-CODE Lab v0 Benchmark Report ({self.evidence_class}) ===",
            f"Evaluated Scenarios: {self.evaluated_faults_count}",
            f"Verdict: {self.summary_verdict}\n",
            f"{'Arm':<40} | {'Acc':<6} | {'Calls':<6} | {'Tokens':<8} | {'Recovery $':<10} | {'CDI':<6}",
            "-" * 85,
        ]
        for name, r in self.arm_results.items():
            lines.append(
                f"{name:<40} | {r.fault_localization_accuracy:<6.2f} | "
                f"{r.diagnostic_model_calls:<6} | {r.total_tokens:<8} | "
                f"${r.recovery_compute_usd:<9.4f} | {r.cdi_score:<6.2f}"
            )
        return "\n".join(lines)
