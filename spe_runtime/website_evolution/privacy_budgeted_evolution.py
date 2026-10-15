"""SPE Ω — Privacy-Budgeted Evolution & Telemetry Minimization Python Runtime
Crown Breakthrough Capability #3

Epistemic Grounding:
- A Privacy Budgeting Framework for Online Experimentation (arXiv:2608.19944, 2026)
- ST-WebAgentBench (ICLR 2026)
- OpenTelemetry Browser Semantic Conventions (2026)
"""

from __future__ import annotations
import math
import random
import hashlib
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from typing import Optional, Dict, Any, Tuple


@dataclass
class MeasurementRequirementPy:
    query_id: str
    question: str
    target_route: str
    metric_type: str  # "COUNT", "CONVERSION_RATE", "LATENCY_BUCKET", "BINARY_TASK_SUCCESS"
    sensitivity_delta: float
    requested_epsilon: float


@dataclass
class MinimizedTelemetryRecordPy:
    record_id: str
    schema_version: str
    route: str
    coarse_viewport: str  # "MOBILE", "TABLET", "DESKTOP"
    latency_bucket: str    # "SUB_100MS", "100_TO_500MS", "500_TO_2000MS", "ABOVE_2000MS"
    task_completed: bool
    feature_engaged: str
    payload_byte_size: int


@dataclass
class PrivacyBudgetStatusPy:
    max_cumulative_epsilon: float
    consumed_epsilon: float
    remaining_epsilon: float
    consumed_delta: float
    experiments_executed: int
    is_budget_exhausted: bool


@dataclass
class PrivacyAuditReceiptPy:
    receipt_id: str
    timestamp: str
    consent_state: str  # "GRANTED", "DENIED", "UNSET"
    egress_permitted: bool
    raw_payload_blocked: bool
    pii_detected: bool
    budget_status: PrivacyBudgetStatusPy
    sanitized_digest: str


class PrivacyBudgetedEvolutionPy:
    """Differential privacy budget manager and telemetry minimization compiler."""

    def __init__(self, max_cumulative_epsilon: float = 1.0) -> None:
        self.max_cumulative_epsilon = max_cumulative_epsilon
        self.consumed_epsilon = 0.0
        self.consumed_delta = 0.0
        self.experiments_executed = 0
        self.local_preferences: Dict[str, str] = {}

    def compile_minimal_telemetry(
        self,
        route: str,
        raw_viewport_width: int,
        raw_latency_ms: float,
        task_completed: bool,
        feature_engaged: str,
        consent_state: str,
        raw_user_input_text: Optional[str] = None,
        client_ip_address: Optional[str] = None,
        cookie_header: Optional[str] = None,
    ) -> Tuple[Optional[MinimizedTelemetryRecordPy], PrivacyAuditReceiptPy]:
        is_consent = consent_state == "GRANTED"
        pii_present = bool(raw_user_input_text or client_ip_address or cookie_header)

        if not is_consent:
            receipt = PrivacyAuditReceiptPy(
                receipt_id=f"audit-py-{int(datetime.now().timestamp()):x}",
                timestamp=datetime.now(timezone.utc).isoformat(),
                consent_state=consent_state,
                egress_permitted=False,
                raw_payload_blocked=True,
                pii_detected=pii_present,
                budget_status=self.get_budget_status(),
                sanitized_digest="sha256:zero-egress-consent-withheld",
            )
            return None, receipt

        coarse_vp = "DESKTOP"
        if raw_viewport_width < 640:
            coarse_vp = "MOBILE"
        elif raw_viewport_width < 1024:
            coarse_vp = "TABLET"

        lat_bucket = "SUB_100MS"
        if raw_latency_ms >= 2000:
            lat_bucket = "ABOVE_2000MS"
        elif raw_latency_ms >= 500:
            lat_bucket = "500_TO_2000MS"
        elif raw_latency_ms >= 100:
            lat_bucket = "100_TO_500MS"

        clean_route = route.split("?")[0]
        record = MinimizedTelemetryRecordPy(
            record_id=f"rec-py-{int(datetime.now().timestamp()):x}",
            schema_version="v1-minimized",
            route=clean_route,
            coarse_viewport=coarse_vp,
            latency_bucket=lat_bucket,
            task_completed=bool(task_completed),
            feature_engaged=feature_engaged[:32],
            payload_byte_size=0,
        )

        record.payload_byte_size = len(repr(asdict(record)).encode())

        receipt = PrivacyAuditReceiptPy(
            receipt_id=f"audit-py-{int(datetime.now().timestamp()):x}",
            timestamp=datetime.now(timezone.utc).isoformat(),
            consent_state=consent_state,
            egress_permitted=True,
            raw_payload_blocked=False,
            pii_detected=pii_present,
            budget_status=self.get_budget_status(),
            sanitized_digest=hashlib.sha256(repr(asdict(record)).encode()).hexdigest()[:16],
        )

        return record, receipt

    def execute_differentially_private_aggregate(
        self, req: MeasurementRequirementPy, raw_aggregate_value: float
    ) -> Tuple[float, float, PrivacyBudgetStatusPy]:
        if req.requested_epsilon <= 0 or req.sensitivity_delta <= 0:
            raise ValueError(
                "INVALID_PRIVACY_PARAMETER: requested_epsilon and sensitivity_delta must be strictly positive."
            )

        if self.consumed_epsilon + req.requested_epsilon > self.max_cumulative_epsilon:
            raise ValueError(
                f"PRIVACY_BUDGET_EXHAUSTED: Requested epsilon {req.requested_epsilon:.2f} "
                f"exceeds remaining budget {self.max_cumulative_epsilon - self.consumed_epsilon:.2f}."
            )

        self.consumed_epsilon += req.requested_epsilon
        self.consumed_delta += 1e-5
        self.experiments_executed += 1

        scale = req.sensitivity_delta / req.requested_epsilon
        noise = self._sample_laplace(0, scale)
        perturbed = round(raw_aggregate_value + noise, 2)

        return perturbed, req.requested_epsilon, self.get_budget_status()

    def apply_randomized_response(self, true_value: bool, epsilon: float = 0.5) -> bool:
        p = math.exp(epsilon) / (1.0 + math.exp(epsilon))
        u = random.random()
        return true_value if u < p else not true_value

    def set_local_preference(self, key: str, value: str) -> None:
        self.local_preferences[key] = value

    def get_local_preference(self, key: str) -> Optional[str]:
        return self.local_preferences.get(key)

    def get_budget_status(self) -> PrivacyBudgetStatusPy:
        remaining = max(0.0, self.max_cumulative_epsilon - self.consumed_epsilon)
        return PrivacyBudgetStatusPy(
            max_cumulative_epsilon=self.max_cumulative_epsilon,
            consumed_epsilon=round(self.consumed_epsilon, 3),
            remaining_epsilon=round(remaining, 3),
            consumed_delta=self.consumed_delta,
            experiments_executed=self.experiments_executed,
            is_budget_exhausted=remaining <= 0.001,
        )

    def _sample_laplace(self, mu: float, b: float) -> float:
        raw_u = random.random() - 0.5
        safe_abs_u = min(0.499999999999999, abs(raw_u))
        arg = max(1e-15, 1.0 - 2.0 * safe_abs_u)
        sign = 1 if raw_u > 0 else (-1 if raw_u < 0 else 0)
        return mu - b * sign * math.log(arg)
