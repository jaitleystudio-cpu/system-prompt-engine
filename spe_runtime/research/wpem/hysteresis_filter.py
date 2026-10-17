"""
SPE Ω — WPEM Asymmetric Thermal Hysteresis Filter (Schmitt Trigger).
Prevents thermal oscillation thrashing by making downgrades instantaneous (fail-safe)
and requiring sustained cooldown windows before promoting execution tiers.
"""

from typing import Optional
from .types import HardwareEnvelope


class ThermalHysteresisFilter:
    """
    Asymmetric Schmitt-Trigger filter for hardware admission decisions:
    - Downscaling (NOMINAL -> CRITICAL) triggers at latency 0ms.
    - Upscaling (CRITICAL -> NOMINAL) requires stable cooldown for cooldown_window_s.
    """

    def __init__(self, cooldown_window_s: float = 10.0):
        self.cooldown_window_s = cooldown_window_s
        self.effective_thermal_state: str = "NOMINAL"
        self.last_high_thermal_timestamp_s: Optional[float] = None
        self.transition_count: int = 0

    def process_envelope(self, envelope: HardwareEnvelope, current_time_s: float) -> str:
        raw_state = envelope.thermal_state.upper()

        # Instantaneous downscale on high thermal pressure
        if raw_state in ("SERIOUS", "CRITICAL"):
            self.last_high_thermal_timestamp_s = current_time_s
            if self.effective_thermal_state not in ("SERIOUS", "CRITICAL"):
                self.transition_count += 1
            self.effective_thermal_state = raw_state
            return self.effective_thermal_state

        # Raw state is NOMINAL or FAIR: check if cooldown window has elapsed
        if self.effective_thermal_state in ("SERIOUS", "CRITICAL"):
            if self.last_high_thermal_timestamp_s is not None:
                elapsed = current_time_s - self.last_high_thermal_timestamp_s
                if elapsed < self.cooldown_window_s:
                    # Damping active: hold the downscaled state to prevent thrashing
                    return self.effective_thermal_state
            # Cooldown passed: promote tier back to NOMINAL
            self.transition_count += 1
            self.effective_thermal_state = raw_state
            self.last_high_thermal_timestamp_s = None
            return self.effective_thermal_state

        self.effective_thermal_state = raw_state
        return self.effective_thermal_state

    def is_promotable(self, current_time_s: float) -> bool:
        """Returns True if hardware has been cool for the full cooldown window."""
        if self.effective_thermal_state in ("SERIOUS", "CRITICAL"):
            return False
        if self.last_high_thermal_timestamp_s is None:
            return True
        return (current_time_s - self.last_high_thermal_timestamp_s) >= self.cooldown_window_s
