"""XCAT invariants X01–X10 — enforcing validators.

Return True when the invariant holds; False when violated.
"""

from __future__ import annotations

from typing import Any, Iterable, Mapping

from spe_runtime.xcat.models import CATEGORY_IDS, CrossCategoryEnvelope

_STRENGTH_RANK = {"HARD": 2, "SOFT": 1}


def _ids(items: Iterable[Mapping[str, Any]], key: str) -> set[str]:
    return {str(item[key]) for item in items if key in item}


def _by_id(
    items: Iterable[Mapping[str, Any]], key: str
) -> dict[str, Mapping[str, Any]]:
    return {str(item[key]): item for item in items if key in item}


def validate_constraint_monotonicity(
    before: CrossCategoryEnvelope, after: CrossCategoryEnvelope
) -> bool:
    """X01: constraints never silently weaken or disappear."""
    before_map = _by_id(before.hard_constraints, "constraint_id")
    after_map = _by_id(after.hard_constraints, "constraint_id")
    if not before_map.keys() <= after_map.keys():
        return False
    for cid, b in before_map.items():
        a = after_map[cid]
        if str(a.get("statement", "")) != str(b.get("statement", "")):
            return False
        b_rank = _STRENGTH_RANK.get(str(b.get("strength", "HARD")), 0)
        a_rank = _STRENGTH_RANK.get(str(a.get("strength", "HARD")), 0)
        if a_rank < b_rank:
            return False
    return True


def validate_provenance_monotonicity(
    before: CrossCategoryEnvelope, after: CrossCategoryEnvelope
) -> bool:
    """X02: provenance never disappears."""
    return _ids(before.provenance, "provenance_id") <= _ids(
        after.provenance, "provenance_id"
    )


def validate_uncertainty_preservation(
    before: CrossCategoryEnvelope, after: CrossCategoryEnvelope
) -> bool:
    """X03: uncertainty never silently disappears."""
    return _ids(before.uncertainties, "uncertainty_id") <= _ids(
        after.uncertainties, "uncertainty_id"
    )


def validate_preference_immutability(
    before: CrossCategoryEnvelope, after: CrossCategoryEnvelope
) -> bool:
    """X04: user preferences are immutable (not model-owned)."""
    before_map = _by_id(before.user_preferences, "preference_id")
    after_map = _by_id(after.user_preferences, "preference_id")
    if before_map.keys() != after_map.keys():
        return False
    for pid, b in before_map.items():
        a = after_map[pid]
        if str(a.get("statement", "")) != str(b.get("statement", "")):
            return False
    return True


def validate_failure_preservation(
    before: CrossCategoryEnvelope, after: CrossCategoryEnvelope
) -> bool:
    """X10 support: FAIL/UNKNOWN cannot become PASS; failures cannot vanish."""
    before_map = {f.failure_id: f for f in before.failures}
    after_map = {f.failure_id: f for f in after.failures}
    if not before_map.keys() <= after_map.keys():
        return False
    for fid, b in before_map.items():
        a = after_map[fid]
        if b.status in ("FAIL", "UNKNOWN") and a.status == "PASS":
            return False
        # Cannot silently upgrade FAIL → UNKNOWN either? Keep FAIL sticky.
        if b.status == "FAIL" and a.status == "UNKNOWN":
            return False
    return True


def validate_taint_preservation(
    before: CrossCategoryEnvelope, after: CrossCategoryEnvelope
) -> bool:
    return set(before.taint_labels) <= set(after.taint_labels)


def validate_sensitivity_preservation(
    before: CrossCategoryEnvelope, after: CrossCategoryEnvelope
) -> bool:
    return set(before.sensitivity_labels) <= set(after.sensitivity_labels)


_STATUS_RANK = {"DENIED": 0, "NONE": 1, "PENDING": 2, "GRANTED": 3}


def validate_authority_non_escalation(
    before: CrossCategoryEnvelope,
    after: CrossCategoryEnvelope,
    authority_event: object | None = None,
) -> bool:
    """X09: authority never self-escalates without an external authority event."""
    if authority_event is not None:
        return True
    b = before.authority_state
    a = after.authority_state
    if a.level > b.level:
        return False
    # Losing grants is OK; gaining grants without event is escalation
    if not set(a.grants) <= set(b.grants):
        return False
    b_rank = _STATUS_RANK.get(str(b.status), -1)
    a_rank = _STATUS_RANK.get(str(a.status), -1)
    if a_rank > b_rank:
        return False
    return True


def validate_category_ownership(category_id: str) -> bool:
    """Category IDs must be namespaced CAT:C01..CAT:C12."""
    return category_id in CATEGORY_IDS


def validate_facts_have_provenance(envelope: CrossCategoryEnvelope) -> bool:
    """X05: facts require provenance."""
    known = _ids(envelope.provenance, "provenance_id")
    for fact in envelope.facts:
        pids = fact.get("provenance_ids") or []
        if not pids:
            return False
        if not set(str(p) for p in pids) <= known:
            return False
    return True


def validate_analysis_not_recommendation(envelope: CrossCategoryEnvelope) -> bool:
    """X06: analysis != recommendation (fields must remain distinct).

    Also rejects analysis payloads that declare kind=recommendation or that are
    recommendation-shaped (action + certainty), which would launder Decide work
    into Analyze.
    """
    if envelope.analysis is not None:
        kind = str(envelope.analysis.get("kind", "") or "").lower()
        if kind == "recommendation":
            return False
        if "action" in envelope.analysis and "certainty" in envelope.analysis:
            return False
    if envelope.analysis is None or envelope.recommendation is None:
        return True
    return dict(envelope.analysis) != dict(envelope.recommendation)


def validate_recommendation_not_execution(envelope: CrossCategoryEnvelope) -> bool:
    """X07: recommendation != execution (no silent promotion into grants)."""
    if envelope.recommendation is None:
        return True
    # Execution grants must not be derived solely by identity-copy of recommendation
    for grant in envelope.execution_grants:
        if grant == envelope.recommendation:
            return False
        if grant.get("from_recommendation") is True and grant.get("authorized") is not True:
            return False
    return True


def validate_no_semantic_rewrite(
    before: CrossCategoryEnvelope, after: CrossCategoryEnvelope
) -> bool:
    """X08: communication must not rewrite locked semantics (goal/constraints)."""
    if after.goal_identity != before.goal_identity:
        return False
    # Locked constraint statements cannot be rewritten
    before_map = _by_id(before.hard_constraints, "constraint_id")
    after_map = _by_id(after.hard_constraints, "constraint_id")
    for cid, b in before_map.items():
        if cid not in after_map:
            return False
        if str(after_map[cid].get("statement", "")) != str(b.get("statement", "")):
            return False
    return True
