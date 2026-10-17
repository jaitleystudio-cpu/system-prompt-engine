"""
SPE Ω — Obligation & Witness Hypergraph IR (Paper 1: BWFS).
Represents task requirements as an AND/OR hypergraph of obligations and witnesses.
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Set, Optional, Tuple
from .types import (
    ObligationStatus, EvidenceStatus, NanoUSD
)


class WitnessType(str, Enum):
    DETERMINISTIC_PROBE = "DETERMINISTIC_PROBE" # $0.00: AST parser, test runner, regex
    STATIC_ANALYSIS     = "STATIC_ANALYSIS"     # $0.00: Linter, typechecker, schema validator
    LOCAL_SLM           = "LOCAL_SLM"           # $0 API: On-device NPU/Metal model
    FRONTIER_MODEL      = "FRONTIER_MODEL"      # Paid: Cloud reasoning model (DeepSeek/Claude/GPT)
    HUMAN_ORACULAR      = "HUMAN_ORACULAR"      # External user confirmation


class HyperEdgeType(str, Enum):
    AND = "AND"  # All source witnesses must be established to satisfy obligation
    OR  = "OR"   # Any source witness being established satisfies obligation


@dataclass
class ObligationNode:
    obligation_id: str
    description: str
    is_safety_critical: bool
    status: ObligationStatus = ObligationStatus.PENDING


@dataclass
class WitnessNode:
    witness_id: str
    witness_type: WitnessType
    produces_evidence_for: List[str]  # List of target obligation_ids
    estimated_cost_nanos: NanoUSD
    estimated_latency_ms: float
    evidence_status: EvidenceStatus = EvidenceStatus.INSUFFICIENT_OR_UNKNOWN
    required_inputs: List[str] = field(default_factory=list)


@dataclass
class HyperEdge:
    edge_id: str
    target_obligation_id: str
    source_witness_ids: Set[str]
    edge_type: HyperEdgeType


class ObligationHypergraph:
    """
    Typed AND/OR Hypergraph: H_K = (O, W, E).
    Manages obligations, witnesses, and computes the bidirectional witness frontier.
    """

    def __init__(self, contract_digest: str):
        self.contract_digest = contract_digest
        self.obligations: Dict[str, ObligationNode] = {}
        self.witnesses: Dict[str, WitnessNode] = {}
        self.edges: List[HyperEdge] = []

    def add_obligation(self, node: ObligationNode) -> None:
        self.obligations[node.obligation_id] = node

    def add_witness(self, node: WitnessNode) -> None:
        self.witnesses[node.witness_id] = node

    def add_hyperedge(self, edge: HyperEdge) -> None:
        if not edge.source_witness_ids:
            raise ValueError(f"HyperEdge '{edge.edge_id}' cannot have empty source_witness_ids")
        self.edges.append(edge)

    def compute_satisfied_obligations(self, established_witness_ids: Set[str]) -> Set[str]:
        """Calculates which obligations are satisfied under the established witness set."""
        satisfied = set()

        # Check all hyperedges
        for edge in self.edges:
            ob_id = edge.target_obligation_id
            if not edge.source_witness_ids:
                continue
            if edge.edge_type == HyperEdgeType.AND:
                if edge.source_witness_ids.issubset(established_witness_ids):
                    satisfied.add(ob_id)
            elif edge.edge_type == HyperEdgeType.OR:
                if any(w_id in established_witness_ids for w_id in edge.source_witness_ids):
                    satisfied.add(ob_id)

        return satisfied

    def compute_witness_frontier(self, established_witness_ids: Set[str]) -> Set[str]:
        """
        Computes the Witness Frontier:
        Δ = W_required - ValidClosure(W_established).
        Returns the set of candidate witness IDs that can make progress on unsatisfied obligations.
        """
        satisfied_obligations = self.compute_satisfied_obligations(established_witness_ids)
        unsatisfied_obligations = set(self.obligations.keys()) - satisfied_obligations

        frontier_witnesses: Set[str] = set()

        for edge in self.edges:
            if edge.target_obligation_id in unsatisfied_obligations:
                # Add missing witnesses for this edge
                missing_for_edge = edge.source_witness_ids - established_witness_ids
                # Only include witnesses that exist in the registered hypergraph
                valid_missing = {w for w in missing_for_edge if w in self.witnesses}
                if edge.edge_type == HyperEdgeType.AND:
                    frontier_witnesses.update(valid_missing)
                elif edge.edge_type == HyperEdgeType.OR:
                    frontier_witnesses.update(valid_missing)

        return frontier_witnesses

    def is_fully_satisfied(self, established_witness_ids: Set[str]) -> bool:
        """Returns True if every required obligation has been satisfied."""
        satisfied = self.compute_satisfied_obligations(established_witness_ids)
        return set(self.obligations.keys()).issubset(satisfied)
