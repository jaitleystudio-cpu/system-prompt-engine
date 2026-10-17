"""
SPE Ω — WPEM Execution Graph Rewriter.
Dynamically reconstructs execution plans across models, deterministic programs,
and hardware backends while strictly preserving mandatory obligations and 2PC effect isolation.
"""

from typing import Dict, Any, List, Set, Optional, Tuple
from spe_runtime.research.wdes.types import NanoUSD, NetworkPolicy
from .types import (
    CandidateExecutionPlan,
    ExecutionPlanNode,
    HardwareEnvelope,
    TransformationRecord,
    TransformationType,
    AdmissibilityStatus,
)
from .admissibility_solver import AdmissibilitySolver
from .hysteresis_filter import ThermalHysteresisFilter


class ExecutionGraphRewriter:
    """
    Core WPEM Graph Rewriting Engine:
    Recompiles an execution plan P1 into an admitted plan P2 under changing physical resources.
    """

    def __init__(
        self,
        transformation_library: Optional[List[TransformationRecord]] = None,
        admissibility_solver: Optional[AdmissibilitySolver] = None,
        hysteresis_filter: Optional[ThermalHysteresisFilter] = None,
    ):
        self.library = transformation_library or []
        self.solver = admissibility_solver or AdmissibilitySolver()
        self.hysteresis = hysteresis_filter or ThermalHysteresisFilter()

    def register_transformation(self, record: TransformationRecord) -> None:
        self.library.append(record)

    def rewrite_plan(
        self,
        initial_plan: CandidateExecutionPlan,
        hardware: HardwareEnvelope,
        mandatory_obligations: Set[str],
        granted_authorities: Set[str],
        current_network_policy: NetworkPolicy,
        current_time_s: float = 0.0,
    ) -> Tuple[CandidateExecutionPlan, AdmissibilityStatus, List[TransformationType]]:
        """
        Attempts to rewrite initial_plan if inadmissible under current hardware envelope.
        Returns:
            (morphed_plan, status, applied_transformations)
        """
        # Step 1: Damped thermal state via asymmetric hysteresis
        effective_thermal = self.hysteresis.process_envelope(hardware, current_time_s)

        # Check if initial plan is already admissible
        status, reason = self.solver.evaluate_admissibility(
            plan=initial_plan,
            hardware=hardware,
            mandatory_obligations=mandatory_obligations,
            granted_authorities=granted_authorities,
            current_network_policy=current_network_policy,
            thermal_state=effective_thermal,
        )

        if status == AdmissibilityStatus.ADMITTED:
            return initial_plan, AdmissibilityStatus.ADMITTED, []

        # Step 2: Inadmissible under hardware pressure -> Morph uncommitted nodes
        applied_transforms: List[TransformationType] = []
        morphed_nodes: List[ExecutionPlanNode] = []

        for node in initial_plan.nodes:
            # 2PC Isolation: Committed irreversible nodes cannot be morphed!
            if node.is_committed:
                morphed_nodes.append(node)
                continue

            # If node is already deterministic and fits memory, keep it
            if node.is_deterministic and hardware.memory_headroom_satisfied(node.required_memory_bytes):
                morphed_nodes.append(node)
                continue

            # Search library for replacement transformation (T1, T2, T3)
            matched_transform = None
            for t in self.library:
                if t.source_operation == node.operation_name:
                    # Check if target fits current hardware
                    if hardware.memory_headroom_satisfied(t.required_memory_bytes):
                        # If thermal state is CRITICAL, target must be deterministic
                        if effective_thermal == "CRITICAL" and t.transformation_type == TransformationType.LARGE_TO_SMALL_MODEL:
                            continue
                        matched_transform = t
                        break

            if matched_transform:
                applied_transforms.append(matched_transform.transformation_type)
                # Morph node into target operation
                morphed_nodes.append(ExecutionPlanNode(
                    node_id=f"morphed_{node.node_id}",
                    operation_name=matched_transform.target_operation,
                    is_deterministic=(matched_transform.transformation_type in (
                        TransformationType.MODEL_TO_PROGRAM, TransformationType.PROGRAM_TO_PROCEDURE
                    )),
                    is_committed=False,
                    required_memory_bytes=matched_transform.required_memory_bytes,
                    estimated_cost_nanos=matched_transform.estimated_api_cost_nanos,
                    estimated_latency_ms=matched_transform.estimated_latency_ms,
                    estimated_energy_mj=matched_transform.estimated_energy_mj,
                    accounted_obligations=set(matched_transform.obligation_mapping.keys()) or node.accounted_obligations,
                    required_authority=node.required_authority,
                    network_policy=matched_transform.privacy_boundary,
                ))
            else:
                # No valid transformation found for this node
                morphed_nodes.append(node)

        candidate_morphed = CandidateExecutionPlan(
            plan_id=f"morphed_{initial_plan.plan_id}",
            nodes=morphed_nodes,
        )

        # Step 3: Evaluate morphed plan admissibility
        morphed_status, morphed_reason = self.solver.evaluate_admissibility(
            plan=candidate_morphed,
            hardware=hardware,
            mandatory_obligations=mandatory_obligations,
            granted_authorities=granted_authorities,
            current_network_policy=current_network_policy,
            thermal_state=effective_thermal,
        )

        if morphed_status == AdmissibilityStatus.ADMITTED:
            return candidate_morphed, AdmissibilityStatus.ADMITTED, applied_transforms

        # Step 4: Transformation 5 (Honest Deferral)
        # If resource constraints still cannot be met, return safe partial plan
        applied_transforms.append(TransformationType.HONEST_DEFERRAL)
        return candidate_morphed, AdmissibilityStatus.DEFERRED, applied_transforms
