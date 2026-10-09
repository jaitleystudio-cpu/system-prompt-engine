"""
SPE Ω — BWFS Bidirectional Frontier Scheduler (Paper 1).
Schedules computation actions to close witness gaps, prioritizing zero-cost deterministic probes
over expensive neural reasoning, under strict privacy and budget constraints.
"""

from dataclasses import dataclass
from typing import Dict, List, Set, Optional, Callable, Any
from .types import NanoUSD, NetworkPolicy, SecurityLabel
from .witness_hypergraph import (
    ObligationHypergraph, WitnessNode, WitnessType
)


@dataclass
class ActionCandidate:
    action_id: str
    target_witness_id: str
    action_name: str
    cost_nanos: NanoUSD
    latency_ms: float
    is_remote: bool
    execute_fn: Optional[Callable[[], Any]] = None


class FrontierScheduler:
    """
    Schedules the optimal next action a* to collapse the largest witness gap
    at minimal cost: a* = argmin [ C(a) + E[V(Sigma ⊕ Obs(a))] ].
    """

    def __init__(self, hypergraph: ObligationHypergraph, network_policy: NetworkPolicy, available_budget_nanos: NanoUSD):
        self.hypergraph = hypergraph
        self.network_policy = network_policy
        self.available_budget_nanos = available_budget_nanos

    def filter_eligible_actions(
        self,
        candidate_actions: List[ActionCandidate],
        frontier_witness_ids: Set[str],
        established_witness_ids: Optional[Set[str]] = None
    ) -> List[ActionCandidate]:
        established = established_witness_ids or set()
        eligible = []

        for action in candidate_actions:
            # 1. Action must target an active witness in the frontier
            if action.target_witness_id not in frontier_witness_ids:
                continue

            witness = self.hypergraph.witnesses.get(action.target_witness_id)
            if not witness:
                continue

            # 2. Sanity gate: non-negative financial cost and non-negative latency
            if action.cost_nanos < 0 or action.latency_ms < 0:
                continue

            # 3. Prerequisite Inputs Gate: All required inputs must be established
            if witness.required_inputs and not set(witness.required_inputs).issubset(established):
                continue

            # 4. Hard Privacy Gate: Air-gapped policy strictly forbids remote actions
            # Effective remote check: Either action claims remote OR witness is an inherently remote frontier model
            is_effective_remote = action.is_remote or (witness.witness_type == WitnessType.FRONTIER_MODEL)
            if is_effective_remote and self.network_policy in (NetworkPolicy.AIR_GAPPED, NetworkPolicy.LOCAL_ONLY):
                continue

            # 5. Hard Budget Gate: Cannot schedule action exceeding available budget
            if action.cost_nanos > self.available_budget_nanos:
                continue

            eligible.append(action)

        return eligible

    def select_next_action(
        self,
        candidate_actions: List[ActionCandidate],
        established_witness_ids: Set[str]
    ) -> Optional[ActionCandidate]:
        """
        Selects the optimal action a* from the eligible set.
        Prioritizes:
        1. Deterministic / Static probes ($0 cost, immediate falsification).
        2. Local SLMs.
        3. Frontier cloud models (only if permitted and required).
        """
        frontier = self.hypergraph.compute_witness_frontier(established_witness_ids)
        if not frontier:
            return None  # All obligations satisfied!

        eligible = self.filter_eligible_actions(candidate_actions, frontier, established_witness_ids)
        if not eligible:
            return None  # Blocked: No eligible action to close remaining gaps

        # Ranking score: lower is better
        # Score = Cost (in Nanos) + (Latency in ms * 1000) - (Safety-Critical Bonus)
        def score_action(action: ActionCandidate) -> float:
            witness = self.hypergraph.witnesses.get(action.target_witness_id)
            if not witness:
                return float("inf")

            # Check if target obligation is safety-critical and still unsatisfied
            unsatisfied_obs = set(self.hypergraph.obligations.keys()) - self.hypergraph.compute_satisfied_obligations(established_witness_ids)
            is_critical = any(
                ob_id in unsatisfied_obs and self.hypergraph.obligations[ob_id].is_safety_critical
                for ob_id in witness.produces_evidence_for
                if ob_id in self.hypergraph.obligations
            )

            base_cost = action.cost_nanos
            latency_penalty = action.latency_ms * 1_000.0

            # Deterministic actions get an enormous priority boost (simulating high Value of Information)
            if witness.witness_type in (WitnessType.DETERMINISTIC_PROBE, WitnessType.STATIC_ANALYSIS):
                type_priority = 0.0
            elif witness.witness_type == WitnessType.LOCAL_SLM:
                type_priority = 10_000_000.0  # $0.01 equivalent priority
            else:
                type_priority = 100_000_000.0 # $0.10 equivalent priority

            critical_bonus = -50_000_000.0 if (is_critical and witness.witness_type == WitnessType.DETERMINISTIC_PROBE) else 0.0

            return base_cost + latency_penalty + type_priority + critical_bonus

        eligible.sort(key=score_action)
        return eligible[0]
