"""Group admitted works into foundational, frontier, contradictory, and replication sets.

Foundational requires citation evidence plus age or a review type. The oldest
paper is not foundational by age alone. Frontier is freshness, not strength.
Replication from a title alone stays TITLE_HEURISTIC and is not a replication
map link. Contradiction membership comes only from opposing evidence edges.
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
_REVIEW_PAPER = frozenset({"REVIEW", "SYSTEMATIC_REVIEW", "META_ANALYSIS"})


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
            basis = [f"YEAR_WITHIN_{frontier_years}", "YEAR_VERIFIED", "NOT_STRENGTH"]
            if record.paper_type == "PREPRINT" or record.peer_review_status == "NOT_PEER_REVIEWED":
                basis.append("PREPRINT")
            if record.peer_review_status == "UNKNOWN":
                basis.append("PEER_REVIEW_UNCERTAIN")
            frontier.append(GroupMember(record.record_id, tuple(basis)))
        if record.cited_by_count is None and median is not None:
            gaps.append(
                UnknownItem(
                    code="CITATION_COUNT_UNKNOWN",
                    subject=record.record_id,
                    detail="citation count absent on every witness",
                    blocks_valid=False,
                )
            )
        review = bool(set(record.publication_types) & _REVIEW_TYPES) or (
            record.paper_type in _REVIEW_PAPER
        )
        older = record.year is not None and record.year < frontier_start
        if (
            median is not None
            and record.cited_by_count is not None
            and record.cited_by_count >= median
            and (older or review)
        ):
            basis = ["CITED_AT_OR_ABOVE_MEDIAN", "NOT_AGE_ALONE"]
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
        elif record.replication_signal == "EXPLICIT_ABSTRACT":
            replication.append(GroupMember(record.record_id, ("EXPLICIT_ABSTRACT",)))
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
    if works and not foundational and median is not None:
        gaps.append(
            UnknownItem(
                code="FOUNDATIONAL_UNKNOWN",
                subject="package",
                detail="citation evidence did not meet the foundational rule",
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
