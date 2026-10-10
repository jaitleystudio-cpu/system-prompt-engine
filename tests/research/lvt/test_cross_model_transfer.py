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
def qualified_tx():
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
    return validator.validate_and_commit(tx, allow_mock_qualification=True)


def test_unqualified_tx_cannot_evaluate_cross_model_transfer():
    """Unqualified / RESEARCH_UNQUALIFIED transaction cannot evaluate cross-model transfer."""
    validator = LearningValidator()
    claim = LearningClaim(
        claim_id="CLM-XFER-UNQ",
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
        tx_id="TX-XFER-UNQ",
        claim=claim,
        protocol=protocol,
        results=results,
        evaluator_id="independent-eval",
        evaluator_type=EvaluatorType.FORMAL_TEST_RUNNER,
    )
    # Default without allow_mock_qualification yields RESEARCH_UNQUALIFIED
    unq_tx = validator.validate_and_commit(tx)
    assert unq_tx.status == QualificationStatus.RESEARCH_UNQUALIFIED

    with pytest.raises(ValueError, match="Cannot evaluate cross-model transfer for unqualified transaction"):
        LearningTransferProtocol.evaluate_cross_model_transfer(
            tx=unq_tx,
            target_model_id="claude-3-7-sonnet",
            evaluator_fn=lambda p, i: 0.8,
            test_dataset=[{"q": "1+1"}],
            base_prompt="base",
            refined_prompt="refined",
        )


def test_successful_cross_model_transfer(qualified_tx):
    def mock_evaluator(prompt, item):
        return 0.85 if "refined" in prompt else 0.50

    dataset = [{"q": "1+1"}]
    
    report = LearningTransferProtocol.evaluate_cross_model_transfer(
        tx=qualified_tx,
        target_model_id="claude-3-7-sonnet",
        evaluator_fn=mock_evaluator,
        test_dataset=dataset,
        base_prompt="base",
        refined_prompt="refined",
    )
    
    assert report["transfers_successfully"] is True
    assert report["transfer_delta"] == 0.35
    assert "cross_model_transfers" in qualified_tx.metadata

def test_failed_cross_model_transfer(qualified_tx):
    def mock_evaluator(prompt, item):
        return 0.40 if "refined" in prompt else 0.50

    dataset = [{"q": "1+1"}]
    
    report = LearningTransferProtocol.evaluate_cross_model_transfer(
        tx=qualified_tx,
        target_model_id="llama-3-3-70b",
        evaluator_fn=mock_evaluator,
        test_dataset=dataset,
        base_prompt="base",
        refined_prompt="refined",
    )
    
    assert report["transfers_successfully"] is False

def test_artifact_synthesis(qualified_tx):
    artifact_json = LearningTransferProtocol.synthesize_spe_learning_artifact(
        tx=qualified_tx,
        refined_prompt_content="Refined rules"
    )
    data = json.loads(artifact_json)
    assert data["spe_version"] == "1.0"
    assert data["artifact_type"] == "LEARNING_VALIDITY_TRANSACTION"
    assert data["tx_id"] == "TX-XFER-001"
    assert "receipt" in data
    assert data["refined_prompt"] == "Refined rules"

def test_distribution_drift_revocation(qualified_tx):
    # Baseline generalization was 0.88.
    # Drift tolerance 0.15 means < 0.73 triggers revocation.
    
    # 0.75 is safe (0.88 - 0.75 = 0.13 <= 0.15)
    revoked_safe = LearningTransferProtocol.check_distribution_drift_and_revoke(
        tx=qualified_tx,
        monitored_scores=[0.75, 0.75],
        drift_tolerance=0.15
    )
    assert not revoked_safe
    assert qualified_tx.status == QualificationStatus.QUALIFIED
    
    # 0.70 is failure (0.88 - 0.70 = 0.18 > 0.15)
    revoked_fail = LearningTransferProtocol.check_distribution_drift_and_revoke(
        tx=qualified_tx,
        monitored_scores=[0.70, 0.70],
        drift_tolerance=0.15
    )
    assert revoked_fail
    assert qualified_tx.status == QualificationStatus.REVOKED
    assert qualified_tx.revocation_reason == RevocationReason.DISTRIBUTION_DRIFT_EXCEEDED
    
    with pytest.raises(TransactionRevokedError):
        LearningTransferProtocol.assert_not_revoked(qualified_tx)
