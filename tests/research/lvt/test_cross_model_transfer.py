"""
SPE Ω — Cross-Model Transfer & Revocation Tests (LVT-0).
Verifies multi-model portability checking, .spe artifact synthesis, and drift revocation.
"""

import json
import pytest

from spe_runtime.research.lvt import (
    EvaluatorType,
    ExperimentProtocol,
    FourArmResults,
    LearningClaim,
    LearningTransferProtocol,
    LearningValidityTransaction,
    LearningValidator,
    QualificationStatus,
    RevocationReason,
    TransactionRevokedError,
)

@pytest.fixture
def legacy_tx():
    validator = LearningValidator()
    claim = LearningClaim(
        claim_id="CLM-XFER-001",
        domain="math",
        description="Formal steps",
        generator_id="gpt-4o",
        base_prompt_ref="prompt_v1",
        candidate_prompt_ref="prompt_v2",
        budget_nanos=1000,
    )
    protocol = ExperimentProtocol(protocol_id="PROTO-XFER")
    results = FourArmResults(
        arm_a_baseline_score=0.60,
        arm_b_authentic_score=0.90,
        arm_c_shuffled_control_score=0.65,
        arm_d_generalization_score=0.88,
        delta_improvement=0.30,
        control_delta=0.25,
        held_out_retention=0.28,
        is_statistically_significant=True,
        total_cost_nanos=1000,
    )
    tx = LearningValidityTransaction(
        tx_id="TX-XFER-001",
        claim=claim,
        protocol=protocol,
        results=results,
        evaluator_id="independent-eval",
        evaluator_type=EvaluatorType.FORMAL_TEST_RUNNER,
    )
    return validator.validate_and_commit(tx)

def test_legacy_aggregate_cannot_claim_successful_cross_model_transfer(legacy_tx):
    def mock_evaluator(prompt, item):
        return 0.85 if "refined" in prompt else 0.50

    dataset = [{"q": "1+1"}]
    
    assert legacy_tx.status == QualificationStatus.REJECTED
    with pytest.raises(ValueError, match="non-qualified"):
        LearningTransferProtocol.evaluate_cross_model_transfer(
            tx=legacy_tx,
            target_model_id="claude-3-7-sonnet",
            evaluator_fn=mock_evaluator,
            test_dataset=dataset,
            base_prompt="base",
            refined_prompt="refined",
        )
    assert "cross_model_transfers" not in legacy_tx.metadata

def test_legacy_aggregate_cannot_claim_failed_cross_model_transfer(legacy_tx):
    def mock_evaluator(prompt, item):
        return 0.40 if "refined" in prompt else 0.50

    dataset = [{"q": "1+1"}]
    
    with pytest.raises(ValueError, match="non-qualified"):
        LearningTransferProtocol.evaluate_cross_model_transfer(
            tx=legacy_tx,
            target_model_id="llama-3-3-70b",
            evaluator_fn=mock_evaluator,
            test_dataset=dataset,
            base_prompt="base",
            refined_prompt="refined",
        )

def test_artifact_synthesis(legacy_tx):
    assert legacy_tx.status == QualificationStatus.REJECTED
    with pytest.raises(ValueError, match="non-qualified"):
        LearningTransferProtocol.synthesize_spe_learning_artifact(
            tx=legacy_tx, refined_prompt_content="Refined rules"
        )

def test_distribution_drift_revocation(legacy_tx):
    # Direct test of the revocation primitive with a hypothetical pre-qualified
    # object. This manual assignment is NOT a valid admission proof.
    legacy_tx.status = QualificationStatus.QUALIFIED
    # Baseline generalization was 0.88.
    # Drift tolerance 0.15 means < 0.73 triggers revocation.
    
    # 0.75 is safe (0.88 - 0.75 = 0.13 <= 0.15)
    revoked_safe = LearningTransferProtocol.check_distribution_drift_and_revoke(
        tx=legacy_tx,
        monitored_scores=[0.75, 0.75],
        drift_tolerance=0.15
    )
    assert not revoked_safe
    assert legacy_tx.status == QualificationStatus.QUALIFIED
    
    # 0.70 is failure (0.88 - 0.70 = 0.18 > 0.15)
    revoked_fail = LearningTransferProtocol.check_distribution_drift_and_revoke(
        tx=legacy_tx,
        monitored_scores=[0.70, 0.70],
        drift_tolerance=0.15
    )
    assert revoked_fail
    assert legacy_tx.status == QualificationStatus.REVOKED
    assert legacy_tx.revocation_reason == RevocationReason.DISTRIBUTION_DRIFT_EXCEEDED
    
    with pytest.raises(TransactionRevokedError):
        LearningTransferProtocol.assert_not_revoked(legacy_tx)
