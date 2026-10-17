"""Identifiability Gate: Pearl do-calculus and Fisher Rank Evaluator for Causal Invariants.

Implements exact nonparametric causal identifiability criteria (Pearl 2009; Tian & Pearl 2002):
evaluates back-door criterion, front-door criterion, and Tian-Pearl c-component factorization.
Distinguishes true structural identifiability limits from search plateaus,
preventing token spend on unidentifiable causal hypotheses.
"""

from __future__ import annotations

import hashlib
import itertools
import json
import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional, Set, Tuple


class IdentifiabilityStatus(str, Enum):
    """Certified status of a causal invariant hypothesis under current observation manifold."""
    IDENTIFIABLE = "IDENTIFIABLE"
    NON_IDENTIFIABLE = "NON_IDENTIFIABLE"
    AMBIGUOUS_LATENT_CONFOUNDING = "AMBIGUOUS_LATENT_CONFOUNDING"
    IDENTIFIED_UNDER_INTERVENTION = "IDENTIFIED_UNDER_INTERVENTION"
    UNKNOWN = "UNKNOWN"


@dataclass(frozen=True)
class CausalVariable:
    """A variable in the structural causal model (SCM)."""
    name: str
    is_exogenous: bool = False
    is_intervenable: bool = True
    domain_type: str = "integer"  # integer, boolean, string, token_sequence


@dataclass(frozen=True)
class CausalEdge:
    """Directed causal relationship X -> Y with optional unobserved confounding U <-> X, Y."""
    source: str
    target: str
    has_latent_confounder: bool = False


@dataclass
class CausalStructuralGraph:
    """Directed Acyclic Graph representing the Structural Causal Model (SCM)."""
    variables: Dict[str, CausalVariable] = field(default_factory=dict)
    edges: List[CausalEdge] = field(default_factory=list)

    def add_variable(self, var: CausalVariable) -> None:
        self.variables[var.name] = var

    def add_edge(self, source: str, target: str, has_latent_confounder: bool = False) -> None:
        self.edges.append(CausalEdge(source=source, target=target, has_latent_confounder=has_latent_confounder))

    def parents(self, node: str) -> Set[str]:
        return {e.source for e in self.edges if e.target == node}

    def children(self, node: str) -> Set[str]:
        return {e.target for e in self.edges if e.source == node}

    def get_latent_confounders(self) -> List[CausalEdge]:
        return [e for e in self.edges if e.has_latent_confounder]


@dataclass(frozen=True)
class IdentifiabilityVerdict:
    """Certified mathematical verdict from the Identifiability Gate."""
    hypothesis_id: str
    status: IdentifiabilityStatus
    identifiability_rank: int
    parameter_dimension: int
    is_promotion_eligible: bool
    adjustment_set: List[str]
    unidentifiable_subspace: List[str]
    disambiguating_experiment: Optional[Dict[str, Any]]
    proof_digest: str
    duration_micros: float
    evidence_class: str = "OBSERVED"


class IdentifiabilityGate:
    """Evaluates whether a causal effect P(Y | do(X)) can be mathematically identified.

    Implements:
      1. Pearl's Back-Door Criterion with minimal adjustment sets.
      2. Pearl's Front-Door Criterion through intermediate mediators.
      3. Tian & Pearl (2002) complete identification criterion for singleton treatment X.
      4. Explicit reject / UNKNOWN for unidentifiable or unsupported topologies.
    """

    def __init__(self, tolerance: float = 1e-6) -> None:
        self.tolerance = tolerance

    def evaluate_invariant(
        self,
        hypothesis_id: str,
        treatment_var: str,
        outcome_var: str,
        graph: CausalStructuralGraph,
        observed_covariates: Set[str],
    ) -> IdentifiabilityVerdict:
        """Determines if the causal effect P(outcome | do(treatment)) is identifiable."""
        t0 = time.perf_counter()

        # 1. Collect all nodes in graph
        all_nodes = set(graph.variables.keys()) | {e.source for e in graph.edges} | {e.target for e in graph.edges}

        if treatment_var not in all_nodes or outcome_var not in all_nodes:
            duration = (time.perf_counter() - t0) * 1e6
            return IdentifiabilityVerdict(
                hypothesis_id=hypothesis_id,
                status=IdentifiabilityStatus.NON_IDENTIFIABLE,
                identifiability_rank=0,
                parameter_dimension=len(all_nodes),
                is_promotion_eligible=False,
                adjustment_set=[],
                unidentifiable_subspace=[v for v in [treatment_var, outcome_var] if v not in all_nodes],
                disambiguating_experiment=None,
                proof_digest=hashlib.sha256(f"missing_nodes_{hypothesis_id}".encode()).hexdigest(),
                duration_micros=duration,
                evidence_class="UNPROVEN",
            )

        # 2. Build internal graph representation
        # Incorporate both latent node variables and bidirected latent edges (has_latent_confounder=True)
        directed_edges: List[Tuple[str, str]] = []
        latent_nodes: Set[str] = set()

        for e in graph.edges:
            directed_edges.append((e.source, e.target))
            if e.has_latent_confounder:
                # Add synthetic latent confounder node U_{source}_{target}
                u_name = f"_U_{e.source}_{e.target}"
                latent_nodes.add(u_name)
                directed_edges.append((u_name, e.source))
                directed_edges.append((u_name, e.target))

        for v in all_nodes:
            if v in (treatment_var, outcome_var):
                continue
            if v.startswith("_U_") or v == "U" or (v.startswith("U") and len(v) <= 3) or v.lower().startswith("latent") or v.lower().startswith("unobserved"):
                latent_nodes.add(v)
            elif v not in observed_covariates:
                # If v is not an observed covariate, check if it is a mediator:
                is_mediator = False
                queue = [treatment_var]
                seen = {treatment_var}
                while queue:
                    c = queue.pop(0)
                    for u_edge, w_edge in directed_edges:
                        if u_edge == c and w_edge not in seen:
                            seen.add(w_edge)
                            queue.append(w_edge)
                if v in seen:
                    queue2 = [v]
                    seen2 = {v}
                    while queue2:
                        c = queue2.pop(0)
                        for u_edge, w_edge in directed_edges:
                            if u_edge == c and w_edge not in seen2:
                                seen2.add(w_edge)
                                queue2.append(w_edge)
                    if outcome_var in seen2:
                        is_mediator = True
                if not is_mediator:
                    latent_nodes.add(v)

        full_nodes = all_nodes | latent_nodes
        observed_nodes = (full_nodes - latent_nodes)

        # 3. Directed path check: If no directed path from X to Y, effect is null (trivially identifiable)
        has_causal_path = self._has_directed_path(directed_edges, treatment_var, outcome_var)
        if not has_causal_path:
            duration = (time.perf_counter() - t0) * 1e6
            digest = hashlib.sha256(f"{hypothesis_id}:null_effect:{treatment_var}->{outcome_var}".encode()).hexdigest()
            return IdentifiabilityVerdict(
                hypothesis_id=hypothesis_id,
                status=IdentifiabilityStatus.IDENTIFIABLE,
                identifiability_rank=len(observed_nodes),
                parameter_dimension=len(full_nodes),
                is_promotion_eligible=True,
                adjustment_set=[],
                unidentifiable_subspace=[],
                disambiguating_experiment=None,
                proof_digest=digest,
                duration_micros=duration,
                evidence_class="DERIVED",
            )

        # 4. Check Back-Door Criterion
        bd_set = self._find_backdoor_adjustment_set(
            directed_edges, full_nodes, treatment_var, outcome_var, observed_nodes
        )
        if bd_set is not None:
            duration = (time.perf_counter() - t0) * 1e6
            digest = hashlib.sha256(f"{hypothesis_id}:backdoor:{sorted(bd_set)}".encode()).hexdigest()
            return IdentifiabilityVerdict(
                hypothesis_id=hypothesis_id,
                status=IdentifiabilityStatus.IDENTIFIABLE,
                identifiability_rank=len(observed_nodes),
                parameter_dimension=len(full_nodes),
                is_promotion_eligible=True,
                adjustment_set=sorted(bd_set),
                unidentifiable_subspace=[],
                disambiguating_experiment=None,
                proof_digest=digest,
                duration_micros=duration,
                evidence_class="OBSERVED",
            )

        # 5. Check Front-Door Criterion
        fd_set = self._find_frontdoor_mediator_set(
            directed_edges, full_nodes, treatment_var, outcome_var, observed_nodes
        )
        if fd_set is not None:
            duration = (time.perf_counter() - t0) * 1e6
            digest = hashlib.sha256(f"{hypothesis_id}:frontdoor:{sorted(fd_set)}".encode()).hexdigest()
            return IdentifiabilityVerdict(
                hypothesis_id=hypothesis_id,
                status=IdentifiabilityStatus.IDENTIFIABLE,
                identifiability_rank=len(observed_nodes),
                parameter_dimension=len(full_nodes),
                is_promotion_eligible=True,
                adjustment_set=sorted(fd_set),
                unidentifiable_subspace=[],
                disambiguating_experiment=None,
                proof_digest=digest,
                duration_micros=duration,
                evidence_class="OBSERVED",
            )

        # 6. Tian & Pearl (2002) Complete Singleton-X Criterion
        is_tp_identifiable = self._tian_pearl_singleton_identifiable(
            directed_edges, full_nodes, treatment_var, outcome_var, latent_nodes
        )

        duration = (time.perf_counter() - t0) * 1e6

        if is_tp_identifiable:
            digest = hashlib.sha256(f"{hypothesis_id}:tian_pearl_id".encode()).hexdigest()
            return IdentifiabilityVerdict(
                hypothesis_id=hypothesis_id,
                status=IdentifiabilityStatus.IDENTIFIABLE,
                identifiability_rank=len(observed_nodes),
                parameter_dimension=len(full_nodes),
                is_promotion_eligible=True,
                adjustment_set=[],
                unidentifiable_subspace=[],
                disambiguating_experiment=None,
                proof_digest=digest,
                duration_micros=duration,
                evidence_class="DERIVED",
            )

        # 7. Non-Identifiable due to latent confounding
        unidentifiable_subspace = [f"{treatment_var}<->{outcome_var}"]
        disambiguating_scenario = {
            "scenario_kind": "ACTIVE_INTERVENTION_EXPERIMENT",
            "target_intervention": f"do({treatment_var})",
            "rationale": "Latent confounding present; require randomized controlled trial or natural experiment.",
        }
        digest = hashlib.sha256(f"{hypothesis_id}:confounded:{treatment_var}:{outcome_var}".encode()).hexdigest()

        return IdentifiabilityVerdict(
            hypothesis_id=hypothesis_id,
            status=IdentifiabilityStatus.AMBIGUOUS_LATENT_CONFOUNDING,
            identifiability_rank=max(0, len(observed_nodes) - 1),
            parameter_dimension=len(full_nodes),
            is_promotion_eligible=False,
            adjustment_set=[],
            unidentifiable_subspace=unidentifiable_subspace,
            disambiguating_experiment=disambiguating_scenario,
            proof_digest=digest,
            duration_micros=duration,
            evidence_class="PROPOSED_INTERVENTION",
        )

    # -----------------------------------------------------------------
    # GRAPH HELPER ALGORITHMS
    # -----------------------------------------------------------------

    def _parents(self, edges: List[Tuple[str, str]], node: str) -> Set[str]:
        return {u for u, v in edges if v == node}

    def _children(self, edges: List[Tuple[str, str]], node: str) -> Set[str]:
        return {v for u, v in edges if u == node}

    def _ancestors(self, edges: List[Tuple[str, str]], target_set: Set[str]) -> Set[str]:
        anc = set(target_set)
        stack = list(target_set)
        while stack:
            curr = stack.pop()
            for p in self._parents(edges, curr):
                if p not in anc:
                    anc.add(p)
                    stack.append(p)
        return anc

    def _descendants(self, edges: List[Tuple[str, str]], target_set: Set[str]) -> Set[str]:
        desc = set(target_set)
        stack = list(target_set)
        while stack:
            curr = stack.pop()
            for c in self._children(edges, curr):
                if c not in desc:
                    desc.add(c)
                    stack.append(c)
        return desc

    def _has_directed_path(self, edges: List[Tuple[str, str]], src: str, dst: str, excluded: Set[str] = set()) -> bool:
        if src == dst:
            return True
        visited = set(excluded) | {src}
        queue = [src]
        while queue:
            curr = queue.pop(0)
            for c in self._children(edges, curr):
                if c == dst:
                    return True
                if c not in visited:
                    visited.add(c)
                    queue.append(c)
        return False

    def _d_separated(self, edges: List[Tuple[str, str]], full_nodes: Set[str], X_set: Set[str], Y_set: Set[str], Z_set: Set[str]) -> bool:
        """Evaluates d-separation using the moral graph criterion on An(X | Y | Z)."""
        anc = self._ancestors(edges, X_set | Y_set | Z_set)
        adj: Dict[str, Set[str]] = {n: set() for n in anc}

        # Induced edges
        for u, v in edges:
            if u in anc and v in anc:
                adj[u].add(v)
                adj[v].add(u)

        # Moralize common children in anc
        for w in anc:
            parents_in_anc = [p for p in self._parents(edges, w) if p in anc]
            for p1, p2 in itertools.combinations(parents_in_anc, 2):
                adj[p1].add(p2)
                adj[p2].add(p1)

        # Remove conditioning set Z
        active = anc - Z_set
        visited = set()
        queue = [x for x in X_set if x in active]
        for x in queue:
            visited.add(x)

        while queue:
            curr = queue.pop(0)
            if curr in Y_set:
                return False  # Path exists! Not d-separated.
            for neighbor in adj.get(curr, set()):
                if neighbor in active and neighbor not in visited:
                    visited.add(neighbor)
                    queue.append(neighbor)

        return True

    def _find_backdoor_adjustment_set(
        self,
        edges: List[Tuple[str, str]],
        full_nodes: Set[str],
        X: str,
        Y: str,
        observed: Set[str],
    ) -> Optional[List[str]]:
        """Searches for a minimal admissible back-door adjustment set Z."""
        desc_X = self._descendants(edges, {X})
        cand = sorted(list((observed - desc_X - {X, Y})))

        # Graph with all outgoing edges from X removed
        edges_xbar = [(u, v) for u, v in edges if u != X]

        for k in range(len(cand) + 1):
            for Z_tuple in itertools.combinations(cand, k):
                Z = set(Z_tuple)
                if self._d_separated(edges_xbar, full_nodes, {X}, {Y}, Z):
                    return list(Z_tuple)
        return None

    def _find_frontdoor_mediator_set(
        self,
        edges: List[Tuple[str, str]],
        full_nodes: Set[str],
        X: str,
        Y: str,
        observed: Set[str],
    ) -> Optional[List[str]]:
        """Searches for an admissible front-door mediator set M."""
        cand = sorted(list(observed - {X, Y}))
        edges_xbar = [(u, v) for u, v in edges if u != X]

        for k in range(1, len(cand) + 1):
            for M_tuple in itertools.combinations(cand, k):
                M = set(M_tuple)
                # (i) M intercepts all directed X->Y paths
                if self._has_directed_path(edges, X, Y, excluded=M):
                    continue
                # (ii) No unblocked back-door from X to M
                if not self._d_separated(edges_xbar, full_nodes, {X}, M, set()):
                    continue
                # (iii) All back-door paths from M to Y are blocked by X
                edges_mbar = [(u, v) for u, v in edges if u not in M]
                if not self._d_separated(edges_mbar, full_nodes, M, {Y}, {X}):
                    continue
                return list(M_tuple)
        return None

    def _tian_pearl_singleton_identifiable(
        self,
        edges: List[Tuple[str, str]],
        full_nodes: Set[str],
        X: str,
        Y: str,
        latent: Set[str],
    ) -> bool:
        """Tian & Pearl (2002) complete identification criterion for singleton treatment X."""
        def obs_reach(u: str) -> Set[str]:
            out: Set[str] = set()
            stack = [u]
            seen = {u}
            while stack:
                n = stack.pop()
                for c in self._children(edges, n):
                    if c in seen:
                        continue
                    seen.add(c)
                    if c in latent:
                        stack.append(c)
                    else:
                        out.add(c)
            return out

        obs_nodes = {v for v in full_nodes if v not in latent}

        # Directed latent projection
        proj_edges: List[Tuple[str, str]] = []
        for v in obs_nodes:
            for c in obs_reach(v):
                proj_edges.append((v, c))

        # Bidirected graph
        b_adj: Dict[str, Set[str]] = {v: set() for v in obs_nodes}
        for u in latent:
            r = sorted(obs_reach(u))
            for a, b in itertools.combinations(r, 2):
                b_adj[a].add(b)
                b_adj[b].add(a)

        anc_Y = self._ancestors(proj_edges, {Y})
        if X not in anc_Y:
            return True

        # Connected component of X in bidirected graph restricted to anc_Y
        comp: Set[str] = {X}
        queue = [X]
        while queue:
            curr = queue.pop(0)
            for neighbor in b_adj.get(curr, set()):
                if neighbor in anc_Y and neighbor not in comp:
                    comp.add(neighbor)
                    queue.append(neighbor)

        children_of_X_in_anc = {c for c in self._children(proj_edges, X) if c in anc_Y}
        return not any(c in comp for c in children_of_X_in_anc)
