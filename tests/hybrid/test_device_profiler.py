"""Comprehensive Tests for SPE Ω Physical Hardware Profiling Engine & Zero-Cost Local Switch.

Verifies:
1. Exact integer arithmetic: Zero floating-point currencies. All cost models use NanoUSD (1 USD = 1,000,000,000 nanos).
2. Hardware Support: Apple Silicon Metal/Unified Memory, Qualcomm NPU, NVIDIA CUDA/ROCm, and CPU AVX-512 fallback.
3. Thermal & Battery Awareness: NOMINAL, FAIR, SERIOUS, CRITICAL states; dynamic downscaling of model parameter ceilings.
4. Memory Headroom Guard: Refuses local weight loading if free unified memory < 1.5x model footprint to prevent OS swap thrashing.
5. Execution placement: Task requiring 2GB VRAM on an 8GB free device outputs PLACEMENT=LOCAL_ENGINE ($0 cost).
"""

from __future__ import annotations

import os
from unittest.mock import patch
import pytest

from spe_runtime.hybrid import (
    DeviceCapabilityProfile,
    DeviceProfiler,
    HardwareEngineType,
    NanoUSD,
    NANOS_PER_USD,
    PlacementTarget,
    ThermalState,
)


def test_nanousd_exact_integer_arithmetic():
    """Validates exact integer arithmetic for financial models with zero floating-point leakage."""
    zero_nanos: NanoUSD = 0
    one_cent_nanos: NanoUSD = 10_000_000
    one_dollar_nanos: NanoUSD = NANOS_PER_USD

    assert isinstance(zero_nanos, int)
    assert not isinstance(zero_nanos, float)
    assert one_dollar_nanos == 1_000_000_000
    assert one_cent_nanos * 100 == one_dollar_nanos


def test_apple_silicon_metal_hardware_detection():
    """Profiles Apple Silicon Metal and Unified Memory acceleration."""
    with patch("sys.platform", "darwin"), patch("platform.machine", return_value="arm64"):
        profiler = DeviceProfiler()
        profile = profiler.profile()

        assert profile.hardware_type == HardwareEngineType.APPLE_METAL
        assert profile.supports_metal is True
        assert profile.supports_cuda is False
        assert profile.supports_npu is False
        assert profile.has_gpu_or_npu is True
        assert "Metal" in (profile.gpu_device_name or "")


def test_qualcomm_npu_hardware_detection():
    """Profiles Qualcomm Hexagon NPU via NNAPI / QNN environment."""
    with patch("sys.platform", "linux"), patch("platform.machine", return_value="aarch64"):
        with patch.dict(os.environ, {"QUALCOMM_NPU": "1"}):
            profiler = DeviceProfiler()
            profile = profiler.profile()

            assert profile.hardware_type == HardwareEngineType.QUALCOMM_NPU
            assert profile.supports_npu is True
            assert profile.supports_metal is False
            assert profile.supports_cuda is False
            assert profile.has_gpu_or_npu is True
            assert "Qualcomm" in (profile.gpu_device_name or "")


def test_nvidia_cuda_hardware_detection():
    """Profiles NVIDIA CUDA GPU via CUDA_VISIBLE_DEVICES or NVML."""
    with patch("sys.platform", "linux"), patch("platform.machine", return_value="x86_64"):
        with patch.dict(os.environ, {"CUDA_VISIBLE_DEVICES": "0,1"}):
            profiler = DeviceProfiler()
            profile = profiler.profile()

            assert profile.hardware_type == HardwareEngineType.NVIDIA_CUDA
            assert profile.supports_cuda is True
            assert profile.supports_metal is False
            assert profile.supports_npu is False
            assert profile.has_gpu_or_npu is True
            assert "CUDA" in (profile.gpu_device_name or "")


def test_cpu_avx512_fallback_detection():
    """Profiles x86_64 CPU fallback with AVX-512 vector engine when no accelerator present."""
    with patch("sys.platform", "linux"), patch("platform.machine", return_value="x86_64"):
        with patch.dict(os.environ, {"CUDA_VISIBLE_DEVICES": ""}, clear=True):
            profiler = DeviceProfiler()
            profile = profiler.profile()

            assert profile.hardware_type == HardwareEngineType.CPU_AVX512
            assert profile.supports_metal is False
            assert profile.supports_cuda is False
            assert profile.supports_npu is False
            assert profile.has_gpu_or_npu is False
            assert "AVX-512" in (profile.gpu_device_name or "")


def test_thermal_state_dynamic_downscaling():
    """
    Validates dynamic downscaling of local model parameter ceilings under thermal stress:
    - NOMINAL: 100% parameter ceiling (e.g. 70B)
    - FAIR: 85% ceiling (59.5B)
    - SERIOUS: 50% ceiling capped at 7B
    - CRITICAL: 0B ceiling (refuse local neural execution)
    """
    base_profile = DeviceProfiler().profile()
    base_profile.model_parameter_ceiling_b = 70.0

    # 1. NOMINAL state
    base_profile.thermal_state = ThermalState.NOMINAL
    base_profile.is_thermal_throttled = False
    assert base_profile.get_effective_parameter_ceiling() == 70.0

    # 2. FAIR state
    base_profile.thermal_state = ThermalState.FAIR
    base_profile.is_thermal_throttled = False
    assert base_profile.get_effective_parameter_ceiling() == pytest.approx(59.5, 0.1)

    # 3. SERIOUS state
    base_profile.thermal_state = ThermalState.SERIOUS
    base_profile.is_thermal_throttled = True
    assert base_profile.get_effective_parameter_ceiling() == 7.0

    # 4. CRITICAL state
    base_profile.thermal_state = ThermalState.CRITICAL
    base_profile.is_thermal_throttled = True
    assert base_profile.get_effective_parameter_ceiling() == 0.0


def test_memory_headroom_guard_1_5x_buffer():
    """
    Validates Memory Headroom Guard:
    Refuses local weight loading if free unified memory is < 1.5x model footprint
    to prevent OS swap thrashing.
    """
    profile = DeviceProfiler().profile()
    profile.available_memory_mb = 8192  # 8 GB free RAM
    profile.free_unified_memory_mb = 8192

    # Model requiring 2GB footprint:
    # 1.5x buffer = 3GB <= 8GB free -> ACCEPTED
    ok, msg = profile.check_memory_headroom(model_footprint_mb=2048)
    assert ok is True
    assert "verified" in msg.lower()

    # Model requiring 6GB footprint:
    # 1.5x buffer = 9GB > 8GB free -> REFUSED
    ok, msg = profile.check_memory_headroom(model_footprint_mb=6144)
    assert ok is False
    assert "headroom refusal" in msg.lower()
    assert "swap thrashing" in msg.lower()
    assert "CLOUD_AUTHORIZED" in msg


def test_execution_placement_local_engine_zero_cost():
    """
    Task requiring 2GB VRAM on an 8GB free device must output PLACEMENT=LOCAL_ENGINE ($0 cost).
    """
    profile = DeviceProfiler().profile()
    profile.available_memory_mb = 8192
    profile.free_unified_memory_mb = 8192
    profile.thermal_state = ThermalState.NOMINAL
    profile.is_thermal_throttled = False
    profile.hardware_type = HardwareEngineType.APPLE_METAL

    target, cost_nanos, reason = profile.determine_execution_placement(vram_required_mb=2048)

    assert target == PlacementTarget.LOCAL_ENGINE
    assert cost_nanos == 0  # $0 cost for local execution!
    assert "qualified for $0 local engine" in reason.lower()


def test_execution_placement_critical_thermal_refusal():
    """
    Task under CRITICAL thermal pressure must offload to CLOUD_AUTHORIZED.
    """
    profile = DeviceProfiler().profile()
    profile.available_memory_mb = 16384
    profile.free_unified_memory_mb = 16384
    profile.thermal_state = ThermalState.CRITICAL
    profile.is_thermal_throttled = True

    target, cost_nanos, reason = profile.determine_execution_placement(
        vram_required_mb=2048,
        estimated_cloud_nanos=15_000_000,
    )

    assert target == PlacementTarget.CLOUD_AUTHORIZED
    assert cost_nanos == 15_000_000
    assert "thermal state is critical" in reason.lower()


def test_execution_placement_memory_headroom_violation():
    """
    Task requiring 6GB VRAM on an 8GB free device (needs 9GB buffer) must offload to CLOUD_AUTHORIZED.
    """
    profile = DeviceProfiler().profile()
    profile.available_memory_mb = 8192
    profile.free_unified_memory_mb = 8192
    profile.thermal_state = ThermalState.NOMINAL
    profile.is_thermal_throttled = False

    target, cost_nanos, reason = profile.determine_execution_placement(
        vram_required_mb=6144,
        estimated_cloud_nanos=25_000_000,
    )

    assert target == PlacementTarget.CLOUD_AUTHORIZED
    assert cost_nanos == 25_000_000
    assert "memory headroom refusal" in reason.lower()
