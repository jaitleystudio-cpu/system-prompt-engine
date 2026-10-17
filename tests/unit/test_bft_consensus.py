"""Unit tests for Level 6 BFT Consensus Engine."""

import pytest

from spe_runtime.swarm.bft_consensus import BFTConsensusEngine
from spe_runtime.swarm.models import ConsensusVote, NodeRole, NodeState, SwarmNode


def test_bft_threshold_calculations():
    engine = BFTConsensusEngine()

    # N = 1 -> f = 0, Q = 1
    f1, q1 = engine.calculate_bft_thresholds(1)
    assert f1 == 0 and q1 == 1

    # N = 4 -> f = 1, Q = 3
    f4, q4 = engine.calculate_bft_thresholds(4)
    assert f4 == 1 and q4 == 3

    # N = 7 -> f = 2, Q = 5
    f7, q7 = engine.calculate_bft_thresholds(7)
    assert f7 == 2 and q7 == 5

    # N = 10 -> f = 3, Q = 7
    f10, q10 = engine.calculate_bft_thresholds(10)
    assert f10 == 3 and q10 == 7


def test_bft_voting_round_approval():
    engine = BFTConsensusEngine()
    nodes = [
        SwarmNode(node_id=f"node_{i}", role=NodeRole.BFT_VALIDATOR)
        for i in range(7)
    ]

    # 5 approve, 2 reject -> Quorum achieved (Q=5 for N=7)
    votes = [
        ConsensusVote(voter_id=f"node_{i}", capsule_id="cap_01", vote=(i < 5), proof_verified=(i < 5), reason="test")
        for i in range(7)
    ]

    receipt = engine.execute_voting_round("round_01", "cap_01", nodes, votes)
    assert receipt.quorum_achieved is True
    assert receipt.votes_for == 5
    assert receipt.votes_against == 2
    assert receipt.byzantine_failures_tolerated == 2
    assert len(receipt.consensus_digest) == 64


def test_bft_voting_round_rejection():
    engine = BFTConsensusEngine()
    nodes = [
        SwarmNode(node_id=f"node_{i}", role=NodeRole.BFT_VALIDATOR)
        for i in range(7)
    ]

    # Only 4 approve (less than Q=5) -> Quorum not achieved
    votes = [
        ConsensusVote(voter_id=f"node_{i}", capsule_id="cap_01", vote=(i < 4), proof_verified=(i < 4), reason="test")
        for i in range(7)
    ]

    receipt = engine.execute_voting_round("round_02", "cap_01", nodes, votes)
    assert receipt.quorum_achieved is False
    assert receipt.votes_for == 4
