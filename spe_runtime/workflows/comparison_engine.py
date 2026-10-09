"""
Head-to-Head Comparison & Benchmark Engine for SPE Ω Verified Workflows Exchange.

Compares AI agent task performance across competing skills or with-vs-without
skill baselines. Computes Wilson 95% confidence intervals, token deltas, and
reproducible audit receipts.
"""

from __future__ import annotations

import math
from dataclasses import asdict, dataclass, field
from typing import Any, Dict, List, Optional


def compute_wilson_lower_bound(successes: int, total: int, confidence: float = 0.95) -> float:
    """
    Computes Wilson score interval lower bound for Bernoulli trials.
    Prevents 1/1 (100%) from beating 980/1000 (98%).
    """
    if total <= 0:
        return 0.0

    z = 1.95996  # 95% confidence z-score
    if confidence == 0.99:
        z = 2.57583
    elif confidence == 0.90:
        z = 1.64485

    p_hat = successes / total
    denominator = 1.0 + (z * z) / total
    centre = p_hat + (z * z) / (2.0 * total)
    spread = z * math.sqrt((p_hat * (1.0 - p_hat) + (z * z) / (4.0 * total)) / total)

    lower = (centre - spread) / denominator
    return max(0.0, min(1.0, lower))


@dataclass(frozen=True)
class CandidateTrialSummary:
    """
    Empirical benchmark trial aggregate for an agent skill configuration.
    """
    candidate_identifier: str  # e.g. "@skill/git-pr-review" or "baseline_without_skill"
    trials_total: int
    trials_successful: int
    average_token_consumption: int
    average_retries: float
    average_latency_ms: int

    @property
    def success_rate(self) -> float:
        return (self.trials_successful / self.trials_total) if self.trials_total > 0 else 0.0

    @property
    def wilson_lower_bound(self) -> float:
        return compute_wilson_lower_bound(self.trials_successful, self.trials_total)


@dataclass
class HeadToHeadComparisonResult:
    """
    The mathematical verdict of a head-to-head empirical comparison.
    """
    comparison_id: str
    task_slug: str
    baseline: CandidateTrialSummary
    challenger: CandidateTrialSummary
    delta_success_rate: float
    delta_wilson_lower: float
    token_savings_pct: float
    retry_reduction_pct: float
    reproducible_command: str
    winner_identifier: str
    verdict_summary: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            "comparison_id": self.comparison_id,
            "task_slug": self.task_slug,
            "baseline": asdict(self.baseline),
            "challenger": asdict(self.challenger),
            "delta_success_rate": round(self.delta_success_rate, 4),
            "delta_wilson_lower": round(self.delta_wilson_lower, 4),
            "token_savings_pct": round(self.token_savings_pct, 2),
            "retry_reduction_pct": round(self.retry_reduction_pct, 2),
            "reproducible_command": self.reproducible_command,
            "winner_identifier": self.winner_identifier,
            "verdict_summary": self.verdict_summary,
        }


class WorkflowComparisonEngine:
    """
    Executes and synthesizes head-to-head empirical benchmarks.
    """

    @staticmethod
    def compare(
        task_slug: str,
        baseline: CandidateTrialSummary,
        challenger: CandidateTrialSummary,
        reproducible_command: Optional[str] = None,
    ) -> HeadToHeadComparisonResult:
        delta_success = challenger.success_rate - baseline.success_rate
        delta_wilson = challenger.wilson_lower_bound - baseline.wilson_lower_bound

        # Calculate token savings pct (positive means challenger used fewer tokens)
        if baseline.average_token_consumption > 0:
            token_savings = ((baseline.average_token_consumption - challenger.average_token_consumption) / baseline.average_token_consumption) * 100.0
        else:
            token_savings = 0.0

        # Calculate retry reduction pct
        if baseline.average_retries > 0:
            retry_reduction = ((baseline.average_retries - challenger.average_retries) / baseline.average_retries) * 100.0
        else:
            retry_reduction = 0.0

        # Winner selection strictly based on Wilson 95% lower bound
        if challenger.wilson_lower_bound > baseline.wilson_lower_bound:
            winner = challenger.candidate_identifier
            verdict = (
                f"{challenger.candidate_identifier} outperforms {baseline.candidate_identifier} "
                f"with a Wilson 95% lower bound of {challenger.wilson_lower_bound:.1%} vs {baseline.wilson_lower_bound:.1%} "
                f"({token_savings:+.1f}% token consumption)."
            )
        elif baseline.wilson_lower_bound > challenger.wilson_lower_bound:
            winner = baseline.candidate_identifier
            verdict = (
                f"{baseline.candidate_identifier} retains superiority "
                f"({baseline.wilson_lower_bound:.1%} vs {challenger.wilson_lower_bound:.1%} Wilson lower bound)."
            )
        else:
            winner = "STATISTICAL_TIE"
            verdict = "Statistical tie: insufficient empirical separation at 95% confidence."

        cmd = reproducible_command or f"spe bench compare --task {task_slug} --a {baseline.candidate_identifier} --b {challenger.candidate_identifier}"

        import hashlib
        comp_id = f"CMP-{hashlib.sha256(f'{task_slug}:{baseline.candidate_identifier}:{challenger.candidate_identifier}'.encode()).hexdigest()[:12]}"

        return HeadToHeadComparisonResult(
            comparison_id=comp_id,
            task_slug=task_slug,
            baseline=baseline,
            challenger=challenger,
            delta_success_rate=delta_success,
            delta_wilson_lower=delta_wilson,
            token_savings_pct=token_savings,
            retry_reduction_pct=retry_reduction,
            reproducible_command=cmd,
            winner_identifier=winner,
            verdict_summary=verdict,
        )
