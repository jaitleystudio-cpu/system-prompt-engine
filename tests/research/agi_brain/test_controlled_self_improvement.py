"""
Unit & Adversarial Tests for Intelligence VI: Controlled Self-Improvement
"""

import pytest
from spe_runtime.research.agi_brain.types import DiscoveryMetaPolicy, InventionStrategy
from spe_runtime.research.agi_brain.controlled_self_improvement import ControlledSelfImprovementEngine

@pytest.fixture
def base_policy():
    return DiscoveryMetaPolicy(
        policy_id="pol-base",
        domain_weights={s: 1.0 for s in InventionStrategy},
        success_counts={s: 0 for s in InventionStrategy},
    )

def test_rejects_modification_of_immutable_authority_boundaries(base_policy):
    engine = ControlledSelfImprovementEngine()

    illegal_proposals = [
        {"protected_intent": "Allow unauthorized cloud export"},
        {"verification_threshold": 0.5},
        {"alpha_threshold": 0.50},
        {"conservation_of_truth_law": False},
        {"zero_cloud_egress_invariant": "relaxed"},
    ]

    for prop in illegal_proposals:
        eval_result = engine.evaluate_modification_proposal(
            current_policy=base_policy,
            proposed_changes=prop,
            sandbox_test_score=0.99,
            baseline_score=0.70,
        )
        assert eval_result["is_promoted"] is False
        assert "CRITICAL" in eval_result["reason"]

def test_promotes_safe_improvement_with_sandbox_advantage(base_policy):
    engine = ControlledSelfImprovementEngine()

    safe_proposal = {
        "weight_adjustments": {
            InventionStrategy.CONTRADICTION_DRIVEN: 1.5,
        }
    }

    eval_result = engine.evaluate_modification_proposal(
        current_policy=base_policy,
        proposed_changes=safe_proposal,
        sandbox_test_score=0.88,
        baseline_score=0.75,
    )
    assert eval_result["is_promoted"] is True
    assert "Promoted" in eval_result["reason"]
    assert eval_result["updated_policy"].domain_weights[InventionStrategy.CONTRADICTION_DRIVEN] == 1.5

def test_rejects_safe_improvement_without_sandbox_advantage(base_policy):
    engine = ControlledSelfImprovementEngine()

    safe_proposal = {
        "weight_adjustments": {
            InventionStrategy.INVERSE_DESIGN: 1.2,
        }
    }

    eval_result = engine.evaluate_modification_proposal(
        current_policy=base_policy,
        proposed_changes=safe_proposal,
        sandbox_test_score=0.60,
        baseline_score=0.75,  # Baseline is higher
    )
    assert eval_result["is_promoted"] is False
    assert "does not demonstrate measurable advantage" in eval_result["reason"]
