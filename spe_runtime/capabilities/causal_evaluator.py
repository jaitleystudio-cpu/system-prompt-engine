"""Wald Sequential Causal Evaluator for Capability Qualification (SPRT + LCB95)."""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Callable, Dict, List, Optional, Tuple

from spe_runtime.capabilities.capsule import (
    AdmissionState,
    CapabilityCapsule,
    CausalInterventions,
)
from spe_runtime.capabilities.sandbox import CapabilitySandbox


@dataclass(frozen=True)
class TrialObservation:
    task_id: str
    active_success: bool
    baseline_success: bool
    placebo_success: bool


@dataclass(frozen=True)
class EvaluationReport:
    accepted: bool
    early_stopped: bool
    trials_evaluated: int
    active_success_rate: float
    baseline_success_rate: float
    placebo_success_rate: float
    delta: float
    lcb_95_delta: float
    stopping_reason: str


class WaldCausalEvaluator:
    """Evaluates candidate capabilities using Wald Sequential Probability Ratio Testing.

    Guarantees early termination on defective or non-performing capabilities
    to protect the user's inference budget.
    """

    def __init__(
        self,
        min_delta: float = 0.15,
        alpha: float = 0.05,
        beta: float = 0.10,
        max_trials: int = 40,
    ) -> None:
        self.min_delta = min_delta
        self.alpha = alpha
        self.beta = beta
        self.max_trials = max_trials

        # Wald boundary thresholds in log-space
        self.upper_bound = math.log((1.0 - beta) / alpha)
        self.lower_bound = math.log(beta / (1.0 - alpha))

    @staticmethod
    def calculate_lcb95(p1: float, n1: int, p0: float, n0: int) -> float:
        """Calculate 95% one-sided Lower Confidence Bound on difference of proportions."""
        if n1 == 0 or n0 == 0:
            return 0.0
        delta = p1 - p0
        # Standard error of difference
        var1 = (p1 * (1.0 - p1)) / n1 if n1 > 0 else 0.0
        var0 = (p0 * (1.0 - p0)) / n0 if n0 > 0 else 0.0
        se = math.sqrt(max(1e-9, var1 + var0))
        z_95 = 1.645  # One-sided 95% confidence
        return round(delta - (z_95 * se), 4)

    def evaluate_observations(
        self,
        observations: List[TrialObservation],
    ) -> EvaluationReport:
        """Run sequential Wald evaluation on a stream of paired observations."""
        log_likelihood_ratio = 0.0
        active_wins = 0
        baseline_wins = 0
        placebo_wins = 0
        trials_count = 0
        early_stopped = False
        stopping_reason = "Max trials reached"
        accepted = False

        for obs in observations:
            trials_count += 1
            if obs.active_success:
                active_wins += 1
            if obs.baseline_success:
                baseline_wins += 1
            if obs.placebo_success:
                placebo_wins += 1

            # Paired comparison score
            # +1 if active succeeded and baseline failed
            # -1 if baseline succeeded and active failed
            # 0 if both tied
            if obs.active_success and not obs.baseline_success:
                log_likelihood_ratio += 1.4
            elif not obs.active_success and obs.baseline_success:
                log_likelihood_ratio -= 1.8
            elif not obs.active_success and not obs.baseline_success:
                # Active failure on an open problem penalizes synthetic candidate
                log_likelihood_ratio -= 0.6

            # Check Wald Early-Stopping bounds
            if log_likelihood_ratio <= self.lower_bound:
                early_stopped = True
                stopping_reason = f"Wald early-rejection threshold breached at trial {trials_count}"
                accepted = False
                break
            elif log_likelihood_ratio >= self.upper_bound and trials_count >= 5:
                early_stopped = True
                stopping_reason = f"Wald early-acceptance threshold reached at trial {trials_count}"
                accepted = True
                break

        active_rate = active_wins / trials_count if trials_count > 0 else 0.0
        baseline_rate = baseline_wins / trials_count if trials_count > 0 else 0.0
        placebo_rate = placebo_wins / trials_count if trials_count > 0 else 0.0
        delta = active_rate - baseline_rate
        lcb = self.calculate_lcb95(active_rate, trials_count, baseline_rate, trials_count)

        # Placebo integrity check applies if not already rejected by Wald bounds
        if not early_stopped:
            if active_rate <= placebo_rate:
                accepted = False
                stopping_reason = "Failed placebo integrity test: candidate does not exceed random feedback"
            else:
                accepted = (lcb >= self.min_delta)
                stopping_reason = "Qualification met frozen delta requirement" if accepted else "LCB95 below delta"
        elif accepted and active_rate <= placebo_rate:
            accepted = False
            stopping_reason = "Failed placebo integrity test: candidate does not exceed random feedback"

        return EvaluationReport(
            accepted=accepted,
            early_stopped=early_stopped,
            trials_evaluated=trials_count,
            active_success_rate=round(active_rate, 4),
            baseline_success_rate=round(baseline_rate, 4),
            placebo_success_rate=round(placebo_rate, 4),
            delta=round(delta, 4),
            lcb_95_delta=lcb,
            stopping_reason=stopping_reason,
        )

    def qualify_and_update_capsule(
        self,
        capsule: CapabilityCapsule,
        observations: List[TrialObservation],
    ) -> EvaluationReport:
        """Evaluate observations and update capsule lifecycle state and intervention records."""
        report = self.evaluate_observations(observations)

        # Update interventions struct
        new_interventions = CausalInterventions(
            trial_count=report.trials_evaluated,
            active_success_rate=report.active_success_rate,
            baseline_success_rate=report.baseline_success_rate,
            placebo_success_rate=report.placebo_success_rate,
            lcb_95_delta=report.lcb_95_delta,
            early_stopped=report.early_stopped,
        )
        capsule.interventions = new_interventions

        if report.accepted:
            if capsule.admission_state in {AdmissionState.HYPOTHESIS, AdmissionState.STRUCTURALLY_VALID}:
                if capsule.admission_state == AdmissionState.HYPOTHESIS:
                    capsule.transition_to(AdmissionState.STRUCTURALLY_VALID, "Structural pass")
                capsule.transition_to(AdmissionState.BEHAVIORALLY_QUALIFIED, report.stopping_reason)
        else:
            capsule.transition_to(AdmissionState.REJECTED, report.stopping_reason)

        return report
