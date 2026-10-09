"""
SPE Ω — Counterfactual Specification Closure (CSC) Probe Optimizer.
Implements the information-theoretic optimization solver:
q* = argmax_{q in Q_admissible} [ (Delta V(q) + lambda * V_reuse(q)) / C_total(q) ]
subject to authority gates, financial cost limits, and air-gap network policies.
"""

from __future__ import annotations

import math
from typing import List, Optional, Tuple, Any, Dict, Callable

from .models import (
    DistinguishingProbe,
    WorldModel,
    WorldPair,
    ProbeVerdict,
    OracleStatus,
    NanoUSD,
    validate_nanos,
    NetworkPolicy,
)


class ProbeOptimizer:
    """
    Distinguishing Probe Information-Gain Optimizer.
    Solves for the most cost-effective admissible probe that eliminates
    counterfactual failure ambiguity.
    """

    def __init__(
        self,
        default_lambda: float = 0.5,
        default_network_policy: NetworkPolicy = NetworkPolicy.AIR_GAPPED,
    ):
        if default_lambda < 0.0:
            raise ValueError(f"default_lambda cannot be negative: {default_lambda}")
        self.default_lambda = default_lambda
        self.default_network_policy = default_network_policy

    def compute_score(
        self,
        probe: DistinguishingProbe,
        lambda_reuse: Optional[float] = None,
    ) -> float:
        """
        Calculates information efficiency:
        score(q) = (Delta V(q) + lambda * V_reuse(q)) / C_total(q)

        Zero-cost probes (C=0) receive infinite priority, ordered by numerator value.
        """
        l_val = self.default_lambda if lambda_reuse is None else lambda_reuse
        if l_val < 0.0:
            raise ValueError(f"lambda_reuse cannot be negative: {l_val}")

        numerator = probe.delta_v + (l_val * probe.v_reuse)
        cost = probe.cost_nanos

        if cost == 0:
            if numerator > 0.0:
                return float("inf")
            return 0.0

        return numerator / float(cost)

    def is_admissible(
        self,
        probe: DistinguishingProbe,
        budget_nanos: NanoUSD,
        granted_authorities: List[str],
        network_policy: Optional[NetworkPolicy] = None,
        world_pair: Optional[WorldPair] = None,
        target_obligation_ref: Optional[str] = None,
    ) -> Tuple[bool, Optional[str]]:
        """
        Checks the four admissibility invariants:
        1. Obligation-Bound
        2. Authority-Gated
        3. Cost-Bounded
        4. Independently Evaluable (Qualified Oracle)
        5. Hard-Boundary Network Policy (Air-Gap compliant)
        6. Distinguishing Power (if world_pair provided)
        """
        validate_nanos(budget_nanos, "budget_nanos")
        current_net_policy = network_policy or self.default_network_policy

        # 1. Obligation binding
        if target_obligation_ref is not None:
            if probe.target_obligation_ref != target_obligation_ref:
                return False, f"Probe target obligation mismatch: {probe.target_obligation_ref} != {target_obligation_ref}"

        # 2. Authority gating
        granted_set = set(granted_authorities)
        for auth in probe.required_authority:
            if auth not in granted_set:
                return False, f"Missing required authority: '{auth}'"

        # 3. Cost bounding
        if probe.cost_nanos > budget_nanos:
            return False, f"Probe cost {probe.cost_nanos} Nanos exceeds budget {budget_nanos} Nanos"

        # 4. Independent oracle qualification
        if probe.oracle_status != OracleStatus.QUALIFIED:
            return False, f"Probe oracle is not qualified (status: {probe.oracle_status.value})"

        # 5. Network policy / Air-gap compliance
        policy_order = {
            NetworkPolicy.AIR_GAPPED: 0,
            NetworkPolicy.LOCAL_ONLY: 1,
            NetworkPolicy.RESTRICTED_CLOUD: 2,
            NetworkPolicy.PUBLIC_EGRESS: 3,
        }
        probe_policy_level = policy_order.get(probe.network_policy, 99)
        current_policy_level = policy_order.get(current_net_policy, 0)
        if probe_policy_level > current_policy_level:
            return False, (
                f"Probe network policy {probe.network_policy.value} exceeds "
                f"maximum allowed policy {current_net_policy.value}"
            )

        # 6. Distinguishing capability against target world pair
        if world_pair is not None:
            if not probe.can_distinguish(world_pair.w_good, world_pair.w_bad):
                return False, "Probe fails to distinguish target world pair (Obs_q(w_good) == Obs_q(w_bad))"

        return True, None

    def filter_admissible(
        self,
        candidate_probes: List[DistinguishingProbe],
        budget_nanos: NanoUSD,
        granted_authorities: List[str],
        network_policy: Optional[NetworkPolicy] = None,
        world_pair: Optional[WorldPair] = None,
        target_obligation_ref: Optional[str] = None,
    ) -> List[DistinguishingProbe]:
        """Filters candidate probes down to the admissible subset Q_admissible."""
        admissible = []
        for p in candidate_probes:
            ok, _ = self.is_admissible(
                probe=p,
                budget_nanos=budget_nanos,
                granted_authorities=granted_authorities,
                network_policy=network_policy,
                world_pair=world_pair,
                target_obligation_ref=target_obligation_ref,
            )
            if ok:
                admissible.append(p)
        return admissible

    def optimize(
        self,
        candidate_probes: List[DistinguishingProbe],
        budget_nanos: NanoUSD,
        granted_authorities: List[str],
        network_policy: Optional[NetworkPolicy] = None,
        world_pair: Optional[WorldPair] = None,
        target_obligation_ref: Optional[str] = None,
        lambda_reuse: Optional[float] = None,
    ) -> Optional[DistinguishingProbe]:
        """
        Solves:
        q* = argmax_{q in Q_admissible} [ (Delta V(q) + lambda * V_reuse(q)) / C_total(q) ]
        Returns None if Q_admissible is empty.
        """
        admissible = self.filter_admissible(
            candidate_probes=candidate_probes,
            budget_nanos=budget_nanos,
            granted_authorities=granted_authorities,
            network_policy=network_policy,
            world_pair=world_pair,
            target_obligation_ref=target_obligation_ref,
        )

        if not admissible:
            return None

        l_val = self.default_lambda if lambda_reuse is None else lambda_reuse

        # Key sorting: sort descending by (priority_tier, score_or_num, -cost, probe_id)
        def sort_key(p: DistinguishingProbe):
            num = p.delta_v + (l_val * p.v_reuse)
            if p.cost_nanos == 0:
                if num > 0.0:
                    return (2, num, -p.cost_nanos, p.probe_id)
                else:
                    return (0, 0.0, 0, p.probe_id)
            score = num / float(p.cost_nanos)
            return (1, score, -p.cost_nanos, p.probe_id)

        best_probe = max(admissible, key=sort_key)
        return best_probe

    def execute_probe(
        self,
        probe: DistinguishingProbe,
        subject: Any,
        budget_nanos: NanoUSD,
        granted_authorities: List[str],
        expected_valid_output: Any = None,
        world_pair: Optional[WorldPair] = None,
    ) -> Tuple[ProbeVerdict, Any]:
        """
        Executes a distinguishing probe against a subject (a WorldModel, a callable function, or an object).
        Enforces authority and budget gates prior to execution.
        """
        # Authority check
        granted_set = set(granted_authorities)
        for auth in probe.required_authority:
            if auth not in granted_set:
                return ProbeVerdict.UNAUTHORIZED, None

        # Budget check
        if probe.cost_nanos > budget_nanos:
            return ProbeVerdict.BUDGET_EXCEEDED, None

        try:
            actual_result = probe.evaluate(subject)

            # If world_pair is provided, verify whether probe distinguishes the worlds
            if world_pair is not None:
                obs_good = probe.evaluate(world_pair.w_good)
                obs_bad = probe.evaluate(world_pair.w_bad)

                if obs_good == obs_bad:
                    # Inconclusive observation: probe cannot distinguish the modeled worlds
                    return ProbeVerdict.INCONCLUSIVE, actual_result

                if actual_result == obs_good:
                    return ProbeVerdict.SUCCESS_CONFIRMED, actual_result
                elif actual_result == obs_bad:
                    return ProbeVerdict.COUNTEREXAMPLE_EXPOSED, actual_result

            # Compare against expected compliant observation
            expected = True if expected_valid_output is None else expected_valid_output
            if callable(expected):
                is_valid = expected(actual_result)
            else:
                is_valid = (actual_result == expected)

            if is_valid:
                return ProbeVerdict.SUCCESS_CONFIRMED, actual_result
            else:
                return ProbeVerdict.COUNTEREXAMPLE_EXPOSED, actual_result

        except Exception as e:
            # An unhandled crash or exception on an adversarial probe exposes a counterexample
            return ProbeVerdict.COUNTEREXAMPLE_EXPOSED, str(e)
