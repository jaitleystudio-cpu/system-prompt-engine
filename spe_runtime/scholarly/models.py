"""Immutable records for the scholarly evidence package.

These types are owned by Lane C. They are not ContextCapsule, not XCAT
envelopes, and not K3 prompts. A later lane may map capsule candidates.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Any

from spe_runtime.scholarly.identity import ScholarlyIdentity


class NoticeKind(str, Enum):
    NONE = "NONE"
    CORRECTION = "CORRECTION"
    EXPRESSION_OF_CONCERN = "EXPRESSION_OF_CONCERN"
    WITHDRAWAL = "WITHDRAWAL"
    RETRACTION = "RETRACTION"
    UNKNOWN = "UNKNOWN"

    def to_dict(self) -> str:
        return self.value


class PackageStatus(str, Enum):
    VALID = "VALID"
    PARTIAL = "PARTIAL"
    REFUSED = "REFUSED"

    def to_dict(self) -> str:
        return self.value


@dataclass(frozen=True)
class RetractionState:
    """Correction or retraction state. UNKNOWN is not NONE."""

    kind: NoticeKind
    notice_ids: tuple[str, ...]
    evidence: tuple[str, ...]

    def to_dict(self) -> dict[str, Any]:
        return {
            "kind": self.kind.value,
            "notice_ids": list(self.notice_ids),
            "evidence": list(self.evidence),
        }


def unknown_retraction(evidence: tuple[str, ...] = ("NO_EXPLICIT_SIGNAL",)) -> RetractionState:
    return RetractionState(
        kind=NoticeKind.UNKNOWN,
        notice_ids=(),
        evidence=evidence,
    )


@dataclass(frozen=True)
class PaperDraft:
    """One source witness before identity merge."""

    source_id: str
    identity: ScholarlyIdentity
    title: str
    abstract: str | None
    authors: tuple[str, ...]
    year: int | None
    venue: str | None
    publication_types: tuple[str, ...]
    cited_by_count: int | None
    is_open_access: bool | None
    license: str
    landing_url: str | None
    retraction: RetractionState
    role: str
    replication_signal: str


@dataclass(frozen=True)
class RejectedDraft:
    """A hit that cannot enter the package."""

    source_id: str
    reason: str
    detail: str


@dataclass(frozen=True)
class PaperRecord:
    """Deduplicated scholarly work admitted to the package."""

    record_id: str
    identity: ScholarlyIdentity
    title: str
    abstract: str | None
    authors: tuple[str, ...]
    year: int | None
    venue: str | None
    publication_types: tuple[str, ...]
    cited_by_count: int | None
    is_open_access: bool | None
    license: str
    landing_url: str | None
    retraction: RetractionState
    source_ids: tuple[str, ...]
    primary_source_id: str
    role: str
    replication_signal: str
    full_text_status: str = "NOT_RETRIEVED"
    abstract_access: str = "ABSTRACT_ABSENT"
    access_limitation: str = "FULL_TEXT_NOT_FETCHED"
    related_preprint: str | None = None
    paper_type: str = "UNKNOWN"
    paper_type_basis: tuple[str, ...] = ()
    peer_review_status: str = "UNKNOWN"
    abstract_provenance: str = ""
    license_status: str = "UNKNOWN"
    full_text_source: str = ""
    retrieval_method: str = ""
    content_digest: str | None = None
    full_text_retrieved_at: str | None = None
    full_text_excerpt: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "record_id": self.record_id,
            "identity": self.identity.to_dict(),
            "title": self.title,
            "abstract": self.abstract,
            "authors": list(self.authors),
            "year": self.year,
            "venue": self.venue,
            "publication_types": list(self.publication_types),
            "cited_by_count": self.cited_by_count,
            "is_open_access": self.is_open_access,
            "license": self.license,
            "landing_url": self.landing_url,
            "retraction": self.retraction.to_dict(),
            "source_ids": list(self.source_ids),
            "primary_source_id": self.primary_source_id,
            "role": self.role,
            "replication_signal": self.replication_signal,
            "full_text_status": self.full_text_status,
            "abstract_access": self.abstract_access,
            "access_limitation": self.access_limitation,
            "related_preprint": self.related_preprint,
            "paper_type": self.paper_type,
            "paper_type_basis": list(self.paper_type_basis),
            "peer_review_status": self.peer_review_status,
            "abstract_provenance": self.abstract_provenance,
            "license_status": self.license_status,
            "full_text_source": self.full_text_source,
            "retrieval_method": self.retrieval_method,
            "content_digest": self.content_digest,
            "full_text_retrieved_at": self.full_text_retrieved_at,
            "full_text_excerpt": self.full_text_excerpt,
        }


@dataclass(frozen=True)
class ClaimAssertion:
    """Caller-supplied structured polarity. Title text is not evidence."""

    claim_text: str
    polarity: str
    doi: str | None = None
    pmid: str | None = None
    pmcid: str | None = None
    arxiv_id: str | None = None


@dataclass(frozen=True)
class ContentCue:
    """Explicit phrases that may appear in an abstract or lawful full text.

    A phrase that appears only in the title does not change polarity.
    """

    support_phrases: tuple[str, ...] = ()
    refute_phrases: tuple[str, ...] = ()


@dataclass(frozen=True)
class ReplicationHint:
    """Optional link between an original work and a replication work.

    The link is kept only when the replication record has structured type
    evidence or the confirmation phrase is in the abstract or full text.
    """

    original_doi: str
    replication_doi: str
    confirm_phrases: tuple[str, ...] = ()
    result_phrase: str | None = None


@dataclass(frozen=True)
class GroupMember:
    record_id: str
    basis: tuple[str, ...]

    def to_dict(self) -> dict[str, Any]:
        return {"record_id": self.record_id, "basis": list(self.basis)}


@dataclass(frozen=True)
class RecordGroups:
    foundational: tuple[GroupMember, ...]
    frontier: tuple[GroupMember, ...]
    contradictory: tuple[GroupMember, ...]
    replication: tuple[GroupMember, ...]

    def to_dict(self) -> dict[str, Any]:
        return {
            "foundational": [item.to_dict() for item in self.foundational],
            "frontier": [item.to_dict() for item in self.frontier],
            "contradictory": [item.to_dict() for item in self.contradictory],
            "replication": [item.to_dict() for item in self.replication],
        }


@dataclass(frozen=True)
class ClaimNode:
    claim_id: str
    text: str
    origin: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "claim_id": self.claim_id,
            "text": self.text,
            "origin": self.origin,
        }


@dataclass(frozen=True)
class EvidenceEdge:
    claim_id: str
    record_id: str
    polarity: str
    strength: str
    source_id: str = ""
    canonical_key: str = ""
    metadata_ref: str = ""
    evidence_scope: str = "NONE"
    polarity_basis: str = "ABSENT"
    source_ids: tuple[str, ...] = ()
    retraction_state: str = "UNKNOWN"
    paper_type: str = "UNKNOWN"

    def to_dict(self) -> dict[str, Any]:
        return {
            "claim_id": self.claim_id,
            "record_id": self.record_id,
            "polarity": self.polarity,
            "strength": self.strength,
            "source_id": self.source_id,
            "canonical_key": self.canonical_key,
            "metadata_ref": self.metadata_ref,
            "evidence_scope": self.evidence_scope,
            "polarity_basis": self.polarity_basis,
            "source_ids": list(self.source_ids),
            "retraction_state": self.retraction_state,
            "paper_type": self.paper_type,
        }


@dataclass(frozen=True)
class ClaimEvidenceGraph:
    status: str
    claims: tuple[ClaimNode, ...]
    edges: tuple[EvidenceEdge, ...]

    def to_dict(self) -> dict[str, Any]:
        return {
            "status": self.status,
            "claims": [item.to_dict() for item in self.claims],
            "edges": [item.to_dict() for item in self.edges],
        }


@dataclass(frozen=True)
class ContradictionPair:
    claim_id: str
    left_record_id: str
    right_record_id: str
    basis: str
    evidence_scope: str = "STRUCTURED_METADATA"
    uncertainty: str = "UNRESOLVED"
    left_paper_type: str = "UNKNOWN"
    right_paper_type: str = "UNKNOWN"

    def to_dict(self) -> dict[str, Any]:
        return {
            "claim_id": self.claim_id,
            "left_record_id": self.left_record_id,
            "right_record_id": self.right_record_id,
            "basis": self.basis,
            "evidence_scope": self.evidence_scope,
            "uncertainty": self.uncertainty,
            "left_paper_type": self.left_paper_type,
            "right_paper_type": self.right_paper_type,
        }


@dataclass(frozen=True)
class ContradictionMap:
    """Known opposing evidence. Empty does not mean none exist.

    resolution is NONE. A larger paper count is not a winner.
    """

    status: str
    reason: str
    pairs: tuple[ContradictionPair, ...]
    resolution: str = "NONE"

    def to_dict(self) -> dict[str, Any]:
        return {
            "status": self.status,
            "reason": self.reason,
            "pairs": [item.to_dict() for item in self.pairs],
            "resolution": self.resolution,
        }


@dataclass(frozen=True)
class ReplicationLink:
    """One original/replication pair. Missing original stays null."""

    replication_record_id: str
    original_record_id: str | None
    relationship: str
    result_relation: str
    evidence: tuple[str, ...]

    def to_dict(self) -> dict[str, Any]:
        return {
            "replication_record_id": self.replication_record_id,
            "original_record_id": self.original_record_id,
            "relationship": self.relationship,
            "result_relation": self.result_relation,
            "evidence": list(self.evidence),
        }


@dataclass(frozen=True)
class ReplicationMap:
    """Replication and benchmark links. Title keywords do not qualify."""

    status: str
    reason: str
    links: tuple[ReplicationLink, ...]

    def to_dict(self) -> dict[str, Any]:
        return {
            "status": self.status,
            "reason": self.reason,
            "links": [item.to_dict() for item in self.links],
        }


@dataclass(frozen=True)
class RateLimitState:
    """Observed request count. This lane does not retry."""

    request_count: int
    retry_after: tuple[str, ...]
    backoff_state: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "request_count": self.request_count,
            "retry_after": list(self.retry_after),
            "backoff_state": self.backoff_state,
        }


@dataclass(frozen=True)
class UnknownItem:
    code: str
    subject: str
    detail: str
    blocks_valid: bool

    def to_dict(self) -> dict[str, Any]:
        return {
            "code": self.code,
            "subject": self.subject,
            "detail": self.detail,
            "blocks_valid": self.blocks_valid,
        }


@dataclass(frozen=True)
class GapUnknownMap:
    items: tuple[UnknownItem, ...]

    def to_dict(self) -> dict[str, Any]:
        return {"items": [item.to_dict() for item in self.items]}

    def blocks_valid(self) -> bool:
        return any(item.blocks_valid for item in self.items)


@dataclass(frozen=True)
class CapsuleCandidate:
    """Context-capsule shaped candidate. Not wired into grounding or K3."""

    candidate_id: str
    integration_status: str
    record_id: str
    domain_id: str
    context_type: str
    claim_or_observation: str
    value: str
    source_id: str
    source_class: str
    authority_class: str
    retrieved_at: str
    valid_as_of: str
    fresh_until: str | None
    license: str
    allowed_use: str
    confidence: float
    support_status: str
    contradiction_group: str | None
    provenance_digest: str
    taint_labels: tuple[str, ...]
    sensitivity_labels: tuple[str, ...]

    def to_dict(self) -> dict[str, Any]:
        return {
            "candidate_id": self.candidate_id,
            "integration_status": self.integration_status,
            "record_id": self.record_id,
            "domain_id": self.domain_id,
            "context_type": self.context_type,
            "claim_or_observation": self.claim_or_observation,
            "value": self.value,
            "source_id": self.source_id,
            "source_class": self.source_class,
            "authority_class": self.authority_class,
            "retrieved_at": self.retrieved_at,
            "valid_as_of": self.valid_as_of,
            "fresh_until": self.fresh_until,
            "license": self.license,
            "allowed_use": self.allowed_use,
            "confidence": self.confidence,
            "support_status": self.support_status,
            "contradiction_group": self.contradiction_group,
            "provenance_digest": self.provenance_digest,
            "taint_labels": list(self.taint_labels),
            "sensitivity_labels": list(self.sensitivity_labels),
        }


@dataclass(frozen=True)
class EgressEvent:
    source_id: str
    host: str
    method: str
    path: str
    query_keys: tuple[str, ...]
    status: int
    retry_after: str | None = None
    attempt: int = 1

    def to_dict(self) -> dict[str, Any]:
        return {
            "source_id": self.source_id,
            "host": self.host,
            "method": self.method,
            "path": self.path,
            "query_keys": list(self.query_keys),
            "status": self.status,
            "retry_after": self.retry_after,
            "attempt": self.attempt,
        }


@dataclass(frozen=True)
class QuarantineEntry:
    reason: str
    source_id: str
    detail: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "reason": self.reason,
            "source_id": self.source_id,
            "detail": self.detail,
        }


@dataclass(frozen=True)
class EvidencePackage:
    """Validated scholarly evidence package for one research query."""

    package_id: str
    status: PackageStatus
    query_text: str
    as_of: str
    frontier_years: int
    max_per_source: int
    sources_requested: tuple[str, ...]
    records: tuple[PaperRecord, ...]
    quarantine: tuple[QuarantineEntry, ...]
    groups: RecordGroups
    claim_evidence_graph: ClaimEvidenceGraph
    contradiction_map: ContradictionMap
    gap_unknown_map: GapUnknownMap
    capsule_candidates: tuple[CapsuleCandidate, ...]
    egress: tuple[EgressEvent, ...]
    refusal_reasons: tuple[str, ...]
    outbound_query: str = ""
    private_withheld: bool = False
    withheld_labels: tuple[str, ...] = ()
    outbound_shapes: tuple[tuple[str, tuple[str, ...]], ...] = ()
    replication_map: ReplicationMap | None = None
    rate_limit: RateLimitState | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "package_id": self.package_id,
            "status": self.status.value,
            "semantic_authority": "NONE",
            "query": {
                "text": self.query_text,
                "as_of": self.as_of,
                "frontier_years": self.frontier_years,
                "max_per_source": self.max_per_source,
                "outbound_query": self.outbound_query,
                "private_withheld": self.private_withheld,
                "withheld_labels": list(self.withheld_labels),
                "outbound_shapes": [
                    {"source_id": source_id, "fields": list(fields)}
                    for source_id, fields in self.outbound_shapes
                ],
            },
            "integration": {
                "status": "NOT_WIRED",
                "later_path": (
                    "EvidencePackage → ContextCapsule → CategoryProtocol → K3"
                ),
                "wired_to_k3": False,
                "wired_to_xcat": False,
                "wired_to_quality": False,
                "semantic_authority": "NONE",
            },
            "sources_requested": list(self.sources_requested),
            "records": [item.to_dict() for item in self.records],
            "quarantine": [item.to_dict() for item in self.quarantine],
            "groups": self.groups.to_dict(),
            "claim_evidence_graph": self.claim_evidence_graph.to_dict(),
            "contradiction_map": self.contradiction_map.to_dict(),
            "replication_map": (
                self.replication_map.to_dict()
                if self.replication_map is not None
                else {"status": "UNKNOWN", "reason": "REPLICATION_ABSENT", "links": []}
            ),
            "rate_limit": (
                self.rate_limit.to_dict()
                if self.rate_limit is not None
                else {"request_count": len(self.egress), "retry_after": [], "backoff_state": "NO_RETRY"}
            ),
            "gap_unknown_map": self.gap_unknown_map.to_dict(),
            "capsule_candidates": [item.to_dict() for item in self.capsule_candidates],
            "egress": [item.to_dict() for item in self.egress],
            "refusal_reasons": list(self.refusal_reasons),
        }
