"""Swarm Mesh: Peer-to-Peer Multi-Agent Cluster & Gossip Topology.

Coordinates distributed node topologies, gossip broadcasting, sybil slashing,
and collective BFT validation rounds across autonomous agents.
"""

from __future__ import annotations

import hashlib
import json
import time
from typing import Any, Dict, List, Optional

from spe_runtime.capabilities.capsule import AdmissionState, CapabilityCapsule
from spe_runtime.capabilities.sandbox import CapabilitySandbox
from spe_runtime.swarm.bft_consensus import BFTConsensusEngine
from spe_runtime.swarm.models import (
    BFTQuorumReceipt,
    ConsensusVote,
    GossipTopic,
    NodeRole,
    NodeState,
    SwarmGossipMessage,
    SwarmNode,
)


class SwarmMesh:
    """Manages the distributed peer-to-peer multi-agent mesh cluster."""

    def __init__(self, cluster_id: str = "spe_omega_swarm_01") -> None:
        self.cluster_id = cluster_id
        self.nodes: Dict[str, SwarmNode] = {}
        self.consensus_engine = BFTConsensusEngine()
        self.gossip_log: List[SwarmGossipMessage] = []
        self._seed_default_cluster()

    def _seed_default_cluster(self) -> None:
        """Seeds canonical 7-node heterogeneous mesh topology."""
        default_topology = [
            ("node_local_silicon", NodeRole.SUPERVISOR, 1.0, 0.99),
            ("node_peer_useast", NodeRole.BFT_VALIDATOR, 1.0, 0.95),
            ("node_peer_eucentral", NodeRole.BFT_VALIDATOR, 1.0, 0.94),
            ("node_peer_apsouth", NodeRole.BFT_VALIDATOR, 1.0, 0.93),
            ("node_edge_wasm_01", NodeRole.WORKER, 0.5, 0.88),
            ("node_edge_wasm_02", NodeRole.WORKER, 0.5, 0.87),
            ("node_redteam_auditor", NodeRole.RED_TEAM_AUDITOR, 1.0, 0.96),
        ]
        for node_id, role, stake, rep in default_topology:
            self.nodes[node_id] = SwarmNode(
                node_id=node_id,
                role=role,
                stake_weight=stake,
                reputation_score=rep,
                state=NodeState.ONLINE,
            )

    def register_node(self, node: SwarmNode) -> bool:
        if node.node_id in self.nodes:
            return False
        self.nodes[node.node_id] = node
        return True

    def slash_node(self, node_id: str, reason: str) -> bool:
        """Slashes a Byzantine, sybil, or malicious peer node."""
        node = self.nodes.get(node_id)
        if not node:
            return False

        node.state = NodeState.SLASHED
        node.reputation_score = 0.0

        slash_payload = {
            "slashed_node_id": node_id,
            "reason": reason,
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }
        self.broadcast_gossip(
            topic=GossipTopic.SLASHING_ALERT,
            payload=slash_payload,
            origin_node_id="node_local_silicon",
        )
        return True

    def broadcast_gossip(
        self,
        topic: GossipTopic,
        payload: Dict[str, Any],
        origin_node_id: str,
    ) -> SwarmGossipMessage:
        """Broadcasts signed gossip message across the peer-to-peer swarm."""
        msg_id = f"gossip_{topic.value.lower()}_{int(time.time()*1000)}"
        msg_payload_str = json.dumps(payload, sort_keys=True)
        sig = hashlib.sha256(f"{msg_id}:{origin_node_id}:{msg_payload_str}".encode("utf-8")).hexdigest()[:24]

        msg = SwarmGossipMessage(
            message_id=msg_id,
            origin_node_id=origin_node_id,
            topic=topic,
            payload=payload,
            signature=sig,
            hop_count=1,
        )
        self.gossip_log.append(msg)
        return msg

    def _validate_capsule_for_peer(self, capsule: CapabilityCapsule) -> Tuple[bool, str]:
        """Independent peer verification of candidate capability capsule."""
        # 1. Exact artifact digest verification
        if not hasattr(capsule, "procedure") or not capsule.procedure:
            return False, "REJECTED_MISSING_PROCEDURE"
        payload_data = capsule.procedure.payload
        if not isinstance(payload_data, str):
            return False, "REJECTED_INVALID_PAYLOAD_TYPE"
        actual_sha = hashlib.sha256(payload_data.encode("utf-8")).hexdigest()
        if capsule.procedure.sha256 != actual_sha:
            return False, f"REJECTED_DIGEST_MISMATCH: expected {actual_sha}, declared {capsule.procedure.sha256}"

        # 2. Valid evidence provenance
        if not hasattr(capsule, "witnesses") or not capsule.witnesses:
            return False, "REJECTED_NO_WITNESSES"
        for wit in capsule.witnesses:
            if not wit.hash or len(wit.hash) != 64 or not wit.proof_type or not wit.verified_at:
                return False, f"REJECTED_INVALID_WITNESS_PROVENANCE: {getattr(wit, 'witness_id', 'unknown')}"

        # 3. Actual qualification result
        if not hasattr(capsule, "admission_state") or capsule.admission_state in (
            AdmissionState.REJECTED,
            AdmissionState.SUSPENDED,
            AdmissionState.HYPOTHESIS,
        ):
            return False, f"REJECTED_UNQUALIFIED_ADMISSION_STATE: {getattr(capsule, 'admission_state', 'NONE')}"

        if not hasattr(capsule, "interventions") or capsule.interventions.trial_count <= 0 or capsule.interventions.lcb_95_delta <= 0.0:
            return False, "REJECTED_NO_POSITIVE_CAUSAL_DELTA"

        # 4. Executable-to-evidence binding: Sandbox trial execution
        fixture = self._build_validation_fixture(capsule)
        try:
            exec_res = CapabilitySandbox.execute_capsule(capsule, fixture, max_duration_ms=50.0)
            if not exec_res.success:
                return False, f"REJECTED_EXECUTABLE_SANDBOX_FAILURE: {exec_res.error}"
        except Exception as ex:
            return False, f"REJECTED_SANDBOX_CRASH: {type(ex).__name__}: {ex}"

        return True, "VERIFIED_VALID_EXECUTABLE_AND_EVIDENCE"

    def _build_validation_fixture(self, capsule: CapabilityCapsule) -> Dict[str, Any]:
        schema = capsule.contracts.input_schema if hasattr(capsule, "contracts") and capsule.contracts else {}
        props = schema.get("properties", {}) if isinstance(schema, dict) else {}
        fixture: Dict[str, Any] = {}
        for prop_name, prop_spec in props.items():
            ptype = prop_spec.get("type", "string") if isinstance(prop_spec, dict) else "string"
            if ptype == "integer":
                fixture[prop_name] = 1000
            elif ptype == "array":
                fixture[prop_name] = [{"clause_id": "c1", "tags": ["auth_guard"]}]
            else:
                fixture[prop_name] = "tok_mgr_test" if "token" in prop_name else "sample_input_text"
        if not fixture:
            name_lower = str(getattr(capsule, "name", "")).lower()
            if "financial" in name_lower:
                fixture = {"amount_cents": 1000, "approval_token": "tok_mgr_valid"}
            elif "privacy" in name_lower:
                fixture = {"text": "Clean payload without PII"}
            else:
                fixture = {"requested_tokens": 10}
        return fixture

    def run_capsule_consensus(self, capsule: CapabilityCapsule) -> BFTQuorumReceipt:
        """Executes full BFT validation across all online validator/auditor nodes in simulated federation."""
        round_id = f"bft_round_{capsule.capsule_id}_{int(time.time()*1000)}"
        registered_list = list(self.nodes.values())

        # Collect votes from each node
        votes: List[ConsensusVote] = []
        for node in registered_list:
            if not node.is_eligible_voter():
                continue

            is_valid, reason = self._validate_capsule_for_peer(capsule)

            votes.append(
                ConsensusVote(
                    voter_id=node.node_id,
                    capsule_id=capsule.capsule_id,
                    vote=is_valid,
                    proof_verified=is_valid,
                    reason=reason,
                )
            )

        receipt = self.consensus_engine.execute_voting_round(
            round_id=round_id,
            capsule_id=capsule.capsule_id,
            registered_nodes=registered_list,
            votes=votes,
        )

        # Broadcast consensus result across simulated federation
        self.broadcast_gossip(
            topic=GossipTopic.PROOF_VERIFICATION,
            payload={
                "capsule_id": capsule.capsule_id,
                "consensus_model": "SIMULATED_BFT_FEDERATION",
                "quorum_achieved": receipt.quorum_achieved,
                "votes_for": receipt.votes_for,
                "total_nodes": receipt.total_nodes,
                "consensus_digest": receipt.consensus_digest,
            },
            origin_node_id="node_local_silicon",
        )

        return receipt

    def export_swarm_telemetry(self) -> Dict[str, Any]:
        """Exports cluster health, topology, and consensus telemetry."""
        online_count = sum(1 for n in self.nodes.values() if n.state == NodeState.ONLINE)
        slashed_count = sum(1 for n in self.nodes.values() if n.state == NodeState.SLASHED)
        f_tol, q_thresh = self.consensus_engine.calculate_bft_thresholds(online_count)

        return {
            "cluster_id": self.cluster_id,
            "total_nodes": len(self.nodes),
            "online_nodes": online_count,
            "slashed_nodes": slashed_count,
            "byzantine_faults_tolerated": f_tol,
            "bft_quorum_threshold": q_thresh,
            "nodes": [
                {
                    "node_id": n.node_id,
                    "role": n.role.value,
                    "reputation": round(n.reputation_score, 2),
                    "stake": n.stake_weight,
                    "state": n.state.value,
                }
                for n in self.nodes.values()
            ],
            "recent_gossip": [
                {
                    "message_id": m.message_id,
                    "topic": m.topic.value,
                    "origin": m.origin_node_id,
                    "signature": m.signature,
                }
                for m in self.gossip_log[-5:]
            ],
        }
