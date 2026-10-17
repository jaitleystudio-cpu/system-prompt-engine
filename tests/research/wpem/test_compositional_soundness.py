"""
SPE Ω — WPEM Compositional Soundness & COPI Guard Tests.
Verifies:
1. Pipeline interface compatibility (T1.target == T2.source).
2. Privacy boundary monotonicity across composed transformations.
3. Cartesian obligation preservation across stages.
4. COPI relational closure guard rejecting unverified cross-stage invariants.
"""

import pytest
from spe_runtime.research.wdes.types import NetworkPolicy
from spe_runtime.research.wpem import (
    TransformationType,
    TransformationRecord,
    CompositionalGuard,
)


def make_transform(
    t_id: str,
    source: str,
    target: str,
    obs: dict,
    policy: NetworkPolicy = NetworkPolicy.AIR_GAPPED,
) -> TransformationRecord:
    return TransformationRecord(
        transformation_id=t_id,
        transformation_type=TransformationType.MODEL_TO_PROGRAM,
        source_operation=source,
        target_operation=target,
        preconditions={"format": "raw"},
        obligation_mapping=obs,
        evidence_requirements=["test_witness"],
        privacy_boundary=policy,
        required_memory_bytes=100_000_000,
        estimated_api_cost_nanos=0,
        estimated_latency_ms=10.0,
        estimated_energy_mj=20,
    )


def test_interface_compatibility_check():
    """Verifies that T2 source must match T1 target."""
    t1 = make_transform("T1", "raw_prompt", "ast_tree", {"PARSE_AST": "ok"})
    t2_compat = make_transform("T2_A", "ast_tree", "bytecode", {"COMPILE_BYTECODE": "ok"})
    t2_incompat = make_transform("T2_B", "json_tokens", "bytecode", {"COMPILE_BYTECODE": "ok"})

    ok, err = CompositionalGuard.verify_composition(t1, t2_compat)
    assert ok is True
    assert err is None

    ok, err = CompositionalGuard.verify_composition(t1, t2_incompat)
    assert ok is False
    assert "Interface mismatch in composition" in str(err)


def test_privacy_boundary_monotonicity():
    """Verifies that composed pipeline cannot escalate network egress permissions."""
    t1_air = make_transform("T1", "opA", "opB", {"OB1": "ok"}, policy=NetworkPolicy.AIR_GAPPED)
    t2_egress = make_transform("T2", "opB", "opC", {"OB2": "ok"}, policy=NetworkPolicy.PUBLIC_EGRESS)
    t2_air = make_transform("T2_air", "opB", "opC", {"OB2": "ok"}, policy=NetworkPolicy.AIR_GAPPED)

    # AIR_GAPPED -> PUBLIC_EGRESS is strictly illegal
    ok, err = CompositionalGuard.verify_composition(t1_air, t2_egress)
    assert ok is False
    assert "Privacy boundary violation in composition" in str(err)

    # AIR_GAPPED -> AIR_GAPPED is valid
    ok, err = CompositionalGuard.verify_composition(t1_air, t2_air)
    assert ok is True


def test_copi_relational_closure_invariants():
    """
    Verifies the Compositional Obligation Preservation Invariant (COPI):
    Cross-procedure relational invariants must be covered by the combined obligations.
    """
    t1 = make_transform("T1", "extract", "validate", {"EXTRACT_SYNTAX": "ok"})
    t2 = make_transform("T2", "validate", "emit", {"VALIDATE_SEMANTICS": "ok"})

    # Relational invariant missing from both stages
    relational_reqs = {"EXTRACT_SYNTAX", "VALIDATE_SEMANTICS", "CROSS_STAGE_SYMBOL_RESOLUTION"}
    ok, err = CompositionalGuard.verify_composition(t1, t2, relational_invariants=relational_reqs)
    assert ok is False
    assert "COPI violation: compositional relational invariants missing" in str(err)
    assert "CROSS_STAGE_SYMBOL_RESOLUTION" in str(err)

    # Relational invariant accounted for
    t2_with_relational = make_transform(
        "T2_covered",
        "validate",
        "emit",
        {"VALIDATE_SEMANTICS": "ok", "CROSS_STAGE_SYMBOL_RESOLUTION": "resolved"},
    )
    ok, err = CompositionalGuard.verify_composition(t1, t2_with_relational, relational_invariants=relational_reqs)
    assert ok is True
    assert err is None
