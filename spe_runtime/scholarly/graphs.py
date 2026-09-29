"""Claim–evidence graph and contradiction map.

Polarity is UNKNOWN unless the caller supplied a structured assertion for the
query claim. This module does not read stance out of titles or abstracts.
An empty contradiction map has status UNKNOWN. It does not mean the claim is
uncontradicted.
"""

from __future__ import annotations

import hashlib

from spe_runtime.scholarly.identity import ScholarlyIdentity, make_identity
from spe_runtime.scholarly.models import (
    ClaimAssertion,
    ClaimEvidenceGraph,
    ClaimNode,
    ContradictionMap,
    ContradictionPair,
    EvidenceEdge,
    PaperRecord,
    UnknownItem,
)

_POLARITIES = frozenset({"SUPPORT", "REFUTE", "NEUTRAL"})
_MAX_PAIRS = 50


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
) -> tuple[ClaimEvidenceGraph, ContradictionMap, tuple[UnknownItem, ...]]:
    """Attach structured polarity and opposing pairs to admitted works."""
    claim = ClaimNode(claim_id_for(query_text), query_text, "QUERY")
    gaps: list[UnknownItem] = []
    edges: list[EvidenceEdge] = []
    works = tuple(record for record in records if record.role == "work")
    matched_assertions: set[int] = set()
    polarity_by_record: dict[str, str] = {}
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
            edges.append(
                EvidenceEdge(claim.claim_id, record.record_id, "UNKNOWN", "ABSENT")
            )
            gaps.append(
                UnknownItem(
                    code="CLAIM_POLARITY_UNKNOWN",
                    subject=record.record_id,
                    detail="no structured assertion for this work",
                    blocks_valid=True,
                )
            )
            continue
        if len(polarities) != 1 or not polarities <= _POLARITIES:
            edges.append(
                EvidenceEdge(claim.claim_id, record.record_id, "UNKNOWN", "STRUCTURED")
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
        edges.append(
            EvidenceEdge(claim.claim_id, record.record_id, polarity, "STRUCTURED")
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
    if not works:
        graph_status = "UNKNOWN"
    elif len(structured) == len(works) and all(
        edge.polarity != "UNKNOWN" for edge in edges
    ):
        graph_status = "VALID"
    elif structured:
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
                pairs.append(
                    ContradictionPair(
                        claim_id=claim.claim_id,
                        left_record_id=ordered[0],
                        right_record_id=ordered[1],
                        basis="OPPOSING_STRUCTURED_POLARITY",
                    )
                )
    if pairs:
        contradiction = ContradictionMap("PRESENT", "OPPOSING_STRUCTURED_POLARITY", tuple(pairs))
    else:
        contradiction = ContradictionMap(
            "UNKNOWN",
            "CONTRADICTION_SIGNAL_ABSENT",
            (),
        )
        gaps.append(
            UnknownItem(
                code="CONTRADICTION_SIGNAL_ABSENT",
                subject=claim.claim_id,
                detail="no structured support/refute pair",
                blocks_valid=False,
            )
        )
    graph = ClaimEvidenceGraph(graph_status, (claim,), tuple(edges))
    return graph, contradiction, tuple(gaps)
