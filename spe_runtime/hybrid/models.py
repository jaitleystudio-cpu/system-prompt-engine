"""Data models and contracts for SPE Ω Hybrid Execution Switchboard & Device Qualification."""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
import hashlib
import json
import time
from typing import Any, Dict, List, Optional

from spe_runtime.cost_engine.telemetry import (
    CostSource,
    TelemetryEvidence,
)


class PlacementTarget(str, Enum):
    """Where a task or subtask is placed for physical execution."""
    LOCAL_DETERMINISTIC = "LOCAL_DETERMINISTIC"  # $0 cloud, deterministic AST / compiler / validator / math
    LOCAL_NEURAL = "LOCAL_NEURAL"                # $0 cloud tokens, runs on user's local device/engine
    HYBRID_SPLIT = "HYBRID_SPLIT"                # Local preprocessing/validation + cloud-authorized reasoning
    CLOUD_AUTHORIZED = "CLOUD_AUTHORIZED"        # Authorized remote cloud provider with escrow
    LOCAL_RECOVERY = "LOCAL_RECOVERY"            # Fallback deterministic response when cloud fails or blocked
    BLOCKED = "BLOCKED"                          # Blocked due to policy, budget, privacy, or missing authority


class HybridPolicy(str, Enum):
    """Governs whether and how cloud tokens can be released."""
    STRICT_OFFLINE = "STRICT_OFFLINE"            # $0 spend, 0 network egress, air-gapped guarantee
    APPROVAL_REQUIRED = "APPROVAL_REQUIRED"      # Cloud requires per-task authorization token
    BOUNDED_HYBRID = "BOUNDED_HYBRID"            # Cloud permitted within standing budget limit & provider allowlist


class DataDisclosureScope(str, Enum):
    """Permitted scope of data transmission."""
    LOCAL_ONLY = "LOCAL_ONLY"                    # Zero sensitive or raw data may leave device
    ANONYMIZED_AGGREGATES = "ANONYMIZED_AGGREGATES"  # Only anonymized summary aggregates may leave
    FULL_PAYLOAD = "FULL_PAYLOAD"                # Full prompt payload permitted to approved provider


@dataclass(frozen=True)
class QualificationVerdict:
    """The honest verdict of device qualification for a specific task."""
    qualified: bool
    recommended_target: PlacementTarget
    reason: str
    memory_sufficient: bool
    compute_sufficient: bool
    battery_sufficient: bool
    thermal_ok: bool
    confidence_score: float  # 0.0 - 1.0


@dataclass
class DeviceCapabilityProfile:
    """Observed or calibrated capability profile of user's device (phone/PC/server)."""
    device_id: str
    platform: str                                # macos, linux, windows, ios, android, web
    cpu_architecture: str                        # arm64, x86_64, etc.
    total_memory_mb: int
    available_memory_mb: int
    has_gpu_or_npu: bool
    gpu_device_name: Optional[str] = None
    battery_percentage: Optional[float] = None  # None if desktop/AC-only
    is_charging: bool = True
    is_thermal_throttled: bool = False
    installed_local_models: List[str] = field(default_factory=list)
    measured_local_tok_per_sec: float = 0.0
    max_context_tokens_local: int = 4096
    last_calibrated_iso: str = ""
    evidence_class: TelemetryEvidence = TelemetryEvidence.CALIBRATED_ESTIMATE

    def qualify_for_task(
        self,
        task_complexity_score: float,
        context_tokens: int,
        min_ram_mb: int = 2048,
    ) -> QualificationVerdict:
        """Determines if the local device is capable of completing this task without cloud tokens."""
        # 1. Thermal & Battery safety check
        if self.is_thermal_throttled:
            return QualificationVerdict(
                qualified=False,
                recommended_target=PlacementTarget.CLOUD_AUTHORIZED,
                reason="Device is thermally throttled; offloading neural compute to prevent degradation.",
                memory_sufficient=True,
                compute_sufficient=False,
                battery_sufficient=True,
                thermal_ok=False,
                confidence_score=0.95,
            )

        if self.battery_percentage is not None and self.battery_percentage < 15.0 and not self.is_charging:
            return QualificationVerdict(
                qualified=False,
                recommended_target=PlacementTarget.CLOUD_AUTHORIZED,
                reason="Battery is below 15% and discharging; local neural inference disabled to conserve power.",
                memory_sufficient=True,
                compute_sufficient=False,
                battery_sufficient=False,
                thermal_ok=True,
                confidence_score=0.98,
            )

        # 2. Memory check
        memory_ok = self.available_memory_mb >= min_ram_mb
        if not memory_ok:
            return QualificationVerdict(
                qualified=False,
                recommended_target=PlacementTarget.CLOUD_AUTHORIZED,
                reason=f"Insufficient available RAM ({self.available_memory_mb} MB available, {min_ram_mb} MB required).",
                memory_sufficient=False,
                compute_sufficient=True,
                battery_sufficient=True,
                thermal_ok=True,
                confidence_score=0.99,
            )

        # 3. Context window check
        if context_tokens > self.max_context_tokens_local:
            return QualificationVerdict(
                qualified=False,
                recommended_target=PlacementTarget.CLOUD_AUTHORIZED,
                reason=f"Context tokens ({context_tokens}) exceed local model limit ({self.max_context_tokens_local}).",
                memory_sufficient=True,
                compute_sufficient=False,
                battery_sufficient=True,
                thermal_ok=True,
                confidence_score=0.90,
            )

        # 4. Model availability & task complexity check
        has_local_model = len(self.installed_local_models) > 0
        if not has_local_model:
            return QualificationVerdict(
                qualified=False,
                recommended_target=PlacementTarget.CLOUD_AUTHORIZED,
                reason="No qualified local neural models installed on device.",
                memory_sufficient=True,
                compute_sufficient=False,
                battery_sufficient=True,
                thermal_ok=True,
                confidence_score=1.0,
            )

        # High complexity (> 0.75) might exceed local small/medium model capability
        if task_complexity_score > 0.75:
            return QualificationVerdict(
                qualified=False,
                recommended_target=PlacementTarget.HYBRID_SPLIT,
                reason=f"Task complexity ({task_complexity_score:.2f}) exceeds local model capability frontier; recommend hybrid split.",
                memory_sufficient=True,
                compute_sufficient=False,
                battery_sufficient=True,
                thermal_ok=True,
                confidence_score=0.85,
            )

        # Device is fully qualified for local execution!
        return QualificationVerdict(
            qualified=True,
            recommended_target=PlacementTarget.LOCAL_NEURAL,
            reason="Device hardware, memory, thermal state, and installed models qualify for local execution.",
            memory_sufficient=True,
            compute_sufficient=True,
            battery_sufficient=True,
            thermal_ok=True,
            confidence_score=0.92,
        )


@dataclass
class TaskRequirement:
    """Requirements extracted from the user's intent."""
    task_id: str
    prompt: str
    estimated_tokens: int
    complexity_score: float  # 0.0 = trivial math/format, 1.0 = deep multi-hop reasoning
    required_capabilities: List[str] = field(default_factory=list)
    contains_sensitive_data: bool = False
    max_acceptable_latency_ms: float = 30000.0


@dataclass
class BudgetEscrowReservation:
    """Reserved financial escrow prior to cloud token dispatch."""
    escrow_id: str
    task_id: str
    reserved_usd: float
    timestamp_iso: str
    committed: bool = False
    released: bool = False


@dataclass
class ExecutionPlacementPlan:
    """The formal placement plan determining where each piece executes."""
    plan_id: str
    task_id: str
    target: PlacementTarget
    policy: HybridPolicy
    disclosure_scope: DataDisclosureScope
    estimated_cost_usd: float
    escrow_id: Optional[str] = None
    local_backend_url: Optional[str] = None
    cloud_provider: Optional[str] = None
    cloud_model_id: Optional[str] = None
    subtask_splits: List[Dict[str, Any]] = field(default_factory=list)
    justification: str = ""


@dataclass(frozen=True)
class ExecutionPlacementCertificate:
    """Independently auditable certificate explaining why execution was routed."""
    certificate_id: str
    plan_id: str
    task_id: str
    selected_target: PlacementTarget
    policy: HybridPolicy
    budget_spent_usd: float
    budget_remaining_usd: float
    evidence_class: TelemetryEvidence
    cost_source: CostSource
    integrity_hash: str
    timestamp_iso: str

    @classmethod
    def create(
        cls,
        certificate_id: str,
        plan_id: str,
        task_id: str,
        selected_target: PlacementTarget,
        policy: HybridPolicy,
        budget_spent_usd: float,
        budget_remaining_usd: float,
        evidence_class: TelemetryEvidence,
        cost_source: CostSource,
        timestamp_iso: str,
    ) -> ExecutionPlacementCertificate:
        raw_material = f"{certificate_id}|{plan_id}|{task_id}|{selected_target.value}|{policy.value}|{budget_spent_usd}|{budget_remaining_usd}|{evidence_class.value}|{cost_source.value}|{timestamp_iso}"
        integrity_hash = hashlib.sha256(raw_material.encode("utf-8")).hexdigest()
        return cls(
            certificate_id=certificate_id,
            plan_id=plan_id,
            task_id=task_id,
            selected_target=selected_target,
            policy=policy,
            budget_spent_usd=budget_spent_usd,
            budget_remaining_usd=budget_remaining_usd,
            evidence_class=evidence_class,
            cost_source=cost_source,
            integrity_hash=integrity_hash,
            timestamp_iso=timestamp_iso,
        )
