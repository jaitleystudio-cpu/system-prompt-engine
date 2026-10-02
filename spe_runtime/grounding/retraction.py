"""Retraction / withdrawal / EoC merge for grounding — never boolean-collapse.

Extends Context Grounding. Does not create a second research engine.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable

from spe_runtime.grounding.models import RetractionCheckStatus

_POSITIVE = frozenset(
    {
        RetractionCheckStatus.RETRACTION_SIGNAL,
        RetractionCheckStatus.WITHDRAWAL_SIGNAL,
        RetractionCheckStatus.EXPRESSION_OF_CONCERN,
        RetractionCheckStatus.CORRECTION_SIGNAL,
    }
)

_RANK = {
    RetractionCheckStatus.RETRACTION_SIGNAL: 5,
    RetractionCheckStatus.WITHDRAWAL_SIGNAL: 4,
    RetractionCheckStatus.EXPRESSION_OF_CONCERN: 3,
    RetractionCheckStatus.CORRECTION_SIGNAL: 2,
    RetractionCheckStatus.NO_SIGNAL_IN_QUERIED_SOURCES: 1,
    RetractionCheckStatus.UNKNOWN: 0,
    RetractionCheckStatus.NOT_CHECKED: 0,
    RetractionCheckStatus.CHECKING: 0,
    RetractionCheckStatus.SOURCE_UNAVAILABLE: 0,
    RetractionCheckStatus.IDENTIFIER_AMBIGUOUS: 0,
    RetractionCheckStatus.CONFLICTING_STATUS: 6,
}


@dataclass(frozen=True)
class RetractionCheckResult:
    status: RetractionCheckStatus
    evidence: tuple[str, ...]
    live_verified: bool = False

    def to_dict(self) -> dict[str, object]:
        return {
            "status": self.status.value,
            "evidence": list(self.evidence),
            "live_verified": self.live_verified,
        }


def merge_retraction_checks(
    witnesses: Iterable[RetractionCheckStatus] | tuple[RetractionCheckStatus, ...] = (),
) -> RetractionCheckResult:
    """Combine retraction witnesses. Empty → UNKNOWN, never NOT_RETRACTED."""
    states = tuple(witnesses)
    if not states:
        return RetractionCheckResult(
            status=RetractionCheckStatus.UNKNOWN,
            evidence=("NO_WITNESS", "NO_MATCH_NE_NOT_RETRACTED", "UNKNOWN_NE_PASS"),
            live_verified=False,
        )

    unique = set(states)
    positives = unique & _POSITIVE
    if len(positives) > 1:
        return RetractionCheckResult(
            status=RetractionCheckStatus.CONFLICTING_STATUS,
            evidence=("CONFLICTING_NOTICE_KINDS", "RETRACTED_NE_WITHDRAWN_NE_EOC"),
            live_verified=False,
        )
    if RetractionCheckStatus.IDENTIFIER_AMBIGUOUS in unique:
        return RetractionCheckResult(
            status=RetractionCheckStatus.IDENTIFIER_AMBIGUOUS,
            evidence=("IDENTIFIER_AMBIGUOUS",),
            live_verified=False,
        )
    if RetractionCheckStatus.SOURCE_UNAVAILABLE in unique and not positives:
        return RetractionCheckResult(
            status=RetractionCheckStatus.SOURCE_UNAVAILABLE,
            evidence=("SOURCE_UNAVAILABLE", "TIMEOUT_NE_CLEAN"),
            live_verified=False,
        )
    if positives:
        best = max(positives, key=lambda s: _RANK[s])
        return RetractionCheckResult(
            status=best,
            evidence=(f"SIGNAL:{best.value}",),
            live_verified=False,
        )
    if unique == {RetractionCheckStatus.NO_SIGNAL_IN_QUERIED_SOURCES}:
        return RetractionCheckResult(
            status=RetractionCheckStatus.NO_SIGNAL_IN_QUERIED_SOURCES,
            evidence=("NO_SIGNAL_IN_QUERIED_SOURCES", "NO_MATCH_NE_NOT_RETRACTED"),
            live_verified=False,
        )
    return RetractionCheckResult(
        status=RetractionCheckStatus.UNKNOWN,
        evidence=("UNKNOWN_NE_PASS",),
        live_verified=False,
    )


def classify_verification_mode(*, from_cache: bool = False, live: bool = False) -> str:
    """CACHE≠LIVE."""
    if from_cache:
        return "CACHE"
    if live:
        return "LIVE"
    return "UNKNOWN"


def classify_peer_review(
    *,
    arxiv_only: bool = False,
    source_type: str | None = None,
    catalog_source: str | None = None,
) -> str:
    """PREPRINT≠PEER_REVIEWED."""
    if arxiv_only or catalog_source == "ARXIV" or source_type == "PREPRINT":
        return "PREPRINT"
    if source_type == "PEER_REVIEWED_PAPER":
        return "PEER_REVIEWED"
    if source_type == "SPECIFICATION":
        return "NOT_APPLICABLE"
    return "UNKNOWN"
