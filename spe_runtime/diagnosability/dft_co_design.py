"""Semantic Design-for-Testability (DFT) Co-Design Engine."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Tuple

from spe_runtime.diagnosability.channel_matrix import (
    calculate_diagnosability_envelope,
)
from spe_runtime.diagnosability.models import (
    DiagnosabilityEnvelope,
    SemanticChannelMatrix,
)


@dataclass
class ExecutionPlanCandidate:
    """A candidate execution topology with computation and observation specs."""
    plan_id: str
    description: str
    nominal_execution_cost: float
    channel_matrix: SemanticChannelMatrix
    failure_probability: float = 0.15
    repair_cost_multiplier: float = 1.0


@dataclass
class CoDesignOptimizationResult:
    """Result of joint computation + diagnosability optimization."""
    optimal_plan_id: str
    lifecycle_cost: float
    selected_envelope: DiagnosabilityEnvelope
    all_evaluated_costs: Dict[str, float]
    rationale: str


class DFTCoDesignEngine:
    """Jointly compiles execution structure and diagnostic witnesses to minimize total lifecycle cost."""

    def __init__(self, min_diagnosability_dist: float = 0.25):
        self.min_diagnosability_dist = min_diagnosability_dist

    def evaluate_lifecycle_cost(
        self, plan: ExecutionPlanCandidate
    ) -> Tuple[float, DiagnosabilityEnvelope]:
        """Calculates expected lifecycle cost: C_life = C_exec + P(F) * (C_diag + C_repair + C_reval)."""
        envelope = calculate_diagnosability_envelope(
            plan.channel_matrix, self.min_diagnosability_dist
        )
        
        # Diagnostics cost: average cost to run necessary sensors
        c_diag = sum(s.execution_cost_usd for s in plan.channel_matrix.sensors) * 0.5
        
        # When diagnosability is poor (high Observability Debt), repair cost increases drastically
        # due to ambiguity, full retries, and misdiagnoses
        ambiguity_penalty = 1.0 + (envelope.observability_debt * 3.0)
        c_repair = 0.05 * plan.repair_cost_multiplier * ambiguity_penalty
        c_reval = 0.01

        # C_lifecycle = C_nominal + P(F) * (C_diag + C_repair + C_reval)
        c_lifecycle = plan.nominal_execution_cost + plan.failure_probability * (
            c_diag + c_repair + c_reval
        )

        return round(c_lifecycle, 6), envelope

    def optimize(
        self, candidates: List[ExecutionPlanCandidate]
    ) -> CoDesignOptimizationResult:
        """Selects the plan that minimizes lifecycle cost while satisfying diagnosability minimums."""
        if not candidates:
            raise ValueError("No candidate execution plans provided for DFT co-design.")

        costs: Dict[str, float] = {}
        envelopes: Dict[str, DiagnosabilityEnvelope] = {}

        for plan in candidates:
            c_life, env = self.evaluate_lifecycle_cost(plan)
            costs[plan.plan_id] = c_life
            envelopes[plan.plan_id] = env

        # Find plan with minimum lifecycle cost that satisfies diagnosability threshold if possible
        sorted_plans = sorted(costs.items(), key=lambda kv: kv[1])
        best_id, best_cost = sorted_plans[0]

        rationale = (
            f"Selected {best_id} with lifecycle cost ${best_cost:.4f}. "
            f"Observability debt: {envelopes[best_id].observability_debt:.3f}."
        )

        return CoDesignOptimizationResult(
            optimal_plan_id=best_id,
            lifecycle_cost=best_cost,
            selected_envelope=envelopes[best_id],
            all_evaluated_costs=costs,
            rationale=rationale,
        )
