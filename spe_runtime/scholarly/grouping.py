"""Group admitted works into foundational, frontier, contradictory, and replication sets.

Foundational requires a known citation count at or above the cohort median.
Frontier requires a known year inside the caller-supplied window. Replication
from a title alone is labeled TITLE_HEURISTIC. Contradiction membership comes
only from structured opposing polarities.
"""

from __future__ import annotations

from spe_runtime.scholarly.models import (
    ContradictionPair,
    GroupMember,
    PaperRecord,
    RecordGroups,
    UnknownItem,
)

_REVIEW_TYPES = frozenset({"review", "systematic-review", "meta-analysis"})


def _median_upper(values: list[int]) -> int:
    ordered = sorted(values)
    return ordered[len(ordered) // 2]


def group_records(
    records: tuple[PaperRecord, ...],
    *,
    as_of_year: int,
    frontier_years: int,
    contradiction_pairs: tuple[ContradictionPair, ...],
) -> tuple[RecordGroups, tuple[UnknownItem, ...]]:
    """Return groups plus unknowns that the grouping could not close."""
    works = tuple(record for record in records if record.role == "work")
    citations = [
        record.cited_by_count
        for record in works
        if record.cited_by_count is not None
    ]
    gaps: list[UnknownItem] = []
    median = _median_upper(citations) if citations else None
    if works and median is None:
        gaps.append(
            UnknownItem(
                code="FOUNDATIONAL_UNAVAILABLE",
                subject="package",
                detail="no admitted work has a citation count",
                blocks_valid=True,
            )
        )
    frontier_start = as_of_year - frontier_years
    contradictory_ids = {
        pair.left_record_id for pair in contradiction_pairs
    } | {pair.right_record_id for pair in contradiction_pairs}
    foundational: list[GroupMember] = []
    frontier: list[GroupMember] = []
    contradictory: list[GroupMember] = []
    replication: list[GroupMember] = []
    for record in works:
        if record.year is None:
            gaps.append(
                UnknownItem(
                    code="YEAR_UNKNOWN",
                    subject=record.record_id,
                    detail="publication year is absent or conflicted",
                    blocks_valid=True,
                )
            )
        elif record.year >= frontier_start:
            frontier.append(
                GroupMember(record.record_id, (f"YEAR_WITHIN_{frontier_years}",))
            )
        if record.cited_by_count is None and median is not None:
            gaps.append(
                UnknownItem(
                    code="CITATION_COUNT_UNKNOWN",
                    subject=record.record_id,
                    detail="citation count absent on every witness",
                    blocks_valid=False,
                )
            )
        review = bool(set(record.publication_types) & _REVIEW_TYPES)
        older = record.year is not None and record.year < frontier_start
        if (
            median is not None
            and record.cited_by_count is not None
            and record.cited_by_count >= median
            and (older or review)
        ):
            basis = ["CITED_AT_OR_ABOVE_MEDIAN"]
            if older:
                basis.append("OUTSIDE_FRONTIER_WINDOW")
            if review:
                basis.append("REVIEW_OR_SYNTHESIS")
            foundational.append(GroupMember(record.record_id, tuple(basis)))
        if record.record_id in contradictory_ids:
            contradictory.append(
                GroupMember(record.record_id, ("OPPOSING_STRUCTURED_POLARITY",))
            )
        if record.replication_signal == "STRUCTURED":
            replication.append(GroupMember(record.record_id, ("STRUCTURED_TYPE",)))
        elif record.replication_signal == "TITLE_HEURISTIC":
            replication.append(GroupMember(record.record_id, ("TITLE_HEURISTIC",)))
            gaps.append(
                UnknownItem(
                    code="REPLICATION_TITLE_HEURISTIC",
                    subject=record.record_id,
                    detail="title suggests replication; no structured type",
                    blocks_valid=False,
                )
            )
    groups = RecordGroups(
        foundational=tuple(foundational),
        frontier=tuple(frontier),
        contradictory=tuple(contradictory),
        replication=tuple(replication),
    )
    return groups, tuple(gaps)
