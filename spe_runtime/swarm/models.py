"""Level 6: Collective Swarm Intelligence & Byzantine-Resilient P2P Federation Models.

Defines data contracts for swarm node topologies, BFT consensus votes,
quorum receipts, peer gossip messages, and sybil defense slashing.
"""

from __future__ import annotations

import hashlib
import json
import time
from dataclasses import asdict, dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional


class NodeRole(str, Enum):
    SUPERVISOR = "SUPERVISOR"
    WORKER = "WORKER"
    RED_TEAM_AUDITOR = "RED_TEAM_AUDITOR"
    BFT_VALIDATOR = "BFT_VALIDATOR"


class NodeState(str, Enum):
    ONLINE = "ONLINE"
    SYNCING = "SYNCING"
    SLASHED = "SLASHED"
    OFFLINE = "OFFLINE"


class GossipTopic(str, Enum):
    CAPSULE_DISCOVERY = "CAPSULE_DISCOVERY"
    PROOF_VERIFICATION = "PROOF_VERIFICATION"
    AXIOM_GOSSIP = "AXIOM_GOSSIP"
    SLASHING_ALERT = "SLASHING_ALERT"


@dataclass
class SwarmNode:
    """A peer node participating in the collective multi-agent mesh."""
    node_id: str
    role: NodeRole
    reputation_score: float = 0.8
    stake_weight: float = 1.0
    state: NodeState = NodeState.ONLINE
    public_key: str = field(default_factory=lambda: hashlib.sha256(str(time.time()).encode("utf-8")).hexdigest()[:32])
    last_heartbeat: str = field(default_factory=lambda: time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()))

    def is_eligible_voter(self) -> bool:
        return self.state == NodeState.ONLINE and self.reputation_score >= 0.5


@dataclass
class ConsensusVote:
    """An individual peer validator's vote on a proposed capability or optimization."""
    voter_id: str
    capsule_id: str
    vote: bool  # True = APPROVE, False = REJECT
    proof_verified: bool
    reason: str
    signature: str = ""

    def __post_init__(self) -> None:
        if not self.signature:
            payload = f"{self.voter_id}:{self.capsule_id}:{self.vote}:{self.proof_verified}"
            self.signature = hashlib.sha256(payload.encode("utf-8")).hexdigest()[:24]


@dataclass
class BFTQuorumReceipt:
    """Mathematical certificate proving Byzantine fault-tolerant quorum consensus."""
    round_id: str
    capsule_id: str
    total_nodes: int
    votes_for: int
    votes_against: int
    quorum_threshold: int
    quorum_achieved: bool
    byzantine_failures_tolerated: int
    consensus_digest: str
    timestamp: str = field(default_factory=lambda: time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()))


@dataclass
class SwarmGossipMessage:
    """Gossip protocol payload broadcast across the peer-to-peer swarm mesh."""
    message_id: str
    origin_node_id: str
    topic: GossipTopic
    payload: Dict[str, Any]
    signature: str
    hop_count: int = 0
    timestamp: str = field(default_factory=lambda: time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()))
