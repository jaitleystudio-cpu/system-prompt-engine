"""Injectable clock for Ring-1 lease deadlines (liveness, not fencing safety)."""

from __future__ import annotations

import time
from dataclasses import dataclass


class Clock:
    def now_ms(self) -> int:
        raise NotImplementedError


@dataclass
class SystemClock(Clock):
    def now_ms(self) -> int:
        return int(time.time() * 1000)


@dataclass
class FakeClock(Clock):
    """Deterministic injectable clock for tests."""

    _now_ms: int = 0

    def now_ms(self) -> int:
        return self._now_ms

    def set_ms(self, value: int) -> None:
        self._now_ms = int(value)

    def advance_ms(self, delta: int) -> None:
        self._now_ms += int(delta)


__all__ = ["Clock", "SystemClock", "FakeClock"]
