"""Claim–evidence graph and contradiction map.

Polarity stays UNKNOWN unless a caller assertion pins the work or an explicit
phrase is present in the abstract or lawful full text. Titles are ignored.
An empty contradiction map has status UNKNOWN. Paper counts do not resolve it.
"""

from __future__ import annotations

import hashlib

from spe_runtime.scholarly.identity import ScholarlyIdentity, make_identity
from spe_runtime.scholarly.models import (
    ClaimAssertion,
    ClaimEvidenceGraph,
    ClaimNode,
    ContentCue,
    ContradictionMap,
    ContradictionPair,
    EvidenceEdge,
    PaperRecord,
    UnknownItem,
)
from spe_runtime.scholarly.qualify_evidence import content_polarity, title_phrase

_POLARITIES = frozenset({"SUPPORT", "REFUTE", "NEUTRAL"})
_MAX_PAIRS = 50


def _edge(
    claim_id: str,
    record: PaperRecord,
    polarity: str,
    strength: str,
    *,
    scope: str,
    basis: str,
) -> EvidenceEdge:
    return EvidenceEdge(
        claim_id,
        record.record_id,
        polarity,
        strength,
        source_id=record.primary_source_id,
        canonical_key=record.identity.canonical_key,
        metadata_ref=record.record_id,
        evidence_scope=scope,
        polarity_basis=basis,
        source_ids=record.source_ids,
        retraction_state=record.retraction.kind.value,
        paper_type=record.paper_type,
    )


def claim_id_for(text: str) -> str:
    digest = hashlib.sha256(text.encode("utf-8")).hexdigest()[:16]
    return f"claim:{digest}"


def _shares(record_identity: ScholarlyIdentity, assertion: ClaimAssertion) -> bool:
    other = make_identity(
        doi=assertion.doi,
        pmid=assertion.pmid,
        pmcid=assertion.pmcid,
        arxiv=assertion.arxiv_id,
    )
    if other.status.value == "UNKNOWN":
        return False
    return any(
        (
            record_identity.doi is not None and record_identity.doi == other.doi,
            record_identity.pmid is not None and record_identity.pmid == other.pmid,
            record_identity.pmcid is not None and record_identity.pmcid == other.pmcid,
            record_identity.arxiv_id is not None
            and record_identity.arxiv_id == other.arxiv_id,
        )
    )


def build_graphs(
    *,
    query_text: str,
    records: tuple[PaperRecord, ...],
    assertions: tuple[ClaimAssertion, ...],
    content_cues: ContentCue | None = None,
) -> tuple[ClaimEvidenceGraph, ContradictionMap, tuple[UnknownItem, ...]]:
    """Attach structured polarity and opposing pairs to admitted works."""
    claim = ClaimNode(claim_id_for(query_text), query_text, "QUERY")
    cues = content_cues or ContentCue()
    gaps: list[UnknownItem] = []
    edges: list[EvidenceEdge] = []
    works = tuple(record for record in records if record.role == "work")
    matched_assertions: set[int] = set()
    polarity_by_record: dict[str, str] = {}
    scope_by_record: dict[str, str] = {}
    for record in works:
        hits = [
            (index, assertion)
            for index, assertion in enumerate(assertions)
            if _shares(record.identity, assertion)
        ]
        for index, _assertion in hits:
            matched_assertions.add(index)
        polarities = {assertion.polarity for _, assertion in hits}
        if not hits:
            content = content_polarity(record, cues)
            if content is None:
                title_only = title_phrase(record, cues)
                edges.append(
                    _edge(
                        claim.claim_id,
                        record,
                        "UNKNOWN",
                        "ABSENT",
                        scope="NONE",
                        basis="ABSENT",
                    )
                )
                detail = "no structured assertion or explicit content phrase"
                if title_only is not None:
                    detail = "phrase matched the title only"
                gaps.append(
                    UnknownItem(
                        code="CLAIM_POLARITY_UNKNOWN",
                        subject=record.record_id,
                        detail=detail,
                        blocks_valid=True,
                    )
                )
                continue
            polarity, scope, basis = content
            polarity_by_record[record.record_id] = polarity
            scope_by_record[record.record_id] = scope
            edges.append(
                _edge(
                    claim.claim_id,
                    record,
                    polarity,
                    "TENTATIVE",
                    scope=scope,
                    basis=basis,
                )
            )
            gaps.append(
                UnknownItem(
                    code="CONTENT_POLARITY_TENTATIVE",
                    subject=record.record_id,
                    detail=basis,
                    blocks_valid=False,
                )
            )
            if polarity == "SUPPORT" and record.retraction.kind.value in {
                "RETRACTION",
                "WITHDRAWAL",
            }:
                gaps.append(
                    UnknownItem(
                        code="RETRACTED_SUPPORT_NOT_USABLE",
                        subject=record.record_id,
                        detail=record.retraction.kind.value,
                        blocks_valid=True,
                    )
                )
            continue
        if len(polarities) != 1 or not polarities <= _POLARITIES:
            edges.append(
                _edge(
                    claim.claim_id,
                    record,
                    "UNKNOWN",
                    "STRUCTURED",
                    scope="STRUCTURED_METADATA",
                    basis="ASSERTION_CONFLICT",
                )
            )
            gaps.append(
                UnknownItem(
                    code="ASSERTION_POLARITY_CONFLICT",
                    subject=record.record_id,
                    detail=",".join(sorted(polarities)),
                    blocks_valid=True,
                )
            )
            continue
        polarity = next(iter(polarities))
        polarity_by_record[record.record_id] = polarity
        scope_by_record[record.record_id] = "STRUCTURED_METADATA"
        edges.append(
            _edge(
                claim.claim_id,
                record,
                polarity,
                "STRUCTURED",
                scope="STRUCTURED_METADATA",
                basis="CALLER_ASSERTION",
            )
        )
        if polarity == "SUPPORT" and record.retraction.kind.value in {
            "RETRACTION",
            "WITHDRAWAL",
        }:
            gaps.append(
                UnknownItem(
                    code="RETRACTED_SUPPORT_NOT_USABLE",
                    subject=record.record_id,
                    detail=record.retraction.kind.value,
                    blocks_valid=True,
                )
            )
    for index, assertion in enumerate(assertions):
        if index not in matched_assertions:
            gaps.append(
                UnknownItem(
                    code="ASSERTION_UNMATCHED",
                    subject=claim.claim_id,
                    detail=assertion.polarity,
                    blocks_valid=True,
                )
            )
    structured = [edge for edge in edges if edge.strength == "STRUCTURED" and edge.polarity != "UNKNOWN"]
    tentative = [edge for edge in edges if edge.strength == "TENTATIVE"]
    if not works:
        graph_status = "UNKNOWN"
    elif len(structured) == len(works) and all(
        edge.polarity != "UNKNOWN" for edge in edges
    ):
        graph_status = "VALID"
    elif structured or tentative:
        graph_status = "PARTIAL"
    else:
        graph_status = "UNKNOWN"
    support_ids = sorted(
        record_id
        for record_id, polarity in polarity_by_record.items()
        if polarity == "SUPPORT"
    )
    refute_ids = sorted(
        record_id
        for record_id, polarity in polarity_by_record.items()
        if polarity == "REFUTE"
    )
    pairs: list[ContradictionPair] = []
    if support_ids and refute_ids:
        for left in support_ids:
            for right in refute_ids:
                if len(pairs) >= _MAX_PAIRS:
                    break
                ordered = tuple(sorted((left, right)))
                left_scope = scope_by_record.get(ordered[0], "NONE")
                right_scope = scope_by_record.get(ordered[1], "NONE")
                if left_scope == "STRUCTURED_METADATA" and right_scope == "STRUCTURED_METADATA":
                    basis = "OPPOSING_STRUCTURED_POLARITY"
                    scope = "STRUCTURED_METADATA"
                else:
                    basis = "OPPOSING_CONTENT_POLARITY"
                    scope = left_scope if left_scope == right_scope else "MIXED"
                by_id = {record.record_id: record for record in works}
                pairs.append(
                    ContradictionPair(
                        claim_id=claim.claim_id,
                        left_record_id=ordered[0],
                        right_record_id=ordered[1],
                        basis=basis,
                        evidence_scope=scope,
                        uncertainty="UNRESOLVED",
                        left_paper_type=by_id[ordered[0]].paper_type,
                        right_paper_type=by_id[ordered[1]].paper_type,
                    )
                )
    if pairs:
        reason = pairs[0].basis if len({item.basis for item in pairs}) == 1 else "OPPOSING_EVIDENCE"
        contradiction = ContradictionMap("PRESENT", reason, tuple(pairs), resolution="NONE")
    else:
        contradiction = ContradictionMap(
            "UNKNOWN",
            "NONE_OBSERVED_IN_FETCHED_SET",
            (),
        )
        gaps.append(
            UnknownItem(
                code="NONE_OBSERVED_IN_FETCHED_SET",
                subject=claim.claim_id,
                detail="no structured support/refute pair in the fetched set",
                blocks_valid=False,
            )
        )
    graph = ClaimEvidenceGraph(graph_status, (claim,), tuple(edges))
    return graph, contradiction, tuple(gaps)
