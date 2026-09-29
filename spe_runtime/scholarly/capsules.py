"""Context-capsule candidates owned by the scholarly lane.

Candidates are not grounding ContextCapsule objects and are not passed to K3.
Confidence is capped at 0.6 because this lane does not verify full text.
support_status is never SUPPORTED.
"""

from __future__ import annotations

import json
import hashlib

from spe_runtime.scholarly.models import (
    CapsuleCandidate,
    ContradictionMap,
    EvidenceEdge,
    PaperRecord,
    UnknownItem,
)

_CONFIDENCE_CEILING = 0.6
_REVIEW_TYPES = frozenset({"review", "systematic-review", "meta-analysis"})
_ARTICLE_TYPES = frozenset({"journal-article", "article"})


def _digest(payload: object) -> str:
    raw = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return "sha256:" + hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _source_class(record: PaperRecord) -> str:
    """arXiv alone is a preprint. A later journal witness does not erase it."""
    types = set(record.publication_types)
    sources = set(record.source_ids)
    publisher = sources - {"arxiv"}
    if "arxiv" in sources and not publisher:
        return "preprint"
    if types & _REVIEW_TYPES and publisher:
        return "systematic_review"
    if record.replication_signal == "STRUCTURED" and publisher:
        return "replication"
    if "preprint" in types and not (types & _ARTICLE_TYPES):
        return "preprint"
    if types & _ARTICLE_TYPES and publisher:
        return "peer_reviewed"
    if record.primary_source_id == "arxiv" or "preprint" in types:
        return "preprint"
    return "unknown"


def _source_token(record: PaperRecord) -> str:
    identity = record.identity
    if identity.doi:
        return f"doi:{identity.doi}"
    if identity.pmid:
        return f"pmid:{identity.pmid}"
    if identity.pmcid:
        return f"pmcid:{identity.pmcid}"
    if identity.arxiv_id:
        return f"arxiv:{identity.arxiv_id}"
    return record.record_id


def _confidence(record: PaperRecord, polarity: str, source_class: str) -> float:
    kind = record.retraction.kind.value
    if kind in {"RETRACTION", "WITHDRAWAL"}:
        score = 0.0
    elif kind == "UNKNOWN":
        score = 0.2
    elif kind == "EXPRESSION_OF_CONCERN":
        score = 0.25
    elif source_class == "preprint":
        score = 0.35
    elif kind == "CORRECTION":
        score = 0.45
    elif polarity == "SUPPORT":
        score = 0.6
    else:
        score = 0.55
    return min(score, _CONFIDENCE_CEILING)


def _support(record: PaperRecord, polarity: str, source_class: str) -> str:
    kind = record.retraction.kind.value
    if kind in {"RETRACTION", "WITHDRAWAL", "UNKNOWN", "EXPRESSION_OF_CONCERN"}:
        return "UNVERIFIED"
    if polarity == "UNKNOWN":
        return "UNVERIFIED"
    if source_class == "preprint" and polarity == "SUPPORT":
        return "PREPRINT_ONLY"
    if polarity == "SUPPORT":
        return "PARTIALLY_SUPPORTED"
    if polarity == "REFUTE":
        return "CONTRADICTED"
    if polarity == "NEUTRAL":
        return "INSUFFICIENT"
    return "UNVERIFIED"


def build_capsule_candidates(
    *,
    query_text: str,
    as_of: str,
    records: tuple[PaperRecord, ...],
    edges: tuple[EvidenceEdge, ...],
    contradictions: ContradictionMap,
) -> tuple[tuple[CapsuleCandidate, ...], tuple[UnknownItem, ...]]:
    """Build unwired capsule candidates for admitted works."""
    polarity = {edge.record_id: edge.polarity for edge in edges}
    contradicted = {
        pair.left_record_id for pair in contradictions.pairs
    } | {pair.right_record_id for pair in contradictions.pairs}
    claim_ids = {pair.claim_id for pair in contradictions.pairs}
    contradiction_group = next(iter(claim_ids)) if len(claim_ids) == 1 else None
    gaps: list[UnknownItem] = []
    candidates: list[CapsuleCandidate] = []
    for record in records:
        if record.role != "work":
            continue
        source_class = _source_class(record)
        if source_class == "unknown":
            gaps.append(
                UnknownItem(
                    code="SOURCE_CLASS_UNKNOWN",
                    subject=record.record_id,
                    detail=",".join(record.publication_types) or "none",
                    blocks_valid=True,
                )
            )
        edge_polarity = polarity.get(record.record_id, "UNKNOWN")
        kind = record.retraction.kind.value
        taints = ["UNTRUSTED_SOURCE"]
        if edge_polarity != "UNKNOWN":
            taints.append("CALLER_ASSERTED")
        if kind == "RETRACTION":
            taints.append("RETRACTED")
        elif kind == "WITHDRAWAL":
            taints.append("WITHDRAWN")
        elif kind == "CORRECTION":
            taints.append("CORRECTED")
        elif kind == "EXPRESSION_OF_CONCERN":
            taints.append("EXPRESSION_OF_CONCERN")
        elif kind == "UNKNOWN":
            taints.append("RETRACTION_STATE_UNKNOWN")
        if source_class == "preprint":
            taints.append("PREPRINT")
        elif "arxiv" in record.source_ids:
            taints.append("PREPRINT_PROVENANCE_RETAINED")
        if record.replication_signal == "TITLE_HEURISTIC":
            taints.append("TITLE_HEURISTIC_REPLICATION")
        allowed = (
            "CITATION_ONLY_RETRACTED"
            if kind in {"RETRACTION", "WITHDRAWAL"}
            else "SUMMARIZE_WITH_ATTRIBUTION"
        )
        digest = _digest(
            {
                "identity": record.identity.to_dict(),
                "title": record.title,
                "retraction": record.retraction.to_dict(),
                "source_ids": list(record.source_ids),
            }
        )
        candidates.append(
            CapsuleCandidate(
                candidate_id=f"cap:{record.record_id}",
                integration_status="CANDIDATE_NOT_WIRED",
                record_id=record.record_id,
                domain_id="research",
                context_type="SCHOLARLY_EVIDENCE",
                claim_or_observation=query_text,
                value=record.title,
                source_id=_source_token(record),
                source_class=source_class,
                authority_class="REFERENCE",
                retrieved_at=f"{as_of}T00:00:00Z",
                valid_as_of=as_of,
                fresh_until=None,
                license=record.license,
                allowed_use=allowed,
                confidence=_confidence(record, edge_polarity, source_class),
                support_status=_support(record, edge_polarity, source_class),
                contradiction_group=(
                    contradiction_group if record.record_id in contradicted else None
                ),
                provenance_digest=digest,
                taint_labels=tuple(taints),
                sensitivity_labels=("PUBLIC_LITERATURE",),
            )
        )
    return tuple(candidates), tuple(gaps)
