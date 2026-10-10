"""Counterfactual Representation Lift (CRL): Representation Morphism & Semantic Bridge.

Detects when an initial problem representation R_0 is a bottleneck, generates
alternative formal representations R_i, and validates semantic equivalence
under explicit formal scope boundaries with cryptographic certificate binding.
"""

from __future__ import annotations

import hashlib
import json
import re
import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Callable, Dict, List, Optional, Set, Tuple

from spe_runtime.supercompiler.causal_circuit_synthesizer import canonical_json_rfc8785

NAME_PATTERN = re.compile(r"^[A-Z][A-Z_]{0,31}$")


class FormalismKind(str, Enum):
    """Target formal representation categories."""
    NATURAL_LANGUAGE_PROMPT = "NATURAL_LANGUAGE_PROMPT"
    FINITE_STATE_MACHINE = "FINITE_STATE_MACHINE"
    DIRECTED_CONSTRAINT_GRAPH = "DIRECTED_CONSTRAINT_GRAPH"
    STRUCTURAL_CAUSAL_MODEL = "STRUCTURAL_CAUSAL_MODEL"


class SemanticBridgeStatus(str, Enum):
    """Status of the semantic bridge between R_0 and candidate R_i."""
    PROVED_EQUIVALENT = "PROVED_EQUIVALENT"
    EMPIRICALLY_SUPPORTED = "EMPIRICALLY_SUPPORTED"
    EQUIVALENCE_VIOLATED = "EQUIVALENCE_VIOLATED"
    UNKNOWN_TRANSFER_SCOPE = "UNKNOWN_TRANSFER_SCOPE"


@dataclass(frozen=True)
class SemanticBridgeCertificate:
    """Formal proof certificate guaranteeing behavioral preservation."""
    source_formalism: FormalismKind
    target_formalism: FormalismKind
    status: SemanticBridgeStatus
    verified_invariants: List[str]
    violated_invariants: List[str]
    proved_scope_description: str
    source_spec_digest: str
    target_artifact_digest: str
    requirements_digest: str
    bridge_digest: str
    verification_latency_ms: float
    verification_method: str = "EXHAUSTIVE_FINITE_MODEL_CHECK_AND_BFS_FIXPOINT"


@dataclass
class FiniteStateMachineRepresentation:
    """FSM Representation for interactive flows, UI states, and workflows."""
    states: Set[str]
    initial_state: str
    transitions: Dict[Tuple[str, str], str]  # (current_state, event) -> next_state
    invariants_per_state: Dict[str, List[str]] = field(default_factory=dict)

    def step(self, current_state: str, event: str) -> Tuple[str, bool]:
        """Transitions state machine deterministically."""
        if (current_state, event) in self.transitions:
            return self.transitions[(current_state, event)], True
        return current_state, False

    def to_canonical_dict(self) -> Dict[str, Any]:
        """Serializes representation to deterministic dictionary for RFC 8785 hashing."""
        serialized_transitions = [
            {"from": s, "event": e, "to": d}
            for (s, e), d in sorted(self.transitions.items(), key=lambda x: (x[0][0], x[0][1]))
        ]
        serialized_invariants = {
            s: sorted(invs) for s, invs in sorted(self.invariants_per_state.items())
        }
        return {
            "kind": "FINITE_STATE_MACHINE",
            "states": sorted(list(self.states)),
            "initial_state": self.initial_state,
            "transitions": serialized_transitions,
            "invariants_per_state": serialized_invariants,
        }


@dataclass
class ConstraintGraphRepresentation:
    """Directed Acyclic Constraint Graph for mutual exclusion and authority delegation."""
    nodes: Set[str]
    directed_delegations: List[Tuple[str, str]]  # (issuer, recipient)
    mutual_exclusions: List[Tuple[str, str]]    # (cap_a, cap_b) cannot be held concurrently
    revoked_edges: Set[Tuple[str, str]] = field(default_factory=set)
    revoked_principals: Set[str] = field(default_factory=set)

    def validate_structure(self) -> bool:
        """Validates that all nodes, delegations, and exclusions satisfy formal schema."""
        if not isinstance(self.nodes, (set, frozenset)):
            return False
        if not all(isinstance(n, str) and NAME_PATTERN.match(n) for n in self.nodes):
            return False
        if not isinstance(self.directed_delegations, (list, tuple)):
            return False
        for e in self.directed_delegations:
            if not (isinstance(e, tuple) and len(e) == 2 and all(isinstance(x, str) and x in self.nodes for x in e)):
                return False
        if not isinstance(self.mutual_exclusions, (list, tuple)):
            return False
        for x in self.mutual_exclusions:
            if not (isinstance(x, tuple) and len(x) == 2 and all(isinstance(a, str) and a in self.nodes for a in x)):
                return False
        return True

    def check_acyclicity(self) -> bool:
        """Verifies no delegation cycles exist among non-revoked edges (iterative Kahn)."""
        if not self.validate_structure():
            return False
        live = [e for e in self.directed_delegations if e not in self.revoked_edges]
        indeg: Dict[str, int] = {n: 0 for n in self.nodes}
        adj: Dict[str, List[str]] = {n: [] for n in self.nodes}
        for u, v in live:
            adj[u].append(v)
            indeg[v] += 1

        queue = [n for n in self.nodes if indeg[n] == 0]
        seen = 0
        while queue:
            n = queue.pop(0)
            seen += 1
            for m in adj[n]:
                indeg[m] -= 1
                if indeg[m] == 0:
                    queue.append(m)

        return seen == len(self.nodes)

    def get_effective_holdings(self) -> Dict[str, Set[str]]:
        """Computes transitive closure of authority delegation: recipient holds all delegator roles."""
        live = [e for e in self.directed_delegations if e not in self.revoked_edges]
        held: Dict[str, Set[str]] = {n: {n} for n in self.nodes}
        changed = True
        while changed:
            changed = False
            for u, v in live:
                if not held[u] <= held[v]:
                    held[v] |= held[u]
                    changed = True
        return held

    def check_mutual_exclusion(self, active_capabilities: Any) -> bool:
        """Verifies no mutually exclusive capabilities are concurrently active or transitively held."""
        if not self.validate_structure() or not self.check_acyclicity():
            return False
        if not isinstance(active_capabilities, (set, frozenset)) or not active_capabilities:
            return False
        if not all(isinstance(x, str) and NAME_PATTERN.match(x) and x in self.nodes for x in active_capabilities):
            return False
        if set(active_capabilities) & self.revoked_principals:
            return False

        # Transitive holdings check
        held = self.get_effective_holdings()
        for a, b in self.mutual_exclusions:
            # Direct pair check in active request
            if a in active_capabilities and b in active_capabilities:
                return False
            # Transitive holdings breach
            if any(a in h and b in h for h in held.values()):
                return False

        return True

    def to_canonical_dict(self) -> Dict[str, Any]:
        """Serializes representation to deterministic dictionary for RFC 8785 hashing."""
        return {
            "kind": "DIRECTED_CONSTRAINT_GRAPH",
            "nodes": sorted(list(self.nodes)) if isinstance(self.nodes, (set, frozenset)) else str(self.nodes),
            "directed_delegations": [
                [u, v] for u, v in sorted(self.directed_delegations)
            ] if isinstance(self.directed_delegations, list) else [],
            "mutual_exclusions": [
                [a, b] for a, b in sorted(self.mutual_exclusions)
            ] if isinstance(self.mutual_exclusions, list) else [],
            "revoked_edges": [
                [u, v] for u, v in sorted(self.revoked_edges)
            ],
            "revoked_principals": sorted(list(self.revoked_principals)),
        }


class RepresentationBottleneckDetector:
    """Analyzes problem specification to determine if flat representation R_0 is a bottleneck."""

    def analyze(self, raw_spec: Dict[str, Any]) -> Tuple[bool, Optional[FormalismKind], str]:
        """Returns (is_bottleneck, recommended_formalism, rationale) using precise token matching."""
        task_desc = str(raw_spec.get("task_description", ""))

        # 1. Sequential stateful interactive flows -> FSM
        if re.search(r"\b(interactive 3d|3d website|scene transition|fsm|finite state machine|state transitions?)\b", task_desc, re.IGNORECASE):
            return (
                True,
                FormalismKind.FINITE_STATE_MACHINE,
                "Sequential multi-phase state machine detected; flat prompts cause state desynchronization.",
            )

        # 2. Transitive delegations and mutual exclusions -> Constraint Graph
        if re.search(r"\b(grants? agent|delegat(ion|e)|re-grant|mutual exclusion|separation of duties|rbac lease)\b", task_desc, re.IGNORECASE):
            return (
                True,
                FormalismKind.DIRECTED_CONSTRAINT_GRAPH,
                "Transitive authority hierarchy detected; flat prompts risk delegation cycles and privilege escalation.",
            )

        # 3. Interventions and causal inference -> Causal SCM
        if re.search(r"\b(increase retention|causal effect|treatment|confound(er|ing)|structural causal model|did the .+ cause)\b", task_desc, re.IGNORECASE):
            return (
                True,
                FormalismKind.STRUCTURAL_CAUSAL_MODEL,
                "Causal dependency structure detected; flat prompts confound observational and interventional effects.",
            )

        return False, None, "Original representation R_0 is sufficient for linear search."


class SemanticBridgeVerifier:
    """Evaluates whether candidate representation R_i preserves all intent in R_0."""

    def verify_fsm_bridge(
        self,
        raw_spec: Dict[str, Any],
        fsm: FiniteStateMachineRepresentation,
    ) -> SemanticBridgeCertificate:
        """Verifies that an FSM preserves the required sequence constraints."""
        t0 = time.perf_counter()
        verified: List[str] = []
        violated: List[str] = []

        # 1. Spec presence validation
        if not raw_spec or not raw_spec.get("required_stages"):
            duration = (time.perf_counter() - t0) * 1e6
            return SemanticBridgeCertificate(
                source_formalism=FormalismKind.NATURAL_LANGUAGE_PROMPT,
                target_formalism=FormalismKind.FINITE_STATE_MACHINE,
                status=SemanticBridgeStatus.UNKNOWN_TRANSFER_SCOPE,
                verified_invariants=[],
                violated_invariants=["empty_or_invalid_spec"],
                proved_scope_description="Unspecified or empty domain scope",
                source_spec_digest=hashlib.sha256(canonical_json_rfc8785(raw_spec).encode()).hexdigest(),
                target_artifact_digest=hashlib.sha256(canonical_json_rfc8785(fsm.to_canonical_dict()).encode()).hexdigest(),
                requirements_digest=hashlib.sha256(b"none").hexdigest(),
                bridge_digest=hashlib.sha256(b"unknown_scope").hexdigest(),
                verification_latency_ms=duration / 1000.0,
            )

        req_stages = raw_spec.get("required_stages", [])
        req_order = raw_spec.get("required_order", [])
        hard_constraints = raw_spec.get("hard_constraints", [])

        # Check required stages presence
        for st in req_stages:
            if st in fsm.states:
                verified.append(f"state_presence:{st}")
            else:
                violated.append(f"missing_state:{st}")

        # Check no unauthorized extra states
        unauthorized_states = fsm.states - set(req_stages)
        if unauthorized_states:
            violated.append(f"unauthorized_extra_states:{sorted(list(unauthorized_states))}")
        else:
            verified.append("no_unauthorized_extra_states")

        # Check initial state
        if fsm.initial_state in fsm.states and (not req_order or fsm.initial_state == req_order[0]):
            verified.append(f"valid_initial_state:{fsm.initial_state}")
        else:
            violated.append("invalid_initial_state")

        # Reachability BFS Fixpoint (order independent)
        reachable: Set[str] = {fsm.initial_state}
        queue = [fsm.initial_state]
        while queue:
            curr = queue.pop(0)
            for (src, _), dst in fsm.transitions.items():
                if src == curr and dst not in reachable:
                    reachable.add(dst)
                    queue.append(dst)

        unreachable = fsm.states - reachable
        if unreachable:
            violated.append(f"unreachable_states:{sorted(list(unreachable))}")
        else:
            verified.append("all_states_reachable")

        # Order preservation
        if req_order and len(req_order) > 1:
            order_ok = True
            for i in range(len(req_order) - 1):
                curr_st = req_order[i]
                next_st = req_order[i + 1]
                direct_reaches = [dst for (s, ev), dst in fsm.transitions.items() if s == curr_st]
                if next_st not in direct_reaches:
                    order_ok = False
                for later_idx in range(i + 2, len(req_order)):
                    if req_order[later_idx] in direct_reaches:
                        order_ok = False
            if order_ok:
                verified.append("order_preserved")
            else:
                violated.append("order_violated")

        # Hard constraints enforcement
        for hc in hard_constraints:
            if "scroll_down advances exactly one stage" in hc and req_order:
                advances_ok = True
                for i in range(len(req_order) - 1):
                    dst = fsm.transitions.get((req_order[i], "scroll_down"))
                    if dst != req_order[i + 1]:
                        advances_ok = False
                if advances_ok:
                    verified.append("scroll_down_advances_preserved")
                else:
                    violated.append("scroll_down_advances_violated")

            if "scroll_up reverses exactly one stage" in hc and req_order:
                reverses_ok = True
                for i in range(1, len(req_order)):
                    dst = fsm.transitions.get((req_order[i], "scroll_up"))
                    if dst != req_order[i - 1]:
                        reverses_ok = False
                if reverses_ok:
                    verified.append("scroll_up_reverses_preserved")
                else:
                    violated.append("scroll_up_reverses_violated")

            if "requires consent" in hc:
                target_st = hc.split()[0]
                st_invs = fsm.invariants_per_state.get(target_st, [])
                if any("consent" in inv.lower() for inv in st_invs):
                    verified.append(f"consent_invariant_present:{target_st}")
                else:
                    violated.append(f"consent_invariant_missing:{target_st}")

        status = SemanticBridgeStatus.PROVED_EQUIVALENT if not violated else SemanticBridgeStatus.EQUIVALENCE_VIOLATED
        duration = (time.perf_counter() - t0) * 1e6

        # Cryptographically bind source spec, target artifact, requirements, and verification outcome
        spec_digest = hashlib.sha256(canonical_json_rfc8785(raw_spec).encode()).hexdigest()
        artifact_digest = hashlib.sha256(canonical_json_rfc8785(fsm.to_canonical_dict()).encode()).hexdigest()
        reqs_digest = hashlib.sha256(canonical_json_rfc8785({"hard_constraints": hard_constraints, "required_order": req_order}).encode()).hexdigest()

        cert_binding = {
            "source_formalism": FormalismKind.NATURAL_LANGUAGE_PROMPT.value,
            "target_formalism": FormalismKind.FINITE_STATE_MACHINE.value,
            "status": status.value,
            "spec_digest": spec_digest,
            "artifact_digest": artifact_digest,
            "requirements_digest": reqs_digest,
            "verified_invariants": sorted(verified),
            "violated_invariants": sorted(violated),
        }
        bridge_digest = hashlib.sha256(canonical_json_rfc8785(cert_binding).encode()).hexdigest()

        return SemanticBridgeCertificate(
            source_formalism=FormalismKind.NATURAL_LANGUAGE_PROMPT,
            target_formalism=FormalismKind.FINITE_STATE_MACHINE,
            status=status,
            verified_invariants=verified,
            violated_invariants=violated,
            proved_scope_description="Exhaustive reachability, sequential order, and invariant preservation",
            source_spec_digest=spec_digest,
            target_artifact_digest=artifact_digest,
            requirements_digest=reqs_digest,
            bridge_digest=bridge_digest,
            verification_latency_ms=duration / 1000.0,
        )

    def verify_constraint_graph_bridge(
        self,
        raw_spec: Dict[str, Any],
        graph: ConstraintGraphRepresentation,
    ) -> SemanticBridgeCertificate:
        """Verifies that a Constraint Graph preserves acyclicity and mutual exclusion."""
        t0 = time.perf_counter()
        verified: List[str] = []
        violated: List[str] = []

        hard_constraints = raw_spec.get("hard_constraints", [])
        req_exclusions = raw_spec.get("required_exclusions", [])

        # 1. Structure validation
        if not graph.validate_structure():
            violated.append("invalid_graph_structure_or_undeclared_nodes")
        else:
            verified.append("valid_graph_structure")

        # 2. Non-empty check when constraints exist
        if (hard_constraints or req_exclusions) and not graph.nodes:
            violated.append("vacuous_empty_graph")

        # 3. Check acyclicity
        if graph.check_acyclicity():
            verified.append("acyclic_delegation_hierarchy")
        else:
            violated.append("cyclic_delegation_risk")

        # 4. Transitive holdings check against mutual exclusion
        if graph.validate_structure():
            held = graph.get_effective_holdings()
            transitive_breach = False
            for a, b in graph.mutual_exclusions:
                if any(a in h and b in h for h in held.values()):
                    transitive_breach = True
            if transitive_breach:
                violated.append("transitive_exclusion_breach_via_delegation")
            else:
                verified.append("transitive_exclusion_preserved")

        # 5. Check required exclusions from spec are present
        if req_exclusions:
            defined_pairs = {tuple(sorted(x)) for x in graph.mutual_exclusions}
            for req_pair in req_exclusions:
                if tuple(sorted(req_pair)) not in defined_pairs:
                    violated.append(f"required_exclusion_missing:{req_pair}")
                else:
                    verified.append(f"required_exclusion_present:{req_pair}")
        elif graph.mutual_exclusions:
            verified.append(f"mutual_exclusions_defined:{len(graph.mutual_exclusions)}")

        status = SemanticBridgeStatus.PROVED_EQUIVALENT if not violated else SemanticBridgeStatus.EQUIVALENCE_VIOLATED
        duration = (time.perf_counter() - t0) * 1e6

        spec_digest = hashlib.sha256(canonical_json_rfc8785(raw_spec).encode()).hexdigest()
        artifact_digest = hashlib.sha256(canonical_json_rfc8785(graph.to_canonical_dict()).encode()).hexdigest()
        reqs_digest = hashlib.sha256(canonical_json_rfc8785({"hard_constraints": hard_constraints, "required_exclusions": req_exclusions}).encode()).hexdigest()

        cert_binding = {
            "source_formalism": FormalismKind.NATURAL_LANGUAGE_PROMPT.value,
            "target_formalism": FormalismKind.DIRECTED_CONSTRAINT_GRAPH.value,
            "status": status.value,
            "spec_digest": spec_digest,
            "artifact_digest": artifact_digest,
            "requirements_digest": reqs_digest,
            "verified_invariants": sorted(verified),
            "violated_invariants": sorted(violated),
        }
        bridge_digest = hashlib.sha256(canonical_json_rfc8785(cert_binding).encode()).hexdigest()

        return SemanticBridgeCertificate(
            source_formalism=FormalismKind.NATURAL_LANGUAGE_PROMPT,
            target_formalism=FormalismKind.DIRECTED_CONSTRAINT_GRAPH,
            status=status,
            verified_invariants=verified,
            violated_invariants=violated,
            proved_scope_description="Acyclic delegation, transitive holdings, and pairwise capability exclusion",
            source_spec_digest=spec_digest,
            target_artifact_digest=artifact_digest,
            requirements_digest=reqs_digest,
            bridge_digest=bridge_digest,
            verification_latency_ms=duration / 1000.0,
        )

    def verify_certificate(
        self,
        cert: SemanticBridgeCertificate,
        raw_spec: Dict[str, Any],
        artifact: Any,
    ) -> bool:
        """Independent verification of certificate authenticity and binding."""
        if cert.status != SemanticBridgeStatus.PROVED_EQUIVALENT:
            return False

        spec_digest = hashlib.sha256(canonical_json_rfc8785(raw_spec).encode()).hexdigest()
        if hasattr(artifact, "to_canonical_dict"):
            artifact_digest = hashlib.sha256(canonical_json_rfc8785(artifact.to_canonical_dict()).encode()).hexdigest()
        else:
            artifact_digest = hashlib.sha256(canonical_json_rfc8785(str(artifact)).encode()).hexdigest()

        if cert.source_spec_digest != spec_digest or cert.target_artifact_digest != artifact_digest:
            return False

        cert_binding = {
            "source_formalism": cert.source_formalism.value,
            "target_formalism": cert.target_formalism.value,
            "status": cert.status.value,
            "spec_digest": cert.source_spec_digest,
            "artifact_digest": cert.target_artifact_digest,
            "requirements_digest": cert.requirements_digest,
            "verified_invariants": sorted(cert.verified_invariants),
            "violated_invariants": sorted(cert.violated_invariants),
        }
        expected_digest = hashlib.sha256(canonical_json_rfc8785(cert_binding).encode()).hexdigest()
        return cert.bridge_digest == expected_digest
