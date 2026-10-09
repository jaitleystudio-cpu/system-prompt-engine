"""
SPE Ω — Counterfactual Specification Closure (CSC) Probe Synthesizer.
Solves q* = argmax [ (Delta V(q) + lambda * V_reuse(q)) / C_total(q) ]
to find the cheapest authorized probe separating w_good and w_bad.
"""

from __future__ import annotations

from typing import List, Optional, Tuple, Any, Dict

from .models import (
    DistinguishingProbe,
    WorldModel,
    WorldPair,
    ProbeVerdict,
    OracleStatus,
    NanoUSD,
    NetworkPolicy,
)
from .probe_optimizer import ProbeOptimizer


class ProbeSynthesizer:
    """
    Synthesizes and selects the optimal distinguishing probe q* that separates
    a compliant world from an adversarial counterfactual world under strict constraints.
    """

    def __init__(
        self,
        default_lambda: float = 0.5,
        default_network_policy: NetworkPolicy = NetworkPolicy.AIR_GAPPED,
    ) -> None:
        self.optimizer = ProbeOptimizer(
            default_lambda=default_lambda,
            default_network_policy=default_network_policy,
        )

    def synthesize_optimal_probe(
        self,
        candidate_probes: List[DistinguishingProbe],
        world_pair: WorldPair,
        budget_nanos: NanoUSD = 10_000_000,
        granted_authorities: Optional[List[str]] = None,
        network_policy: Optional[NetworkPolicy] = None,
        target_obligation_ref: Optional[str] = None,
        lambda_reuse: Optional[float] = None,
    ) -> Optional[DistinguishingProbe]:
        """
        Solves:
        q* = argmax_{q in Q_admissible} [ (Delta V(q) + lambda * V_reuse(q)) / C_total(q) ]
        """
        return self.optimizer.optimize(
            candidate_probes=candidate_probes,
            budget_nanos=budget_nanos,
            granted_authorities=granted_authorities or [],
            network_policy=network_policy,
            world_pair=world_pair,
            target_obligation_ref=target_obligation_ref,
            lambda_reuse=lambda_reuse,
        )

    def execute_and_classify(
        self,
        probe: DistinguishingProbe,
        subject: Any,
        world_pair: Optional[WorldPair] = None,
        budget_nanos: NanoUSD = 10_000_000,
        granted_authorities: Optional[List[str]] = None,
    ) -> Tuple[ProbeVerdict, Any]:
        """Executes probe and classifies subject as SUCCESS_CONFIRMED or COUNTEREXAMPLE_EXPOSED."""
        return self.optimizer.execute_probe(
            probe=probe,
            subject=subject,
            budget_nanos=budget_nanos,
            granted_authorities=granted_authorities if granted_authorities is not None else list(probe.required_authority),
            world_pair=world_pair,
        )
