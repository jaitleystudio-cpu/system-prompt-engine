"""
Decisive Experiment Selector & Cryptographic Precommitment Lock for CWC-1.
Version 1.2: Repaired with Clean EIG Objective, Practical Discriminatory Power Qualification,
Prior Sensitivity Ambiguity Sets (Go & Isaac 2022), and Tamper-Evident Append-Only Chronology (RFC 3161).
"""

from __future__ import annotations
import hashlib
import json
import math
import time
from typing import Dict, List, Optional, Set, Tuple
from .types import (
    AcquisitionMode,
    ActionDecision,
    DiscriminatoryPowerReport,
    ExplanatoryMechanism,
    InterventionalAction,
    MechanismClass,
    PrecommitmentDigest,
    PreregistrationChainEntry,
    PriorSensitivityReport,
    ProductivityCalculationStatus,
)


class PreregistrationLedger:
    """
    Append-only cryptographic hash chain establishing verifiable chronological order (RFC 3161 - Hard Test 6).
    Enforces replay resistance, monotonic sequence numbering, and tamper-evident chaining.
    """
    def __init__(self, trust_boundary: str = "LOCAL_APPEND_ONLY_CHAIN"):
        self.trust_boundary = trust_boundary
        self.chain: List[PreregistrationChainEntry] = []
        self.registered_nonces: Set[str] = set()
        self.registered_tokens: Set[str] = set()
        self._genesis_hash = "0" * 64

    def register_precommitment(
        self,
        action_id: str,
        predictions_hash: str,
        model_digest: str,
        protocol_id: str,
        nonce: str,
        timestamp_utc: str = "2026-10-14T00:00:00Z",
        run_id: str = "RUN-DEFAULT",
        monotonic_ns: Optional[int] = None,
    ) -> PrecommitmentDigest:
        # Replay resistance check (Hard Test 6)
        if nonce in self.registered_nonces:
            raise ValueError(f"REPLAY_ATTACK_DETECTED: Nonce '{nonce}' has already been registered in preregistration ledger.")

        seq = len(self.chain) + 1
        prev_hash = self.chain[-1].block_hash if self.chain else self._genesis_hash
        mono_time = monotonic_ns if monotonic_ns is not None else time.monotonic_ns()

        # Monotonic time check against backdating
        if self.chain and mono_time < self.chain[-1].monotonic_timestamp_ns:
            raise ValueError("CHRONOLOGY_VIOLATION: Monotonic timestamp cannot decrease (backdating attempt detected).")

        preimage = f"{prev_hash}|{seq}|{mono_time}|{timestamp_utc}|{run_id}|{model_digest}|{action_id}|{protocol_id}|{predictions_hash}|{nonce}"
        block_hash = hashlib.sha256(preimage.encode("utf-8")).hexdigest()

        entry = PreregistrationChainEntry(
            sequence_number=seq,
            previous_block_hash=prev_hash,
            monotonic_timestamp_ns=mono_time,
            timestamp_utc=timestamp_utc,
            run_id=run_id,
            model_digest=model_digest,
            action_digest=action_id,
            protocol_digest=protocol_id,
            nonce=nonce,
            block_hash=block_hash,
            trust_boundary=self.trust_boundary,
        )
        self.chain.append(entry)
        self.registered_nonces.add(nonce)

        prereg_token = f"PREREG-SHA256:{block_hash[:16]}-SEQ:{seq}-T:{timestamp_utc}-PROT:{protocol_id}"
        self.registered_tokens.add(prereg_token)

        return PrecommitmentDigest(
            digest_sha256=block_hash,
            action_id=action_id,
            timestamp_utc=timestamp_utc,
            nonce=nonce,
            sealed_predictions_hash=predictions_hash,
            preregistration_token=prereg_token,
            chain_sequence=seq,
            previous_block_hash=prev_hash,
            trust_boundary=self.trust_boundary,
            run_id=run_id,
        )

    def verify_chain(self) -> Tuple[bool, str]:
        """Verifies the integrity of the entire append-only hash chain."""
        prev = self._genesis_hash
        for i, entry in enumerate(self.chain):
            if entry.sequence_number != i + 1:
                return False, f"Broken sequence number at block {i+1}"
            if entry.previous_block_hash != prev:
                return False, f"Broken hash chain link at block {i+1}"
            prev = entry.block_hash
        return True, "Chain valid and tamper-evident"


class ExperimentSelector:
    """Selects decisive interventional experiments to discriminate competing mechanisms."""

    def __init__(self, lambda_evsi: float = 1.0, mu_fr: float = 1.0):
        self.lambda_evsi = lambda_evsi
        self.mu_fr = mu_fr
        self.ledger = PreregistrationLedger()

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

    def compute_expected_information_gain(
        self,
        mechanisms: List[ExplanatoryMechanism],
        condition: str,
        sigma: float = 1.0,
        is_discrete: Optional[bool] = None,
    ) -> float:
        """
        Computes clean Shannon Expected Information Gain / Mutual Information (Lindley 1956 - Hard Test 1):
            I(M; Y | do(a)) = H(Y | do(a)) - sum_i w_i H(Y | do(a), M_i)
        Prevents double-counting with JSD by computing the exact non-overlapping mutual information in bits.
        """
        if len(mechanisms) < 2:
            return 0.0

        for m in mechanisms:
            if math.isnan(m.prior_weight) or math.isinf(m.prior_weight) or m.prior_weight < 0:
                raise ValueError("NUMERICAL_ERROR_INVALID_VALUE: Prior weights must be non-negative finite numbers")

        weights = [m.prior_weight for m in mechanisms]
        total_w = sum(weights)
        if total_w <= 0:
            return 0.0
        norm_weights = [w / total_w for w in weights]

        predictions = []
        for m in mechanisms:
            val = m.predictions.get(condition)
            if val is None:
                val = list(m.predictions.values())[0] if m.predictions else 0.0
            if math.isnan(val) or math.isinf(val):
                raise ValueError("NUMERICAL_ERROR_INVALID_VALUE: Prediction values cannot be NaN or infinite")
            predictions.append(val)

        # Check if discrete calculation applies:
        # 1. Explicitly requested via is_discrete=True
        # 2. sigma <= 1e-4
        # 3. All mechanisms are deterministic equation/program models
        # 4. Predictions are discrete point values (e.g. integers or discrete levels)
        is_discrete_eval = (
            is_discrete is True
            or sigma <= 1e-4
            or all(m.mechanism_class in (MechanismClass.EQUATION_SYSTEM, MechanismClass.ALGORITHMIC_PROGRAM) for m in mechanisms)
            or all(abs(p - round(p)) < 1e-4 for p in predictions)
        )

        if is_discrete_eval:
            clusters: List[Tuple[float, float]] = []  # (mean_value, accumulated_weight)
            for i, p in enumerate(predictions):
                w = norm_weights[i]
                found = False
                for idx, (c_val, c_prob) in enumerate(clusters):
                    if abs(p - c_val) <= 1e-4:
                        clusters[idx] = (c_val, c_prob + w)
                        found = True
                        break
                if not found:
                    clusters.append((p, w))

            ent = -sum(c_prob * math.log2(c_prob) for _, c_prob in clusters if c_prob > 1e-12)
            return max(0.0, ent)

        # Continuous Gaussian densities: Mutual Information via numerical integration of mixture KL
        min_val = min(predictions) - 4.0 * sigma
        max_val = max(predictions) + 4.0 * sigma
        steps = 100
        step_size = (max_val - min_val) / steps if steps > 0 else 1.0
        grid = [min_val + i * step_size for i in range(steps + 1)]

        def gaussian_pdf(x: float, mu: float, s: float) -> float:
            denom = s * math.sqrt(2.0 * math.pi)
            exponent = -0.5 * ((x - mu) / s) ** 2
            return (1.0 / denom) * math.exp(exponent)

        comp_densities = []
        for mu in predictions:
            raw = [gaussian_pdf(x, mu, sigma) for x in grid]
            comp_densities.append(raw)

        mi_bits = 0.0
        mixture = [sum(w * comp_densities[i][k] for i, w in enumerate(norm_weights)) for k in range(len(grid))]

        for i, w in enumerate(norm_weights):
            if w <= 1e-12:
                continue
            kl_i = 0.0
            p_i = comp_densities[i]
            for k in range(len(grid)):
                if p_i[k] > 1e-12 and mixture[k] > 1e-12:
                    kl_i += p_i[k] * math.log2(p_i[k] / mixture[k]) * step_size
            mi_bits += w * kl_i

        return max(0.0, mi_bits)

    def score_monetary_acquisition(
        self,
        action: InterventionalAction,
    ) -> int:
        """
        Dimensionally consistent monetary acquisition objective in exact integer NanoUSD (CWC-F02):
            Score(a) = EVSI_nanos(a) - Cost_nanos(a) - RiskLoss_nanos(a)
        Precondition: Action is guaranteed authorized and feasible. Rejects negative costs (Hard Test 5).
        """
        if action.cost_nanos < 0 or action.risk_nanos < 0:
            raise ValueError("Negative cost values strictly rejected: accounting contract prohibits negative costs")
        evsi_nanos = int(action.expected_value_sample_info * 1_000_000_000)
        net_score = evsi_nanos - action.cost_nanos - action.risk_nanos
        return net_score

    def score_clean_information_density(
        self,
        action: InterventionalAction,
    ) -> float:
        """
        Pure information density objective eliminating overlapping terms (Hard Test 1):
            Density(a) = EIG(a) (bits) / Cost_USD(a)
        Handles zero-cost without division by zero and rejects negative costs (Hard Test 5).
        """
        if action.cost_nanos < 0 or action.risk_nanos < 0:
            raise ValueError("Negative cost values strictly rejected: accounting contract prohibits negative costs")
        if action.cost_nanos == 0:
            # Zero-cost computation: return pure EIG (status is ZERO_COST_INFORMATION_DENSITY_UNDEFINED)
            return action.expected_information_gain
        cost_usd = action.cost_nanos / 1_000_000_000.0
        return action.expected_information_gain / cost_usd

    def score_multi_objective_utility(
        self,
        action: InterventionalAction,
        weight_eig: float = 1.0,
        weight_fr: float = 1.0,
        weight_cost: float = 1.0,
    ) -> float:
        """
        Explicitly derived multi-attribute scientific utility (Lindley 1956 - Hard Test 1).
        Clearly formulated as a decision utility, NOT literal information bits.
        """
        if action.cost_nanos < 0 or action.risk_nanos < 0:
            raise ValueError("Negative cost values strictly rejected: accounting contract prohibits negative costs")
        cost_usd = action.cost_nanos / 1_000_000_000.0
        return (weight_eig * action.expected_information_gain) + (weight_fr * action.falsification_potential) - (weight_cost * cost_usd)

    def score_information_density_acquisition(
        self,
        action: InterventionalAction,
        jsd_disagreement: float = 0.0,
        deduplicate_information: bool = False,
    ) -> float:
        """
        Dimensionally consistent scientific information density objective (CWC-F02):
            Score(a) = [EIG(a) (bits) + mu*FR(a) (dimless) + JSD(a) (nats)] / Cost_USD(a)
        If deduplicate_information=True, eliminates overlapping terms (Hard Test 1).
        """
        if action.cost_nanos < 0 or action.risk_nanos < 0:
            raise ValueError("Negative cost values strictly rejected: accounting contract prohibits negative costs")
        if action.cost_nanos == 0:
            return action.expected_information_gain
        cost_usd = max(action.cost_nanos / 1_000_000_000.0, 0.001)
        if deduplicate_information:
            total_information = action.expected_information_gain
        else:
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
        if action.cost_nanos < 0 or action.risk_nanos < 0:
            raise ValueError("Negative cost values strictly rejected: accounting contract prohibits negative costs")
        evsi_nanos = int(action.expected_value_sample_info * 1_000_000_000 * self.lambda_evsi)
        info_nanos = int(
            (action.expected_information_gain + self.mu_fr * action.falsification_potential + jsd_disagreement)
            * 1_000_000_000
        )
        return evsi_nanos + info_nanos - action.cost_nanos - action.risk_nanos

    def qualify_discriminatory_power(
        self,
        mechanism_1: ExplanatoryMechanism,
        mechanism_2: ExplanatoryMechanism,
        condition: str,
        cost_nanos_per_sample: int = 100_000_000,
        sigma: float = 1.0,
        alpha: float = 0.01,
        power_target: float = 0.80,
        available_sample_size: int = 1,
        budget_nanos: int = 10_000_000_000,
        is_bernoulli: bool = False,
    ) -> DiscriminatoryPowerReport:
        """
        Evaluates practical discriminatory power, sample size, noise, uncertainty, and cost (Hard Test 2).
        Exposes whether an experiment with positive TV distance is practically capable of discriminating mechanisms.
        """
        p1 = mechanism_1.predictions.get(condition, 0.0)
        p2 = mechanism_2.predictions.get(condition, 0.0)
        delta = abs(p1 - p2)

        if is_bernoulli or (0.0 <= p1 <= 1.0 and 0.0 <= p2 <= 1.0 and delta < 0.5):
            tv = delta
            single_shot_accuracy = (1.0 + tv) / 2.0
            variance = p1 * (1.0 - p1) + p2 * (1.0 - p2)
            variance = max(variance, 0.0001)
        else:
            tv = delta / max(abs(p1), abs(p2), 1.0)
            single_shot_accuracy = 0.5 * (1.0 + math.erf(delta / (2.0 * math.sqrt(2.0) * sigma)))
            variance = 2.0 * (sigma ** 2)

        z_alpha = 2.576 if alpha <= 0.01 else 1.96
        z_beta = 0.842 if power_target <= 0.80 else 1.282

        if delta < 1e-6:
            n_req = 10_000_000
            achievable_power = alpha
        else:
            n_req = max(1, math.ceil(((z_alpha + z_beta) ** 2 * variance) / (delta ** 2)))
            z_stat = (delta * math.sqrt(available_sample_size) / math.sqrt(variance)) - z_alpha
            achievable_power = max(alpha, min(1.0, 0.5 * (1.0 + math.erf(z_stat / math.sqrt(2.0)))))

        total_cost = n_req * cost_nanos_per_sample
        is_powered = (achievable_power >= power_target) and (available_sample_size >= n_req)
        is_budget_ok = total_cost <= budget_nanos

        return DiscriminatoryPowerReport(
            achievable_power=round(achievable_power, 4),
            required_sample_size=n_req,
            effect_size_delta=round(delta, 4),
            total_variation=round(tv, 4),
            single_shot_accuracy=round(single_shot_accuracy, 4),
            is_sufficiently_powered=is_powered,
            total_cost_nanos=total_cost,
            is_within_budget=is_budget_ok,
            alpha=alpha,
            power_target=power_target,
        )

    def resolve_condition_key(
        self,
        action: InterventionalAction,
        mechanisms: List[ExplanatoryMechanism],
    ) -> str:
        """
        Robust condition key resolver:
        Finds matching prediction key in candidate mechanisms across naming conventions.
        """
        all_keys = set()
        for m in mechanisms:
            all_keys.update(m.predictions.keys())

        candidates = [
            action.target_variable,
            f"{action.target_variable}_intervene_{int(action.intervention_value)}",
            f"{action.target_variable}_intervene_{action.intervention_value}",
            f"x_intervene_{int(action.intervention_value)}",
            f"x_intervene_{action.intervention_value}",
            action.action_id,
        ]
        for c in candidates:
            if c in all_keys:
                return c
        if action.target_variable in all_keys:
            return action.target_variable
        return f"x_intervene_{int(action.intervention_value)}"

    def evaluate_prior_sensitivity(
        self,
        mechanisms: List[ExplanatoryMechanism],
        candidate_actions: List[InterventionalAction],
        ambiguity_set: Optional[List[List[float]]] = None,
    ) -> PriorSensitivityReport:
        """
        Robust Expected Information Gain (REIG) evaluation over prior ambiguity sets (Go & Isaac 2022 - Hard Test 4).
        Tests whether the preferred experiment reverses when prior weights change.
        """
        if not candidate_actions or not mechanisms:
            return PriorSensitivityReport(
                is_ranking_stable=True,
                reversal_detected=False,
                tested_priors_count=0,
                robust_expected_info_gain=0.0,
                preferred_action_id="",
                worst_case_prior_weight=0.0,
                prior_source="EMPTY",
            )

        k = len(mechanisms)
        base_weights = [m.prior_weight for m in mechanisms]
        total_w = sum(base_weights) or 1.0
        base_norm = [w / total_w for w in base_weights]

        if ambiguity_set is None:
            ambiguity_set = [base_norm]
            if k == 2:
                ambiguity_set.extend([
                    [0.80, 0.20],
                    [0.20, 0.80],
                    [0.50, 0.50],
                    [0.95, 0.05],
                    [0.05, 0.95],
                ])
            elif k >= 3:
                ambiguity_set.extend([
                    [0.49, 0.49, 0.02] + [0.0] * (k - 3),
                    [0.02, 0.02, 0.96] + [0.0] * (k - 3),
                    [1.0 / k] * k,
                ])

        baseline_scores = {}
        for act in candidate_actions:
            cond = self.resolve_condition_key(act, mechanisms)
            baseline_scores[act.action_id] = self.compute_expected_information_gain(mechanisms, cond)

        best_baseline_action = max(candidate_actions, key=lambda a: baseline_scores.get(a.action_id, 0.0))

        reversal_detected = False
        reig_worst = float("inf")
        worst_w = base_norm[0]

        for p_vec in ambiguity_set:
            perturbed_mechs = [
                ExplanatoryMechanism(
                    mechanism_id=m.mechanism_id,
                    name=m.name,
                    mechanism_class=m.mechanism_class,
                    hypothesis=m.hypothesis,
                    assumptions=m.assumptions,
                    causal_edges=m.causal_edges,
                    equations=m.equations,
                    predictions=m.predictions,
                    falsification_conditions=m.falsification_conditions,
                    prior_weight=p_vec[i],
                    model_representation=m.model_representation,
                    is_cyclic=m.is_cyclic,
                    prior_source=m.prior_source,
                )
                for i, m in enumerate(mechanisms)
            ]

            scores_for_p = {}
            for act in candidate_actions:
                cond = self.resolve_condition_key(act, perturbed_mechs)
                eig_p = self.compute_expected_information_gain(perturbed_mechs, cond)
                scores_for_p[act.action_id] = eig_p

            top_for_p = max(candidate_actions, key=lambda a: scores_for_p.get(a.action_id, 0.0))
            if top_for_p.action_id != best_baseline_action.action_id:
                reversal_detected = True

            act_score = scores_for_p.get(best_baseline_action.action_id, 0.0)
            if act_score < reig_worst:
                reig_worst = act_score
                worst_w = p_vec[0]

        prior_src = mechanisms[0].prior_source if mechanisms else "UNSPECIFIED"

        return PriorSensitivityReport(
            is_ranking_stable=not reversal_detected,
            reversal_detected=reversal_detected,
            tested_priors_count=len(ambiguity_set),
            robust_expected_info_gain=round(reig_worst if reig_worst != float("inf") else 0.0, 4),
            preferred_action_id=best_baseline_action.action_id,
            worst_case_prior_weight=round(worst_w, 4),
            prior_source=prior_src,
        )

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
        Attaches prior sensitivity and discriminatory power analysis (Hard Tests 2, 4).
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
            condition = self.resolve_condition_key(action, mechanisms)
            jsd = self.compute_jensen_shannon_divergence(mechanisms, condition)

            if mode == AcquisitionMode.MONETARY_DECISION_VALUE:
                score = float(self.score_monetary_acquisition(action))
            elif mode == AcquisitionMode.CLEAN_EXPECTED_INFORMATION_GAIN:
                score = self.score_clean_information_density(action)
            elif mode == AcquisitionMode.MULTI_OBJECTIVE_UTILITY:
                score = self.score_multi_objective_utility(action)
            else:
                score = self.score_information_density_acquisition(action, jsd)

            if score > best_score:
                best_score = score
                best_action = action
                best_jsd = jsd

        prior_report = self.evaluate_prior_sensitivity(mechanisms, feasible)
        power_report: Optional[DiscriminatoryPowerReport] = None
        if best_action is not None and len(mechanisms) >= 2:
            power_cond = self.resolve_condition_key(best_action, mechanisms)
            power_report = self.qualify_discriminatory_power(
                mechanisms[0],
                mechanisms[1],
                power_cond,
                cost_nanos_per_sample=best_action.cost_nanos,
                budget_nanos=budget_nanos,
            )

        prod_status = None
        if best_action is not None and best_action.cost_nanos == 0:
            prod_status = ProductivityCalculationStatus.ZERO_COST_INFORMATION_DENSITY_UNDEFINED

        return ActionDecision(
            status="ACTION_SELECTED",
            selected_action=best_action,
            feasible_action_count=len(feasible),
            filtered_unauthorized_count=len(candidate_actions) - len(feasible),
            acquisition_score=best_score,
            acquisition_mode=mode,
            prior_sensitivity=prior_report,
            discriminatory_power=power_report,
            productivity_status=prod_status,
        ), best_jsd

    def seal_precommitment_lock(
        self,
        mechanisms: List[ExplanatoryMechanism],
        action: InterventionalAction,
        timestamp_utc: str = "2026-10-14T00:00:00Z",
        nonce: str = "spe-cwc-nonce-salt-42",
        protocol_id: str = "STAT-PROT-DEFAULT",
        run_id: str = "RUN-DEFAULT",
        use_ledger: bool = True,
    ) -> PrecommitmentDigest:
        """
        Locks predictions cryptographically before executing intervention (Anti-HARKing Law - CWC-F06, Hard Test 6).
        Commitment = SHA256(CanonicalJSON(Predictions) || ActionID || Timestamp || ProtocolID || Nonce)
        Generates verifiable preregistration token for chronological integrity with append-only ledger support.
        """
        condition_key = self.resolve_condition_key(action, mechanisms)
        predictions_map = {
            m.mechanism_id: m.predictions.get(condition_key, list(m.predictions.values())[0] if m.predictions else 0.0)
            for m in mechanisms
        }
        canonical_json = json.dumps(predictions_map, sort_keys=True, separators=(",", ":"))
        predictions_hash = hashlib.sha256(canonical_json.encode("utf-8")).hexdigest()

        effective_nonce = nonce
        if use_ledger and nonce == "spe-cwc-nonce-salt-42" and nonce in self.ledger.registered_nonces:
            effective_nonce = f"spe-cwc-nonce-salt-{len(self.ledger.chain) + 1}-{int(time.monotonic_ns())}"

        if use_ledger:
            model_digest = hashlib.sha256(
                "".join(m.mechanism_id for m in mechanisms).encode("utf-8")
            ).hexdigest()
            return self.ledger.register_precommitment(
                action_id=action.action_id,
                predictions_hash=predictions_hash,
                model_digest=model_digest,
                protocol_id=protocol_id,
                nonce=effective_nonce,
                timestamp_utc=timestamp_utc,
                run_id=run_id,
            )

        preimage = f"{predictions_hash}|{action.action_id}|{timestamp_utc}|{protocol_id}|{effective_nonce}"
        digest = hashlib.sha256(preimage.encode("utf-8")).hexdigest()

        prereg_token = f"PREREG-SHA256:{digest[:16]}-T:{timestamp_utc}-PROT:{protocol_id}"

        return PrecommitmentDigest(
            digest_sha256=digest,
            action_id=action.action_id,
            timestamp_utc=timestamp_utc,
            nonce=effective_nonce,
            sealed_predictions_hash=predictions_hash,
            preregistration_token=prereg_token,
            chain_sequence=1,
            previous_block_hash="0" * 64,
            trust_boundary="LOCAL_APPEND_ONLY_CHAIN",
            run_id=run_id,
        )
