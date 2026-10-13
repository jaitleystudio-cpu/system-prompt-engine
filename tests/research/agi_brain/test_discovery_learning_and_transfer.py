"""
Unit & Adversarial Tests for Intelligence V: Learning How to Discover & Transfer
"""

import pytest
from spe_runtime.research.agi_brain.types import (
    InventionStrategy,
    VerificationResult,
    VerificationStatus,
)
from spe_runtime.research.agi_brain.discovery_learning import DiscoveryLearningEngine

def test_meta_policy_updates_weights_on_verified_discovery():
    engine = DiscoveryLearningEngine(policy_id="test-policy")
    initial_weight = engine.policy.domain_weights[InventionStrategy.CONTRADICTION_DRIVEN]

    # Record verified discovery
    res_verified = VerificationResult(
        result_id="vr-01",
        candidate_id="c-01",
        status=VerificationStatus.VERIFIED,
    )
    engine.record_investigation_outcome(InventionStrategy.CONTRADICTION_DRIVEN, res_verified)

    assert engine.policy.domain_weights[InventionStrategy.CONTRADICTION_DRIVEN] > initial_weight
    assert engine.policy.success_counts[InventionStrategy.CONTRADICTION_DRIVEN] == 1

def test_meta_policy_penalizes_rejected_discovery():
    engine = DiscoveryLearningEngine(policy_id="test-policy")
    initial_weight = engine.policy.domain_weights[InventionStrategy.EVOLUTIONARY_PROGRAM_SEARCH]

    res_rejected = VerificationResult(
        result_id="vr-02",
        candidate_id="c-02",
        status=VerificationStatus.REJECTED,
    )
    engine.record_investigation_outcome(InventionStrategy.EVOLUTIONARY_PROGRAM_SEARCH, res_rejected)

    assert engine.policy.domain_weights[InventionStrategy.EVOLUTIONARY_PROGRAM_SEARCH] < initial_weight

def test_holdout_transfer_evaluation():
    engine = DiscoveryLearningEngine(policy_id="test-policy")
    # Artificially boost FIRST_PRINCIPLES
    engine.policy.domain_weights[InventionStrategy.FIRST_PRINCIPLES] = 10.0

    holdout_trials = [
        {"optimal_strategy": InventionStrategy.FIRST_PRINCIPLES},
        {"optimal_strategy": InventionStrategy.FIRST_PRINCIPLES},
        {"optimal_strategy": InventionStrategy.EVOLUTIONARY_PROGRAM_SEARCH},
    ]

    transfer_score = engine.evaluate_holdout_transfer(holdout_trials)
    assert transfer_score == pytest.approx(2 / 3, 0.01)
    assert engine.policy.heldout_transfer_score == pytest.approx(2 / 3, 0.01)
