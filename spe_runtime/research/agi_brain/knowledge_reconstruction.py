"""
SPE AGI BRAIN Ω — Intelligence I: Scientific Knowledge Reconstruction
October 12, 2026 | Research Quarantine Track
"""

from typing import Dict, List, Any
from spe_runtime.research.agi_brain.types import KnowledgeState, ScientificObjective

class KnowledgeReconstructionEngine:
    """
    Reconstructs the frontier state of knowledge for a scientific objective.
    Separates empirical ground truth from citation inheritance, identifies boundary
    conditions, and isolates divergent predictions between competing theories.
    """

    def reconstruct(
        self,
        objective: ScientificObjective,
        raw_claims: List[Dict[str, Any]]
    ) -> KnowledgeState:
        state = KnowledgeState()

        for claim in raw_claims:
            statement = claim.get("statement", "").strip()
            if not statement:
                continue

            # Classify empirical provenance vs citation chain
            has_direct_measurement = bool(claim.get("direct_measurement", False))
            citation_hops = int(claim.get("citation_hops", 0))

            if has_direct_measurement and citation_hops == 0:
                state.direct_evidence_claims.append(statement)
            else:
                state.citation_chain_claims.append(statement)

            # Extract definitions and assumptions
            if claim.get("is_assumption", False):
                state.theoretical_assumptions.append(statement)
            if "term" in claim and "definition" in claim:
                state.definitions[claim["term"]] = claim["definition"]

            # Boundary conditions
            if claim.get("is_boundary_condition", False):
                state.boundary_conditions.append(statement)

        # Detect theoretical divergence between competing candidate theories
        state.divergent_predictions = self._find_divergent_predictions(raw_claims)

        # Extract unresolved research gaps
        state.unresolved_gaps = self._extract_unresolved_gaps(raw_claims, state)

        return state

    def _find_divergent_predictions(
        self,
        claims: List[Dict[str, Any]]
    ) -> List[Dict[str, str]]:
        divergences = []
        theories = [c for c in claims if "theory_id" in c and "predicted_outcome" in c]

        for i in range(len(theories)):
            for j in range(i + 1, len(theories)):
                t1, t2 = theories[i], theories[j]
                if t1.get("condition") == t2.get("condition"):
                    if t1.get("predicted_outcome") != t2.get("predicted_outcome"):
                        divergences.append({
                            "condition": str(t1.get("condition")),
                            "theory_a": str(t1.get("theory_id")),
                            "prediction_a": str(t1.get("predicted_outcome")),
                            "theory_b": str(t2.get("theory_id")),
                            "prediction_b": str(t2.get("predicted_outcome")),
                        })
        return divergences

    def _extract_unresolved_gaps(
        self,
        claims: List[Dict[str, Any]],
        state: KnowledgeState
    ) -> List[str]:
        gaps = []
        for c in claims:
            if c.get("unresolved_gap"):
                gaps.append(c["unresolved_gap"])

        # If there are divergent predictions without direct evidence resolving them, add to gaps
        for div in state.divergent_predictions:
            gap_desc = (
                f"Divergence under condition '{div['condition']}': "
                f"{div['theory_a']} predicts {div['prediction_a']} vs "
                f"{div['theory_b']} predicts {div['prediction_b']}"
            )
            if gap_desc not in gaps:
                gaps.append(gap_desc)
        return gaps
