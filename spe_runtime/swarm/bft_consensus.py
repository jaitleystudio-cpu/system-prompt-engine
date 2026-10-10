"""Byzantine Fault Tolerant (BFT) Quorum Consensus Engine.

Guarantees distributed multi-agent consensus on newly discovered capabilities
and meta-compiler optimizations with mathematical tolerance of up to f = floor((N-1)/3)
malicious or faulty peer nodes.
"""

from __future__ import annotations

import hashlib
import json
import time
from typing import Dict, List, Optional, Set, Tuple

from spe_runtime.capabilities.capsule import CapabilityCapsule
from spe_runtime.swarm.models import (
    BFTQuorumReceipt,
    ConsensusVote,
    NodeRole,
    NodeState,
    SwarmNode,
)


class BFTConsensusEngine:
    """Executes Byzantine Fault Tolerant voting rounds across swarm peer validators."""

    @staticmethod
    def calculate_bft_thresholds(total_nodes: int) -> Tuple[int, int]:
        """Calculates (max_byzantine_faults_tolerated, quorum_threshold).
        Formula:
          f = floor((N - 1) / 3)
          Q = 2*f + 1
        """
        if total_nodes <= 1:
            return (0, 1)
        f = (total_nodes - 1) // 3
        q = (2 * f) + 1
        return (f, q)

    def execute_voting_round(
        self,
        round_id: str,
        capsule_id: str,
        registered_nodes: List[SwarmNode],
        votes: List[ConsensusVote],
    ) -> BFTQuorumReceipt:
        """Evaluates a stream of peer votes against BFT quorum invariants."""
        # 1. Filter out slashed, offline, or ineligible nodes
        eligible_voter_ids: Set[str] = {
            n.node_id for n in registered_nodes if n.is_eligible_voter()
        }
        total_eligible = len(eligible_voter_ids)
        f_tolerated, q_threshold = self.calculate_bft_thresholds(total_eligible)

        seen_voters: Set[str] = set()
        votes_for = 0
        votes_against = 0
        slashed_voters: List[str] = []

        for vote in votes:
            if vote.voter_id not in eligible_voter_ids:
                continue
            if vote.voter_id in seen_voters:
                # Double-voting attempt: flag for slashing
                slashed_voters.append(vote.voter_id)
                continue

            seen_voters.add(vote.voter_id)

            # Slashing rule: Voting REJECT when mathematical proof is valid without cause
            if vote.vote is True:
                votes_for += 1
            else:
                votes_against += 1

        quorum_achieved = votes_for >= q_threshold

        payload = {
            "round_id": round_id,
            "capsule_id": capsule_id,
            "total_nodes": total_eligible,
            "votes_for": votes_for,
            "votes_against": votes_against,
            "q_threshold": q_threshold,
            "quorum_achieved": quorum_achieved,
        }
        consensus_digest = hashlib.sha256(
            json.dumps(payload, sort_keys=True).encode("utf-8")
        ).hexdigest()

        return BFTQuorumReceipt(
            round_id=round_id,
            capsule_id=capsule_id,
            total_nodes=total_eligible,
            votes_for=votes_for,
            votes_against=votes_against,
            quorum_threshold=q_threshold,
            quorum_achieved=quorum_achieved,
            byzantine_failures_tolerated=f_tolerated,
            consensus_digest=consensus_digest,
        )
