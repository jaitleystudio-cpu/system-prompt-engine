"""LVT-2 migration: legacy aggregate-only evidence must fail closed.

These regression tests deliberately do not fabricate independent evidence.
"""
import pytest

from spe_runtime.research.lvt import (
    EvaluatorType, ExperimentProtocol, FourArmResults, LearningClaim,
    LearningValidityRuleViolation, LearningValidityTransaction,
    LearningValidator, QualificationStatus,
)


def _legacy_tx():
    return LearningValidityTransaction(
        tx_id="LVT2-NEG-LEGACY-001",
        claim=LearningClaim(
            claim_id="LVT2-LEGACY-CLAIM", domain="prompt-eval",
            description="Legacy synthetic score claim",
            generator_id="generator-a",
            base_prompt_ref="base-v1", candidate_prompt_ref="candidate-v2",
            budget_nanos=1000,
        ),
        protocol=ExperimentProtocol(protocol_id="legacy-aggregate-0", sample_size=1),
        results=FourArmResults(
            arm_a_baseline_score=0.10,
            arm_b_authentic_score=0.90,
            arm_c_shuffled_control_score=0.20,
            arm_d_generalization_score=0.95,
            delta_improvement=0.80,
            control_delta=0.70,
            held_out_retention=0.85,
            is_statistically_significant=True,
            total_cost_nanos=400,
        ),
        evaluator_id="different-evaluator",
        evaluator_type=EvaluatorType.FORMAL_TEST_RUNNER,
    )


def test_legacy_aggregate_without_item_level_evidence_never_qualifies():
    tx = _legacy_tx()
    result = LearningValidator().validate_and_commit(tx)
    assert result.status != QualificationStatus.QUALIFIED
    assert not result.canonical_receipt_signature
    assert not result.artifact_hash


def test_strict_legacy_aggregate_rejects_with_evidence_authentic():
    with pytest.raises(LearningValidityRuleViolation, match="EvidenceAuthentic"):
        LearningValidator().validate_and_commit(_legacy_tx(), strict=True)


def test_legacy_significance_flag_cannot_override_missing_evidence():
    tx = _legacy_tx()
    conjuncts = LearningValidator().evaluate_conjuncts(tx)
    assert conjuncts["EvidenceAuthentic"] is False


def test_legacy_rejection_preserves_no_signed_qualification():
    tx = _legacy_tx()
    v = LearningValidator()
    v.validate_and_commit(tx)
    assert tx.status == QualificationStatus.REJECTED
    assert v.verify_transaction_signature(tx) is False
