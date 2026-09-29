"""Verdict algebra. UNKNOWN is never aggregated or relabeled as PASS."""

from __future__ import annotations

from enum import Enum

from spe_runtime.visual.errors import UnknownLaunderError


class ClaimVerdict(str, Enum):
    PASS = "PASS"
    FAIL = "FAIL"
    UNKNOWN = "UNKNOWN"

    def __str__(self) -> str:
        return self.value


class EpistemicStatus(str, Enum):
    OBSERVATION = "OBSERVATION"
    MODEL_JUDGMENT = "MODEL_JUDGMENT"
    SUPPLIED_UNTRUSTED = "SUPPLIED_UNTRUSTED"
    ABSENT = "ABSENT"

    def __str__(self) -> str:
        return self.value


def combine_verdicts(verdicts: tuple[ClaimVerdict, ...] | list[ClaimVerdict]) -> ClaimVerdict:
    """Fold claim verdicts. An empty set is UNKNOWN, not PASS."""

    if not verdicts:
        return ClaimVerdict.UNKNOWN
    if any(item is ClaimVerdict.FAIL or item == ClaimVerdict.FAIL for item in verdicts):
        return ClaimVerdict.FAIL
    if any(item is ClaimVerdict.UNKNOWN or item == ClaimVerdict.UNKNOWN for item in verdicts):
        return ClaimVerdict.UNKNOWN
    if all(item is ClaimVerdict.PASS or item == ClaimVerdict.PASS for item in verdicts):
        return ClaimVerdict.PASS
    return ClaimVerdict.UNKNOWN


def assert_unknown_is_not_pass(verdict: ClaimVerdict, epistemic: EpistemicStatus) -> None:
    """PASS is legal only for a completed OBSERVATION."""

    if verdict is ClaimVerdict.PASS and epistemic is not EpistemicStatus.OBSERVATION:
        raise UnknownLaunderError(
            f"UNKNOWN_LAUNDERED: verdict PASS is illegal for epistemic status {epistemic.value}"
        )
    if epistemic is EpistemicStatus.ABSENT and verdict is not ClaimVerdict.UNKNOWN:
        raise UnknownLaunderError(
            "ABSENT evidence must stay UNKNOWN and cannot fail open or pass"
        )
