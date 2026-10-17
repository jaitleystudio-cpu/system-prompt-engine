"""Tests for SPE Ω Dual-Compiled Counterexample-Closed Supercompiler."""

import pytest
from spe_runtime.supercompiler import (
    CEGISEngine,
    CostFrontier,
    DualCompiler,
    DualProgram,
    ExecutionHarness,
    FalsifierStrategy,
    HarnessSuperoptimizer,
    InstructionClause,
    ProofCarryingHarness,
)


def test_dual_compiler_generates_executor_and_falsifier():
    compiler = DualCompiler()
    spec = {
        "intent_id": "intent_test_001",
        "task_description": "Execute secure database query and calculate metric.",
        "hard_constraints": [
            "Never execute query without active tenant lease",
            "Output must strictly follow JSON metric format",
        ],
        "tools": [
            {
                "name": "sql_query",
                "description": "Execute read-only SQL query",
                "parameters": {"query": {"type": "string"}},
                "required_capabilities": ["DATABASE_READ"],
            }
        ],
        "model_target": "frontier-reasoning",
    }

    dual_prog = compiler.compile(spec)
    assert dual_prog.intent_id == "intent_test_001"
    assert len(dual_prog.executor.clauses) >= 3  # 2 constraints + 1 task
    assert len(dual_prog.executor.tools) == 1
    assert dual_prog.executor.tools[0].tool_name == "sql_query"
    assert len(dual_prog.falsifier.target_invariants) == 2
    assert FalsifierStrategy.REVOKED_AUTHORITY in dual_prog.falsifier.strategies
    assert FalsifierStrategy.PROMPT_INJECTION in dual_prog.falsifier.strategies


def test_cegis_loop_synthesizes_counterexamples_and_repairs():
    compiler = DualCompiler()
    spec = {
        "intent_id": "intent_fintech_002",
        "task_description": "Transfer funds between corporate accounts.",
        "hard_constraints": ["Authorized transfers only", "Maximum single transfer $5000"],
    }
    dual_prog = compiler.compile(spec)

    cegis = CEGISEngine(max_rounds=5)
    hardened_harness, encountered_ces = cegis.run(dual_prog)

    # Verify that counterexamples were generated and closed
    assert len(encountered_ces) > 0
    # Hardened harness must contain new guard clauses and validators
    tags = {tag for c in hardened_harness.clauses for tag in c.tags}
    assert "auth_guard" in tags or "injection_armor" in tags
    assert "verify_authority" in hardened_harness.validators

    # Re-checking all encountered counterexamples on hardened harness must pass 100%
    for ce in encountered_ces:
        assert cegis.check_harness(hardened_harness, ce) is True


def test_superoptimizer_prunes_redundancies_and_preserves_adversarial_suite():
    compiler = DualCompiler()
    spec = {
        "intent_id": "intent_opt_003",
        "task_description": "Extract financial table data.",
        "hard_constraints": ["Strict table extraction"],
    }
    dual_prog = compiler.compile(spec)

    cegis = CEGISEngine(max_rounds=3)
    hardened_harness, ces = cegis.run(dual_prog)

    # Add an optional removable verbose clause
    hardened_harness.clauses.append(
        InstructionClause(
            clause_id="clause_removable_verbose",
            text="Please be polite and format nicely whenever possible.",
            intent_source="style_hint",
            tags=["formatting"],
            is_removable=True,
        )
    )

    optimizer = HarnessSuperoptimizer(cegis_engine=cegis)
    pch: ProofCarryingHarness = optimizer.optimize(hardened_harness, ces)

    # The removable verbose clause should be pruned because it doesn't affect adversarial invariants
    clause_ids = [c.clause_id for c in pch.harness.clauses]
    assert "clause_removable_verbose" not in clause_ids

    # Proof-carrying harness properties
    assert pch.canonical_digest is not None
    assert pch.cost_frontier.estimated_tokens > 0
    assert pch.cost_frontier.cdi_score > 0
    assert pch.diagnosability_score >= 0.95
