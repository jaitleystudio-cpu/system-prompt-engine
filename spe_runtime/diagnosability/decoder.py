"""Bayesian Syndrome Decoder with Open-World Rejection and Multi-Fault Sparsity."""

from __future__ import annotations

import math
from typing import Dict, List, Optional

from spe_runtime.diagnosability.models import (
    DiagnosticResult,
    SemanticChannelMatrix,
)


class BayesianSyndromeDecoder:
    """Decodes observed sensor syndromes into root failure classes under uncertainty."""

    def __init__(self, open_world_threshold: float = 0.50, min_log_likelihood_per_sensor: float = -2.5):
        self.open_world_threshold = open_world_threshold
        self.min_log_likelihood_per_sensor = min_log_likelihood_per_sensor

    def decode(
        self,
        syndrome: Dict[str, float],
        channel: SemanticChannelMatrix,
        cost_incurred: float = 0.0,
        executed_probes: Optional[List[str]] = None,
    ) -> DiagnosticResult:
        """Decode a syndrome observation vector into posterior fault distributions."""
        if not syndrome or not channel.faults:
            return DiagnosticResult(
                decoded_fault="UNKNOWN_FAULT_FAMILY",
                confidence=0.0,
                is_unknown_family=True,
                posterior_probabilities={},
                executed_probes=executed_probes or [],
                total_diagnostic_cost_usd=cost_incurred,
            )

        log_posteriors: Dict[str, float] = {}
        log_likelihoods: Dict[str, float] = {}

        # Prior log odds and data likelihood
        for fault in channel.faults:
            fid = fault.fault_id
            prior = max(1e-5, min(1.0 - 1e-5, fault.prior_probability))
            log_prior = math.log(prior)

            # Likelihood across observed sensors
            f_table = channel.likelihood_table.get(fid, {})
            log_lik = 0.0
            for sensor_id, obs_val in syndrome.items():
                p_active = f_table.get(sensor_id, 0.05)
                p_active = max(1e-4, min(1.0 - 1e-4, p_active))

                # Continuous soft log-likelihood
                log_lik += obs_val * math.log(p_active) + (1.0 - obs_val) * math.log(1.0 - p_active)

            log_likelihoods[fid] = log_lik
            log_posteriors[fid] = log_prior + log_lik

        # Softmax normalization to compute posterior probabilities P(F_i | S)
        max_log = max(log_posteriors.values()) if log_posteriors else 0.0
        exp_sum = sum(math.exp(lp - max_log) for lp in log_posteriors.values())
        posteriors: Dict[str, float] = {}
        for fid, lp in log_posteriors.items():
            posteriors[fid] = round(math.exp(lp - max_log) / exp_sum, 4)

        # Sort faults by posterior probability
        sorted_faults = sorted(posteriors.items(), key=lambda kv: kv[1], reverse=True)
        top_fault, top_prob = sorted_faults[0] if sorted_faults else (None, 0.0)

        # Goodness-of-fit per sensor under top fault
        top_lik = log_likelihoods.get(top_fault, 0.0)
        avg_log_lik = top_lik / len(syndrome) if syndrome else 0.0

        # Open-World Fault Detection:
        # Either posterior is below threshold (ambiguity) OR goodness-of-fit is below plausibility
        if top_prob < self.open_world_threshold or avg_log_lik < self.min_log_likelihood_per_sensor:
            return DiagnosticResult(
                decoded_fault="UNKNOWN_FAULT_FAMILY",
                confidence=top_prob,
                is_unknown_family=True,
                posterior_probabilities=posteriors,
                multi_fault_set=None,
                executed_probes=executed_probes or list(syndrome.keys()),
                total_diagnostic_cost_usd=cost_incurred,
            )

        # Multi-fault detection: check if second fault also has elevated posterior
        multi_set = [top_fault]
        if len(sorted_faults) > 1:
            second_fault, second_prob = sorted_faults[1]
            if second_prob >= 0.25 and (top_prob - second_prob) < 0.20:
                multi_set.append(second_fault)

        return DiagnosticResult(
            decoded_fault=top_fault,
            confidence=top_prob,
            is_unknown_family=False,
            posterior_probabilities=posteriors,
            multi_fault_set=multi_set if len(multi_set) > 1 else None,
            executed_probes=executed_probes or list(syndrome.keys()),
            total_diagnostic_cost_usd=cost_incurred,
        )
