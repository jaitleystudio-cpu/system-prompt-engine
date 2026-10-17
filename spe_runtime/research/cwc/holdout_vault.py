"""
Sealed Holdout Vault & Benchmark Contamination Prevention Gate (Hard Test 14).
Protects evaluation integrity by sealing test benchmarks, logging all exposures,
and enforcing strict single-look evaluation budgets.
"""

from __future__ import annotations
import hashlib
import json
import time
from typing import Any, Callable, Dict, List, Optional, Tuple


class SealedHoldoutVault:
    """
    Cryptographically sealed vault for holdout scientific benchmarks (Hard Test 14).
    Prevents benchmark overfitting, retrieval contamination, and prompt leakage.
    """

    def __init__(
        self,
        benchmark_name: str,
        test_cases: List[Dict[str, Any]],
        max_exposures: int = 1,
        evaluator_authority_token: str = "AUTH-EVALUATOR-INDEPENDENT",
    ):
        self.benchmark_name = benchmark_name
        self._test_cases = test_cases
        self.max_exposures = max_exposures
        self.evaluator_authority_token = evaluator_authority_token
        self.exposure_count = 0
        self.exposure_log: List[Dict[str, Any]] = []

        # Compute tamper-evident seal of holdout cases
        cases_json = json.dumps(test_cases, sort_keys=True, separators=(",", ":"))
        self.seal_sha256 = hashlib.sha256(cases_json.encode("utf-8")).hexdigest()

    def evaluate_holdout(
        self,
        model_eval_fn: Callable[[Dict[str, Any]], float],
        caller_authority_token: str,
        caller_id: str = "INDEPENDENT_EVALUATOR",
    ) -> Dict[str, Any]:
        """
        Executes a sealed holdout evaluation under strict exposure budget.
        Raises PermissionError if exposure limit is exceeded or if untrusted caller attempts access.
        """
        if caller_authority_token != self.evaluator_authority_token:
            raise PermissionError(
                f"HOLDOUT_CONTAMINATION_PREVENTED: Caller '{caller_id}' lacks independent evaluator authority"
            )

        if self.exposure_count >= self.max_exposures:
            raise PermissionError(
                f"HOLDOUT_CONTAMINATION_PREVENTED: Holdout benchmark '{self.benchmark_name}' has reached "
                f"its maximum exposure budget ({self.max_exposures}). Permanently sealed against contamination."
            )

        self.exposure_count += 1
        scores = []
        for case in self._test_cases:
            pred = model_eval_fn(case)
            true_y = case.get("expected_y", 0.0)
            err = abs(pred - true_y) / max(abs(true_y), 1.0)
            scores.append(1.0 if err <= 0.15 else 0.0)

        pass_rate = sum(scores) / len(scores) if scores else 0.0

        receipt = {
            "benchmark_name": self.benchmark_name,
            "seal_sha256": self.seal_sha256,
            "exposure_number": self.exposure_count,
            "caller_id": caller_id,
            "pass_rate": pass_rate,
            "cases_evaluated": len(self._test_cases),
            "timestamp_ns": time.monotonic_ns(),
        }
        self.exposure_log.append(receipt)
        return receipt

    def get_audit_receipt(self) -> Dict[str, Any]:
        """Returns the complete tamper-evident audit record of holdout exposures."""
        return {
            "benchmark_name": self.benchmark_name,
            "seal_sha256": self.seal_sha256,
            "exposure_count": self.exposure_count,
            "max_exposures": self.max_exposures,
            "is_exhausted": self.exposure_count >= self.max_exposures,
            "log": list(self.exposure_log),
        }
