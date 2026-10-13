"""Failure Genome R13: owner-reviewed official correction/retraction evidence.

Reuses the existing R2 journal, R1 Ed25519 receipt-verification owner, and
R11 host locking. It refuses to infer RETRACTION from an untrusted feed status
or unreviewed text. Only a separately pinned reviewer signature tied to the
current journal head and exact original/source digests may append a correction
or retraction classification. No external fetching or public publication.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Mapping

from spe_runtime.ci_gate.receipt import AuthenticatedReceipt, verify_receipt_signature
from .event_journal import (
    EventKind, JournalDecision, JournalEntry, SourceEventJournal, SourceSnapshot,
    _utc, _digest_ok,
)

REVISION_SCHEMA = "spe.failure_genome.owner_revision_v1"
REVISION_SCOPE = "REVIEWED_PROVIDER_NOTICE_REVISION_NOT_FAILURE_PROOF"
_ALLOWED_REASONS = frozenset({
    "PROVIDER_OFFICIAL_CORRECTION",
    "PROVIDER_OFFICIAL_RETRACTION",
})
_PUBLIC_LABEL = "PUBLIC_STATUS_NOTICE_METADATA_ONLY"


@dataclass(frozen=True)
class OwnerReviewedRevision:
    source_id: str
    event_id: str
    source_url: str
    source_model_scope: str
    kind: EventKind
    reason_code: str
    content_sha256: str
    predecessor_digest: str
    source_published_at: str
    observed_at: str
    journal_parent_sha256: str


@dataclass(frozen=True)
class RevisionDecision:
    state: str
    reason_codes: tuple[str, ...]
    entry: JournalEntry | None = None
    independently_proven_provider_event: bool = False
    original_failure_explanation_verified: bool = False
    public_correction_published: bool = False
    publication_authorized: bool = False


def revision_receipt_payload(request: OwnerReviewedRevision) -> dict[str, object]:
    """A signer must review exact source content separately before signing."""
    return {
        "schema": REVISION_SCHEMA,
        "scope": REVISION_SCOPE,
        "source_id": request.source_id,
        "event_id": request.event_id,
        "source_url": request.source_url,
        "source_model_scope": request.source_model_scope,
        "kind": request.kind.value if isinstance(request.kind, EventKind) else "INVALID",
        "reason_code": request.reason_code,
        "content_sha256": request.content_sha256,
        "predecessor_digest": request.predecessor_digest,
        "source_published_at": request.source_published_at,
        "observed_at": request.observed_at,
        "journal_parent_sha256": request.journal_parent_sha256,
    }


def classify_reviewed_revision(
    journal: SourceEventJournal,
    request: OwnerReviewedRevision,
    *,
    reviewer_receipt: AuthenticatedReceipt | None,
    trusted_reviewer_keys: Mapping[str, str] | None,
) -> RevisionDecision:
    """Append only a previously signed, reviewable correction/withdrawal note.

    CALLER responsibility: run inside R11's exclusive durable session, ensure
    source was captured from approved HTTPS endpoint, and review notice terms.
    Self-signed receipts and an altered chain can never establish authority.
    """
    issues: set[str] = set()
    if not isinstance(journal, SourceEventJournal) or not journal.verify_chain():
        return RevisionDecision("HOLD", ("JOURNAL_INTEGRITY_INVALID",))
    if not isinstance(request, OwnerReviewedRevision):
        return RevisionDecision("HOLD", ("REVISION_REQUEST_INVALID",))
    if request.kind not in (EventKind.CORRECTION, EventKind.RETRACTION):
        issues.add("UNREVIEWED_STATUS_CANNOT_RECLASSIFY_REVISION")
    if (
        (request.kind is EventKind.CORRECTION and request.reason_code != "PROVIDER_OFFICIAL_CORRECTION")
        or (request.kind is EventKind.RETRACTION and request.reason_code != "PROVIDER_OFFICIAL_RETRACTION")
    ):
        issues.add("REASON_KIND_MISMATCH")
    if request.reason_code not in _ALLOWED_REASONS:
        issues.add("REASON_NOT_ALLOWLISTED")
    if not _digest_ok(request.content_sha256) or not _digest_ok(request.predecessor_digest):
        issues.add("SOURCE_CONTENT_DIGEST_INVALID")
    if _utc(request.source_published_at) is None or _utc(request.observed_at) is None:
        issues.add("SOURCE_TIMESTAMPS_UNVERIFIED")
    elif _utc(request.observed_at) < _utc(request.source_published_at):
        issues.add("OBSERVED_BEFORE_PUBLISHED")
    prior = journal.latest_entry(request.source_id, request.event_id)
    if prior is None:
        issues.add("PREDECESSOR_NOT_PRESENT")
    else:
        if prior.content_sha256 != request.predecessor_digest:
            issues.add("PREDECESSOR_DIGEST_MISMATCH")
        if prior.event_kind is EventKind.RETRACTION:
            issues.add("RETRACTED_EVENT_TERMINAL")
        if _utc(request.observed_at) and _utc(prior.observed_at) and _utc(request.observed_at) <= _utc(prior.observed_at):
            issues.add("NON_MONOTONIC_OBSERVATION")
        original = next((x for x in reversed(journal.observations)
                         if x.source_id == request.source_id and x.event_id == request.event_id), None)
        if (
            original is None or original.url != request.source_url
            or original.subject_model != request.source_model_scope
        ):
            issues.add("ORIGINAL_SOURCE_OR_MODEL_SCOPE_CHANGED")
    head = journal.entries[-1].chain_digest if journal.entries else "0" * 64
    if request.journal_parent_sha256 != head:
        issues.add("JOURNAL_CHANGED_SINCE_OWNER_REVIEW")
    if not isinstance(reviewer_receipt, AuthenticatedReceipt):
        issues.add("OWNER_REVIEW_SIGNATURE_MISSING")
    if not isinstance(trusted_reviewer_keys, Mapping) or not trusted_reviewer_keys:
        issues.add("REVIEWER_TRUST_ROOT_MISSING")
    if isinstance(reviewer_receipt, AuthenticatedReceipt) and isinstance(trusted_reviewer_keys, Mapping):
        pk = trusted_reviewer_keys.get(reviewer_receipt.signer_key_id)
        if not isinstance(pk, str) or len(pk) != 64 or any(c not in "0123456789abcdef" for c in pk):
            issues.add("REVIEWER_NOT_OWNER_ENROLLED")
        elif reviewer_receipt.spec_version != "0.1.0" or reviewer_receipt.canonical_payload != revision_receipt_payload(request):
            issues.add("REVIEWER_SIGNED_WRONG_REVISION")
        elif not verify_receipt_signature(reviewer_receipt, pk):
            issues.add("REVIEWER_SIGNATURE_INVALID")
    if issues:
        return RevisionDecision("HOLD", tuple(sorted(issues)))
    snapshot = SourceSnapshot(
        source_id=request.source_id, event_id=request.event_id,
        url=request.source_url, content_sha256=request.content_sha256,
        source_published_at=request.source_published_at,
        observed_at=request.observed_at, event_kind=request.kind,
        subject_model=request.source_model_scope,
        title=_PUBLIC_LABEL, predecessor_digest=request.predecessor_digest,
    )
    result = journal.ingest(snapshot)
    if result.decision is not JournalDecision.ADDED:
        return RevisionDecision("HOLD", ("JOURNAL_REJECTED_OWNER_REVIEWED_REVISION",) + result.reason_codes)
    return RevisionDecision(
        "RECORDED_OWNER_REVIEWED_METADATA_ONLY",
        ("OWNER_SIGNED_REVISION_CLASSIFICATION_NOT_EXTERNAL_TRUTH",),
        entry=result.entry,
    )
