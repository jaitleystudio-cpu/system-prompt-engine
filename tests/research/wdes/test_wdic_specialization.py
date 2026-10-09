"""
SPE Ω — Unit & Behavioral Tests for Paper 2: Witness-Directed Intelligence Compilation (WDIC).
Verifies two-speed compilation (Exploration vs Specialization Mode), zero-token fast path,
and precondition drift invalidation.
"""

import pytest
from spe_runtime.research.wdes import (
    CompilationMode,
    WitnessContract,
    SpecializationRegistry,
    WDICSpecializer,
)


def test_wdic_exploration_to_specialization_lifecycle():
    """
    Lifecycle Test:
    Run 1: Unregistered contract -> Exploration Mode (consumes tokens).
    Registration: Synthesize and commit verified deterministic procedure.
    Run 2: Registered contract -> Specialization Mode ($0 tokens consumed, fast path).
    """
    specializer = WDICSpecializer()

    contract = WitnessContract(
        contract_id="contract_sql_parser",
        target_obligation_id="ob_sql_valid",
        evidence_producer_name="sql_ast_validator",
        input_schema_hash="hash_schema_v1",
        tool_version_hash="hash_sqlfluff_3.0",
        compiler_version_hash="hash_spe_2026.10",
        is_deterministic=True,
    )

    payload = {"query": "SELECT id, name FROM users WHERE active = 1;"}

    def exploration_fallback(inp):
        return {"parsed": True, "tables": ["users"], "columns": ["id", "name"]}

    # Run 1: First time run -> Exploration Mode
    res1, mode1, tokens1 = specializer.execute_with_mode(contract, payload, exploration_fallback)
    assert mode1 == CompilationMode.EXPLORATION
    assert tokens1 > 0
    assert res1["parsed"] is True

    # Specialize & Register verified deterministic procedure
    def compiled_deterministic_proc(inp):
        # Fast deterministic parser (AST-based, 0 tokens)
        return {"parsed": True, "tables": ["users"], "columns": ["id", "name"], "optimized": True}

    proc = specializer.specialize_and_register(contract, compiled_deterministic_proc, tokens_saved=2000)
    assert proc.execution_count == 0
    assert specializer.registry.count() == 1

    # Run 2: Second run with same contract preconditions -> Specialization Mode (0 tokens)
    res2, mode2, tokens2 = specializer.execute_with_mode(contract, payload, exploration_fallback)
    assert mode2 == CompilationMode.SPECIALIZATION
    assert tokens2 == 0  # Zero tokens!
    assert res2["parsed"] is True
    assert res2["optimized"] is True
    assert proc.execution_count == 1


def test_wdic_precondition_drift_triggers_exploration():
    """
    Precondition Drift Guard:
    If the compiler version, tool version, or schema changes, the precondition digest drifts.
    WDIC must NEVER execute stale code: it must safely drop down to Exploration Mode.
    """
    specializer = WDICSpecializer()

    base_contract = WitnessContract(
        contract_id="contract_json_schema",
        target_obligation_id="ob_schema_match",
        evidence_producer_name="json_validator",
        input_schema_hash="schema_v1_hash",
        tool_version_hash="tool_v1_hash",
        compiler_version_hash="compiler_v1_hash",
        is_deterministic=True,
    )

    specializer.specialize_and_register(
        base_contract,
        lambda inp: {"valid": True, "v": 1}
    )

    payload = {"data": [1, 2, 3]}

    def exploration_fallback(inp):
        return {"valid": True, "v": 2, "recomputed": True}

    # Contract with schema drift (v1 -> v2)
    drifted_contract = WitnessContract(
        contract_id="contract_json_schema",
        target_obligation_id="ob_schema_match",
        evidence_producer_name="json_validator",
        input_schema_hash="schema_v2_hash_DRIFTED",  # DRIFT!
        tool_version_hash="tool_v1_hash",
        compiler_version_hash="compiler_v1_hash",
        is_deterministic=True,
    )

    # Must fall back to exploration mode on schema drift
    res, mode, tokens = specializer.execute_with_mode(drifted_contract, payload, exploration_fallback)
    assert mode == CompilationMode.EXPLORATION
    assert tokens > 0
    assert res.get("recomputed") is True

    # Producer drift (RFC 8785 guarantees evidence_producer_name changes drift digest)
    producer_drift_contract = WitnessContract(
        contract_id="contract_json_schema",
        target_obligation_id="ob_schema_match",
        evidence_producer_name="alternative_validator",  # PRODUCER DRIFT!
        input_schema_hash="schema_v1_hash",
        tool_version_hash="tool_v1_hash",
        compiler_version_hash="compiler_v1_hash",
        is_deterministic=True,
    )
    assert producer_drift_contract.compute_precondition_digest() != base_contract.compute_precondition_digest()
    res_p, mode_p, tokens_p = specializer.execute_with_mode(producer_drift_contract, payload, exploration_fallback)
    assert mode_p == CompilationMode.EXPLORATION

    # Determinism flag drift
    determinism_drift_contract = WitnessContract(
        contract_id="contract_json_schema",
        target_obligation_id="ob_schema_match",
        evidence_producer_name="json_validator",
        input_schema_hash="schema_v1_hash",
        tool_version_hash="tool_v1_hash",
        compiler_version_hash="compiler_v1_hash",
        is_deterministic=False,  # DETERMINISM DRIFT!
    )
    assert determinism_drift_contract.compute_precondition_digest() != base_contract.compute_precondition_digest()
    res_d, mode_d, tokens_d = specializer.execute_with_mode(determinism_drift_contract, payload, exploration_fallback)
    assert mode_d == CompilationMode.EXPLORATION


def test_wdic_registry_invalidation():
    """Explicit cache invalidation drops execution back to Exploration Mode."""
    specializer = WDICSpecializer()

    contract = WitnessContract(
        contract_id="contract_auth",
        target_obligation_id="ob_auth",
        evidence_producer_name="token_verifier",
        input_schema_hash="schema_auth",
        tool_version_hash="tool_auth",
        compiler_version_hash="spe_auth",
        is_deterministic=True,
    )

    specializer.specialize_and_register(contract, lambda inp: {"auth": True})
    digest = contract.compute_precondition_digest()

    assert specializer.registry.lookup(digest) is not None

    # Invalidate
    success = specializer.registry.invalidate(digest)
    assert success is True
    assert specializer.registry.lookup(digest) is None

    # Next execution must use Exploration Mode
    res, mode, tokens = specializer.execute_with_mode(
        contract,
        {"token": "xyz"},
        lambda inp: {"auth": True, "fallback": True}
    )
    assert mode == CompilationMode.EXPLORATION
    assert tokens > 0
    assert res["fallback"] is True
