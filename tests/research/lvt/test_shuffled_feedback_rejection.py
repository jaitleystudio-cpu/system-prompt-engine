"""
SPE Ω — Shuffled Feedback Rejection Tests (LVT-0).
Verifies that spurious feedback (which performs no better than shuffled control)
is strictly rejected by the formal admission rule.
"""

import pytest
from spe_runtime.research.lvt import (
    EvaluatorType,
    ExperimentProtocol,
    FourArmResults,
    LearningClaim,
    LearningValidityTransaction,
    LearningValidator,
    QualificationStatus,
    LearningValidityRuleViolation,
)

def test_shuffled_feedback_fails_admission():
    """If Arm B (authentic) does not beat Arm C (shuffled control) by epsilon, reject."""
    validator = LearningValidator()

    claim = LearningClaim(
        claim_id="CLM-SHUF-001",
        domain="summarization",
        description="Spurious length optimization",
        generator_id="agent-alpha",
        base_prompt_ref="prompt_v1",
        candidate_prompt_ref="prompt_v2",
        budget_nanos=1000,
    )
    protocol = ExperimentProtocol(protocol_id="PROTO-SHUF", significance_threshold_epsilon=0.05)
    
    # Arm B is 0.75, Arm C is 0.74. Delta is 0.01 < epsilon (0.05).
    # This means the "authentic" feedback didn't significantly outperform random noise!
    results = FourArmResults(
        arm_a_baseline_score=0.60,
        arm_b_authentic_score=0.75,
        arm_c_shuffled_control_score=0.74,  # Spurious!
        arm_d_generalization_score=0.75,
        delta_improvement=0.15,
        control_delta=0.01,  # Fails!
        held_out_retention=0.15,
        is_statistically_significant=True,
        total_cost_nanos=1000,
    )

    tx = LearningValidityTransaction(
        tx_id="TX-SHUF-001",
        claim=claim,
        protocol=protocol,
        results=results,
        evaluator_id="agent-eval",
        evaluator_type=EvaluatorType.INDEPENDENT_STATIC_ORACLE,
    )

    with pytest.raises(LearningValidityRuleViolation, match="ImprovementSupported"):
        validator.validate_and_commit(tx, strict=True)
        
    # Non-strict mode should just set status to REJECTED
    tx2 = LearningValidityTransaction(
        tx_id="TX-SHUF-002",
        claim=claim,
        protocol=protocol,
        results=results,
        evaluator_id="agent-eval",
        evaluator_type=EvaluatorType.INDEPENDENT_STATIC_ORACLE,
    )
    committed_tx = validator.validate_and_commit(tx2, strict=False)
    assert committed_tx.status == QualificationStatus.REJECTED
    assert "ImprovementSupported" in committed_tx.rejection_reason
