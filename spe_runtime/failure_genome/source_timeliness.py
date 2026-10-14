"""R17 source-claimed revision chronology and freshness classification.

This is existing Failure Genome R6 source-observation policy, not a new
news index, provider verification, publisher or model diagnostic. The clock
age is calculated from SOURCE-CONTROLLED updated_at/created_at, not an
independently witnessed headline-publication timestamp. Do not represent
it as first-to-report speed or verified publication latency.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from .event_journal import _utc


@dataclass(frozen=True)
class SourceTimeliness:
    state: str
    claimed_revision_age_seconds: int | None
    reason_codes: tuple[str, ...]
    public_event_verified: bool = False
    first_to_report_verified: bool = False
    headline_ready: bool = False


def assess_source_timeliness(
    *,
    source_published_at: str,
    observed_at: str,
    predecessor_published_at: str | None = None,
    changed_content: bool = True,
    archival_threshold_seconds: int = 86400,
) -> SourceTimeliness:
    """Fail closed on regression in source-revision clock; measure age only.

    A source clock is untrusted. A changed payload must have a strictly later
    source revision timestamp than the existing journal's latest version.
    Equal timestamps with different content are quarantined for manual review,
    rather than silently overriding newer incident history.
    """
    if (
        type(archival_threshold_seconds) is not int
        or not 60 <= archival_threshold_seconds <= 86400 * 30
    ):
        raise ValueError("UNSAFE_FRESHNESS_POLICY")
    observed = _utc(observed_at)
    published = _utc(source_published_at)
    old = _utc(predecessor_published_at) if predecessor_published_at is not None else None
    if observed is None or published is None or (predecessor_published_at is not None and old is None):
        return SourceTimeliness("HOLD", None, ("SOURCE_TIMESTAMP_INVALID",))
    if published > observed:
        return SourceTimeliness("HOLD", None, ("SOURCE_CLOCK_AHEAD_OF_OBSERVATION",))
    if changed_content and old is not None and published <= old:
        return SourceTimeliness("HOLD", None, ("NON_MONOTONIC_SOURCE_REVISION",))
    age = max(0, int((observed - published).total_seconds()))
    if age > archival_threshold_seconds:
        return SourceTimeliness(
            "ARCHIVAL_SOURCE_METADATA", age,
            ("SOURCE_CLAIMED_TIMESTAMP_UNVERIFIED", "SOURCE_REVISION_NOT_CURRENT"),
        )
    return SourceTimeliness(
        "CURRENT_SOURCE_METADATA", age, ("SOURCE_CLAIMED_TIMESTAMP_UNVERIFIED",),
    )
