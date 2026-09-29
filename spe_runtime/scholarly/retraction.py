"""Merge correction and retraction witnesses.

A positive notice outranks an explicit NONE from another source. NONE plus
UNKNOWN stays UNKNOWN. Omission is never stored as NONE.
"""

from __future__ import annotations

from spe_runtime.scholarly.models import NoticeKind, RetractionState


def _rank(kind: NoticeKind) -> int:
    if kind is NoticeKind.RETRACTION:
        return 5
    if kind is NoticeKind.WITHDRAWAL:
        return 4
    if kind is NoticeKind.EXPRESSION_OF_CONCERN:
        return 3
    if kind is NoticeKind.CORRECTION:
        return 2
    if kind is NoticeKind.NONE:
        return 1
    if kind is NoticeKind.UNKNOWN:
        return 0
    raise AssertionError(f"UNHANDLED_NOTICE:{kind}")


def merge_retraction(states: tuple[RetractionState, ...]) -> RetractionState:
    """Combine witnesses. Positive evidence dominates explicit NONE."""
    if not states:
        return RetractionState(NoticeKind.UNKNOWN, (), ("NO_WITNESS",))
    notices: list[str] = []
    evidence: list[str] = []
    for state in states:
        for notice_id in state.notice_ids:
            if notice_id not in notices:
                notices.append(notice_id)
        for item in state.evidence:
            if item not in evidence:
                evidence.append(item)
    kinds = {state.kind for state in states}
    if NoticeKind.NONE in kinds and kinds - {NoticeKind.NONE, NoticeKind.UNKNOWN}:
        evidence.append("RETRACTION_WITNESS_CONFLICT")
    best = max(states, key=lambda state: _rank(state.kind)).kind
    if best is NoticeKind.NONE and NoticeKind.UNKNOWN in kinds:
        best = NoticeKind.UNKNOWN
        evidence.append("EXPLICIT_NONE_WITH_UNKNOWN_WITNESS")
    return RetractionState(
        kind=best,
        notice_ids=tuple(notices),
        evidence=tuple(evidence),
    )
