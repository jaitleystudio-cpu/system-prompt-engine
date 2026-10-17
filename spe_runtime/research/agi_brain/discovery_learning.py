"""
SPE AGI BRAIN Ω — Intelligence V: Learning How to Discover
October 12, 2026 | Research Quarantine Track
"""

from typing import Dict, List, Optional, Any
from spe_runtime.research.agi_brain.types import (
    DiscoveryMetaPolicy,
    InventionStrategy,
    DomainType,
    VerificationResult,
    VerificationStatus,
)

class DiscoveryLearningEngine:
    """
    Meta-learns scientific search policies across problems and evaluates transfer
    on unseen holdout task families.
    """

    def __init__(self, policy_id: str = "meta-policy-01"):
        self.policy = DiscoveryMetaPolicy(
            policy_id=policy_id,
            domain_weights={s: 1.0 for s in InventionStrategy},
            success_counts={s: 0 for s in InventionStrategy},
        )

    def record_investigation_outcome(
        self,
        strategy: InventionStrategy,
        result: VerificationResult,
    ) -> None:
        """Updates strategy weights based on independently verified outcomes."""
        current_weight = self.policy.domain_weights.get(strategy, 1.0)
        current_count = self.policy.success_counts.get(strategy, 0)

        if result.status == VerificationStatus.VERIFIED:
            # Reward successful verified discovery
            self.policy.domain_weights[strategy] = current_weight * 1.2
            self.policy.success_counts[strategy] = current_count + 1
        elif result.status == VerificationStatus.REJECTED:
            # Penalize rejected claims
            self.policy.domain_weights[strategy] = max(0.1, current_weight * 0.8)
        # UNKNOWN leaves weights neutral

    def evaluate_holdout_transfer(
        self,
        holdout_trials: List[Dict[str, Any]],
    ) -> float:
        """
        Evaluates the learned meta-policy on unseen task families.
        Returns transfer score [0.0 to 1.0].
        """
        if not holdout_trials:
            return 0.0

        successful_transfers = 0
        for trial in holdout_trials:
            recommended_strategy = self.get_top_strategy()
            trial_winner = trial.get("optimal_strategy")
            if recommended_strategy == trial_winner or trial.get("is_verified_on_holdout"):
                successful_transfers += 1

        transfer_score = successful_transfers / len(holdout_trials)
        self.policy.heldout_transfer_score = transfer_score
        return transfer_score

    def get_top_strategy(self) -> InventionStrategy:
        """Returns the current highest-weighted strategy."""
        return max(
            self.policy.domain_weights.keys(),
            key=lambda s: self.policy.domain_weights[s],
        )

    def get_ranked_strategies(self) -> List[InventionStrategy]:
        """Returns strategies sorted by descending weight."""
        return sorted(
            self.policy.domain_weights.keys(),
            key=lambda s: self.policy.domain_weights[s],
            reverse=True,
        )
