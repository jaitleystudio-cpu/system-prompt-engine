"""
SPE Ω — WPEM Asymmetric Thermal Hysteresis Filter (Schmitt Trigger) Tests.
Verifies:
1. Instantaneous downscale on high thermal pressure (0ms latency).
2. Cooldown damping window (10s) holding downscaled tier against short dips.
3. Promotion back to nominal after sustained stability.
4. Thrashing suppression under rapid 2-second thermal cycling.
"""

import pytest
from spe_runtime.research.wpem import (
    ThermalHysteresisFilter,
    HardwareEnvelope,
)


def make_hw_envelope(thermal_state: str, timestamp_s: float) -> HardwareEnvelope:
    return HardwareEnvelope(
        timestamp_ms=timestamp_s * 1000.0,
        thermal_state=thermal_state,
        available_memory_bytes=4_000_000_000,
        accelerator_available=True,
        battery_level_pct=80.0,
    )


def test_instantaneous_downscale_on_thermal_pressure():
    """Verifies that when thermal pressure hits SERIOUS or CRITICAL, downscale occurs with 0 delay."""
    filter = ThermalHysteresisFilter(cooldown_window_s=10.0)

    # Initial state is NOMINAL at t=0
    hw_nom = make_hw_envelope("NOMINAL", timestamp_s=0.0)
    eff = filter.process_envelope(hw_nom, current_time_s=0.0)
    assert eff == "NOMINAL"

    # Sudden spike to CRITICAL at t=0.1
    hw_crit = make_hw_envelope("CRITICAL", timestamp_s=0.1)
    eff = filter.process_envelope(hw_crit, current_time_s=0.1)
    assert eff == "CRITICAL"
    assert filter.is_promotable(current_time_s=0.1) is False


def test_cooldown_damping_holds_downscaled_tier():
    """
    Verifies that if thermal state drops back to NOMINAL prematurely (< 10s),
    the filter holds the downscaled state to prevent thrashing.
    """
    filter = ThermalHysteresisFilter(cooldown_window_s=10.0)

    # Spike at t=1.0
    hw_crit = make_hw_envelope("CRITICAL", timestamp_s=1.0)
    filter.process_envelope(hw_crit, current_time_s=1.0)
    assert filter.effective_thermal_state == "CRITICAL"

    # Quick dip back to NOMINAL at t=3.0 (elapsed = 2.0s < 10.0s cooldown)
    hw_nom = make_hw_envelope("NOMINAL", timestamp_s=3.0)
    eff = filter.process_envelope(hw_nom, current_time_s=3.0)
    assert eff == "CRITICAL"  # Still damped!
    assert filter.is_promotable(current_time_s=3.0) is False

    # Another reading at t=9.9 (elapsed = 8.9s < 10.0s)
    eff = filter.process_envelope(hw_nom, current_time_s=9.9)
    assert eff == "CRITICAL"  # Still damped!

    # Reading at t=11.1 (elapsed = 10.1s >= 10.0s cooldown)
    eff = filter.process_envelope(hw_nom, current_time_s=11.1)
    assert eff == "NOMINAL"  # Promoted back!
    assert filter.is_promotable(current_time_s=11.1) is True


def test_rapid_thermal_oscillation_thrashing_suppression():
    """
    Simulates aggressive thermal thrashing (NOMINAL <-> CRITICAL every 2 seconds for 20 seconds).
    Without hysteresis, transitions = 10. With hysteresis, downscale locks until stability.
    """
    filter = ThermalHysteresisFilter(cooldown_window_s=10.0)

    states = ["NOMINAL", "CRITICAL", "NOMINAL", "CRITICAL", "NOMINAL", "CRITICAL"]
    times = [0.0, 2.0, 4.0, 6.0, 8.0, 10.0]

    for state, t in zip(states, times):
        hw = make_hw_envelope(state, timestamp_s=t)
        filter.process_envelope(hw, current_time_s=t)

    # After hitting CRITICAL at t=2.0, it should never flip back to NOMINAL
    # because NOMINAL intervals are only 2s long (much less than 10s cooldown).
    assert filter.effective_thermal_state == "CRITICAL"
    # Transition count should only be 1 (the initial downscale from NOMINAL -> CRITICAL)
    assert filter.transition_count == 1
