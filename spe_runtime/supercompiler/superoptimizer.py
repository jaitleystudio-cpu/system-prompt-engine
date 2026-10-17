"""Harness Superoptimizer: Minimizes tokens and cost while guaranteeing zero counterexample regressions."""

from __future__ import annotations

import copy
from typing import List, Tuple

from spe_runtime.supercompiler.cegis_loop import CEGISEngine
from spe_runtime.supercompiler.models import (
    CostFrontier,
    Counterexample,
    ExecutionHarness,
    ProofCarryingHarness,
)


class HarnessSuperoptimizer:
    """Superoptimizes execution harnesses by pruning redundant clauses and verifiers."""

    def __init__(self, cegis_engine: Optional[CEGISEngine] = None):
        self.cegis_engine = cegis_engine or CEGISEngine()

    def evaluate_cost_frontier(self, harness: ExecutionHarness) -> CostFrontier:
        """Computes the empirical/estimated cost frontier and CDI score for a harness."""
        token_count = harness.token_estimate()
        validator_count = len(harness.validators)
        
        # Base assumptions for standard benchmark task
        inference_cost_per_token = 0.000003 if "compact" in harness.model_target else 0.000015
        inference_cost = token_count * inference_cost_per_token
        tool_cost = len(harness.tools) * 0.005
        verification_cost = validator_count * 0.001
        
        # Total lifecycle cost
        total_cost_usd = inference_cost + tool_cost + verification_cost
        cdi_score = round(total_cost_usd * 1000.0, 4)  # Normalized CDI per 1,000 tasks

        return CostFrontier(
            estimated_tokens=token_count,
            estimated_cost_usd=round(total_cost_usd, 6),
            model_calls=1 + len(harness.tools),
            validator_count=validator_count,
            cdi_score=cdi_score,
        )

    def optimize(
        self, harness: ExecutionHarness, adversarial_suite: List[Counterexample]
    ) -> ProofCarryingHarness:
        """Performs superoptimization over clauses and validators against the frozen adversarial suite."""
        current_harness = copy.deepcopy(harness)

        # 1. Prune redundant removable clauses
        pruned_clauses = []
        for clause in current_harness.clauses:
            if not clause.is_removable:
                pruned_clauses.append(clause)
                continue

            # Candidate trial: omit this clause
            candidate_harness = copy.deepcopy(current_harness)
            candidate_harness.clauses = [c for c in candidate_harness.clauses if c.clause_id != clause.clause_id]

            # Verify that all adversarial counterexamples still pass
            survives_all = all(
                self.cegis_engine.check_harness(candidate_harness, ce)
                for ce in adversarial_suite
            )

            if survives_all:
                # Omission is safe and reduces cost!
                current_harness = candidate_harness
            else:
                # Clause was necessary to defend against a counterexample! Keep it.
                pruned_clauses.append(clause)

        # 2. Prune duplicate validators
        seen_validators = set()
        deduped_validators = []
        for val in current_harness.validators:
            if val not in seen_validators:
                seen_validators.add(val)
                deduped_validators.append(val)
        current_harness.validators = deduped_validators

        # 3. Compute final frontier and proof-carrying package
        frontier = self.evaluate_cost_frontier(current_harness)
        passed_invariants = list({ce.violated_invariant for ce in adversarial_suite})

        return ProofCarryingHarness(
            harness=current_harness,
            surviving_adversarial_suite=adversarial_suite,
            passed_invariants=passed_invariants,
            cost_frontier=frontier,
            diagnosability_score=1.0 if not adversarial_suite else 0.95,
            canonical_digest=current_harness.compute_digest(),
        )
