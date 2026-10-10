"""
SPE Ω — LVT Contract, Types, and Self-Certification Rejection Tests.
Verifies exact NanoUSD arithmetic, formal admission rule conjuncts,
and Ed25519 signature attestation.
"""

import pytest
from spe_runtime.research.lvt import (
    EvaluatorType,
    ExperimentProtocol,
    FourArmResults,
    GeneratingModelSelfCertificationError,
    LearningClaim,
    LearningValidityRuleViolation,
    LearningValidityTransaction,
    LearningValidator,
    QualificationStatus,
    validate_nanos,
)


def test_nanousd_integer_arithmetic_invariants():
    """Verify exact integer NanoUSD rules (1 USD = 10^9 Nanos)."""
    assert validate_nanos(0) == 0
    assert validate_nanos(1_000_000_000) == 1_000_000_000

    with pytest.raises(ValueError, match="cannot be negative"):
        validate_nanos(-1)

    with pytest.raises(TypeError, match="must be an integer NanoUSD"):
        validate_nanos(1.5)  # type: ignore

    with pytest.raises(TypeError, match="must be an integer NanoUSD"):
        validate_nanos(True)  # type: ignore


def test_protocol_forbids_self_certification():
    """Invariant: allow_self_certification can NEVER be True."""
    with pytest.raises(ValueError, match="allow_self_certification can NEVER be True"):
        ExperimentProtocol(
            protocol_id="proto_bad",
            allow_self_certification=True,
        )


def test_self_certification_rejection_by_type():
    """Validator must reject transactions with GENERATING_MODEL_SELF evaluator type."""
    validator = LearningValidator()

    claim = LearningClaim(
        claim_id="CLM-001",
        domain="security",
        description="Neutralize prompt injections",
        generator_id="agent-alpha",
        base_prompt_ref="prompt_v1",
        candidate_prompt_ref="prompt_v2",
        budget_nanos=400,
    )
    protocol = ExperimentProtocol(protocol_id="PROTO-001")
    results = FourArmResults(
        arm_a_baseline_score=0.70,
        arm_b_authentic_score=0.95,
        arm_c_shuffled_control_score=0.72,
        arm_d_generalization_score=0.92,
        delta_improvement=0.25,
        control_delta=0.23,
        held_out_retention=0.22,
        is_statistically_significant=True,
        total_cost_nanos=400,
    )

    tx = LearningValidityTransaction(
        tx_id="TX-001",
        claim=claim,
        protocol=protocol,
        results=results,
        evaluator_id="agent-beta",
        evaluator_type=EvaluatorType.GENERATING_MODEL_SELF,
    )

    with pytest.raises(GeneratingModelSelfCertificationError, match="Self-certification rejected"):
        validator.validate_and_commit(tx)

    assert tx.status == QualificationStatus.REJECTED


def test_self_certification_rejection_by_identical_id():
    """Validator must reject transactions where evaluator_id == generator_id."""
    validator = LearningValidator()

    claim = LearningClaim(
        claim_id="CLM-002",
        domain="sql_generation",
        description="Fix table aliasing bugs",
        generator_id="model-gpt4o",
        base_prompt_ref="prompt_v1",
        candidate_prompt_ref="prompt_v2",
        budget_nanos=400,
    )
    protocol = ExperimentProtocol(protocol_id="PROTO-001")
    results = FourArmResults(
        arm_a_baseline_score=0.60,
        arm_b_authentic_score=0.90,
        arm_c_shuffled_control_score=0.61,
        arm_d_generalization_score=0.88,
        delta_improvement=0.30,
        control_delta=0.29,
        held_out_retention=0.28,
        is_statistically_significant=True,
        total_cost_nanos=400,
    )

    tx = LearningValidityTransaction(
        tx_id="TX-002",
        claim=claim,
        protocol=protocol,
        results=results,
        evaluator_id="model-gpt4o",  # Same as generator_id!
        evaluator_type=EvaluatorType.INDEPENDENT_STATIC_ORACLE,
    )

    with pytest.raises(GeneratingModelSelfCertificationError, match="cannot evaluate its own claim"):
        validator.validate_and_commit(tx)

    assert tx.status == QualificationStatus.REJECTED


def test_legacy_aggregate_is_not_valid_qualification_or_cryptographic_proof():
    """Mock aggregates must not create a signed learning qualification."""
    validator = LearningValidator()

    claim = LearningClaim(
        claim_id="CLM-003",
        domain="math_reasoning",
        description="Enforce formal chain-of-thought invariants",
        generator_id="synthesizer-model-A",
        base_prompt_ref="prompt_v1",
        candidate_prompt_ref="prompt_v2",
        budget_nanos=5000,
    )
    protocol = ExperimentProtocol(
        protocol_id="PROTO-003",
        sample_size=50,
        significance_threshold_epsilon=0.05,
    )
    results = FourArmResults(
        arm_a_baseline_score=0.72,
        arm_b_authentic_score=0.92,
        arm_c_shuffled_control_score=0.74,
        arm_d_generalization_score=0.91,
        delta_improvement=0.20,
        control_delta=0.18,
        held_out_retention=0.19,
        is_statistically_significant=True,
        total_cost_nanos=2000,
    )

    tx = LearningValidityTransaction(
        tx_id="TX-003",
        claim=claim,
        protocol=protocol,
        results=results,
        evaluator_id="independent-formal-verifier-B",
        evaluator_type=EvaluatorType.FORMAL_TEST_RUNNER,
    )

    committed_tx = validator.validate_and_commit(tx)
    assert committed_tx.status == QualificationStatus.REJECTED
    assert "EvidenceAuthentic" in committed_tx.rejection_reason
    assert committed_tx.committed_timestamp is None
    assert committed_tx.artifact_hash == ""
    assert committed_tx.canonical_receipt_signature == ""
    assert validator.verify_transaction_signature(committed_tx) is False


def test_strict_rule_checking_raises_violation():
    """Strict mode raises LearningValidityRuleViolation if conjuncts fail."""
    validator = LearningValidator()

    claim = LearningClaim(
        claim_id="CLM-004",
        domain="code_review",
        description="Catch memory leaks",
        generator_id="agent-gen",
        base_prompt_ref="prompt_v1",
        candidate_prompt_ref="prompt_v2",
        budget_nanos=1000,
    )
    protocol = ExperimentProtocol(protocol_id="PROTO-004")
    # Cost exceeds claim budget!
    results = FourArmResults(
        arm_a_baseline_score=0.70,
        arm_b_authentic_score=0.85,
        arm_c_shuffled_control_score=0.71,
        arm_d_generalization_score=0.84,
        delta_improvement=0.15,
        control_delta=0.14,
        held_out_retention=0.14,
        is_statistically_significant=True,
        total_cost_nanos=2500,  # > 1000 budget!
    )

    tx = LearningValidityTransaction(
        tx_id="TX-004",
        claim=claim,
        protocol=protocol,
        results=results,
        evaluator_id="agent-eval",
        evaluator_type=EvaluatorType.INDEPENDENT_STATIC_ORACLE,
    )

    with pytest.raises(LearningValidityRuleViolation, match="ExperimentAuthorized"):
        validator.validate_and_commit(tx, strict=True)
