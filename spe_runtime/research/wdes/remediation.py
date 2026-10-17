"""
SPE Ω — Infeasibility & Missing-Requirement Analysis (Paper 1 & C4P-X+).
Analyzes execution blockages when no eligible actions exist to close the witness frontier,
and computes the minimum-cost remediation set R* = argmin Cost(R') to restore progress.
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Set, Optional, Tuple
from .types import NanoUSD, NetworkPolicy, ObligationStatus
from .witness_hypergraph import ObligationHypergraph, WitnessType, HyperEdgeType


class RemediationActionType(str, Enum):
    GRANT_NETWORK_EGRESS = "GRANT_NETWORK_EGRESS"     # Relax network policy (e.g. Air-Gapped -> Restricted Cloud)
    INCREASE_BUDGET      = "INCREASE_BUDGET"           # Add budget nanos to allow frontier model inference
    USER_CONFIRMATION    = "USER_CONFIRMATION"         # Solicit human oracular witness
    INSTALL_LOCAL_TOOL   = "INSTALL_LOCAL_TOOL"        # Provide deterministic local probe for offline execution
    RELAX_OBLIGATION     = "RELAX_OBLIGATION"          # Non-safety critical obligation relaxation


@dataclass
class RemediationOption:
    option_id: str
    action_type: RemediationActionType
    target_obligation_ids: List[str]
    description: str
    cost_nanos: NanoUSD
    estimated_delay_ms: float
    metadata: Dict[str, str] = field(default_factory=dict)


class RemediationAnalyzer:
    """
    Solves the Bounded Infeasibility Problem:
    When FrontierScheduler returns None and unsatisfied obligations remain,
    diagnoses the root-cause constraints and computes the minimal remediation set R*.
    """

    def __init__(self, hypergraph: ObligationHypergraph):
        self.hypergraph = hypergraph

    def diagnose_and_solve(
        self,
        established_witness_ids: Set[str],
        current_network_policy: NetworkPolicy,
        available_budget_nanos: NanoUSD
    ) -> List[RemediationOption]:
        """
        Computes remediation candidates that can unblock the witness frontier.
        Returns sorted list of RemediationOption by cost.
        """
        satisfied_obs = self.hypergraph.compute_satisfied_obligations(established_witness_ids)
        unsatisfied_obs = set(self.hypergraph.obligations.keys()) - satisfied_obs

        # If all obligations are satisfied, nothing is blocked
        if not unsatisfied_obs:
            return []

        frontier = self.hypergraph.compute_witness_frontier(established_witness_ids)
        options: List[RemediationOption] = []

        # Analyze each blocked witness in the frontier
        for witness_id in frontier:
            witness = self.hypergraph.witnesses.get(witness_id)
            if not witness:
                continue

            target_obs = witness.produces_evidence_for

            # Subcase 1: Human confirmation witness needed
            if witness.witness_type == WitnessType.HUMAN_ORACULAR:
                options.append(RemediationOption(
                    option_id=f"rem_human_{witness_id}",
                    action_type=RemediationActionType.USER_CONFIRMATION,
                    target_obligation_ids=target_obs,
                    description=f"Solicit human confirmation for witness '{witness_id}'",
                    cost_nanos=0,
                    estimated_delay_ms=30000.0,
                    metadata={"witness_id": witness_id}
                ))

            # Subcase 2: Prerequisite inputs missing
            if witness.required_inputs and not set(witness.required_inputs).issubset(established_witness_ids):
                missing_inputs = sorted(list(set(witness.required_inputs) - established_witness_ids))
                options.append(RemediationOption(
                    option_id=f"rem_prereq_{witness_id}",
                    action_type=RemediationActionType.INSTALL_LOCAL_TOOL,
                    target_obligation_ids=target_obs,
                    description=f"Prerequisite inputs missing for witness '{witness_id}': {missing_inputs}",
                    cost_nanos=0,
                    estimated_delay_ms=100.0,
                    metadata={"witness_id": witness_id, "missing_prerequisites": ",".join(missing_inputs)}
                ))

            # Subcase 3: Blocked by network policy (Remote frontier model on air-gapped or local-only)
            # Evaluated independently from budget gate
            if witness.witness_type == WitnessType.FRONTIER_MODEL and current_network_policy in (
                NetworkPolicy.AIR_GAPPED, NetworkPolicy.LOCAL_ONLY
            ):
                options.append(RemediationOption(
                    option_id=f"rem_net_{witness_id}",
                    action_type=RemediationActionType.GRANT_NETWORK_EGRESS,
                    target_obligation_ids=target_obs,
                    description=(
                        f"Network egress blocked for frontier model witness '{witness_id}'. "
                        f"Grant RESTRICTED_CLOUD egress or install equivalent local deterministic probe."
                    ),
                    cost_nanos=0,
                    estimated_delay_ms=500.0,
                    metadata={"witness_id": witness_id, "required_policy": NetworkPolicy.RESTRICTED_CLOUD.value}
                ))

                # Also suggest offline deterministic tool installation as zero-egress alternative
                options.append(RemediationOption(
                    option_id=f"rem_tool_{witness_id}",
                    action_type=RemediationActionType.INSTALL_LOCAL_TOOL,
                    target_obligation_ids=target_obs,
                    description=f"Deploy local deterministic verification probe to replace cloud witness '{witness_id}'",
                    cost_nanos=0,
                    estimated_delay_ms=100.0,
                    metadata={"witness_id": witness_id}
                ))

            # Subcase 4: Blocked by budget exhaustion (evaluated even if network policy was also blocked!)
            if witness.estimated_cost_nanos > available_budget_nanos:
                deficit = witness.estimated_cost_nanos - available_budget_nanos
                options.append(RemediationOption(
                    option_id=f"rem_budget_{witness_id}",
                    action_type=RemediationActionType.INCREASE_BUDGET,
                    target_obligation_ids=target_obs,
                    description=(
                        f"Budget deficit of {deficit} NanoUSD for witness '{witness_id}'. "
                        f"Required: {witness.estimated_cost_nanos}, Available: {available_budget_nanos}."
                    ),
                    cost_nanos=deficit,
                    estimated_delay_ms=0.0,
                    metadata={"witness_id": witness_id, "deficit_nanos": str(deficit)}
                ))

        # Check unsatisfied obligations for relaxation or missing producer options
        for ob_id in unsatisfied_obs:
            ob = self.hypergraph.obligations.get(ob_id)
            if not ob:
                continue

            if not ob.is_safety_critical:
                options.append(RemediationOption(
                    option_id=f"rem_relax_{ob_id}",
                    action_type=RemediationActionType.RELAX_OBLIGATION,
                    target_obligation_ids=[ob_id],
                    description=f"Relax optional obligation '{ob_id}' ({ob.description})",
                    cost_nanos=0,
                    estimated_delay_ms=0.0,
                    metadata={"obligation_id": ob_id}
                ))
            else:
                # Safety-critical obligation with no viable witnesses in frontier
                edges_for_ob = [e for e in self.hypergraph.edges if e.target_obligation_id == ob_id]
                if not edges_for_ob or not any(e.source_witness_ids for e in edges_for_ob):
                    options.append(RemediationOption(
                        option_id=f"rem_missing_producer_{ob_id}",
                        action_type=RemediationActionType.INSTALL_LOCAL_TOOL,
                        target_obligation_ids=[ob_id],
                        description=f"Safety-critical obligation '{ob_id}' has no defined evidence producers. Provide a valid probe.",
                        cost_nanos=0,
                        estimated_delay_ms=100.0,
                        metadata={"obligation_id": ob_id}
                    ))

        # Deduplicate options by option_id
        seen_ids = set()
        deduped = []
        for opt in options:
            if opt.option_id not in seen_ids:
                seen_ids.add(opt.option_id)
                deduped.append(opt)

        # Sort by cost ascending, then delay ascending (R* minimal cost solver)
        deduped.sort(key=lambda opt: (opt.cost_nanos, opt.estimated_delay_ms))
        return deduped
