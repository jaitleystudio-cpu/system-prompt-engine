"""Domain Ontology Knowledge Graph for Self-Directing Capability Discovery.

Represents concepts, capabilities, and formal invariant dependencies as a DAG.
Detects frontier gaps in the ontology to trigger autonomous hypothesis synthesis.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Set

from spe_runtime.discovery.models import DiscoveredAxiom


@dataclass
class OntologyNode:
    """A conceptual or procedural entity within the domain ontology DAG."""
    node_id: str
    name: str
    domain: str
    is_proven: bool = False
    axioms: List[DiscoveredAxiom] = field(default_factory=list)
    dependencies: List[str] = field(default_factory=list)  # incoming edges (requires)
    dependents: List[str] = field(default_factory=list)    # outgoing edges (enables)


class DomainOntologyGraph:
    """Directed Acyclic Graph (DAG) tracking discovered concepts and frontier gaps."""

    def __init__(self) -> None:
        self.nodes: Dict[str, OntologyNode] = {}
        self._seed_default_ontology()

    def _seed_default_ontology(self) -> None:
        """Seeds foundational domain categories."""
        foundational = [
            ("FINANCIAL_RISK", "Financial Authority & Guardrails", "SECURITY"),
            ("PRIVACY_SHIELD", "Zero-PII Isolation Shield", "SECURITY"),
            ("AST_OPTIMIZER", "Deterministic AST Compiler Pass", "COMPILER"),
            ("RATE_LIMITER", "Sliding Window Throughput Regulator", "NETWORK"),
        ]
        for node_id, name, domain in foundational:
            self.nodes[node_id] = OntologyNode(
                node_id=node_id,
                name=name,
                domain=domain,
                is_proven=False,
            )

    def add_node(self, node_id: str, name: str, domain: str) -> OntologyNode:
        if node_id not in self.nodes:
            self.nodes[node_id] = OntologyNode(node_id=node_id, name=name, domain=domain)
        return self.nodes[node_id]

    def add_dependency(self, prerequisite_id: str, dependent_id: str) -> bool:
        """Adds a directed edge: dependent_id REQUIRES prerequisite_id. Guarantees DAG."""
        if prerequisite_id not in self.nodes or dependent_id not in self.nodes:
            return False

        # Cycle check
        if self._has_path(dependent_id, prerequisite_id):
            return False  # Adding would create cycle

        if prerequisite_id not in self.nodes[dependent_id].dependencies:
            self.nodes[dependent_id].dependencies.append(prerequisite_id)
        if dependent_id not in self.nodes[prerequisite_id].dependents:
            self.nodes[prerequisite_id].dependents.append(dependent_id)
        return True

    def _has_path(self, start_id: str, end_id: str, visited: Optional[Set[str]] = None) -> bool:
        """DFS path check to prevent DAG cycles."""
        if start_id == end_id:
            return True
        visited = visited or set()
        visited.add(start_id)

        node = self.nodes.get(start_id)
        if not node:
            return False

        for dep_id in node.dependents:
            if dep_id not in visited:
                if self._has_path(dep_id, end_id, visited):
                    return True
        return False

    def attach_axiom(self, node_id: str, axiom: DiscoveredAxiom) -> bool:
        """Marks node as proven by attaching a mathematically verified axiom."""
        if node_id in self.nodes:
            node = self.nodes[node_id]
            node.axioms.append(axiom)
            node.is_proven = True
            return True
        return False

    def identify_frontier_gaps(self) -> List[str]:
        """Identifies unproven nodes or open domain boundaries ready for discovery."""
        gaps: List[str] = []
        for node_id, node in self.nodes.items():
            if not node.is_proven:
                # Check if all its prerequisites are met
                prereqs_proven = all(
                    self.nodes[p].is_proven for p in node.dependencies if p in self.nodes
                )
                if prereqs_proven:
                    gaps.append(node_id)

        # If all current nodes are proven, synthesize next domain frontier
        if not gaps:
            frontier_candidates = [
                "IDEMPOTENCY_LEDGER",
                "FAILSAFE_CIRCUIT_BREAKER",
                "DIFFERENTIAL_PRIVACY_AUDITOR",
            ]
            for candidate in frontier_candidates:
                if candidate not in self.nodes:
                    self.add_node(candidate, f"Autonomous {candidate}", "SYNTHETIC_FRONTIER")
                    gaps.append(candidate)
                    break

        return gaps

    def topological_sort(self) -> List[str]:
        """Returns topological ordering of proven capabilities."""
        in_degree = {nid: len(n.dependencies) for nid, n in self.nodes.items()}
        queue = [nid for nid, deg in in_degree.items() if deg == 0]
        ordered: List[str] = []

        while queue:
            curr = queue.pop(0)
            ordered.append(curr)
            for dep_id in self.nodes[curr].dependents:
                in_degree[dep_id] -= 1
                if in_degree[dep_id] == 0:
                    queue.append(dep_id)

        return ordered
