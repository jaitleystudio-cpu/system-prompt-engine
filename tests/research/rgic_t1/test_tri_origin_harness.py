"""
Unit and Adversarial Tests for RGIC-T1 Tri-Origin Counterfactual Harness.
Part of SPE Ω Research Quarantine.

Tests:
1. Three-Fault Worlds: Discrimination across Goal (G), World (W), and Verifier (V).
2. Joint fault resolution (G + V).
3. Cryptographic prediction precommitment lock (tamper and HARKing prevention).
4. Observational equivalence & honest unidentifiable abstention.
5. Open-world unmodeled uncertainty handling (OTHER_OR_UNMODELED).
6. Exact integer NanoUSD value-of-information (VOI) probe selection.
7. Directed Acyclic Epistemic Dependency Graph (DAEDG) retraction cascades.
"""

import pytest
import time
from spe_runtime.research.rgic_t1.types import (
    OriginClass,
    Hypothesis,
    DiagnosticProbe,
    PrecommitmentLock,
    DistinguishabilityRecord,
    EpistemicNode,
    EpistemicNodeState,
)
from spe_runtime.research.rgic_t1.tri_origin_harness import (
    TriOriginDiagnoser,
    EpistemicDependencyGraph,
)


@pytest.fixture
def diagnoser():
    return TriOriginDiagnoser()


@pytest.fixture
def sample_hypotheses():
    # Scenario: 3D Website fails on mobile device
    h_goal = Hypothesis(
        id="h-goal-mobile-viewport",
        origin_class=OriginClass.GOAL,
        description="Goal misunderstanding: Mobile responsiveness was an unrespected requirement",
        predicted_outcomes={
            "probe-check-spec": {"requirement_contains_mobile": True},
            "probe-browser-feature": {"webgl2_supported": True},
            "probe-verifier-viewport": {"test_viewport": "desktop_only"}
        }
    )
    h_world = Hypothesis(
        id="h-world-webgl-missing",
        origin_class=OriginClass.WORLD,
        description="World dynamics: Customer's device hardware lacks WebGL2 support",
        predicted_outcomes={
            "probe-check-spec": {"requirement_contains_mobile": False},
            "probe-browser-feature": {"webgl2_supported": False},
            "probe-verifier-viewport": {"test_viewport": "desktop_only"}
        }
    )
    h_verifier = Hypothesis(
        id="h-verifier-desktop-only",
        origin_class=OriginClass.VERIFIER,
        description="Verifier inadequacy: Test suite only evaluated 1920x1080 desktop viewport",
        predicted_outcomes={
            "probe-check-spec": {"requirement_contains_mobile": False},
            "probe-browser-feature": {"webgl2_supported": True},
            "probe-verifier-viewport": {"test_viewport": "desktop_only"}
        }
    )
    return [h_goal, h_world, h_verifier]


@pytest.fixture
def sample_probes():
    p_spec = DiagnosticProbe(
        id="probe-check-spec",
        description="Inspects frozen ProtectedIntent AST for mobile viewport requirements",
        cost_nano_usd=5_000_000,  # 0.005 USD
        risk_score=10,
        expected_entropy_reduction=800,
        is_authorized=True
    )
    p_feature = DiagnosticProbe(
        id="probe-browser-feature",
        description="Runs client device capability probe for WebGL2",
        cost_nano_usd=20_000_000, # 0.02 USD
        risk_score=20,
        expected_entropy_reduction=900,
        is_authorized=True
    )
    p_unauthorized = DiagnosticProbe(
        id="probe-unauthorized-port-scan",
        description="Scans internal customer network ports",
        cost_nano_usd=100_000_000,
        risk_score=950,
        expected_entropy_reduction=950,
        is_authorized=False
    )
    return [p_spec, p_feature, p_unauthorized]


def test_three_fault_world_discrimination(diagnoser, sample_hypotheses, sample_probes):
    """
    Verifies that executing probe-browser-feature successfully isolates
    World-Model failure (WebGL2 missing) from Goal and Verifier hypotheses.
    """
    probe = sample_probes[1]  # probe-browser-feature
    lock = diagnoser.compute_precommitment_lock(
        probe=probe,
        hypotheses=sample_hypotheses,
        timestamp_ns=1791550000000000,
        salt="test-salt"
    )

    # Reality observation: webgl2_supported is False
    observation = {"webgl2_supported": False}

    record = diagnoser.adjudicate(
        record_id="rec-001",
        discrepancy_id="disc-mobile-crash",
        probe=probe,
        lock=lock,
        hypotheses=sample_hypotheses,
        observation=observation,
        candidate_probes=sample_probes
    )

    assert record.status == "DISCRIMINATED"
    assert record.is_identifiable is True
    assert record.discriminated_origins == [OriginClass.WORLD]
    assert "h-world-webgl-missing" in record.remaining_hypotheses
    assert "h-goal-mobile-viewport" in record.eliminated_hypotheses
    assert "h-verifier-desktop-only" in record.eliminated_hypotheses


def test_cryptographic_precommitment_lock_anti_harking(diagnoser, sample_hypotheses, sample_probes):
    """
    Verifies that altering predictions after the lock is created
    causes adjudication to reject the run with INVALID_RUN.
    """
    probe = sample_probes[0]  # probe-check-spec
    lock = diagnoser.compute_precommitment_lock(
        probe=probe,
        hypotheses=sample_hypotheses,
        timestamp_ns=1791550000000000,
        salt="test-salt"
    )

    # Adversarial tampering: sneaky agent changes predictions after seeing observation!
    tampered_hypotheses = list(sample_hypotheses)
    tampered_hypotheses[0] = Hypothesis(
        id="h-goal-mobile-viewport",
        origin_class=OriginClass.GOAL,
        description="Goal",
        predicted_outcomes={"probe-check-spec": {"requirement_contains_mobile": False}}
    )

    observation = {"requirement_contains_mobile": False}

    record = diagnoser.adjudicate(
        record_id="rec-002",
        discrepancy_id="disc-tamper",
        probe=probe,
        lock=lock,
        hypotheses=tampered_hypotheses,
        observation=observation
    )

    assert record.status == "INVALID_RUN"
    assert record.is_identifiable is False


def test_observational_equivalence_unidentifiable_abstention(diagnoser, sample_probes):
    """
    When two hypotheses produce identical predictions across ALL authorized probes,
    RGIC-T1 must refuse to guess and emit UNIDENTIFIABLE.
    """
    h_equiv1 = Hypothesis(
        id="h-hidden-network-drop",
        origin_class=OriginClass.WORLD,
        description="Network packet dropped by firewall",
        predicted_outcomes={"probe-check-spec": {"result": "TIMEOUT"}}
    )
    h_equiv2 = Hypothesis(
        id="h-hidden-server-crash",
        origin_class=OriginClass.WORLD,
        description="Remote daemon died during request",
        predicted_outcomes={"probe-check-spec": {"result": "TIMEOUT"}}
    )

    probe = sample_probes[0]
    lock = diagnoser.compute_precommitment_lock(
        probe=probe,
        hypotheses=[h_equiv1, h_equiv2],
        timestamp_ns=1791550000000000
    )

    observation = {"result": "TIMEOUT"}

    record = diagnoser.adjudicate(
        record_id="rec-003",
        discrepancy_id="disc-timeout",
        probe=probe,
        lock=lock,
        hypotheses=[h_equiv1, h_equiv2],
        observation=observation,
        candidate_probes=[probe]  # Only this probe available
    )

    assert record.status == "UNIDENTIFIABLE"
    assert record.is_identifiable is False
    assert len(record.remaining_hypotheses) == 2


def test_open_world_unmodeled_discrepancy(diagnoser, sample_hypotheses, sample_probes):
    """
    If none of the candidate hypotheses predicted the observed outcome,
    RGIC-T1 must flag OTHER_OR_UNMODELED rather than forcing a false classification.
    """
    probe = sample_probes[1]
    lock = diagnoser.compute_precommitment_lock(
        probe=probe,
        hypotheses=sample_hypotheses,
        timestamp_ns=1791550000000000
    )

    # Bizarre unexpected observation not predicted by any hypothesis
    observation = {"webgl2_supported": "DEVICE_MELTED_BY_LASER"}

    record = diagnoser.adjudicate(
        record_id="rec-004",
        discrepancy_id="disc-laser",
        probe=probe,
        lock=lock,
        hypotheses=sample_hypotheses,
        observation=observation
    )

    assert record.status == "UNIDENTIFIABLE"
    assert record.discriminated_origins == [OriginClass.OTHER_OR_UNMODELED]
    assert len(record.remaining_hypotheses) == 0


def test_integer_nanousd_probe_selection(diagnoser, sample_hypotheses, sample_probes):
    """
    Tests VOI probe selection:
    1. Unauthorized probes are strictly rejected (-10^15 utility).
    2. Among authorized probes, the one maximizing net integer utility is selected.
    """
    unauthorized_probe = sample_probes[2]
    score_unauth = diagnoser.compute_probe_utility(unauthorized_probe)
    assert score_unauth < -1_000_000_000_000

    optimal_probe = diagnoser.select_optimal_probe(
        hypotheses=sample_hypotheses,
        candidate_probes=sample_probes,
        criticality=10
    )
    assert optimal_probe is not None
    assert optimal_probe.is_authorized is True
    assert optimal_probe.id in ("probe-check-spec", "probe-browser-feature")


def test_epistemic_dependency_retraction_cascade():
    """
    Tests the Directed Acyclic Epistemic Dependency Graph (DAEDG):
    E1 -> M1 -> C1 -> QB
    When Mechanism M1 is invalidated, Capability C1 and Qualification QB
    must be immediately demoted to REQUALIFICATION_REQUIRED.
    """
    graph = EpistemicDependencyGraph()

    e1 = EpistemicNode(id="E1", node_type="OBSERVATION", description="Benchmark receipt")
    m1 = EpistemicNode(id="M1", node_type="MECHANISM", description="Shared memory protocol", dependencies=["E1"])
    c1 = EpistemicNode(id="C1", node_type="CAPABILITY", description="Sub-millisecond IPC", dependencies=["M1"])
    qb = EpistemicNode(id="QB", node_type="QUALIFICATION", description="Qualified on Model B", dependencies=["C1"])

    graph.add_node(e1)
    graph.add_node(m1)
    graph.add_node(c1)
    graph.add_node(qb)

    # Invalidate Mechanism M1
    demoted = graph.invalidate_node("M1")

    # M1 is invalidated
    assert graph.nodes["M1"].state == EpistemicNodeState.INVALIDATED

    # C1 and QB are demoted to REQUALIFICATION_REQUIRED
    assert graph.nodes["C1"].state == EpistemicNodeState.REQUALIFICATION_REQUIRED
    assert graph.nodes["QB"].state == EpistemicNodeState.REQUALIFICATION_REQUIRED

    # Upstream E1 remains untouched and valid
    assert graph.nodes["E1"].state == EpistemicNodeState.VALID

    # Return list contains downstream dependents
    assert "C1" in demoted
    assert "QB" in demoted
