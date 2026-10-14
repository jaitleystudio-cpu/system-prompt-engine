"""
Decisive Experiment Selector & Cryptographic Precommitment Lock for CWC-1.
Implements the Jensen-Shannon Disagreement Objective, exact integer NanoUSD Acquisition,
and Anti-HARKing Cryptographic Precommitment.
"""

from __future__ import annotations
import hashlib
import json
import math
from typing import Dict, List, Optional, Tuple
from .types import (
    ExplanatoryMechanism,
    InterventionalAction,
    PrecommitmentDigest,
)


class ExperimentSelector:
    """Selects decisive interventional experiments to discriminate competing mechanisms."""

    def __init__(self, lambda_evsi: float = 0.5, mu_fr: float = 1.0):
        self.lambda_evsi = lambda_evsi
        self.mu_fr = mu_fr

    def compute_jensen_shannon_divergence(
        self,
        mechanisms: List[ExplanatoryMechanism],
        condition: str,
        sigma: float = 1.0,
    ) -> float:
        """
        Computes pairwise Jensen-Shannon Disagreement D(a) across candidate mechanisms:
            D(a) = sum_{i < j} w_i * w_j * JSD(P_i(y|do(a)), P_j(y|do(a)))
        Uses Gaussian predictive densities centered at mechanism predictions with variance sigma^2.
        """
        if len(mechanisms) < 2:
            return 0.0

        total_jsd = 0.0
        # Discretize support grid over [-10, 10] relative to means
        means = [m.predictions.get(condition, 0.0) for m in mechanisms]
        min_val = min(means) - 3.0 * sigma
        max_val = max(means) + 3.0 * sigma
        steps = 50
        step_size = (max_val - min_val) / steps if steps > 0 else 1.0
        grid = [min_val + i * step_size for i in range(steps + 1)]

        def gaussian_pdf(x: float, mu: float, s: float) -> float:
            denom = s * math.sqrt(2.0 * math.pi)
            exponent = -0.5 * ((x - mu) / s) ** 2
            return (1.0 / denom) * math.exp(exponent)

        # Precompute discrete distributions
        dists = []
        for mu in means:
            raw = [gaussian_pdf(x, mu, sigma) for x in grid]
            total = sum(raw) * step_size
            norm = [p / total for p in raw] if total > 0 else [1.0 / len(raw)] * len(raw)
            dists.append(norm)

        for i in range(len(mechanisms)):
            for j in range(i + 1, len(mechanisms)):
                w_i = mechanisms[i].prior_weight
                w_j = mechanisms[j].prior_weight
                p = dists[i]
                q = dists[j]

                # Mixture M = 0.5 * (P + Q)
                m = [0.5 * (p_k + q_k) for p_k, q_k in zip(p, q)]

                # KL(P || M)
                kl_pm = sum(
                    p_k * math.log(p_k / m_k) for p_k, m_k in zip(p, m) if p_k > 1e-12 and m_k > 1e-12
                )
                # KL(Q || M)
                kl_qm = sum(
                    q_k * math.log(q_k / m_k) for q_k, m_k in zip(q, m) if q_k > 1e-12 and m_k > 1e-12
                )

                jsd = 0.5 * kl_pm + 0.5 * kl_qm
                total_jsd += w_i * w_j * jsd

        return max(0.0, total_jsd)

    def score_intervention_acquisition(
        self,
        action: InterventionalAction,
        jsd_disagreement: float,
    ) -> int:
        """
        Computes exact integer NanoUSD acquisition score for a candidate intervention:
            Score(a) = [EIG(a)*10^9 + lambda*EVSI(a)*10^9 + mu*FR(a)*10^9] - CostNanoUSD(a) - RiskNanoUSD(a)
        If action is not authorized, returns -10^15.
        """
        if not action.is_authorized:
            return -1_000_000_000_000_000  # -10^15

        # Incorporate JSD into EIG
        effective_eig = action.expected_information_gain + jsd_disagreement
        eig_nanos = int(effective_eig * 1_000_000_000)
        evsi_nanos = int(self.lambda_evsi * action.expected_value_sample_info * 1_000_000_000)
        fr_nanos = int(self.mu_fr * action.falsification_potential * 1_000_000_000)

        benefit_nanos = eig_nanos + evsi_nanos + fr_nanos
        score = benefit_nanos - action.cost_nanos - action.risk_nanos
        return score

    def select_best_experiment(
        self,
        mechanisms: List[ExplanatoryMechanism],
        candidate_actions: List[InterventionalAction],
    ) -> Tuple[Optional[InterventionalAction], float]:
        """
        Evaluates candidate actions, computes JSD disagreement for each,
        and selects the highest scoring authorized action.
        """
        best_action: Optional[InterventionalAction] = None
        best_score = -float("inf")
        best_jsd = 0.0

        for action in candidate_actions:
            # Map action to condition
            condition = f"x_intervene_{int(action.intervention_value)}"
            jsd = self.compute_jensen_shannon_divergence(mechanisms, condition)
            score = self.score_intervention_acquisition(action, jsd)

            if score > best_score:
                best_score = score
                best_action = action
                best_jsd = jsd

        return best_action, best_jsd

    def seal_precommitment_lock(
        self,
        mechanisms: List[ExplanatoryMechanism],
        action: InterventionalAction,
        timestamp_utc: str = "2026-10-14T00:00:00Z",
        nonce: str = "spe-cwc-nonce-salt-42",
    ) -> PrecommitmentDigest:
        """
        Locks predictions cryptographically before executing intervention (Anti-HARKing Law).
        Commitment = SHA256(CanonicalJSON(Predictions) || ActionID || Timestamp || Nonce)
        """
        predictions_map = {
            m.mechanism_id: m.predictions.get(f"x_intervene_{int(action.intervention_value)}", 0.0)
            for m in mechanisms
        }
        canonical_json = json.dumps(predictions_map, sort_keys=True, separators=(",", ":"))
        predictions_hash = hashlib.sha256(canonical_json.encode("utf-8")).hexdigest()

        preimage = f"{predictions_hash}|{action.action_id}|{timestamp_utc}|{nonce}"
        digest = hashlib.sha256(preimage.encode("utf-8")).hexdigest()

        return PrecommitmentDigest(
            digest_sha256=digest,
            action_id=action.action_id,
            timestamp_utc=timestamp_utc,
            nonce=nonce,
            sealed_predictions_hash=predictions_hash,
        )
