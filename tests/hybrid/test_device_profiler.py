"""Contracts for SPE hybrid hardware profiling and fail-closed placement."""

from dataclasses import replace

import pytest

from spe_runtime.hybrid import device_profiler as dp

GIB = 1024 ** 3


class FakeProbe:
    def __init__(self, snapshot):
        self.current = snapshot

    def snapshot(self):
        return self.current


def hardware(backend=dp.Accelerator.METAL, *, free=8 * GIB, total=16 * GIB,
             thermal=dp.ThermalState.NOMINAL, battery=dp.PowerSource.AC):
    return dp.HardwareSnapshot(
        accelerator=backend, free_memory_bytes=free, total_memory_bytes=total,
        thermal_state=thermal, power_source=battery, cpu_architecture="arm64",
        device_name="test-device", evidence=("mocked physical probe",),
    )


@pytest.mark.parametrize("backend", [dp.Accelerator.METAL, dp.Accelerator.CUDA, dp.Accelerator.NNAPI, dp.Accelerator.ROCM])
def test_accelerated_hardware_profile_and_zero_dollar_local_placement(backend):
    profiler = dp.DeviceProfiler(probe=FakeProbe(hardware(backend)))
    decision = profiler.place(dp.ModelRequirement(weight_bytes=2 * GIB, parameter_count=1_000_000_000))
    assert decision.placement == dp.Placement.LOCAL_ENGINE
    assert decision.estimated_cost == dp.NanoUSD(0)
    assert isinstance(decision.estimated_cost, dp.NanoUSD)
    assert decision.profile.accelerator == backend


def test_thermal_state_is_requeried_and_critical_derates_ceiling():
    probe = FakeProbe(hardware())
    profiler = dp.DeviceProfiler(probe=probe, nominal_parameter_ceiling=8_000_000_000)
    nominal = profiler.profile()
    assert nominal.parameter_ceiling == 8_000_000_000
    probe.current = replace(probe.current, thermal_state=dp.ThermalState.CRITICAL)
    critical = profiler.profile()
    assert critical.parameter_ceiling == 2_000_000_000
    assert critical.parameter_ceiling < nominal.parameter_ceiling
    probe.current = replace(probe.current, thermal_state=dp.ThermalState.NOMINAL)
    assert profiler.profile().parameter_ceiling == nominal.parameter_ceiling


@pytest.mark.parametrize("state,percent", [(dp.ThermalState.NOMINAL, 100), (dp.ThermalState.FAIR, 75),
                                           (dp.ThermalState.SERIOUS, 50), (dp.ThermalState.CRITICAL, 25),
                                           (dp.ThermalState.UNKNOWN, 25)])
def test_thermal_downscaling_ratios_are_integer(state, percent):
    p = dp.DeviceProfiler(probe=FakeProbe(hardware(thermal=state)), nominal_parameter_ceiling=8_000_000_000)
    assert p.profile().parameter_ceiling == 8_000_000_000 * percent // 100


def test_memory_below_one_point_five_refuses_loading_and_recommends_fallback():
    profiler = dp.DeviceProfiler(probe=FakeProbe(hardware(free=3 * GIB - 1)))
    choice = profiler.place(dp.ModelRequirement(weight_bytes=2 * GIB, parameter_count=1))
    assert choice.placement == dp.Placement.FALLBACK_RECOMMENDED
    assert choice.reason == "INSUFFICIENT_MEMORY_HEADROOM"
    assert choice.estimated_cost is None
    assert choice.authorized_remote_execution is False


def test_exact_1point5_memory_boundary_is_safe():
    profiler = dp.DeviceProfiler(probe=FakeProbe(hardware(free=3 * GIB)))
    assert profiler.place(dp.ModelRequirement(weight_bytes=2 * GIB, parameter_count=1)).placement == dp.Placement.LOCAL_ENGINE


def test_missing_memory_is_fail_closed():
    profiler = dp.DeviceProfiler(probe=FakeProbe(hardware(free=None)))
    choice = profiler.place(dp.ModelRequirement(weight_bytes=2 * GIB, parameter_count=1))
    assert choice.reason == "UNKNOWN_AVAILABLE_MEMORY"
    assert choice.placement == dp.Placement.FALLBACK_RECOMMENDED


def test_non_accelerated_cpu_remains_eligible_for_local_execution_when_safe():
    profiler = dp.DeviceProfiler(probe=FakeProbe(hardware(dp.Accelerator.CPU_AVX512)))
    assert profiler.place(dp.ModelRequirement(weight_bytes=2 * GIB, parameter_count=1)).placement == dp.Placement.LOCAL_ENGINE


def test_parameter_ceiling_rejection_under_critical_thermal_state():
    profiler = dp.DeviceProfiler(probe=FakeProbe(hardware(thermal=dp.ThermalState.CRITICAL)), nominal_parameter_ceiling=4_000_000_000)
    decision = profiler.place(dp.ModelRequirement(weight_bytes=1 * GIB, parameter_count=1_000_000_001))
    assert decision.reason == "THERMAL_PARAMETER_CEILING"
    assert decision.placement == dp.Placement.FALLBACK_RECOMMENDED


def test_low_battery_derates_parameter_ceiling():
    profiler = dp.DeviceProfiler(probe=FakeProbe(hardware(battery=dp.PowerSource.BATTERY_LOW)), nominal_parameter_ceiling=8_000_000_000)
    assert profiler.profile().parameter_ceiling == 4_000_000_000


def test_zero_model_footprint_rejected():
    with pytest.raises(ValueError):
        dp.ModelRequirement(weight_bytes=0, parameter_count=1)


@pytest.mark.parametrize("value", [-1, True, 1.5, "1", float("inf")])
def test_nanousd_rejects_invalid_and_floating_currency(value):
    with pytest.raises((TypeError, ValueError)):
        dp.NanoUSD(value)


def test_exact_nanousd_conversion_constant():
    assert dp.NANOS_PER_USD == 1_000_000_000
    assert dp.NanoUSD(1_000_000_000) == dp.NANOS_PER_USD


def test_unknown_accelerator_recommends_fallback_not_remote_call():
    p = dp.DeviceProfiler(probe=FakeProbe(hardware(dp.Accelerator.UNKNOWN)))
    choice = p.place(dp.ModelRequirement(weight_bytes=1024, parameter_count=1))
    assert choice.placement == dp.Placement.FALLBACK_RECOMMENDED
    assert choice.reason == "NO_SUPPORTED_EXECUTION_BACKEND"


def test_mocked_apple_metal_probe_uses_real_accelerator_and_shared_ram(monkeypatch):
    probe = dp.SystemHardwareProbe()
    monkeypatch.setattr(dp.platform, "system", lambda: "Darwin")
    monkeypatch.setattr(dp.platform, "machine", lambda: "arm64")
    monkeypatch.setattr(probe, "_metal_available", lambda: True)
    monkeypatch.setattr(probe, "_memory_available", lambda: (8 * GIB, 16 * GIB))
    monkeypatch.setattr(probe, "_thermal_state", lambda: dp.ThermalState.NOMINAL)
    monkeypatch.setattr(probe, "_power_source", lambda: dp.PowerSource.AC)
    assert probe.snapshot().accelerator == dp.Accelerator.METAL
    assert probe.snapshot().free_memory_bytes == 8 * GIB


def test_mocked_nvidia_cuda_hardware_probe(monkeypatch):
    probe = dp.SystemHardwareProbe()
    monkeypatch.setattr(dp.platform, "system", lambda: "Linux")
    monkeypatch.setattr(dp.platform, "machine", lambda: "x86_64")
    monkeypatch.setattr(probe, "_nvidia_memory", lambda: (8 * GIB, 16 * GIB))
    monkeypatch.setattr(probe, "_rocm_memory", lambda: None)
    monkeypatch.setattr(probe, "_android_nnapi", lambda: False)
    monkeypatch.setattr(probe, "_thermal_state", lambda: dp.ThermalState.NOMINAL)
    monkeypatch.setattr(probe, "_power_source", lambda: dp.PowerSource.AC)
    profile = probe.snapshot()
    assert profile.accelerator == dp.Accelerator.CUDA
    assert profile.free_memory_bytes == 8 * GIB


def test_mocked_qualcomm_npu_probe(monkeypatch):
    probe = dp.SystemHardwareProbe()
    monkeypatch.setattr(dp.platform, "system", lambda: "Linux")
    monkeypatch.setattr(dp.platform, "machine", lambda: "aarch64")
    monkeypatch.setattr(probe, "_android_nnapi", lambda: True)
    monkeypatch.setattr(probe, "_memory_available", lambda: (8 * GIB, 16 * GIB))
    monkeypatch.setattr(probe, "_thermal_state", lambda: dp.ThermalState.FAIR)
    monkeypatch.setattr(probe, "_power_source", lambda: dp.PowerSource.BATTERY)
    profile = probe.snapshot()
    assert profile.accelerator == dp.Accelerator.NNAPI
    assert profile.thermal_state == dp.ThermalState.FAIR


def test_cpu_flags_do_not_claim_avx512_on_arm(monkeypatch):
    probe = dp.SystemHardwareProbe()
    monkeypatch.setattr(dp.platform, "machine", lambda: "aarch64")
    monkeypatch.setattr(probe, "_cpu_flags", lambda: "avx512f neon")
    assert probe._cpu_backend() == dp.Accelerator.CPU_ARM_NEON


def test_cpu_avx512_requires_actual_x86_feature(monkeypatch):
    probe = dp.SystemHardwareProbe()
    monkeypatch.setattr(dp.platform, "machine", lambda: "x86_64")
    monkeypatch.setattr(probe, "_cpu_flags", lambda: "sse4_2 avx avx2 avx512f")
    assert probe._cpu_backend() == dp.Accelerator.CPU_AVX512


def test_denies_invalid_snapshot_memory():
    with pytest.raises(ValueError):
        hardware(free=-1)


def test_offline_policy_has_no_automatic_cloud_authorization():
    p = dp.DeviceProfiler(probe=FakeProbe(hardware(free=0)))
    result = p.place(dp.ModelRequirement(weight_bytes=2 * GIB, parameter_count=1))
    assert result.authorized_remote_execution is False
    assert result.estimated_cost is None
