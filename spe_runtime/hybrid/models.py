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


NanoUSD = int  # Exact integer units: 1_000_000_000 Nanos = $1.00 USD
NANOS_PER_USD = 1_000_000_000


class ThermalState(str, Enum):
    """System thermal condition."""
    NOMINAL = "NOMINAL"
    FAIR = "FAIR"
    SERIOUS = "SERIOUS"
    CRITICAL = "CRITICAL"


class HardwareEngineType(str, Enum):
    """Detected physical hardware acceleration engine."""
    APPLE_METAL = "APPLE_METAL"          # Apple Silicon Metal / Unified Memory
    NVIDIA_CUDA = "NVIDIA_CUDA"          # NVIDIA CUDA / NVML
    QUALCOMM_NPU = "QUALCOMM_NPU"        # Qualcomm Hexagon / NNAPI
    AMD_ROCM = "AMD_ROCM"                # AMD ROCm / HIP
    CPU_AVX512 = "CPU_AVX512"            # x86/ARM CPU fallback with AVX-512 / NEON


class PlacementTarget(str, Enum):
    """Where a task or subtask is placed for physical execution."""
    LOCAL_DETERMINISTIC = "LOCAL_DETERMINISTIC"  # $0 cloud, deterministic AST / compiler / validator / math
    LOCAL_NEURAL = "LOCAL_NEURAL"                # $0 cloud tokens, runs on user's local device/engine
    LOCAL_ENGINE = "LOCAL_ENGINE"                # $0 cloud tokens, physical native device engine
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
    thermal_state: ThermalState = ThermalState.NOMINAL
    hardware_type: HardwareEngineType = HardwareEngineType.CPU_AVX512
    supports_metal: bool = False
    supports_cuda: bool = False
    supports_npu: bool = False
    model_parameter_ceiling_b: float = 70.0
    free_unified_memory_mb: int = 0
    installed_local_models: List[str] = field(default_factory=list)
    measured_local_tok_per_sec: float = 0.0
    max_context_tokens_local: int = 4096
    last_calibrated_iso: str = ""
    evidence_class: TelemetryEvidence = TelemetryEvidence.CALIBRATED_ESTIMATE

    def get_effective_parameter_ceiling(self) -> float:
        """Dynamically downscale parameter ceiling under thermal stress."""
        base = self.model_parameter_ceiling_b
        if self.thermal_state == ThermalState.CRITICAL:
            return 0.0
        elif self.thermal_state == ThermalState.SERIOUS:
            return min(7.0, base * 0.50)
        elif self.thermal_state == ThermalState.FAIR:
            return base * 0.85
        return base

    def check_memory_headroom(self, model_footprint_mb: int) -> Tuple[bool, str]:
        """Refuse local weight loading if free unified memory is < 1.5x model footprint."""
        free_mem = self.free_unified_memory_mb if self.free_unified_memory_mb > 0 else self.available_memory_mb
        required_headroom_mb = int(model_footprint_mb * 1.5)
        if free_mem < required_headroom_mb:
            return (
                False,
                f"Memory headroom refusal: available memory ({free_mem} MB) is less than required 1.5x buffer "
                f"for {model_footprint_mb} MB model footprint ({required_headroom_mb} MB required). "
                f"Refusing weight load to prevent OS swap thrashing. Recommendation: fallback to CLOUD_AUTHORIZED or downscale model.",
            )
        return True, f"Memory headroom verified: {free_mem} MB available >= 1.5x buffer ({required_headroom_mb} MB)."

    def determine_execution_placement(
        self,
        vram_required_mb: int,
        task_complexity_score: float = 0.5,
        estimated_cloud_nanos: NanoUSD = 10_000_000,
    ) -> Tuple[PlacementTarget, NanoUSD, str]:
        """
        Calculates execution placement and cost.
        If free memory is sufficient (>= 1.5x) and thermals are not critical, outputs LOCAL_ENGINE ($0 cost).
        """
        # Thermal check
        if self.thermal_state == ThermalState.CRITICAL or self.is_thermal_throttled:
            return (
                PlacementTarget.CLOUD_AUTHORIZED,
                estimated_cloud_nanos,
                "Thermal state is CRITICAL; offloading to CLOUD_AUTHORIZED to prevent hardware degradation.",
            )

        # Headroom check
        headroom_ok, reason = self.check_memory_headroom(vram_required_mb)
        if not headroom_ok:
            return (
                PlacementTarget.CLOUD_AUTHORIZED,
                estimated_cloud_nanos,
                reason,
            )

        # Fully qualified for local execution!
        return (
            PlacementTarget.LOCAL_ENGINE,
            0,  # $0 cost
            f"Execution qualified for $0 local engine ({self.hardware_type.value}) with verified 1.5x headroom.",
        )

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
