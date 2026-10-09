"""
SPE Ω — Counterfactual Specification Closure (CSC) World Discriminator.
Identifies evidence-compatible world pairs (w_good vs w_bad) where
Obs_E(w_good) == Obs_E(w_bad) despite K(w_good) != K(w_bad).
"""

from __future__ import annotations

import hashlib
from typing import List, Dict, Any, Optional, Callable, Tuple

from spe_runtime.ci_gate.receipt import rfc8785_canonicalize
from .models import (
    WorldModel,
    WorldPair,
    WorldType,
    DistinguishingProbe,
    DiscriminationResult,
    CounterfactualChallengeRecord,
    HypothesisStatus,
    OracleStatus,
    PredicateValue,
)


class WorldDiscriminator:
    """
    Evidence-Compatible World-Pair Discriminator.
    Evaluates whether current evidence E can formally separate genuine success from failure worlds.
    """

    def are_indistinguishable(
        self,
        w_good: WorldModel,
        w_bad: WorldModel,
        evidence_keys: List[str],
    ) -> bool:
        """
        Checks if Obs_e(w_good) == Obs_e(w_bad) for every e in evidence_keys.
        """
        for key in evidence_keys:
            if w_good.observation_for(key) != w_bad.observation_for(key):
                return False
        return True

    def find_indistinguishable_pairs(
        self,
        worlds: List[WorldModel],
        evidence_keys: List[str],
    ) -> List[WorldPair]:
        """
        Searches all worlds for pairs (w_good, w_bad) such that:
        K(w_good) == True, K(w_bad) == False, and Obs_E(w_good) == Obs_E(w_bad).
        """
        goods = [w for w in worlds if w.satisfies_objective]
        bads = [w for w in worlds if not w.satisfies_objective]

        indistinguishable: List[WorldPair] = []
        for g in goods:
            for b in bads:
                if self.are_indistinguishable(g, b, evidence_keys):
                    indistinguishable.append(WorldPair(w_good=g, w_bad=b))

        return indistinguishable

    def is_distinguished_by(
        self,
        w_good: WorldModel,
        w_bad: WorldModel,
        probe: DistinguishingProbe,
    ) -> bool:
        """
        Checks if an observation probe q can separate w_good and w_bad:
        Obs_q(w_good) != Obs_q(w_bad).
        """
        return probe.can_distinguish(w_good, w_bad)

    def evaluate_evidence_sufficiency(
        self,
        worlds: List[WorldModel],
        evidence_keys: List[str],
    ) -> DiscriminationResult:
        """
        Evaluates whether current evidence set E is conclusive.
        If any pair (w_good, w_bad) is indistinguishable, evidence is INCONCLUSIVE.
        If no failure worlds are modeled, evidence sufficiency is unverified.
        """
        if not worlds:
            return DiscriminationResult(
                is_conclusive=False,
                indistinguishable_pairs=[],
                total_worlds_analyzed=0,
                evidence_keys=list(evidence_keys),
                recommendation="No worlds provided for discrimination analysis.",
            )

        goods = [w for w in worlds if w.satisfies_objective]
        bads = [w for w in worlds if not w.satisfies_objective]

        if not bads:
            return DiscriminationResult(
                is_conclusive=False,
                indistinguishable_pairs=[],
                total_worlds_analyzed=len(worlds),
                evidence_keys=list(evidence_keys),
                recommendation=(
                    "Evidence sufficiency is UNVERIFIED: zero counterfactual failure worlds (w_bad) "
                    "modeled. Counterfactual search required to establish specification closure."
                ),
            )

        if not goods:
            return DiscriminationResult(
                is_conclusive=False,
                indistinguishable_pairs=[],
                total_worlds_analyzed=len(worlds),
                evidence_keys=list(evidence_keys),
                recommendation="Zero compliant worlds (w_good) found. Specification not yet satisfied.",
            )

        indistinguishable_pairs = self.find_indistinguishable_pairs(worlds, evidence_keys)
        is_conclusive = len(indistinguishable_pairs) == 0

        if is_conclusive:
            rec = "Current evidence set E formally discriminates all modeled failure worlds."
        else:
            rec = (
                f"Evidence set E is INCONCLUSIVE: {len(indistinguishable_pairs)} counterfactual "
                "world pair(s) are indistinguishable under current tests. Distinguishing probe synthesis required."
            )

        return DiscriminationResult(
            is_conclusive=is_conclusive,
            indistinguishable_pairs=indistinguishable_pairs,
            total_worlds_analyzed=len(worlds),
            evidence_keys=list(evidence_keys),
            recommendation=rec,
        )

    def synthesize_counterfactual_world(
        self,
        w_good: WorldModel,
        mutation_fn: Optional[Callable[[Dict[str, Any]], Dict[str, Any]]] = None,
        failure_description: str = "Counterfactual failure world preserving observed evidence",
        unobserved_failure_obs: Optional[Dict[str, Any]] = None,
        world_type: WorldType = WorldType.HYPOTHESIS_WORLD,
        world_id: Optional[str] = None,
    ) -> WorldModel:
        """
        Synthesizes a counterfactual world w_bad that replicates all observations
        of w_good across existing evidence, but violates the objective (K(w_bad) = False)
        in unobserved scenarios or edge-cases.
        """
        obs = dict(w_good.observations)
        if unobserved_failure_obs:
            obs.update(unobserved_failure_obs)

        env_params = dict(w_good.environment_parameters)
        if mutation_fn:
            env_params = mutation_fn(env_params)

        if world_id is not None:
            bad_id = world_id
        else:
            seed = {"desc": failure_description, "obs": obs, "env": env_params}
            bad_id = f"w_bad_{w_good.world_id}_{hashlib.sha256(rfc8785_canonicalize(seed)).hexdigest()[:8]}"

        return WorldModel(
            world_id=bad_id,
            satisfies_objective=False,
            observations=obs,
            environment_parameters=env_params,
            description=failure_description,
            world_type=world_type,
        )

    def filter_eliminated_worlds(
        self,
        worlds: List[WorldModel],
        probe: DistinguishingProbe,
        actual_observation: Any,
    ) -> List[WorldModel]:
        """
        Elimination update: filters out worlds whose predicted observation under probe q
        does not match the actual empirically observed result.
        """
        surviving: List[WorldModel] = []
        for w in worlds:
            predicted = probe.evaluate(w)
            if predicted == actual_observation:
                surviving.append(w)
        return surviving

    def build_challenge_record(
        self,
        world_pair: WorldPair,
        obligation_ref: str,
        probe: DistinguishingProbe,
        evidence_snapshot_hash: str,
        challenge_id: Optional[str] = None,
        protected_intent_ref: str = "intent://default",
        assumptions: Optional[List[str]] = None,
        plausibility_basis: Optional[List[str]] = None,
        hypothesis_status: str = HypothesisStatus.UNVERIFIED_HYPOTHESIS.value,
        observed_result: PredicateValue = PredicateValue.UNKNOWN,
        new_obligation_proposal: Optional[str] = None,
        invalidated_evidence_refs: Optional[List[str]] = None,
    ) -> CounterfactualChallengeRecord:
        """
        Builds a CounterfactualChallengeRecord binding an indistinguishable world pair
        and a candidate distinguishing probe.
        """
        cid = challenge_id or f"ccr_{world_pair.w_bad.world_id}_{probe.probe_id}"
        h_status = hypothesis_status.value if hasattr(hypothesis_status, "value") else str(hypothesis_status)
        return CounterfactualChallengeRecord(
            challenge_id=cid,
            protected_intent_ref=protected_intent_ref,
            obligation_ref=obligation_ref,
            evidence_snapshot_hash=evidence_snapshot_hash,
            observed_success_evidence_refs=list(world_pair.w_good.observations.keys()),
            declared_scope={"environment": world_pair.w_good.environment_parameters},
            alternative_world_hypothesis=world_pair.w_bad.description or f"Failure world {world_pair.w_bad.world_id}",
            assumptions=assumptions or ["Synthetic test suite does not cover out-of-distribution parser paths"],
            plausibility_basis=plausibility_basis or ["SpecBench empirical pattern: parser memorization of test fixtures"],
            hypothesis_status=h_status,
            distinguishing_probe_operation=probe.operation,
            required_authority=list(probe.required_authority),
            required_budget_nanos=probe.cost_nanos,
            expected_observation_classes=list(probe.expected_observation_classes),
            oracle_status=probe.oracle_status.value if isinstance(probe.oracle_status, OracleStatus) else str(probe.oracle_status),
            observed_result=observed_result,
            new_obligation_proposal=new_obligation_proposal,
            invalidated_evidence_refs=list(invalidated_evidence_refs) if invalidated_evidence_refs is not None else [],
        )
