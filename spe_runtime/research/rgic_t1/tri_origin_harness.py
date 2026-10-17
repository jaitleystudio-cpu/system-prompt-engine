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
                    "origin_class": h.origin_class.value if hasattr(h.origin_class, "value") else str(h.origin_class),
                    "predictions": h.predicted_outcomes.get(probe.id, {})
                }
                for h in sorted(hypotheses, key=lambda x: x.id)
            ]
        }
        raw_json = json.dumps(payload, sort_keys=True, default=lambda o: o.value if hasattr(o, "value") else str(o))
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

        # Non-negative clamping for entropy reduction and criticality
        clamped_entropy = max(0, probe.expected_entropy_reduction)
        clamped_criticality = max(0, criticality)

        # Informational yield = Entropy reduction (1..1000) * Criticality (1..10) * 1,000,000 nanos
        info_yield = clamped_entropy * clamped_criticality * 1_000_000

        # Risk penalty scaled to NanoUSD equivalent (RiskPoints * 10^7 nanos)
        clamped_risk = max(0, probe.risk_score)
        risk_penalty = clamped_risk * 10_000_000

        return info_yield - max(0, probe.cost_nano_usd) - risk_penalty

    def compute_total_variation(
        self, pred1: Optional[Dict[str, Any]], pred2: Optional[Dict[str, Any]]
    ) -> float:
        """
        Computes Total Variation distance between two predicted outcome distributions.
        TV = 0.5 * sum_{y} |P(y|H1) - P(y|H2)|
        For deterministic outcomes, returns 1.0 if pred1 != pred2, else 0.0.
        """
        if pred1 is None or pred2 is None:
            return 0.0
        if pred1 == pred2:
            return 0.0

        # Check if both dictionaries represent numeric probability distributions
        is_numeric1 = all(isinstance(v, (int, float)) and not isinstance(v, bool) for v in pred1.values())
        is_numeric2 = all(isinstance(v, (int, float)) and not isinstance(v, bool) for v in pred2.values())

        if is_numeric1 and is_numeric2 and pred1 and pred2:
            all_keys = set(pred1.keys()).union(set(pred2.keys()))
            tv = 0.5 * sum(abs(float(pred1.get(k, 0.0)) - float(pred2.get(k, 0.0))) for k in all_keys)
            return float(tv)

        return 1.0 if pred1 != pred2 else 0.0

    def check_separability(
        self, h1: Hypothesis, h2: Hypothesis, probe: DiagnosticProbe, epsilon: float = 0.01
    ) -> bool:
        """
        Returns True if the probe produces distinct predicted observations
        between h1 and h2 with Total Variation separability >= epsilon.
        """
        pred1 = h1.predicted_outcomes.get(probe.id)
        pred2 = h2.predicted_outcomes.get(probe.id)
        if pred1 is None or pred2 is None:
            return False
        return self.compute_total_variation(pred1, pred2) >= epsilon

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

        discriminated_origins = sorted(list({h.origin_class for h in remaining}), key=lambda x: x.value)

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

    def detect_cycles(self) -> List[List[str]]:
        """
        Detects directed cycles in the epistemic graph using DFS.
        Returns a list of cycle paths (empty if graph is a valid DAG).
        """
        WHITE, GRAY, BLACK = 0, 1, 2
        color = {node_id: WHITE for node_id in self.nodes}
        cycles: List[List[str]] = []

        def dfs(u: str, path: List[str]):
            color[u] = GRAY
            path.append(u)
            for v in sorted(self.dependents.get(u, set())):
                if v not in color:
                    continue
                if color[v] == GRAY:
                    cycle_start_idx = path.index(v)
                    cycles.append(path[cycle_start_idx:] + [v])
                elif color[v] == WHITE:
                    dfs(v, path)
            path.pop()
            color[u] = BLACK

        for node_id in sorted(self.nodes.keys()):
            if color[node_id] == WHITE:
                dfs(node_id, [])

        return cycles

    def has_cycles(self) -> bool:
        """Returns True if the epistemic graph contains at least one cycle."""
        return len(self.detect_cycles()) > 0

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

        # Find all reachable descendants of target_node_id (strictly excluding target_node_id itself)
        descendants: Set[str] = set()
        queue: List[str] = list(self.dependents.get(target_node_id, set()))
        while queue:
            curr = queue.pop(0)
            if curr == target_node_id or curr in descendants:
                continue
            descendants.add(curr)
            for child in self.dependents.get(curr, set()):
                if child != target_node_id and child not in descendants:
                    queue.append(child)

        if not descendants:
            return []

        # Topological sort over the induced subgraph of descendants using Kahn's algorithm
        # in_degree: count of dependencies for node u that are also in descendants
        in_degree: Dict[str, int] = {
            u: sum(1 for p in self.nodes[u].dependencies if p in descendants)
            for u in descendants
        }

        ready_queue: List[str] = sorted([u for u, deg in in_degree.items() if deg == 0])
        demoted_nodes: List[str] = []

        while ready_queue:
            curr_id = ready_queue.pop(0)
            demoted_nodes.append(curr_id)
            if curr_id in self.nodes:
                self.nodes[curr_id].state = EpistemicNodeState.REQUALIFICATION_REQUIRED

            for child_id in sorted(self.dependents.get(curr_id, set())):
                if child_id in descendants:
                    in_degree[child_id] -= 1
                    if in_degree[child_id] == 0:
                        ready_queue.append(child_id)
                        ready_queue.sort()

        # Handle any remaining cyclic descendants safely
        remaining_in_cycle = sorted([u for u in descendants if u not in demoted_nodes])
        for curr_id in remaining_in_cycle:
            demoted_nodes.append(curr_id)
            if curr_id in self.nodes:
                self.nodes[curr_id].state = EpistemicNodeState.REQUALIFICATION_REQUIRED

        return demoted_nodes


# Canonical research alias
EpistemicDependencyTracker = EpistemicDependencyGraph
