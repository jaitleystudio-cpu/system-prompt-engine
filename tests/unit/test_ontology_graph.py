"""Unit tests for Level 5 Domain Ontology Graph."""

import pytest

from spe_runtime.discovery.models import DiscoveredAxiom
from spe_runtime.discovery.ontology_graph import DomainOntologyGraph


def test_ontology_initialization_and_gaps():
    graph = DomainOntologyGraph()
    gaps = graph.identify_frontier_gaps()
    assert len(gaps) >= 4
    assert "FINANCIAL_RISK" in gaps


def test_ontology_dag_cycle_prevention():
    graph = DomainOntologyGraph()
    # A -> B
    ok1 = graph.add_dependency("FINANCIAL_RISK", "PRIVACY_SHIELD")
    assert ok1 is True

    # B -> C
    graph.add_node("NODE_C", "Node C", "TEST")
    ok2 = graph.add_dependency("PRIVACY_SHIELD", "NODE_C")
    assert ok2 is True

    # Attempt C -> A (cycle!)
    cycle_attempt = graph.add_dependency("NODE_C", "FINANCIAL_RISK")
    assert cycle_attempt is False, "Cycle addition must be rejected"


def test_ontology_axiom_attachment():
    graph = DomainOntologyGraph()
    axiom = DiscoveredAxiom(
        axiom_id="ax_test_1",
        statement="Refund limits are strictly verified",
        domain="FINANCIAL_RISK",
        formal_contract={},
        witness_receipt_hash="hash123",
    )
    attached = graph.attach_axiom("FINANCIAL_RISK", axiom)
    assert attached is True
    assert graph.nodes["FINANCIAL_RISK"].is_proven is True
