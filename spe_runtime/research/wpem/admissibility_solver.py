"""
SPE Ω — WPEM Multi-Objective Admissibility Solver & Lagrangian Optimizer.
Evaluates the formal admissibility predicate Admissible(P, H_t, K, O, A, E)
and minimizes multi-objective cost J(P) = C_API(P) + alpha*Latency + beta*Energy + C_revalidation.
"""

from typing import Dict, Any, List, Set, Optional, Tuple
from spe_runtime.research.wdes.types import NanoUSD, NetworkPolicy, validate_nanos
from .types import (
    CandidateExecutionPlan,
    HardwareEnvelope,
    AdmissibilityStatus,
)


class AdmissibilitySolver:
    """
    Evaluates candidate execution plan P against physical hardware envelope H_t
    and task contract (K, O, A, E).
    """

    def __init__(
        self,
        alpha_latency_weight: float = 1.0,     # Nanos per millisecond
        beta_energy_weight: float = 0.5,        # Nanos per millijoule
        max_permitted_latency_ms: float = 5000.0,
    ):
        self.alpha = alpha_latency_weight
        self.beta = beta_energy_weight
        self.max_latency_ms = max_permitted_latency_ms

    def compute_lagrangian_cost(
        self,
        plan: CandidateExecutionPlan,
        revalidation_cost_nanos: NanoUSD = 0,
    ) -> float:
        """
        Calculates unified Lagrangian cost:
        J(P) = C_API(P) + alpha * C_latency(P) + beta * C_energy(P) + C_revalidation(P)
        """
        api_nanos = plan.total_cost_nanos
        latency_penalty = self.alpha * plan.total_latency_ms
        energy_penalty = self.beta * plan.total_energy_mj
        return float(api_nanos) + latency_penalty + energy_penalty + float(revalidation_cost_nanos)

    def evaluate_admissibility(
        self,
        plan: CandidateExecutionPlan,
        hardware: HardwareEnvelope,
        mandatory_obligations: Set[str],
        granted_authorities: Set[str],
        current_network_policy: NetworkPolicy,
        thermal_state: Optional[str] = None,
    ) -> Tuple[AdmissibilityStatus, Optional[str]]:
        """
        Evaluates Admissible(P, H_t, K, O, A, E) across all five invariants.
        Returns (ADMITTED, None) or (REJECTED/DEFERRED, reason).
        """
        effective_thermal = thermal_state or hardware.thermal_state

        # 1. Structural Preservation: All mandatory obligations O must be accounted for
        accounted_obs = plan.all_accounted_obligations()
        missing_obs = mandatory_obligations - accounted_obs
        if missing_obs:
            return AdmissibilityStatus.REJECTED, f"Structural preservation failed: missing obligations {missing_obs}"

        # 2. Latency Bound
        if plan.total_latency_ms > self.max_latency_ms:
            return AdmissibilityStatus.REJECTED, f"Latency ceiling exceeded: {plan.total_latency_ms}ms > {self.max_latency_ms}ms"

        # 3. Hardware Resource Admission: Memory Headroom & Thermal State
        for node in plan.nodes:
            # Memory check: Free memory must be >= 1.5x required footprint
            if not hardware.memory_headroom_satisfied(node.required_memory_bytes, multiplier=1.5):
                return AdmissibilityStatus.DEFERRED, (
                    f"Memory headroom violation for node '{node.node_id}': "
                    f"Free {hardware.available_memory_bytes} < 1.5x required {node.required_memory_bytes}"
                )

            # Thermal check: If thermal state is CRITICAL, stochastic heavy models are inadmissible
            if effective_thermal == "CRITICAL" and not node.is_deterministic:
                return AdmissibilityStatus.DEFERRED, (
                    f"Thermal refusal for node '{node.node_id}': "
                    f"Stochastic heavy inference forbidden under CRITICAL thermal state"
                )

        # 4. Authority Bounds: All required authorities must be in granted_authorities
        for node in plan.nodes:
            missing_auth = node.required_authority - granted_authorities
            if missing_auth:
                return AdmissibilityStatus.REJECTED, f"Authority boundary violation: missing {missing_auth} for '{node.node_id}'"

        # 5. Network Policy / Air-gap boundary
        policy_order = {
            NetworkPolicy.AIR_GAPPED: 0,
            NetworkPolicy.LOCAL_ONLY: 1,
            NetworkPolicy.RESTRICTED_CLOUD: 2,
            NetworkPolicy.PUBLIC_EGRESS: 3,
        }
        max_level = policy_order.get(current_network_policy, 0)
        for node in plan.nodes:
            node_level = policy_order.get(node.network_policy, 0)
            if node_level > max_level:
                return AdmissibilityStatus.REJECTED, (
                    f"Network policy violation for node '{node.node_id}': "
                    f"Node policy '{node.network_policy.value}' exceeds allowed '{current_network_policy.value}'"
                )

        return AdmissibilityStatus.ADMITTED, None
