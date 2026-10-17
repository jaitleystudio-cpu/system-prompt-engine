"""Deterministic protocol depth router with explicit score thresholds."""

from __future__ import annotations

from dataclasses import dataclass

from spe_runtime.protocols.models import ProtocolDepth

# Signals are integers in [SIGNAL_MIN, SIGNAL_MAX].
SIGNAL_MIN = 0
SIGNAL_MAX = 3

# Integer score = sum of six signals (max 18). Bounded thresholds:
SCORE_QUICK_MAX = 3  # [0, 3] => QUICK
SCORE_STANDARD_MAX = 7  # [4, 7] => STANDARD
SCORE_DEEP_MAX = 11  # [8, 11] => DEEP
# [12, 18] => CRITICAL

# Explicit escalation: stakes == 3 and irreversibility >= 2 => CRITICAL
ESCALATE_STAKES = 3
ESCALATE_IRREVERSIBILITY_MIN = 2


@dataclass(frozen=True)
class DepthSignals:
    """Discrete depth features; each field is an integer in 0..3."""

    complexity: int
    stakes: int
    uncertainty: int
    freshness: int
    evidence: int
    irreversibility: int

    def __post_init__(self) -> None:
        for name in (
            "complexity",
            "stakes",
            "uncertainty",
            "freshness",
            "evidence",
            "irreversibility",
        ):
            value = getattr(self, name)
            if not isinstance(value, int) or isinstance(value, bool):
                raise TypeError(f"{name} must be int")
            if value < SIGNAL_MIN or value > SIGNAL_MAX:
                raise ValueError(
                    f"{name}={value} out of range [{SIGNAL_MIN}, {SIGNAL_MAX}]"
                )

    @property
    def score(self) -> int:
        return (
            self.complexity
            + self.stakes
            + self.uncertainty
            + self.freshness
            + self.evidence
            + self.irreversibility
        )


def select_protocol_depth(signals: DepthSignals) -> ProtocolDepth:
    """Prefer the lowest depth that satisfies risk/quality requirements."""
    if (
        signals.stakes == ESCALATE_STAKES
        and signals.irreversibility >= ESCALATE_IRREVERSIBILITY_MIN
    ):
        return ProtocolDepth.CRITICAL

    score = signals.score
    if score <= SCORE_QUICK_MAX:
        return ProtocolDepth.QUICK
    if score <= SCORE_STANDARD_MAX:
        return ProtocolDepth.STANDARD
    if score <= SCORE_DEEP_MAX:
        return ProtocolDepth.DEEP
    return ProtocolDepth.CRITICAL
