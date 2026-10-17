"""
SPE AGI BRAIN Ω — Discovery Utility Objective Calculator
October 12, 2026 | Research Quarantine Track
"""

from typing import Dict, Any
from spe_runtime.research.agi_brain.types import NANOS_PER_USD

class DiscoveryObjectiveCalculator:
    """
    Computes the scientific discovery utility function:
    U(e) = (E[Delta K_verified] + lambda * E[Delta T_transfer]) / Cost_total - R_false_acceptance
    Uses exact integer NanoUSD accounting to prevent continuous float currency leakage.
    """

    def __init__(self, lambda_weight: float = 1.5, false_acceptance_penalty_nanos: int = 10_000_000_000):
        # false_acceptance_penalty_nanos: default 10 USD (10 * 10^9 nanos)
        self.lambda_weight = lambda_weight
        self.false_acceptance_penalty_nanos = false_acceptance_penalty_nanos

    def compute_utility(
        self,
        delta_k_verified: float,     # Verified knowledge gain (units 0.0 to 100.0)
        delta_t_transfer: float,     # Holdout transfer gain (units 0.0 to 100.0)
        compute_cost_nanos: int,     # Compute cost in NanoUSD
        measurement_cost_nanos: int, # Measurement/experiment cost in NanoUSD
        human_cost_nanos: int = 0,   # Human review cost in NanoUSD
        has_false_acceptance: bool = False,
    ) -> Dict[str, Any]:
        total_cost_nanos = max(1, compute_cost_nanos + measurement_cost_nanos + human_cost_nanos)

        # Numerator: weighted scientific progress (scaled by 10^9 for exact integer precision)
        numerator_scale = int((delta_k_verified + (self.lambda_weight * delta_t_transfer)) * 1_000_000)

        # Normalized efficiency score
        base_efficiency = numerator_scale / (total_cost_nanos / 1_000)

        penalty_nanos = self.false_acceptance_penalty_nanos if has_false_acceptance else 0
        final_utility = base_efficiency - (penalty_nanos / 1_000_000)

        return {
            "utility_score": round(final_utility, 4),
            "total_cost_nanos": total_cost_nanos,
            "total_cost_usd": total_cost_nanos / NANOS_PER_USD,
            "has_false_acceptance": has_false_acceptance,
            "penalty_applied_nanos": penalty_nanos,
        }
