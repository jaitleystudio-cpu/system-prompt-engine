"""
SPE Ω — Unit & Behavioral Tests for Paper 1: Bidirectional Witness-Frontier Synthesis (BWFS).
Verifies AND/OR hypergraphs, witness frontier collapse, action prioritization, and air-gap gates.
"""

import pytest
from spe_runtime.research.wdes import (
    PredicateValue,
    VerificationVerdict,
    NanoUSD,
    NetworkPolicy,
    ObligationStatus,
    EvidenceStatus,
    ObligationNode,
    WitnessNode,
    WitnessType,
    HyperEdge,
    ObligationHypergraph,
    ActionCandidate,
    FrontierScheduler,
    RemediationAnalyzer,
    RemediationOption,
)
from spe_runtime.research.wdes.witness_hypergraph import HyperEdgeType
from spe_runtime.research.wdes.remediation import RemediationActionType


def test_kleene_3_valued_logic():
    """Verifies strict 3-valued Kleene logic operations."""
    t = PredicateValue.TRUE
    f = PredicateValue.FALSE
    u = PredicateValue.UNKNOWN

    # AND truth table
    assert t.logical_and(t) == t
    assert t.logical_and(f) == f
    assert f.logical_and(u) == f
    assert t.logical_and(u) == u
    assert u.logical_and(u) == u

    # OR truth table
    assert t.logical_or(t) == t
    assert t.logical_or(u) == t
    assert f.logical_or(u) == u
    assert f.logical_or(f) == f
    assert u.logical_or(u) == u

    # NOT truth table
    assert t.logical_not() == f
    assert f.logical_not() == t
    assert u.logical_not() == u


def test_obligation_hypergraph_and_or_frontier():
    """Verifies AND/OR hypergraph construction and frontier collapse."""
    graph = ObligationHypergraph(contract_digest="sha256:test_contract")

    # Obligations
    ob_syntax = ObligationNode("ob_syntax", "Python syntax valid", is_safety_critical=True)
    ob_correctness = ObligationNode("ob_correctness", "Regression test passes", is_safety_critical=True)
    graph.add_obligation(ob_syntax)
    graph.add_obligation(ob_correctness)

    # Witnesses
    w_ast = WitnessNode("w_ast", WitnessType.DETERMINISTIC_PROBE, ["ob_syntax"], 0, 1.0)
    w_unit_test = WitnessNode("w_unit_test", WitnessType.DETERMINISTIC_PROBE, ["ob_correctness"], 0, 50.0)
    w_fuzz = WitnessNode("w_fuzz", WitnessType.DETERMINISTIC_PROBE, ["ob_correctness"], 0, 500.0)
    graph.add_witness(w_ast)
    graph.add_witness(w_unit_test)
    graph.add_witness(w_fuzz)

    # Edges: ob_syntax requires w_ast (AND)
    graph.add_hyperedge(HyperEdge("edge_syntax", "ob_syntax", {"w_ast"}, HyperEdgeType.AND))
    # ob_correctness satisfied if either unit_test OR fuzz passes
    graph.add_hyperedge(HyperEdge("edge_correctness", "ob_correctness", {"w_unit_test", "w_fuzz"}, HyperEdgeType.OR))

    # Initial state: no witnesses established
    established = set()
    frontier = graph.compute_witness_frontier(established)
    assert frontier == {"w_ast", "w_unit_test", "w_fuzz"}
    assert not graph.is_fully_satisfied(established)

    # Establish w_ast -> ob_syntax is satisfied
    established.add("w_ast")
    satisfied = graph.compute_satisfied_obligations(established)
    assert satisfied == {"ob_syntax"}
    frontier = graph.compute_witness_frontier(established)
    assert frontier == {"w_unit_test", "w_fuzz"}
    assert not graph.is_fully_satisfied(established)

    # Establish w_unit_test -> ob_correctness is satisfied via OR edge
    established.add("w_unit_test")
    satisfied = graph.compute_satisfied_obligations(established)
    assert satisfied == {"ob_syntax", "ob_correctness"}
    frontier = graph.compute_witness_frontier(established)
    assert frontier == set()
    assert graph.is_fully_satisfied(established)


def test_frontier_scheduler_prioritizes_zero_cost_deterministic_probes():
    """BWFS must prioritize deterministic $0 probes over expensive cloud models."""
    graph = ObligationHypergraph("sha256:scheduler_test")
    ob = ObligationNode("ob_lint", "Code is clean", is_safety_critical=True)
    graph.add_obligation(ob)

    w_deterministic = WitnessNode("w_flake8", WitnessType.DETERMINISTIC_PROBE, ["ob_lint"], 0, 5.0)
    w_cloud = WitnessNode("w_gpt4o", WitnessType.FRONTIER_MODEL, ["ob_lint"], 15_000_000, 2500.0)
    graph.add_witness(w_deterministic)
    graph.add_witness(w_cloud)

    graph.add_hyperedge(HyperEdge("edge_lint", "ob_lint", {"w_flake8", "w_gpt4o"}, HyperEdgeType.OR))

    scheduler = FrontierScheduler(
        hypergraph=graph,
        network_policy=NetworkPolicy.PUBLIC_EGRESS,
        available_budget_nanos=100_000_000  # $0.10
    )

    actions = [
        ActionCandidate("act_flake8", "w_flake8", "run flake8", cost_nanos=0, latency_ms=5.0, is_remote=False),
        ActionCandidate("act_gpt4o", "w_gpt4o", "query gpt4o", cost_nanos=15_000_000, latency_ms=2500.0, is_remote=True),
    ]

    selected = scheduler.select_next_action(actions, established_witness_ids=set())
    assert selected is not None
    assert selected.action_id == "act_flake8"
    assert selected.cost_nanos == 0


def test_frontier_scheduler_enforces_airgap_boundary():
    """Hard Privacy Gate: Air-gapped network policy strictly blocks remote actions and deceptive cloud targets."""
    graph = ObligationHypergraph("sha256:airgap_test")
    ob = ObligationNode("ob_secret", "Analyze classified document", is_safety_critical=True)
    graph.add_obligation(ob)

    w_cloud = WitnessNode("w_cloud_ai", WitnessType.FRONTIER_MODEL, ["ob_secret"], 5_000_000, 1000.0)
    graph.add_witness(w_cloud)
    graph.add_hyperedge(HyperEdge("edge_secret", "ob_secret", {"w_cloud_ai"}, HyperEdgeType.AND))

    scheduler = FrontierScheduler(
        hypergraph=graph,
        network_policy=NetworkPolicy.AIR_GAPPED,
        available_budget_nanos=100_000_000
    )

    # 1. Action explicitly declares is_remote=True
    actions = [
        ActionCandidate("act_cloud", "w_cloud_ai", "remote call", cost_nanos=5_000_000, latency_ms=1000.0, is_remote=True),
    ]
    assert scheduler.select_next_action(actions, established_witness_ids=set()) is None

    # 2. Deceptive action claims is_remote=False but targets a FRONTIER_MODEL witness
    deceptive_actions = [
        ActionCandidate("act_deceptive", "w_cloud_ai", "stealth call", cost_nanos=5_000_000, latency_ms=1000.0, is_remote=False),
    ]
    assert scheduler.select_next_action(deceptive_actions, established_witness_ids=set()) is None


def test_frontier_scheduler_enforces_budget_boundary():
    """Hard Budget Gate: Excludes actions exceeding available NanoUSD balance or attempting negative cost exploits."""
    graph = ObligationHypergraph("sha256:budget_test")
    ob = ObligationNode("ob_compute", "Expensive analysis", is_safety_critical=False)
    graph.add_obligation(ob)

    w_expensive = WitnessNode("w_heavy", WitnessType.FRONTIER_MODEL, ["ob_compute"], 20_000_000, 1500.0)
    graph.add_witness(w_expensive)
    graph.add_hyperedge(HyperEdge("edge_expensive", "ob_compute", {"w_heavy"}, HyperEdgeType.AND))

    scheduler = FrontierScheduler(
        hypergraph=graph,
        network_policy=NetworkPolicy.PUBLIC_EGRESS,
        available_budget_nanos=10_000_000  # Only 10m nanos ($0.01) available, requires 20m ($0.02)
    )

    # Exceeds budget
    actions = [
        ActionCandidate("act_heavy", "w_heavy", "heavy model", cost_nanos=20_000_000, latency_ms=1500.0, is_remote=True),
    ]
    assert scheduler.select_next_action(actions, established_witness_ids=set()) is None

    # Negative cost exploit attempt
    exploit_actions = [
        ActionCandidate("act_exploit", "w_heavy", "negative cost exploit", cost_nanos=-5_000_000, latency_ms=100.0, is_remote=True),
    ]
    assert scheduler.select_next_action(exploit_actions, established_witness_ids=set()) is None


def test_remediation_analyzer_diagnoses_airgap_and_budget():
    """Remediation solver must accurately diagnose why frontier is blocked and provide R* solutions."""
    graph = ObligationHypergraph("sha256:remediation_test")
    ob1 = ObligationNode("ob1", "Cloud analysis required", is_safety_critical=True)
    ob2 = ObligationNode("ob2", "Optional benchmark", is_safety_critical=False)
    graph.add_obligation(ob1)
    graph.add_obligation(ob2)

    w_cloud = WitnessNode("w_cloud", WitnessType.FRONTIER_MODEL, ["ob1"], 50_000_000, 1000.0)
    w_opt = WitnessNode("w_opt", WitnessType.DETERMINISTIC_PROBE, ["ob2"], 0, 1.0)
    graph.add_witness(w_cloud)
    graph.add_witness(w_opt)
    graph.add_hyperedge(HyperEdge("e1", "ob1", {"w_cloud"}, HyperEdgeType.AND))
    graph.add_hyperedge(HyperEdge("e2", "ob2", {"w_opt"}, HyperEdgeType.AND))

    analyzer = RemediationAnalyzer(graph)

    # 1. Under air-gapped policy with ample budget
    options = analyzer.diagnose_and_solve(
        established_witness_ids=set(),
        current_network_policy=NetworkPolicy.AIR_GAPPED,
        available_budget_nanos=100_000_000
    )
    assert len(options) >= 2
    action_types = [opt.action_type for opt in options]
    assert RemediationActionType.GRANT_NETWORK_EGRESS in action_types
    assert RemediationActionType.INSTALL_LOCAL_TOOL in action_types

    # 2. Under budget deficit (public egress)
    options_budget = analyzer.diagnose_and_solve(
        established_witness_ids=set(),
        current_network_policy=NetworkPolicy.PUBLIC_EGRESS,
        available_budget_nanos=10_000_000  # Deficit of 40m nanos
    )
    assert any(opt.action_type == RemediationActionType.INCREASE_BUDGET for opt in options_budget)
    budget_opt = next(opt for opt in options_budget if opt.action_type == RemediationActionType.INCREASE_BUDGET)
    assert budget_opt.cost_nanos == 40_000_000

    # 3. Simultaneous air-gap AND budget deficit: both must be diagnosed
    options_both = analyzer.diagnose_and_solve(
        established_witness_ids=set(),
        current_network_policy=NetworkPolicy.AIR_GAPPED,
        available_budget_nanos=10_000_000
    )
    both_types = [opt.action_type for opt in options_both]
    assert RemediationActionType.GRANT_NETWORK_EGRESS in both_types
    assert RemediationActionType.INCREASE_BUDGET in both_types

    # 4. If ob2 is already satisfied, it must NOT be suggested for relaxation
    options_satisfied_ob2 = analyzer.diagnose_and_solve(
        established_witness_ids={"w_opt"},
        current_network_policy=NetworkPolicy.PUBLIC_EGRESS,
        available_budget_nanos=100_000_000
    )
    assert not any(opt.action_type == RemediationActionType.RELAX_OBLIGATION for opt in options_satisfied_ob2)

    # 5. Empty source witnesses must raise ValueError
    with pytest.raises(ValueError):
        graph.add_hyperedge(HyperEdge("e_empty", "ob1", set(), HyperEdgeType.AND))

    # 6. Orphan obligation: unsatisfied obligation with no evidence producers
    orphan_graph = ObligationHypergraph("sha256:orphan_test")
    orphan_ob = ObligationNode("ob_orphan", "Safety check with no probes", is_safety_critical=True)
    orphan_graph.add_obligation(orphan_ob)
    orphan_analyzer = RemediationAnalyzer(orphan_graph)
    orphan_options = orphan_analyzer.diagnose_and_solve(set(), NetworkPolicy.PUBLIC_EGRESS, 100_000_000)
    assert len(orphan_options) == 1
    assert orphan_options[0].action_type == RemediationActionType.INSTALL_LOCAL_TOOL
    assert "no defined evidence producers" in orphan_options[0].description

    # 7. Missing prerequisite inputs diagnosis
    prereq_graph = ObligationHypergraph("sha256:prereq_test")
    ob_p = ObligationNode("ob_p", "Prereq task", is_safety_critical=True)
    prereq_graph.add_obligation(ob_p)
    w_dep = WitnessNode("w_dep", WitnessType.LOCAL_SLM, ["ob_p"], 0, 10.0, required_inputs=["w_base_probe"])
    prereq_graph.add_witness(w_dep)
    prereq_graph.add_hyperedge(HyperEdge("e_p", "ob_p", {"w_dep"}, HyperEdgeType.AND))
    prereq_analyzer = RemediationAnalyzer(prereq_graph)
    prereq_options = prereq_analyzer.diagnose_and_solve(set(), NetworkPolicy.PUBLIC_EGRESS, 100_000_000)
    assert any("Prerequisite inputs missing" in opt.description for opt in prereq_options)
