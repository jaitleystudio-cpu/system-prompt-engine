"""Epistemic Speculative Cascade with Behavioral Deoptimization."""

from __future__ import annotations

from typing import Any, Callable, Dict, List, Optional, Tuple

from spe_runtime.cost_engine.models import CostTier, SpeculativeCascadeResult


class EpistemicSpeculativeCascade:
    """Speculatively executes tasks on micro/compact models, deoptimizing to frontier only on invariant failure."""

    def __init__(
        self,
        compact_cost_per_m_tokens: float = 0.60,
        frontier_cost_per_m_tokens: float = 15.00,
    ):
        self.compact_cost_per_m_tokens = compact_cost_per_m_tokens
        self.frontier_cost_per_m_tokens = frontier_cost_per_m_tokens

    def execute(
        self,
        task_prompt: str,
        speculative_runner: Callable[[str], Tuple[str, int]],
        frontier_runner: Callable[[str], Tuple[str, int]],
        invariant_verifier: Callable[[str], bool],
    ) -> SpeculativeCascadeResult:
        """Executes the speculative cascade: runs compact first, checks invariants, deoptimizes if necessary."""
        # 1. Speculative trial on compact tier
        spec_output, spec_tokens = speculative_runner(task_prompt)
        spec_cost = (spec_tokens / 1_000_000.0) * self.compact_cost_per_m_tokens

        # 2. Check guarded invariants
        is_valid = invariant_verifier(spec_output)

        if is_valid:
            # Speculation succeeded! Commit at massive cost savings
            return SpeculativeCascadeResult(
                attempted_tier=CostTier.COMPACT,
                committed_tier=CostTier.COMPACT,
                deoptimized=False,
                deopt_reason=None,
                tokens_consumed=spec_tokens,
                cost_usd=round(spec_cost, 6),
                invariants_satisfied=True,
            )

        # 3. Invariant failed! Trigger Behavioral Deoptimization to Frontier tier
        frontier_output, frontier_tokens = frontier_runner(task_prompt)
        frontier_cost = (frontier_tokens / 1_000_000.0) * self.frontier_cost_per_m_tokens
        total_cost = spec_cost + frontier_cost
        total_tokens = spec_tokens + frontier_tokens

        frontier_valid = invariant_verifier(frontier_output)

        return SpeculativeCascadeResult(
            attempted_tier=CostTier.COMPACT,
            committed_tier=CostTier.FRONTIER,
            deoptimized=True,
            deopt_reason="Speculative output violated protected behavioral invariant; deoptimized to frontier model",
            tokens_consumed=total_tokens,
            cost_usd=round(total_cost, 6),
            invariants_satisfied=frontier_valid,
        )
