"""
RGIC-E1 Evidence Closure Planner — Minimal Probe Selection & VOI Planning
Part of SPE Ω Research Quarantine.

Mathematical Core:
Utility(a) = (DeltaEntropy(a) * Criticality(o) * 1000) - CostNanoUSD(a) - RiskPenalty(a) - FrictionPenalty(a)
subject to a in A_authorized.

Enforces:
1. Strict integer arithmetic (NanoUSD and integer basis points).
2. Authorization boundaries (rejects unauthorized actions).
3. Value of Information (VOI): High friction user clarification is suppressed
   when deterministic or programmatic probes can resolve the obligation.
4. Minimal probe optimization: Selects the cheapest, lowest-risk action
   achieving the required uncertainty reduction.
"""

from typing import List, Optional, Dict
from spe_runtime.research.rgic_e1.types import (
    VerificationAction, Obligation, VerificationActionKind, ObligationState
)

class ClosurePlanner:
    """
    Bidirectional Evidence Acquisition Compiler.
    Determines what missing observations are required to close open obligations
    and selects optimal minimal probes.
    """
    def __init__(self):
        pass

    def evaluate_action_utility(self, action: VerificationAction, obligation: Obligation) -> int:
        """
        Calculates expected net utility of an action in exact integer units.
        Returns a strongly negative value (-10**15) if unauthorized.
        """
        if not action.is_authorized:
            return -1_000_000_000_000_000

        # Check obligation match if action is bound to a specific obligation
        if action.target_obligation_id and action.target_obligation_id != obligation.id:
            return -1_000_000_000_000_000

        # Information Yield = Expected Entropy Reduction (1..1000) * Criticality (1..10) * 1000
        entropy_reduction = max(1, min(1000, action.expected_entropy_reduction))
        criticality = max(1, min(10, obligation.criticality))
        informational_yield = entropy_reduction * criticality * 1_000_000

        # Risk penalty scaled to NanoUSD equivalent
        risk_penalty = action.risk_score * 10_000_000

        # Human friction penalty (e.g. for user clarification questions)
        # ACL 2026 Finding: Minimize user interruptions unless VOI exceeds threshold
        friction_penalty = action.clarification_friction_score * 20_000_000

        # Total net utility in integer units
        net_utility = informational_yield - action.cost_nano_usd - risk_penalty - friction_penalty
        return net_utility

    def select_minimal_probe(
        self, candidate_actions: List[VerificationAction], obligation: Obligation
    ) -> Optional[VerificationAction]:
        """
        Selects the admissible action that maximizes expected utility.
        If multiple actions achieve similar yield, minimal cost/risk action wins.
        """
        best_action: Optional[VerificationAction] = None
        best_utility: Optional[int] = None

        for action in candidate_actions:
            if not action.is_authorized:
                continue

            # If obligation authority boundary exists, verify action constraints
            if obligation.authority_boundary:
                boundary = obligation.authority_boundary
                if action.cost_nano_usd > boundary.max_cost_nano_usd:
                    continue
                if boundary.allowed_tools and action.kind == VerificationActionKind.TOOL_CALL:
                    if action.id not in boundary.allowed_tools and action.description not in boundary.allowed_tools:
                        continue

            utility = self.evaluate_action_utility(action, obligation)
            if best_utility is None or utility > best_utility:
                best_utility = utility
                best_action = action

        return best_action

    def plan_acquisition_schedule(
        self,
        obligations: List[Obligation],
        candidate_actions: List[VerificationAction],
        max_budget_nano_usd: int = 100_000_000_000
    ) -> List[VerificationAction]:
        """
        Synthesizes an optimal information acquisition schedule across all UNKNOWN obligations.
        Prioritizes high-criticality obligations and respects overall NanoUSD budget constraints.
        """
        schedule: List[VerificationAction] = []
        spent_budget_nano_usd: int = 0

        # Sort obligations by criticality descending
        open_obligations = [o for o in obligations if o.state == ObligationState.UNKNOWN]
        open_obligations.sort(key=lambda o: o.criticality, reverse=True)

        for obs in open_obligations:
            best_probe = self.select_minimal_probe(candidate_actions, obs)
            if best_probe:
                if spent_budget_nano_usd + best_probe.cost_nano_usd <= max_budget_nano_usd:
                    schedule.append(best_probe)
                    spent_budget_nano_usd += best_probe.cost_nano_usd

        return schedule
