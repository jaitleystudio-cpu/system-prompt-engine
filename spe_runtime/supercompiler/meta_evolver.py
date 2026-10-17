"""Meta-Compiler Self-Evolution: Evolutionary / genetic heuristic engine (FunSearch style).

Mutates, composes, and optimizes compiler passes (heuristic pruning order,
token packing, validator bisection, deopt guard simplification), backed by
formal equivalence verification and zero semantic drift.
"""

from __future__ import annotations

import copy
import hashlib
import json
import random
import time
import uuid
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any, Callable, Dict, List, Optional, Set, Tuple

from spe_runtime.supercompiler.cegis_loop import CEGISEngine
from spe_runtime.supercompiler.evolution_ledger import EvolutionLedger, PromotionRecord
from spe_runtime.supercompiler.formal_equivalence import (
    EquivalenceProofCertificate,
    FormalEquivalenceVerifier,
)
from spe_runtime.supercompiler.models import (
    CostFrontier,
    Counterexample,
    ExecutionHarness,
    InstructionClause,
    ProofCarryingHarness,
)


@dataclass
class CompilerPass:
    """An individual AST / harness transformation pass."""
    pass_id: str
    name: str
    pass_type: str  # "pruning", "packing", "bisection", "deopt_guard"
    parameters: Dict[str, Any] = field(default_factory=dict)
    generation: int = 0

    def execute(
        self,
        harness: ExecutionHarness,
        adversarial_suite: List[Counterexample],
        cegis_engine: CEGISEngine,
    ) -> ExecutionHarness:
        """Applies this pass transformation to the harness."""
        if self.pass_type == "pruning":
            return self._execute_pruning(harness, adversarial_suite, cegis_engine)
        elif self.pass_type == "packing":
            return self._execute_packing(harness)
        elif self.pass_type == "bisection":
            return self._execute_bisection(harness)
        elif self.pass_type == "deopt_guard":
            return self._execute_deopt(harness)
        return harness

    def _execute_pruning(
        self,
        harness: ExecutionHarness,
        adversarial_suite: List[Counterexample],
        cegis_engine: CEGISEngine,
    ) -> ExecutionHarness:
        strategy = self.parameters.get("order", "LARGEST_FIRST")
        batch_size = self.parameters.get("batch_size", 1)

        current = copy.deepcopy(harness)
        removable_clauses = [c for c in current.clauses if c.is_removable]
        fixed_clauses = [c for c in current.clauses if not c.is_removable]

        if not removable_clauses:
            return current

        # Order removable clauses according to evolved strategy
        if strategy == "LARGEST_FIRST":
            # Prune largest token clauses first to maximize early token reduction
            ordered_removable = sorted(
                removable_clauses,
                key=lambda c: len(c.text.split()),
                reverse=True,
            )
        elif strategy == "SMALLEST_FIRST":
            ordered_removable = sorted(
                removable_clauses,
                key=lambda c: len(c.text.split()),
            )
        elif strategy == "REVERSE_ORDER":
            ordered_removable = list(reversed(removable_clauses))
        elif strategy == "BISECTION_BATCH":
            ordered_removable = list(removable_clauses)
            batch_size = max(2, batch_size)
        else:
            ordered_removable = list(removable_clauses)

        surviving_removable = list(ordered_removable)

        if strategy == "BISECTION_BATCH" and len(surviving_removable) >= batch_size:
            i = 0
            while i < len(surviving_removable):
                chunk = surviving_removable[i : i + batch_size]
                trial_remaining = [c for c in surviving_removable if c not in chunk]

                trial_harness = copy.deepcopy(current)
                trial_harness.clauses = fixed_clauses + trial_remaining

                if all(cegis_engine.check_harness(trial_harness, ce) for ce in adversarial_suite):
                    # Chunk omission is safe!
                    surviving_removable = trial_remaining
                else:
                    # Fallback to single-clause check within chunk
                    surviving_in_chunk = []
                    for clause in chunk:
                        sub_trial = copy.deepcopy(current)
                        sub_trial.clauses = [
                            c for c in (fixed_clauses + surviving_removable)
                            if c.clause_id != clause.clause_id
                        ]
                        if all(cegis_engine.check_harness(sub_trial, ce) for ce in adversarial_suite):
                            surviving_removable = [
                                c for c in surviving_removable if c.clause_id != clause.clause_id
                            ]
                        else:
                            surviving_in_chunk.append(clause)
                    i += len(surviving_in_chunk)
        else:
            # Linear trial in heuristic order
            for clause in ordered_removable:
                trial_harness = copy.deepcopy(current)
                trial_harness.clauses = [
                    c for c in (fixed_clauses + surviving_removable)
                    if c.clause_id != clause.clause_id
                ]

                if all(cegis_engine.check_harness(trial_harness, ce) for ce in adversarial_suite):
                    surviving_removable = [
                        c for c in surviving_removable if c.clause_id != clause.clause_id
                    ]

        current.clauses = fixed_clauses + surviving_removable
        return current

    def _execute_packing(self, harness: ExecutionHarness) -> ExecutionHarness:
        """Token packing: normalizes whitespace and removes duplicated clause texts."""
        current = copy.deepcopy(harness)
        seen_texts: Set[str] = set()
        packed_clauses: List[InstructionClause] = []

        normalize_ws = self.parameters.get("normalize_whitespace", True)
        coalesce_tags = self.parameters.get("coalesce_tags", True)

        for clause in current.clauses:
            cleaned_text = " ".join(clause.text.split()) if normalize_ws else clause.text
            if cleaned_text in seen_texts and clause.is_removable:
                # Safe to skip duplicate removable clause
                continue

            seen_texts.add(cleaned_text)
            dedup_tags = sorted(list(set(clause.tags))) if coalesce_tags else clause.tags

            packed_clauses.append(
                InstructionClause(
                    clause_id=clause.clause_id,
                    text=cleaned_text,
                    intent_source=clause.intent_source,
                    tags=dedup_tags,
                    is_removable=clause.is_removable,
                )
            )

        current.clauses = packed_clauses
        return current

    def _execute_bisection(self, harness: ExecutionHarness) -> ExecutionHarness:
        """Optimizes validator sequencing and deduplication."""
        current = copy.deepcopy(harness)
        seen = set()
        deduped = []
        for v in current.validators:
            if v not in seen:
                seen.add(v)
                deduped.append(v)

        ordering = self.parameters.get("validator_sort", "FASTEST_FIRST")
        if ordering == "FASTEST_FIRST":
            # Place simple schema/authority guards first for early exit
            def _weight(v: str) -> int:
                if "schema" in v or "format" in v:
                    return 0
                if "authority" in v or "lease" in v:
                    return 1
                if "budget" in v:
                    return 2
                return 10

            deduped.sort(key=_weight)

        current.validators = deduped
        return current

    def _execute_deopt(self, harness: ExecutionHarness) -> ExecutionHarness:
        """Optimizes and deduplicates deopt guards."""
        current = copy.deepcopy(harness)
        seen = set()
        deduped_guards = []
        for g in current.deopt_guards:
            cleaned = " ".join(g.split())
            if cleaned not in seen:
                seen.add(cleaned)
                deduped_guards.append(cleaned)
        current.deopt_guards = deduped_guards
        return current


@dataclass
class CandidatePipeline:
    """An evolved sequence of compiler passes forming an optimization pipeline."""
    pipeline_id: str
    passes: List[CompilerPass]
    generation: int = 0
    fitness: float = 0.0
    speedup_ratio: float = 1.0
    token_reduction_pct: float = 0.0
    verified: bool = False
    proof_certificate: Optional[EquivalenceProofCertificate] = None
    parent_ids: List[str] = field(default_factory=list)
    mutation_history: List[str] = field(default_factory=list)

    def optimize(
        self,
        harness: ExecutionHarness,
        adversarial_suite: List[Counterexample],
        cegis_engine: Optional[CEGISEngine] = None,
    ) -> ProofCarryingHarness:
        """Executes the pipeline passes sequentially, returning a ProofCarryingHarness."""
        engine = cegis_engine or CEGISEngine()
        current_harness = copy.deepcopy(harness)

        for p in self.passes:
            current_harness = p.execute(current_harness, adversarial_suite, engine)

        # Evaluate cost frontier
        token_count = current_harness.token_estimate()
        validator_count = len(current_harness.validators)
        inference_cost_per_token = 0.000003 if "compact" in current_harness.model_target else 0.000015
        inference_cost = token_count * inference_cost_per_token
        tool_cost = len(current_harness.tools) * 0.005
        verification_cost = validator_count * 0.001
        total_cost_usd = inference_cost + tool_cost + verification_cost
        cdi_score = round(total_cost_usd * 1000.0, 4)

        frontier = CostFrontier(
            estimated_tokens=token_count,
            estimated_cost_usd=round(total_cost_usd, 6),
            model_calls=1 + len(current_harness.tools),
            validator_count=validator_count,
            cdi_score=cdi_score,
        )

        passed_invariants = list({ce.violated_invariant for ce in adversarial_suite})

        return ProofCarryingHarness(
            harness=current_harness,
            surviving_adversarial_suite=adversarial_suite,
            passed_invariants=passed_invariants,
            cost_frontier=frontier,
            diagnosability_score=1.0 if not adversarial_suite else 0.95,
            canonical_digest=current_harness.compute_digest(),
        )

    def compute_digest(self) -> str:
        payload = [
            {"pass_type": p.pass_type, "params": p.parameters} for p in self.passes
        ]
        return hashlib.sha256(json.dumps(payload, sort_keys=True).encode("utf-8")).hexdigest()


class MetaCompilerEvolver:
    """Evolutionary / genetic heuristic engine (FunSearch style) for self-evolving supercompilers."""

    def __init__(
        self,
        verifier: Optional[FormalEquivalenceVerifier] = None,
        ledger: Optional[EvolutionLedger] = None,
        population_size: int = 6,
        mutation_rate: float = 0.7,
        crossover_rate: float = 0.3,
        random_seed: int = 42,
    ):
        self.verifier = verifier or FormalEquivalenceVerifier()
        self.ledger = ledger or EvolutionLedger()
        self.population_size = max(4, population_size)
        self.mutation_rate = mutation_rate
        self.crossover_rate = crossover_rate
        self.random = random.Random(random_seed)

        self.current_generation = 0
        self.baseline_pipeline = self._create_baseline_pipeline()
        self.population: List[CandidatePipeline] = [copy.deepcopy(self.baseline_pipeline)]
        self.generation_history: List[Dict[str, Any]] = []
        self.champion: CandidatePipeline = copy.deepcopy(self.baseline_pipeline)

        # Baseline evaluation
        cert = self.verifier.verify(self.baseline_pipeline, self.baseline_pipeline)
        self.baseline_pipeline.verified = cert.is_verified
        self.baseline_pipeline.proof_certificate = cert
        self.baseline_pipeline.speedup_ratio = 1.0
        self.baseline_pipeline.fitness = 1.0
        self.champion = copy.deepcopy(self.baseline_pipeline)

    def _create_baseline_pipeline(self) -> CandidatePipeline:
        """Constructs Level 3 baseline superoptimizer pipeline."""
        p_prune = CompilerPass(
            pass_id="baseline_pruning",
            name="Sequential Removable Clause Pruning",
            pass_type="pruning",
            parameters={"order": "DEFAULT", "batch_size": 1},
            generation=0,
        )
        p_bisect = CompilerPass(
            pass_id="baseline_bisection",
            name="Sequential Validator Deduplication",
            pass_type="bisection",
            parameters={"validator_sort": "DEFAULT"},
            generation=0,
        )
        return CandidatePipeline(
            pipeline_id="pipeline_gen0_baseline",
            passes=[p_prune, p_bisect],
            generation=0,
            fitness=1.0,
            speedup_ratio=1.0,
            token_reduction_pct=0.0,
            verified=True,
        )

    def _mutate_pass(self, p: CompilerPass, gen: int) -> CompilerPass:
        """Applies stochastic mutations to a pass's parameters."""
        new_pass = copy.deepcopy(p)
        new_pass.pass_id = f"pass_{uuid.uuid4().hex[:6]}"
        new_pass.generation = gen

        if p.pass_type == "pruning":
            strategies = ["LARGEST_FIRST", "BISECTION_BATCH", "SMALLEST_FIRST", "REVERSE_ORDER"]
            curr_strat = p.parameters.get("order", "LARGEST_FIRST")
            choices = [s for s in strategies if s != curr_strat]
            new_strat = self.random.choice(choices)
            new_batch = self.random.choice([1, 2, 4])
            new_pass.parameters = {"order": new_strat, "batch_size": new_batch}
            new_pass.name = f"Heuristic Pruning ({new_strat}, B={new_batch})"

        elif p.pass_type == "packing":
            normalize_ws = self.random.choice([True, False])
            coalesce_tags = self.random.choice([True, False])
            new_pass.parameters = {
                "normalize_whitespace": normalize_ws,
                "coalesce_tags": coalesce_tags,
            }
            new_pass.name = f"Token Packing (WS={normalize_ws}, Coalesce={coalesce_tags})"

        elif p.pass_type == "bisection":
            sorts = ["FASTEST_FIRST", "DEFAULT"]
            new_sort = self.random.choice(sorts)
            new_pass.parameters = {"validator_sort": new_sort}
            new_pass.name = f"Validator Bisection ({new_sort})"

        elif p.pass_type == "deopt_guard":
            new_pass.parameters = {"aggressive_dedup": True}
            new_pass.name = "Deopt Guard Dedup"

        return new_pass

    def mutate_pipeline(self, parent: CandidatePipeline, gen: int) -> CandidatePipeline:
        """Generates a mutated candidate pipeline from parent."""
        mutated_passes = [self._mutate_pass(p, gen) for p in parent.passes]
        history = list(parent.mutation_history)

        mutation_type = self.random.choice(["param_mutation", "reorder_passes", "insert_pass"])

        if mutation_type == "reorder_passes" and len(mutated_passes) >= 2:
            idx1, idx2 = self.random.sample(range(len(mutated_passes)), 2)
            mutated_passes[idx1], mutated_passes[idx2] = mutated_passes[idx2], mutated_passes[idx1]
            history.append(f"reordered_passes({idx1},{idx2})")

        elif mutation_type == "insert_pass":
            pool = [
                CompilerPass(
                    pass_id=f"pass_pack_{uuid.uuid4().hex[:6]}",
                    name="Token Packing Pass",
                    pass_type="packing",
                    parameters={"normalize_whitespace": True, "coalesce_tags": True},
                    generation=gen,
                ),
                CompilerPass(
                    pass_id=f"pass_deopt_{uuid.uuid4().hex[:6]}",
                    name="Deopt Guard Simplification",
                    pass_type="deopt_guard",
                    parameters={"aggressive_dedup": True},
                    generation=gen,
                ),
            ]
            cand = self.random.choice(pool)
            if not any(p.pass_type == cand.pass_type for p in mutated_passes):
                mutated_passes.append(cand)
                history.append(f"inserted_pass({cand.pass_type})")
            else:
                history.append("param_mutation")
        else:
            history.append("param_mutation")

        return CandidatePipeline(
            pipeline_id=f"pipeline_gen{gen}_{uuid.uuid4().hex[:6]}",
            passes=mutated_passes,
            generation=gen,
            fitness=0.0,
            speedup_ratio=1.0,
            token_reduction_pct=0.0,
            verified=False,
            parent_ids=[parent.pipeline_id],
            mutation_history=history,
        )

    def crossover_pipelines(
        self, p1: CandidatePipeline, p2: CandidatePipeline, gen: int
    ) -> CandidatePipeline:
        """Combines passes from two high-fitness parent pipelines."""
        pass_types_seen = set()
        child_passes: List[CompilerPass] = []

        pool = list(p1.passes) + list(p2.passes)
        self.random.shuffle(pool)

        for p in pool:
            if p.pass_type not in pass_types_seen:
                pass_types_seen.add(p.pass_type)
                cloned = copy.deepcopy(p)
                cloned.generation = gen
                child_passes.append(cloned)

        # Must at least have pruning
        if not any(p.pass_type == "pruning" for p in child_passes):
            child_passes.insert(
                0,
                CompilerPass(
                    pass_id=f"pass_prune_{uuid.uuid4().hex[:6]}",
                    name="Bisection Batch Pruning",
                    pass_type="pruning",
                    parameters={"order": "BISECTION_BATCH", "batch_size": 2},
                    generation=gen,
                ),
            )

        return CandidatePipeline(
            pipeline_id=f"pipeline_gen{gen}_cross_{uuid.uuid4().hex[:6]}",
            passes=child_passes,
            generation=gen,
            fitness=0.0,
            speedup_ratio=1.0,
            token_reduction_pct=0.0,
            verified=False,
            parent_ids=[p1.pipeline_id, p2.pipeline_id],
            mutation_history=[f"crossover({p1.pipeline_id},{p2.pipeline_id})"],
        )

    def evaluate_candidate(self, candidate: CandidatePipeline) -> None:
        """Evaluates candidate against FormalEquivalenceVerifier and scores fitness."""
        cert = self.verifier.verify(self.baseline_pipeline, candidate)
        candidate.proof_certificate = cert
        candidate.verified = cert.is_verified
        candidate.speedup_ratio = cert.speedup_ratio
        candidate.token_reduction_pct = cert.token_reduction_pct

        if not cert.is_verified or cert.drift_detected:
            # Lethal mutation: semantic drift or invariant regression
            candidate.fitness = 0.0
        else:
            # FunSearch composite fitness: Speedup + Token reduction
            candidate.fitness = round(
                (cert.speedup_ratio * 0.7) + (cert.token_reduction_pct * 0.03),
                4,
            )

    def step_generation(self) -> Dict[str, Any]:
        """Evolves population by one generation."""
        self.current_generation += 1
        gen = self.current_generation
        new_candidates: List[CandidatePipeline] = []

        # Elitism: carry forward the current champion
        new_candidates.append(copy.deepcopy(self.champion))

        # Filter valid parents
        valid_parents = [p for p in self.population if p.verified and p.fitness > 0]
        if not valid_parents:
            valid_parents = [self.baseline_pipeline]

        while len(new_candidates) < self.population_size:
            r = self.random.random()
            if r < self.crossover_rate and len(valid_parents) >= 2:
                p1, p2 = self.random.sample(valid_parents, 2)
                child = self.crossover_pipelines(p1, p2, gen)
            else:
                p = self.random.choice(valid_parents)
                child = self.mutate_pipeline(p, gen)

            self.evaluate_candidate(child)
            new_candidates.append(child)

        self.population = new_candidates

        # Update champion
        for cand in self.population:
            if cand.verified and cand.fitness > self.champion.fitness:
                self.champion = copy.deepcopy(cand)

        telemetry = {
            "generation": gen,
            "population_size": len(self.population),
            "verified_count": sum(1 for c in self.population if c.verified),
            "champion_id": self.champion.pipeline_id,
            "champion_fitness": self.champion.fitness,
            "champion_speedup": self.champion.speedup_ratio,
            "champion_token_reduction_pct": self.champion.token_reduction_pct,
            "champion_passes": [p.name for p in self.champion.passes],
            "champion_digest": self.champion.compute_digest(),
        }
        self.generation_history.append(telemetry)
        return telemetry

    def evolve(self, num_generations: int = 3) -> Dict[str, Any]:
        """Runs the evolutionary loop for the specified generation budget."""
        results = []
        for _ in range(num_generations):
            results.append(self.step_generation())

        return {
            "final_generation": self.current_generation,
            "champion_id": self.champion.pipeline_id,
            "champion_speedup": self.champion.speedup_ratio,
            "champion_token_reduction_pct": self.champion.token_reduction_pct,
            "champion_fitness": self.champion.fitness,
            "generations": results,
            "proof_certificate": self.champion.proof_certificate.to_dict() if self.champion.proof_certificate else None,
        }

    def promote_champion(self) -> PromotionRecord:
        """Promotes the current evolved champion to the versioned evolution ledger."""
        if not self.champion.verified or not self.champion.proof_certificate:
            raise ValueError("Cannot promote an unverified champion with semantic drift or regression.")

        record = self.ledger.record_promotion(
            candidate=self.champion,
            certificate=self.champion.proof_certificate,
        )
        return record

    def rollback(self, target_hash: Optional[str] = None) -> PromotionRecord:
        """Rolls back the active pipeline in the evolution ledger."""
        return self.ledger.rollback(target_hash)
