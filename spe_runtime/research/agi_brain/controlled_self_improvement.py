"""
SPE AGI BRAIN Ω — Intelligence VI: Controlled Self-Improvement
October 12, 2026 | Research Quarantine Track
"""

from typing import Dict, Any, Optional
from spe_runtime.research.agi_brain.types import DiscoveryMetaPolicy

IMMUTABLE_AUTHORITY_BOUNDARIES = frozenset([
    "protected_intent",
    "verification_threshold",
    "alpha_threshold",
    "authority_grants",
    "conservation_of_truth_law",
    "zero_cloud_egress_invariant",
])

class ControlledSelfImprovementEngine:
    """
    Evaluates proposed modifications to search strategies and resource allocation
    exclusively in isolated sandboxes. Enforces strict immutability of authority boundaries,
    verification thresholds, and protected intents.
    """

    def evaluate_modification_proposal(
        self,
        current_policy: DiscoveryMetaPolicy,
        proposed_changes: Dict[str, Any],
        sandbox_test_score: float,
        baseline_score: float,
    ) -> Dict[str, Any]:
        # 1. Authority Boundary Check: Block any modification to protected boundaries
        for key in proposed_changes:
            if key.lower() in IMMUTABLE_AUTHORITY_BOUNDARIES:
                return {
                    "is_promoted": False,
                    "reason": f"CRITICAL: Proposed change attempts to modify immutable authority boundary '{key}'.",
                    "updated_policy": current_policy,
                }

        # 2. Measurable Advantage Check in Sandbox
        delta = sandbox_test_score - baseline_score
        if delta <= 0.0:
            return {
                "is_promoted": False,
                "reason": f"Rejected: Sandbox delta ({delta:.4f}) does not demonstrate measurable advantage over baseline.",
                "updated_policy": current_policy,
            }

        # 3. Apply Safe Adaptations (e.g. strategy weight or resource allocation adjustments)
        updated_weights = dict(current_policy.domain_weights)
        if "weight_adjustments" in proposed_changes:
            for strat, factor in proposed_changes["weight_adjustments"].items():
                if strat in updated_weights:
                    updated_weights[strat] = max(0.05, updated_weights[strat] * factor)

        promoted_policy = DiscoveryMetaPolicy(
            policy_id=f"{current_policy.policy_id}-promoted",
            domain_weights=updated_weights,
            success_counts=dict(current_policy.success_counts),
            heldout_transfer_score=sandbox_test_score,
        )

        return {
            "is_promoted": True,
            "reason": f"Promoted: Verified sandbox advantage delta of +{delta:.4f}.",
            "updated_policy": promoted_policy,
        }
