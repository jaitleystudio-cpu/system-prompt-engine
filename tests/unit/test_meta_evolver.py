"""Unit tests for MetaCompilerEvolver in SPE Ω Supercompiler."""

import pytest
from spe_runtime.supercompiler import (
    CEGISEngine,
    CandidatePipeline,
    CompilerPass,
    Counterexample,
    DualCompiler,
    ExecutionHarness,
    FalsifierStrategy,
    InstructionClause,
    MetaCompilerEvolver,
    ProofCarryingHarness,
)


def test_compiler_pass_pruning_heuristics():
    cegis = CEGISEngine()
    harness = ExecutionHarness(
        harness_id="test_harness",
        clauses=[
            InstructionClause(clause_id="fixed_1", text="Mandatory 1", intent_source="root", tags=["safety"], is_removable=False),
            InstructionClause(clause_id="removable_short", text="Short remark", intent_source="extra", tags=["hint"], is_removable=True),
            InstructionClause(clause_id="removable_long", text="Very long and verbose instruction clause with lots of redundant words", intent_source="extra", tags=["hint"], is_removable=True),
        ],
        tools=[],
        model_target="generic",
        validators=["verify_something"],
    )
    adversarial_suite = []  # No CEs, so both removable clauses can be safely pruned

    # Test LARGEST_FIRST
    pass_largest = CompilerPass(
        pass_id="p1",
        name="Largest First Pruning",
        pass_type="pruning",
        parameters={"order": "LARGEST_FIRST"},
    )
    res_harness = pass_largest.execute(harness, adversarial_suite, cegis)
    assert len(res_harness.clauses) == 1
    assert res_harness.clauses[0].clause_id == "fixed_1"

    # Test BISECTION_BATCH
    pass_bisection = CompilerPass(
        pass_id="p2",
        name="Bisection Batch Pruning",
        pass_type="pruning",
        parameters={"order": "BISECTION_BATCH", "batch_size": 2},
    )
    res_bisection = pass_bisection.execute(harness, adversarial_suite, cegis)
    assert len(res_bisection.clauses) == 1
    assert res_bisection.clauses[0].clause_id == "fixed_1"

    # Test SMALLEST_FIRST
    pass_smallest = CompilerPass(
        pass_id="p3",
        name="Smallest First Pruning",
        pass_type="pruning",
        parameters={"order": "SMALLEST_FIRST"},
    )
    res_smallest = pass_smallest.execute(harness, adversarial_suite, cegis)
    assert len(res_smallest.clauses) == 1
    assert res_smallest.clauses[0].clause_id == "fixed_1"

    # Test REVERSE_ORDER
    pass_reverse = CompilerPass(
        pass_id="p4",
        name="Reverse Order Pruning",
        pass_type="pruning",
        parameters={"order": "REVERSE_ORDER"},
    )
    res_reverse = pass_reverse.execute(harness, adversarial_suite, cegis)
    assert len(res_reverse.clauses) == 1
    assert res_reverse.clauses[0].clause_id == "fixed_1"


def test_compiler_pass_token_packing_and_bisection():
    harness = ExecutionHarness(
        harness_id="test_pack_harness",
        clauses=[
            InstructionClause(clause_id="c1", text="  Mandatory    spacing   in text  ", intent_source="root", tags=["tag_b", "tag_a", "tag_a"], is_removable=False),
            InstructionClause(clause_id="c2", text="Duplicate hint", intent_source="hint1", tags=["hint"], is_removable=True),
            InstructionClause(clause_id="c3", text="Duplicate hint", intent_source="hint2", tags=["hint"], is_removable=True),
        ],
        tools=[],
        model_target="generic",
        validators=["verify_budget", "verify_schema", "verify_authority", "verify_budget"],
    )
    cegis = CEGISEngine()

    # Packing pass
    pack_pass = CompilerPass(
        pass_id="pack_1",
        name="Token Packing",
        pass_type="packing",
        parameters={"normalize_whitespace": True, "coalesce_tags": True},
    )
    packed_harness = pack_pass.execute(harness, [], cegis)
    assert packed_harness.clauses[0].text == "Mandatory spacing in text"
    assert packed_harness.clauses[0].tags == ["tag_a", "tag_b"]  # Deduplicated and sorted
    assert len(packed_harness.clauses) == 2  # c3 was deduplicated

    # Validator bisection pass
    bisect_pass = CompilerPass(
        pass_id="bisect_1",
        name="Validator Bisection",
        pass_type="bisection",
        parameters={"validator_sort": "FASTEST_FIRST"},
    )
    bisected_harness = bisect_pass.execute(packed_harness, [], cegis)
    assert bisected_harness.validators[0] == "verify_schema"
    assert bisected_harness.validators[1] == "verify_authority"
    assert bisected_harness.validators[2] == "verify_budget"
    assert len(bisected_harness.validators) == 3


def test_candidate_pipeline_produces_proof_carrying_harness():
    p_prune = CompilerPass(pass_id="p1", name="Pruning", pass_type="pruning", parameters={"order": "LARGEST_FIRST"})
    p_pack = CompilerPass(pass_id="p2", name="Packing", pass_type="packing", parameters={"normalize_whitespace": True})
    pipeline = CandidatePipeline(pipeline_id="pipe_test_01", passes=[p_prune, p_pack], generation=1)

    compiler = DualCompiler()
    dual = compiler.compile({"task_description": "Test task", "hard_constraints": ["Constraint 1"]})
    harness = dual.executor

    pch: ProofCarryingHarness = pipeline.optimize(harness, [])
    assert isinstance(pch, ProofCarryingHarness)
    assert pch.canonical_digest is not None
    assert pch.cost_frontier.estimated_tokens > 0
    assert pch.cost_frontier.cdi_score > 0


def test_meta_evolver_genetic_loop():
    evolver = MetaCompilerEvolver(population_size=4, random_seed=123)
    assert evolver.baseline_pipeline.verified is True
    assert evolver.current_generation == 0

    # Step one generation
    telemetry = evolver.step_generation()
    assert telemetry["generation"] == 1
    assert telemetry["population_size"] >= 4
    assert telemetry["verified_count"] >= 1
    assert evolver.champion is not None
    assert evolver.champion.verified is True
