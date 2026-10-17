"""
SPE Ω — Verified Successful Outcomes per Dollar (VSOD) Calculator
October 12, 2026 | Research Quarantine Track
"""

from __future__ import annotations
from typing import Dict, Any

from spe_runtime.research.egac.types import NANOS_PER_USD, VsodMetrics

class VsodCalculator:
    """
    Computes the scientific breakthrough metric:
    VSOD = N_verified_successes / C_total_execution (in USD)
    with exact integer NanoUSD arithmetic.
    """

    @staticmethod
    def calculate_vsod(
        n_verified_successes: int,
        total_cost_nanos: int,
        tokens_saved: int = 0,
        latency_p95_ms: int = 0,
        critical_failures: int = 0,
    ) -> VsodMetrics:
        """
        Calculates VSOD and returns structured metrics.
        """
        if total_cost_nanos <= 0:
            total_cost_nanos = 1  # Guard against division by zero

        total_cost_usd = float(total_cost_nanos) / float(NANOS_PER_USD)
        vsod_score = (float(n_verified_successes) * float(NANOS_PER_USD)) / float(total_cost_nanos)

        return VsodMetrics(
            n_verified_successes=n_verified_successes,
            total_cost_nanos=total_cost_nanos,
            total_cost_usd=round(total_cost_usd, 6),
            vsod_score=round(vsod_score, 4),
            tokens_saved=tokens_saved,
            latency_p95_ms=latency_p95_ms,
            critical_failures=critical_failures,
        )

    @staticmethod
    def compare_systems(
        baseline: VsodMetrics,
        treatment: VsodMetrics,
    ) -> Dict[str, Any]:
        """
        Performs head-to-head comparison between two inference regimes.
        """
        vsod_gain_pct = (
            ((treatment.vsod_score - baseline.vsod_score) / max(0.0001, baseline.vsod_score)) * 100.0
        )
        cost_savings_nanos = baseline.total_cost_nanos - treatment.total_cost_nanos
        cost_savings_pct = (
            (float(cost_savings_nanos) / max(1.0, float(baseline.total_cost_nanos))) * 100.0
        )

        is_superior = (
            treatment.vsod_score > baseline.vsod_score
            and treatment.critical_failures <= baseline.critical_failures
        )

        return {
            "baseline_vsod": baseline.vsod_score,
            "treatment_vsod": treatment.vsod_score,
            "vsod_gain_pct": round(vsod_gain_pct, 2),
            "cost_savings_nanos": cost_savings_nanos,
            "cost_savings_pct": round(cost_savings_pct, 2),
            "is_superior": is_superior,
            "treatment_critical_failures": treatment.critical_failures,
        }
