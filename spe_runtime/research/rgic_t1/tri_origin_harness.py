"""
RGIC-T1 — Tri-Origin Counterfactual Intelligence Harness
Extension of RGIC (Reality-Grounded Intelligence Compilation).
Part of SPE Ω Research Quarantine.

Addresses:
- Diagnosis of Goal (G), World (W), and Verifier (V) failure origins
- Cryptographic prediction precommitment (anti-HARKing)
- Exact integer NanoUSD value-of-information (VOI) probe selection
- Total variation / separability checking and unidentifiable abstention
- Directed Acyclic Epistemic Dependency Graph (DAEDG) & retraction cascades
"""

import hashlib
import json
import time
from typing import List, Dict, Any, Optional, Set
from spe_runtime.research.rgic_t1.types import (
    OriginClass,
    Hypothesis,
    DiagnosticProbe,
    PrecommitmentLock,
    DistinguishabilityRecord,
    EpistemicNode,
    EpistemicNodeState,
)


class TriOriginDiagnoser:
    """
    Core diagnostic engine for separating Goal, World, and Verifier uncertainties.
    """

    def __init__(self):
        pass

    def compute_precommitment_lock(
        self,
        probe: DiagnosticProbe,
        hypotheses: List[Hypothesis],
        timestamp_ns: int,
        salt: str = "spe-rgic-t1-salt"
    ) -> PrecommitmentLock:
        """
        Creates an immutable cryptographic hash lock over hypotheses and predictions
        before the probe is executed.
        """
        payload = {
            "probe_id": probe.id,
            "timestamp_ns": timestamp_ns,
            "salt": salt,
            "hypotheses": [
                {
                    "id": h.id,
                    "origin_class": h.origin_class.value,
                    "predictions": h.predicted_outcomes.get(probe.id, {})
                }
                for h in sorted(hypotheses, key=lambda x: x.id)
            ]
        }
        raw_json = json.dumps(payload, sort_keys=True)
        digest = hashlib.sha256(raw_json.encode("utf-8")).hexdigest()
        return PrecommitmentLock(
            probe_id=probe.id,
            commitment_hash=digest,
            timestamp_ns=timestamp_ns,
            salt=salt
        )

    def verify_precommitment_lock(
        self,
        lock: PrecommitmentLock,
        probe: DiagnosticProbe,
        hypotheses: List[Hypothesis]
    ) -> bool:
        """
        Verifies that predictions were not tampered with post-observation.
        """
        recomputed = self.compute_precommitment_lock(
            probe=probe,
            hypotheses=hypotheses,
            timestamp_ns=lock.timestamp_ns,
            salt=lock.salt
        )
        return recomputed.commitment_hash == lock.commitment_hash

    def compute_probe_utility(self, probe: DiagnosticProbe, criticality: int = 10) -> int:
        """
        Exact integer NanoUSD Value-of-Information (VOI) score.
        Negative infinity (-10^15) if unauthorized.
        """
        if not probe.is_authorized:
            return -1_000_000_000_000_000

        # Informational yield = Entropy reduction (1..1000) * Criticality (1..10) * 1,000,000 nanos
        info_yield = probe.expected_entropy_reduction * criticality * 1_000_000

        # Risk penalty scaled to NanoUSD equivalent
        risk_penalty = probe.risk_score * 10_000_000

        return info_yield - probe.cost_nano_usd - risk_penalty

    def check_separability(
        self, h1: Hypothesis, h2: Hypothesis, probe: DiagnosticProbe
    ) -> bool:
        """
        Returns True if the probe produces distinct predicted observations
        between h1 and h2 (Separable under probe).
        """
        pred1 = h1.predicted_outcomes.get(probe.id)
        pred2 = h2.predicted_outcomes.get(probe.id)
        if pred1 is None or pred2 is None:
            return False
        return pred1 != pred2

    def select_optimal_probe(
        self,
        hypotheses: List[Hypothesis],
        candidate_probes: List[DiagnosticProbe],
        criticality: int = 10
    ) -> Optional[DiagnosticProbe]:
        """
        Selects the authorized probe with the highest integer utility that
        distinguishes between at least two competing hypotheses.
        """
        best_probe: Optional[DiagnosticProbe] = None
        best_utility: Optional[int] = None

        for probe in candidate_probes:
            if not probe.is_authorized:
                continue

            # Check if this probe separates at least one pair of hypotheses
            can_separate = False
            for i in range(len(hypotheses)):
                for j in range(i + 1, len(hypotheses)):
                    if self.check_separability(hypotheses[i], hypotheses[j], probe):
                        can_separate = True
                        break
                if can_separate:
                    break

            if not can_separate:
                continue

            util = self.compute_probe_utility(probe, criticality)
            if best_utility is None or util > best_utility:
                best_utility = util
                best_probe = probe

        return best_probe

    def adjudicate(
        self,
        record_id: str,
        discrepancy_id: str,
        probe: DiagnosticProbe,
        lock: PrecommitmentLock,
        hypotheses: List[Hypothesis],
        observation: Dict[str, Any],
        candidate_probes: Optional[List[DiagnosticProbe]] = None
    ) -> DistinguishabilityRecord:
        """
        Adjudicates observation against precommitted hypotheses.
        Enforces cryptographic verification, separates G/W/V, or reports UNIDENTIFIABLE.
        """
        # Step 1: Enforce precommitment lock
        if not self.verify_precommitment_lock(lock, probe, hypotheses):
            return DistinguishabilityRecord(
                id=record_id,
                discrepancy_id=discrepancy_id,
                evaluated_hypotheses=[h.id for h in hypotheses],
                selected_probe_id=probe.id,
                precommitment_hash=lock.commitment_hash,
                observation=observation,
                discriminated_origins=[],
                eliminated_hypotheses=[],
                remaining_hypotheses=[h.id for h in hypotheses],
                is_identifiable=False,
                status="INVALID_RUN"
            )

        # Step 2: Compare observation against each hypothesis's prediction
        eliminated: List[str] = []
        remaining: List[Hypothesis] = []

        for h in hypotheses:
            pred = h.predicted_outcomes.get(probe.id)
            if pred is None:
                # If hypothesis had no prediction, it cannot be validated by this probe
                remaining.append(h)
                continue

            # All predicted keys must match observation
            matches = True
            for k, expected_v in pred.items():
                if observation.get(k) != expected_v:
                    matches = False
                    break

            if matches:
                remaining.append(h)
            else:
                eliminated.append(h.id)

        # Step 3: Check observational equivalence across remaining hypotheses
        is_identifiable = True
        status = "DISCRIMINATED"

        if len(remaining) == 0:
            # None of our modeled hypotheses predicted this observation!
            # Must abstain and report open-world unmodeled discrepancy
            return DistinguishabilityRecord(
                id=record_id,
                discrepancy_id=discrepancy_id,
                evaluated_hypotheses=[h.id for h in hypotheses],
                selected_probe_id=probe.id,
                precommitment_hash=lock.commitment_hash,
                observation=observation,
                discriminated_origins=[OriginClass.OTHER_OR_UNMODELED],
                eliminated_hypotheses=eliminated,
                remaining_hypotheses=[],
                is_identifiable=False,
                status="UNIDENTIFIABLE"
            )

        if len(remaining) > 1 and candidate_probes is not None:
            # Check if any other authorized probe can separate remaining hypotheses
            further_separable = False
            for p in candidate_probes:
                if not p.is_authorized:
                    continue
                for i in range(len(remaining)):
                    for j in range(i + 1, len(remaining)):
                        if self.check_separability(remaining[i], remaining[j], p):
                            further_separable = True
                            break
                    if further_separable:
                        break
                if further_separable:
                    break

            if not further_separable:
                # The remaining hypotheses cannot be separated by ANY authorized probe!
                is_identifiable = False
                status = "UNIDENTIFIABLE"

        discriminated_origins = list({h.origin_class for h in remaining})

        return DistinguishabilityRecord(
            id=record_id,
            discrepancy_id=discrepancy_id,
            evaluated_hypotheses=[h.id for h in hypotheses],
            selected_probe_id=probe.id,
            precommitment_hash=lock.commitment_hash,
            observation=observation,
            discriminated_origins=discriminated_origins,
            eliminated_hypotheses=eliminated,
            remaining_hypotheses=[h.id for h in remaining],
            is_identifiable=is_identifiable,
            status=status
        )


class EpistemicDependencyGraph:
    """
    Directed Acyclic Epistemic Dependency Graph (DAEDG).
    Tracks the derivation chain: Observation -> Mechanism -> Capability -> Qualification.
    Enforces the Retraction Cascade Law when an underlying assumption is invalidated.
    """

    def __init__(self):
        self.nodes: Dict[str, EpistemicNode] = {}
        # Forward edges: parent -> set of children who depend on parent
        self.dependents: Dict[str, Set[str]] = {}

    def add_node(self, node: EpistemicNode) -> None:
        self.nodes[node.id] = node
        if node.id not in self.dependents:
            self.dependents[node.id] = set()

        for dep_id in node.dependencies:
            if dep_id not in self.dependents:
                self.dependents[dep_id] = set()
            self.dependents[dep_id].add(node.id)

    def invalidate_node(self, target_node_id: str) -> List[str]:
        """
        Invalidates the target node and demotes all downstream dependent nodes
        to REQUALIFICATION_REQUIRED in topological order.
        Returns the list of demoted node IDs.
        """
        if target_node_id not in self.nodes:
            return []

        # Target node is marked INVALIDATED
        self.nodes[target_node_id].state = EpistemicNodeState.INVALIDATED

        demoted_nodes: List[str] = []
        visited: Set[str] = set()
        queue: List[str] = list(self.dependents.get(target_node_id, set()))

        while queue:
            curr_id = queue.pop(0)
            if curr_id in visited:
                continue
            visited.add(curr_id)

            if curr_id in self.nodes:
                self.nodes[curr_id].state = EpistemicNodeState.REQUALIFICATION_REQUIRED
                demoted_nodes.append(curr_id)

            # Add downstream dependents
            for child_id in self.dependents.get(curr_id, set()):
                if child_id not in visited:
                    queue.append(child_id)

        return demoted_nodes
