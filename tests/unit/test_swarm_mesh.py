"""Unit tests for Level 6 Swarm Mesh and Peer Gossip Topology."""

import pytest

from spe_runtime.swarm.models import GossipTopic, NodeRole, NodeState, SwarmNode
from spe_runtime.swarm.swarm_mesh import SwarmMesh


def test_swarm_cluster_initialization():
    mesh = SwarmMesh()
    assert len(mesh.nodes) == 7
    roles = {n.role for n in mesh.nodes.values()}
    assert NodeRole.SUPERVISOR in roles
    assert NodeRole.BFT_VALIDATOR in roles
    assert NodeRole.RED_TEAM_AUDITOR in roles


def test_swarm_node_registration_and_slashing():
    mesh = SwarmMesh()
    new_node = SwarmNode(
        node_id="node_peer_tokyo",
        role=NodeRole.WORKER,
        reputation_score=0.85,
    )
    registered = mesh.register_node(new_node)
    assert registered is True
    assert len(mesh.nodes) == 8

    # Slash the node
    slashed = mesh.slash_node("node_peer_tokyo", reason="Detected Byzantine double-spend attempt")
    assert slashed is True
    assert mesh.nodes["node_peer_tokyo"].state == NodeState.SLASHED
    assert mesh.nodes["node_peer_tokyo"].reputation_score == 0.0

    # Verify slashing alert broadcast in gossip log
    recent_msg = mesh.gossip_log[-1]
    assert recent_msg.topic == GossipTopic.SLASHING_ALERT
    assert recent_msg.payload["slashed_node_id"] == "node_peer_tokyo"


def test_swarm_gossip_broadcasting():
    mesh = SwarmMesh()
    msg = mesh.broadcast_gossip(
        topic=GossipTopic.CAPSULE_DISCOVERY,
        payload={"capsule_id": "cap_test_100", "domain": "RATE_LIMITER"},
        origin_node_id="node_local_silicon",
    )
    assert msg.topic == GossipTopic.CAPSULE_DISCOVERY
    assert len(msg.signature) == 24
    assert len(mesh.gossip_log) >= 1
