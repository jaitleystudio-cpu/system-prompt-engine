"""Quality-Diversity (MAP-Elites) Multi-Dimensional Capability Archive.

Maintains an illumination grid of diverse, high-performing capabilities
across reasoning complexity, token sparsity, and cross-model generality.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

from spe_runtime.discovery.models import (
    DialecticalDuelReceipt,
    DiscoveryHypothesis,
    EliteRecord,
)


class QualityDiversityArchive:
    """MAP-Elites 3D Illumination Archive for autonomous discovery capabilities."""

    def __init__(
        self,
        complexity_bins: int = 3,
        sparsity_bins: int = 3,
        generality_bins: int = 3,
    ) -> None:
        self.complexity_bins = complexity_bins
        self.sparsity_bins = sparsity_bins
        self.generality_bins = generality_bins
        # Cell coordinate (c, s, g) -> EliteRecord
        self.archive: Dict[Tuple[int, int, int], EliteRecord] = {}

    def discretize(
        self,
        complexity: float,
        sparsity: float,
        generality: int,
    ) -> Tuple[int, int, int]:
        """Discretizes continuous metrics into discrete cell coordinates."""
        # Complexity: 0: low (<3), 1: medium (3-6), 2: high (>6)
        if complexity < 3.0:
            c = 0
        elif complexity <= 6.0:
            c = 1
        else:
            c = min(self.complexity_bins - 1, 2)

        # Sparsity: 0: dense (>150 tokens), 1: standard (50-150), 2: sparse (<50)
        if sparsity > 150.0:
            s = 0
        elif sparsity >= 50.0:
            s = 1
        else:
            s = min(self.sparsity_bins - 1, 2)

        # Generality: 0: single model, 1: dual/triple (2-3), 2: universal (4+)
        if generality <= 1:
            g = 0
        elif generality <= 3:
            g = 1
        else:
            g = min(self.generality_bins - 1, 2)

        return (c, s, g)

    def add(
        self,
        hypothesis: DiscoveryHypothesis,
        fitness_score: float,
        complexity: float,
        sparsity: float,
        generality: int,
        duel_receipt: DialecticalDuelReceipt,
    ) -> bool:
        """Attempts to add or replace an elite in the Quality-Diversity niche."""
        coords = self.discretize(complexity, sparsity, generality)
        existing = self.archive.get(coords)

        if existing is None or fitness_score > existing.fitness_score:
            self.archive[coords] = EliteRecord(
                cell_coordinates=coords,
                hypothesis=hypothesis,
                fitness_score=fitness_score,
                reasoning_complexity=complexity,
                token_sparsity=sparsity,
                domain_generality=generality,
                duel_receipt=duel_receipt,
            )
            return True
        return False

    def coverage_ratio(self) -> float:
        """Computes current archive niche coverage ratio (0.0 to 1.0)."""
        total_niches = self.complexity_bins * self.sparsity_bins * self.generality_bins
        return len(self.archive) / max(1, total_niches)

    def total_elites(self) -> int:
        return len(self.archive)

    def get_champions(self, top_k: int = 5) -> List[EliteRecord]:
        """Returns the top-K highest fitness champions in the archive."""
        sorted_elites = sorted(
            self.archive.values(),
            key=lambda e: e.fitness_score,
            reverse=True,
        )
        return sorted_elites[:top_k]

    def export_summary(self) -> Dict[str, Any]:
        """Exports JSON-serializable summary of archive state."""
        return {
            "total_elites": len(self.archive),
            "total_niches": self.complexity_bins * self.sparsity_bins * self.generality_bins,
            "coverage_pct": round(self.coverage_ratio() * 100.0, 2),
            "champions": [
                {
                    "hypothesis_id": e.hypothesis.hypothesis_id,
                    "domain": e.hypothesis.domain,
                    "fitness": round(e.fitness_score, 4),
                    "coordinates": list(e.cell_coordinates),
                    "complexity": e.reasoning_complexity,
                    "sparsity": e.token_sparsity,
                    "generality": e.domain_generality,
                }
                for e in self.get_champions(5)
            ],
        }
