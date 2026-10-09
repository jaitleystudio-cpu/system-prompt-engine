"""
SPE Ω — Counterfactual Specification Closure (CSC) World Generator.
Implements bounded search for evidence-compatible world pairs (w_good, w_bad)
where K(w_good)=TRUE and K(w_bad)=FALSE while Obs_E(w_good) == Obs_E(w_bad).
"""

from __future__ import annotations

from typing import Dict, Any, List, Optional, Tuple

from .models import (
    WorldModel,
    CounterfactualWorld,
    WorldPair,
    WorldType,
    DiscriminationResult,
)
from .world_discriminator import WorldDiscriminator


class WorldGenerator:
    """
    Synthesizes and searches for counterfactual failure worlds that are
    indistinguishable from compliant worlds under current visible test suites.
    """

    def __init__(self, discriminator: Optional[WorldDiscriminator] = None) -> None:
        self.discriminator = discriminator or WorldDiscriminator()

    def generate_world_pair(
        self,
        w_good: WorldModel,
        countermodel_description: str,
        countermodel_world_type: WorldType = WorldType.SPEC_GAMING_WORLD,
        divergent_hypotheses: Optional[Dict[str, Any]] = None,
        divergent_latent_variables: Optional[Dict[str, Any]] = None,
    ) -> WorldPair:
        """
        Synthesizes w_bad such that Obs_E(w_good) == Obs_E(w_bad) on all current visible keys,
        while K(w_good)=TRUE and K(w_bad)=FALSE.
        """
        w_bad = self.discriminator.synthesize_counterfactual_world(
            w_good=w_good,
            countermodel_description=countermodel_description,
            countermodel_world_type=countermodel_world_type,
            divergent_hypotheses=divergent_hypotheses,
            divergent_latent_variables=divergent_latent_variables,
        )
        return WorldPair(w_good=w_good, w_bad=w_bad)

    def find_indistinguishable_pairs(
        self,
        worlds: List[WorldModel],
        evidence_keys: List[str],
    ) -> List[WorldPair]:
        """Returns all pairs (w_good, w_bad) that produce identical visible test observations."""
        result = self.discriminator.evaluate_evidence_sufficiency(
            worlds=worlds,
            evidence_keys=evidence_keys,
        )
        return result.indistinguishable_pairs
