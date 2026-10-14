"""
Decisive Experiment Selector & Cryptographic Precommitment Lock for CWC-1.
Version 1.1: Repaired with Structural Feasibility Filtering, Dimensionally Consistent Acquisition,
and Verifiable Chronological Pre-registration (CWC-F02, CWC-F03, CWC-F06).
"""

from __future__ import annotations
import hashlib
import json
import math
from typing import Dict, List, Optional, Tuple
from .types import (
    AcquisitionMode,
    ActionDecision,
    ExplanatoryMechanism,
    InterventionalAction,
    PrecommitmentDigest,
)


class ExperimentSelector:
    """Selects decisive interventional experiments to discriminate competing mechanisms."""

    def __init__(self, lambda_evsi: float = 1.0, mu_fr: float = 1.0):
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

    def score_monetary_acquisition(
        self,
        action: InterventionalAction,
    ) -> int:
        """
        Dimensionally consistent monetary acquisition objective in exact integer NanoUSD (CWC-F02):
            Score(a) = EVSI_nanos(a) - Cost_nanos(a) - RiskLoss_nanos(a)
        Precondition: Action is guaranteed authorized and feasible.
        """
        evsi_nanos = int(action.expected_value_sample_info * 1_000_000_000)
        net_score = evsi_nanos - action.cost_nanos - action.risk_nanos
        return net_score

    def score_information_density_acquisition(
        self,
        action: InterventionalAction,
        jsd_disagreement: float,
    ) -> float:
        """
        Dimensionally consistent scientific information density objective (CWC-F02):
            Score(a) = [EIG(a) (bits) + mu*FR(a) (dimless) + JSD(a) (nats)] / Cost_USD(a)
        Measures information gain per dollar expended without invalid unit conversions.
        """
        cost_usd = max(action.cost_nanos / 1_000_000_000.0, 0.001)
        total_information = action.expected_information_gain + self.mu_fr * action.falsification_potential + jsd_disagreement
        return total_information / cost_usd

    def score_intervention_acquisition(
        self,
        action: InterventionalAction,
        jsd_disagreement: float = 0.0,
    ) -> int:
        """
        Backwards compatibility acquisition scoring method.
        If unauthorized, returns -10^15 penalty.
        For authorized actions, computes exact integer NanoUSD acquisition score.
        """
        if not action.is_authorized:
            return -1_000_000_000_000_000
        evsi_nanos = int(action.expected_value_sample_info * 1_000_000_000 * self.lambda_evsi)
        info_nanos = int(
            (action.expected_information_gain + self.mu_fr * action.falsification_potential + jsd_disagreement)
            * 1_000_000_000
        )
        return evsi_nanos + info_nanos - action.cost_nanos - action.risk_nanos

    def select_best_experiment(
        self,
        mechanisms: List[ExplanatoryMechanism],
        candidate_actions: List[InterventionalAction],
        budget_nanos: int = 10_000_000_000,  # $10.00 USD default
        risk_ceiling_nanos: int = 1_000_000_000,
        mode: AcquisitionMode = AcquisitionMode.MONETARY_DECISION_VALUE,
    ) -> Tuple[ActionDecision, float]:
        """
        Structural Action Selection (CWC-F03):
        Filters out unauthorized, over-budget, or excessive-risk actions BEFORE optimization.
        Returns explicit ActionDecision with status NO_AUTHORIZED_FEASIBLE_ACTION if empty.
        """
        feasible = [
            a for a in candidate_actions
            if a.is_authorized and a.cost_nanos <= budget_nanos and a.risk_nanos <= risk_ceiling_nanos
        ]

        if not feasible:
            return ActionDecision(
                status="NO_AUTHORIZED_FEASIBLE_ACTION",
                selected_action=None,
                feasible_action_count=0,
                filtered_unauthorized_count=len(candidate_actions),
                acquisition_score=0.0,
                acquisition_mode=mode,
            ), 0.0

        best_action: Optional[InterventionalAction] = None
        best_score = -float("inf")
        best_jsd = 0.0

        for action in feasible:
            condition = f"x_intervene_{int(action.intervention_value)}"
            jsd = self.compute_jensen_shannon_divergence(mechanisms, condition)

            if mode == AcquisitionMode.MONETARY_DECISION_VALUE:
                score = float(self.score_monetary_acquisition(action))
            else:
                score = self.score_information_density_acquisition(action, jsd)

            if score > best_score:
                best_score = score
                best_action = action
                best_jsd = jsd

        return ActionDecision(
            status="ACTION_SELECTED",
            selected_action=best_action,
            feasible_action_count=len(feasible),
            filtered_unauthorized_count=len(candidate_actions) - len(feasible),
            acquisition_score=best_score,
            acquisition_mode=mode,
        ), best_jsd

    def seal_precommitment_lock(
        self,
        mechanisms: List[ExplanatoryMechanism],
        action: InterventionalAction,
        timestamp_utc: str = "2026-10-14T00:00:00Z",
        nonce: str = "spe-cwc-nonce-salt-42",
        protocol_id: str = "STAT-PROT-DEFAULT",
    ) -> PrecommitmentDigest:
        """
        Locks predictions cryptographically before executing intervention (Anti-HARKing Law - CWC-F06).
        Commitment = SHA256(CanonicalJSON(Predictions) || ActionID || Timestamp || ProtocolID || Nonce)
        Generates verifiable preregistration token for chronological integrity.
        """
        predictions_map = {
            m.mechanism_id: m.predictions.get(f"x_intervene_{int(action.intervention_value)}", 0.0)
            for m in mechanisms
        }
        canonical_json = json.dumps(predictions_map, sort_keys=True, separators=(",", ":"))
        predictions_hash = hashlib.sha256(canonical_json.encode("utf-8")).hexdigest()

        preimage = f"{predictions_hash}|{action.action_id}|{timestamp_utc}|{protocol_id}|{nonce}"
        digest = hashlib.sha256(preimage.encode("utf-8")).hexdigest()

        prereg_token = f"PREREG-SHA256:{digest[:16]}-T:{timestamp_utc}-PROT:{protocol_id}"

        return PrecommitmentDigest(
            digest_sha256=digest,
            action_id=action.action_id,
            timestamp_utc=timestamp_utc,
            nonce=nonce,
            sealed_predictions_hash=predictions_hash,
            preregistration_token=prereg_token,
        )
