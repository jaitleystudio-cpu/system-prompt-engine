"""Causal Proof Graph engine."""

from __future__ import annotations

import json
from dataclasses import asdict
from typing import Any

from .models import CausalEdge, CausalEvidence, CausalNode, EdgeType, NodeType


class CausalProofGraph:
    def __init__(self) -> None:
        self.nodes: dict[str, CausalNode] = {}
        self.edges: dict[str, CausalEdge] = {}
        self.evidence: dict[str, list[CausalEvidence]] = {}  # node_id -> list of evidence
        self._outgoing: dict[str, list[str]] = {}
        self._incoming: dict[str, list[str]] = {}

    def add_node(self, node: CausalNode) -> None:
        self.nodes[node.node_id] = node
        self._outgoing.setdefault(node.node_id, [])
        self._incoming.setdefault(node.node_id, [])

    def add_edge(self, edge: CausalEdge) -> None:
        self.edges[edge.edge_id] = edge
        self._outgoing.setdefault(edge.source_id, []).append(edge.edge_id)
        self._incoming.setdefault(edge.target_id, []).append(edge.edge_id)

    def attach_evidence(self, node_id: str, ev: CausalEvidence) -> None:
        self.evidence.setdefault(node_id, []).append(ev)

    def why_does_this_clause_exist(self, clause_id: str) -> dict[str, Any]:
        """Traces backwards from a prompt clause to its requirement, intent, and human source."""
        if clause_id not in self.nodes:
            raise KeyError(f"Node {clause_id} not found")

        visited: set[str] = set()
        trace_path: list[dict[str, Any]] = []

        def _trace_back(curr_id: str) -> None:
            if curr_id in visited:
                return
            visited.add(curr_id)
            node = self.nodes.get(curr_id)
            if node:
                trace_path.append({
                    "id": node.node_id,
                    "type": node.node_type.value,
                    "label": node.label,
                })
            # incoming edges
            for eid in self._incoming.get(curr_id, []):
                e = self.edges[eid]
                _trace_back(e.source_id)

        _trace_back(clause_id)

        # Categorize discovered upstream nodes
        human_spans = [p for p in trace_path if p["type"] == NodeType.HUMAN_SPAN.value]
        intents = [p for p in trace_path if p["type"] == NodeType.PROTECTED_INTENT.value]
        requirements = [p for p in trace_path if p["type"] == NodeType.REQUIREMENT.value]
        transforms = [p for p in trace_path if p["type"] in (NodeType.K3_TRANSFORM.value, NodeType.XCAT_NODE.value, NodeType.EFFECT_PLAN_OP.value)]

        return {
            "clause_id": clause_id,
            "human_spans": human_spans,
            "protected_intents": intents,
            "requirements": requirements,
            "transforms": transforms,
            "full_lineage": trace_path,
        }

    def where_is_this_requirement_enforced(self, req_id: str) -> dict[str, Any]:
        """Traces forward from a requirement to prompt clauses, tests, runtime policies, and executions."""
        if req_id not in self.nodes:
            raise KeyError(f"Node {req_id} not found")

        visited: set[str] = set()
        downstream: list[dict[str, Any]] = []

        def _trace_forward(curr_id: str) -> None:
            if curr_id in visited:
                return
            visited.add(curr_id)
            node = self.nodes.get(curr_id)
            if node:
                downstream.append({
                    "id": node.node_id,
                    "type": node.node_type.value,
                    "label": node.label,
                })
            for eid in self._outgoing.get(curr_id, []):
                e = self.edges[eid]
                _trace_forward(e.target_id)

        _trace_forward(req_id)

        constraints = [d for d in downstream if d["type"] == NodeType.CONSTRAINT.value]
        clauses = [d for d in downstream if d["type"] == NodeType.PROMPT_CLAUSE.value]
        tests = [d for d in downstream if d["type"] == NodeType.TEST_CASE.value]
        policies = [d for d in downstream if d["type"] == NodeType.RUNTIME_POLICY.value]

        return {
            "requirement_id": req_id,
            "constraints": constraints,
            "prompt_clauses": clauses,
            "tests": tests,
            "runtime_policies": policies,
            "all_enforcements": downstream,
        }

    def which_transform_produced_this_text(self, clause_id: str) -> dict[str, Any]:
        trace = self.why_does_this_clause_exist(clause_id)
        transforms = trace["transforms"]
        return {
            "clause_id": clause_id,
            "producing_transforms": transforms,
        }

    def which_tests_cover_this_requirement(self, req_id: str) -> list[str]:
        enf = self.where_is_this_requirement_enforced(req_id)
        return [t["id"] for t in enf["tests"]]

    def which_failures_affect_it(self, req_id: str) -> list[str]:
        failures: list[str] = []
        for eid in self._incoming.get(req_id, []):
            edge = self.edges[eid]
            if edge.edge_type == EdgeType.REGRESSED_BY:
                failures.append(edge.source_id)
        return failures

    def validate_orphans(self) -> dict[str, list[str]]:
        orphan_clauses: list[str] = []
        orphan_reqs: list[str] = []

        for nid, node in self.nodes.items():
            if node.node_type == NodeType.PROMPT_CLAUSE:
                trace = self.why_does_this_clause_exist(nid)
                if not trace["requirements"]:
                    orphan_clauses.append(nid)
            elif node.node_type == NodeType.REQUIREMENT:
                enf = self.where_is_this_requirement_enforced(nid)
                if not enf["prompt_clauses"] and not enf["runtime_policies"] and not enf["tests"]:
                    orphan_reqs.append(nid)

        return {
            "orphan_clauses": orphan_clauses,
            "orphan_requirements": orphan_reqs,
        }

    def diff_graphs(self, other: CausalProofGraph) -> dict[str, Any]:
        added_nodes = [nid for nid in other.nodes if nid not in self.nodes]
        removed_nodes = [nid for nid in self.nodes if nid not in other.nodes]
        added_edges = [eid for eid in other.edges if eid not in self.edges]
        removed_edges = [eid for eid in self.edges if eid not in other.edges]
        return {
            "added_nodes": added_nodes,
            "removed_nodes": removed_nodes,
            "added_edges": added_edges,
            "removed_edges": removed_edges,
        }

    def to_dict(self) -> dict[str, Any]:
        return {
            "nodes": {nid: {"node_id": n.node_id, "node_type": n.node_type.value, "label": n.label, "payload": n.payload} for nid, n in self.nodes.items()},
            "edges": {eid: {"edge_id": e.edge_id, "source_id": e.source_id, "target_id": e.target_id, "edge_type": e.edge_type.value, "metadata": e.metadata} for eid, e in self.edges.items()},
            "evidence": {nid: [asdict(ev) for ev in ev_list] for nid, ev_list in self.evidence.items()},
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> CausalProofGraph:
        g = cls()
        for nid, nd in data.get("nodes", {}).items():
            g.add_node(CausalNode(node_id=nd["node_id"], node_type=NodeType(nd["node_type"]), label=nd["label"], payload=nd.get("payload", {})))
        for eid, ed in data.get("edges", {}).items():
            g.add_edge(CausalEdge(edge_id=ed["edge_id"], source_id=ed["source_id"], target_id=ed["target_id"], edge_type=EdgeType(ed["edge_type"]), metadata=ed.get("metadata", {})))
        for nid, ev_list in data.get("evidence", {}).items():
            for ev in ev_list:
                g.attach_evidence(nid, CausalEvidence(**ev))
        return g


def create_reference_trace() -> CausalProofGraph:
    """Builds an authoritative end-to-end reference trace demonstrating:
    Human Source Span -> ProtectedIntent -> RequirementGraph -> Constraint -> XCAT/K3 Transform
    -> EffectPlan -> Prompt Clause -> Test Case -> Runtime Policy -> Failure Record -> Candidate Repair.
    """
    g = CausalProofGraph()

    # 1. Human Source Span
    g.add_node(CausalNode("SRC-FIN-01", NodeType.HUMAN_SPAN, "PRD Sec 9.2: Mask cardholder primary account numbers and cap unapproved transfers"))
    # 2. ProtectedIntent
    g.add_node(CausalNode("INT-FIN-01", NodeType.PROTECTED_INTENT, "PCI-DSS Cardholder Data & Transfer Protection Intent"))
    # 3. Requirement
    g.add_node(CausalNode("REQ-FIN-01", NodeType.REQUIREMENT, "Redact PAN numbers in payment assistant and reject unapproved transfers over $10,000"))
    # 4. Constraint
    g.add_node(CausalNode("CON-FIN-01", NodeType.CONSTRAINT, "payload.pan.masked == true && transfer.limit <= $10,000"))
    # 5. XCAT Category
    g.add_node(CausalNode("XCAT-FIN-01", NodeType.XCAT_NODE, "CATEGORY_C08_BUSINESS_FINANCE_GUARD"))
    # 6. K3 Transform
    g.add_node(CausalNode("K3-FIN-01", NodeType.K3_TRANSFORM, "K3_PAN_MASK_AND_APPROVAL_RULE"))
    # 7. Effect Plan Op
    g.add_node(CausalNode("PLAN-OP-01", NodeType.EFFECT_PLAN_OP, "INJECT_PAN_MASKING_DIRECTIVE"))
    # 8. Prompt Clause
    g.add_node(CausalNode("CLS-FIN-01", NodeType.PROMPT_CLAUSE, "You MUST mask all cardholder account numbers (PAN) with asterisks except the last 4 digits, and DENY any wire transfer exceeding $10,000 without dual-approval."))
    # 9. Test Case
    g.add_node(CausalNode("TST-FIN-01", NodeType.TEST_CASE, "test_pan_leakage_and_transfer_cap"))
    # 10. Runtime Policy
    g.add_node(CausalNode("POL-FIN-01", NodeType.RUNTIME_POLICY, "PAYMENT grant requires dual-sign approval token and cardholder masking"))
    # 11. Failure Record (from Failure Genome Ω)
    g.add_node(CausalNode("FAIL-FG-01", NodeType.FAILURE_RECORD, "SPE-FG-2026-000412: Model unmasked card numbers when prompted with markdown table formatting"))
    # 12. Candidate Repair
    g.add_node(CausalNode("REP-FIN-01", NodeType.CANDIDATE_REPAIR, "DELIMITER_ENFORCEMENT: Enforce regex mask filter before output generation and deny raw payment emission"))

    # Edges
    g.add_edge(CausalEdge("E-01", "SRC-FIN-01", "INT-FIN-01", EdgeType.DERIVES_FROM))
    g.add_edge(CausalEdge("E-02", "INT-FIN-01", "REQ-FIN-01", EdgeType.DERIVES_FROM))
    g.add_edge(CausalEdge("E-03", "REQ-FIN-01", "CON-FIN-01", EdgeType.ENFORCES))
    g.add_edge(CausalEdge("E-04", "CON-FIN-01", "XCAT-FIN-01", EdgeType.TRANSFORMS))
    g.add_edge(CausalEdge("E-05", "XCAT-FIN-01", "K3-FIN-01", EdgeType.TRANSFORMS))
    g.add_edge(CausalEdge("E-06", "K3-FIN-01", "PLAN-OP-01", EdgeType.TRANSFORMS))
    g.add_edge(CausalEdge("E-07", "PLAN-OP-01", "CLS-FIN-01", EdgeType.PRODUCES))
    g.add_edge(CausalEdge("E-08", "REQ-FIN-01", "TST-FIN-01", EdgeType.VALIDATES_WITH))
    g.add_edge(CausalEdge("E-09", "REQ-FIN-01", "POL-FIN-01", EdgeType.MONITORS))
    g.add_edge(CausalEdge("E-10", "FAIL-FG-01", "TST-FIN-01", EdgeType.REGRESSED_BY))
    g.add_edge(CausalEdge("E-11", "REP-FIN-01", "FAIL-FG-01", EdgeType.REPAIRS))
    g.add_edge(CausalEdge("E-12", "REP-FIN-01", "CLS-FIN-01", EdgeType.PRODUCES))

    # Evidence attachment
    g.attach_evidence("TST-FIN-01", CausalEvidence("EV-PAN-01", "OBSERVED_LOCAL", "masking_rejection_rate", 1.0, "2026-10-08T12:00:00Z"))

    return g

