"""Level 6 End-to-End Integration Test: Swarm Mesh & Byzantine Consensus Validation."""

import pytest

from spe_runtime.discovery.open_ended_engine import OpenEndedDiscoveryEngine
from spe_runtime.swarm.models import NodeState
from spe_runtime.swarm.swarm_mesh import SwarmMesh


def test_level6_swarm_consensus_e2e():
    # 1. Generate real discovered capability capsule from Level 5 engine
    discovery_engine = OpenEndedDiscoveryEngine()
    epoch_summary = discovery_engine.run_discovery_epoch(iterations=2)
    assert len(discovery_engine.compiled_capsules) >= 1
    discovered_capsule = discovery_engine.compiled_capsules[0]

    # 2. Feed capsule into Level 6 Swarm Mesh
    mesh = SwarmMesh()
    assert len(mesh.nodes) == 7

    # 3. Run BFT Consensus Round
    receipt = mesh.run_capsule_consensus(discovered_capsule)
    assert receipt.quorum_achieved is True
    assert receipt.votes_for >= 5
    assert receipt.byzantine_failures_tolerated == 2
    assert len(receipt.consensus_digest) == 64

    # 4. Verify gossip stream has broadcast the consensus proof
    last_msg = mesh.gossip_log[-1]
    assert last_msg.payload["capsule_id"] == discovered_capsule.capsule_id
    assert last_msg.payload["quorum_achieved"] is True

    # 5. Simulate Byzantine Attack & Slash Node
    mesh.slash_node("node_peer_apsouth", reason="Byzantine equivocation detected")
    telemetry = mesh.export_swarm_telemetry()
    assert telemetry["online_nodes"] == 6
    assert telemetry["slashed_nodes"] == 1
    assert mesh.nodes["node_peer_apsouth"].state == NodeState.SLASHED
