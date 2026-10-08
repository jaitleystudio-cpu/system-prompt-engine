"""Tests for Causal Proof Graph (M3)."""

from spe_runtime.proof_graph.graph import CausalProofGraph
from spe_runtime.proof_graph.models import (
    CausalEdge,
    CausalEvidence,
    CausalNode,
    EdgeType,
    NodeType,
)


def test_causal_proof_graph_end_to_end_trace():
    g = CausalProofGraph()

    # 1. Human source span
    g.add_node(CausalNode("SRC-01", NodeType.HUMAN_SPAN, "PRD Section 4: Never allow SQL injection in user search"))
    # 2. ProtectedIntent
    g.add_node(CausalNode("INT-01", NodeType.PROTECTED_INTENT, "Strict database query boundary"))
    # 3. Requirement
    g.add_node(CausalNode("REQ-01", NodeType.REQUIREMENT, "Parameterize all SQL inputs and reject raw concatenation"))
    # 4. Constraint
    g.add_node(CausalNode("CON-01", NodeType.CONSTRAINT, "query.raw_concat == false"))
    # 5. K3 Transform
    g.add_node(CausalNode("K3-01", NodeType.K3_TRANSFORM, "K3_SQL_PARAMETERIZE_RULE"))
    # 6. Prompt Clause
    g.add_node(CausalNode("CLS-01", NodeType.PROMPT_CLAUSE, "You MUST use parameterized queries and NEVER concatenate raw strings."))
    # 7. Test Case
    g.add_node(CausalNode("TST-01", NodeType.TEST_CASE, "test_sql_injection_defense"))
    # 8. Runtime Policy
    g.add_node(CausalNode("POL-01", NodeType.RUNTIME_POLICY, "DATABASE_WRITE grant requires query AST validation"))

    # Add edges
    g.add_edge(CausalEdge("E1", "SRC-01", "INT-01", EdgeType.DERIVES_FROM))
    g.add_edge(CausalEdge("E2", "INT-01", "REQ-01", EdgeType.DERIVES_FROM))
    g.add_edge(CausalEdge("E3", "REQ-01", "CON-01", EdgeType.ENFORCES))
    g.add_edge(CausalEdge("E4", "CON-01", "K3-01", EdgeType.TRANSFORMS))
    g.add_edge(CausalEdge("E5", "K3-01", "CLS-01", EdgeType.PRODUCES))
    g.add_edge(CausalEdge("E6", "REQ-01", "TST-01", EdgeType.VALIDATES_WITH))
    g.add_edge(CausalEdge("E7", "REQ-01", "POL-01", EdgeType.MONITORS))

    # Evidence
    g.attach_evidence("TST-01", CausalEvidence("EV-01", "OBSERVED_LOCAL", "injection_rejection_rate", 1.0, "2026-10-08T00:00:00Z"))

    # Test "WHY DOES THIS CLAUSE EXIST?"
    why = g.why_does_this_clause_exist("CLS-01")
    assert any(h["id"] == "SRC-01" for h in why["human_spans"])
    assert any(i["id"] == "INT-01" for i in why["protected_intents"])
    assert any(r["id"] == "REQ-01" for r in why["requirements"])
    assert any(t["id"] == "K3-01" for t in why["transforms"])

    # Test "WHERE IS THIS REQUIREMENT ENFORCED?"
    where = g.where_is_this_requirement_enforced("REQ-01")
    assert any(c["id"] == "CON-01" for c in where["constraints"])
    assert any(cl["id"] == "CLS-01" for cl in where["prompt_clauses"])
    assert any(t["id"] == "TST-01" for t in where["tests"])
    assert any(p["id"] == "POL-01" for p in where["runtime_policies"])

    # Test test coverage query
    assert g.which_tests_cover_this_requirement("REQ-01") == ["TST-01"]

    # Test orphan detection (clean)
    orphans = g.validate_orphans()
    assert orphans["orphan_clauses"] == []
    assert orphans["orphan_requirements"] == []

    # Add orphan clause and verify detection
    g.add_node(CausalNode("CLS-ORPHAN", NodeType.PROMPT_CLAUSE, "Be friendly and polite."))
    orphans2 = g.validate_orphans()
    assert "CLS-ORPHAN" in orphans2["orphan_clauses"]

    # Test serialization roundtrip
    serialized = g.to_dict()
    g2 = CausalProofGraph.from_dict(serialized)
    assert len(g2.nodes) == len(g.nodes)
    assert len(g2.edges) == len(g.edges)
