"""Failure Genome R4: inert, unindexable independent-review draft only.

Not a publishing owner. It renders a safe *local reviewer preview* only after
R1 metadata signature, R2 snapshot and capsule integrity are mutually bound.
No public articles, SEO submissions, notifications or live site mutations.
"""
from __future__ import annotations

import hashlib
from dataclasses import dataclass
from html import escape
from typing import TYPE_CHECKING

from .event_journal import EventKind, JournalEntry
from .incident_review import ReviewState
from .investigation import InvestigationReport
from .store import sanitize_text

if TYPE_CHECKING:
    from .models import FailureGenomeEntry


@dataclass(frozen=True)
class ReviewDraft:
    failure_id: str
    html: str
    content_sha256: str
    status: str = "REVIEW_REQUIRED"
    robots: str = "noindex, nofollow, noarchive"
    publication_authorized: bool = False
    externally_verified: bool = False


def render_internal_review_draft(
    *,
    failure: FailureGenomeEntry,
    investigation: InvestigationReport,
    journal_entry: JournalEntry,
    headline: str,
) -> ReviewDraft:
    """Require exact cross-owner binding, produce a redacted HTML draft.

    No external incident or repair may be claimed as proven by this function.
    It is impossible to return publication_authorized=True.
    """
    if (
        failure.scope != "GLOBAL" or failure.consent is not True or
        failure.failure_id != investigation.failure_id or
        investigation.preflight.state != ReviewState.READY_FOR_INDEPENDENT_REVIEW or
        investigation.state != "READY_FOR_INDEPENDENT_REVIEW" or
        not investigation.source_receipt_signature_valid or
        not investigation.replay_capsule_integrity_valid
    ):
        raise PermissionError("SOURCE_OR_INCIDENT_REVIEW_NOT_READY")
    if (
        journal_entry.event_id != failure.failure_id or
        not isinstance(investigation.source_review_content_sha256, str) or
        journal_entry.content_sha256 != investigation.source_review_content_sha256 or
        journal_entry.source_published_at != investigation.source_review_published_at or
        journal_entry.observed_at != investigation.source_review_observed_at
    ):
        raise PermissionError("INCIDENT_SOURCE_SNAPSHOT_NOT_BOUND")
    if not isinstance(headline, str) or not headline.strip() or len(headline) > 300:
        raise ValueError("INVALID_HEADLINE")
    if not isinstance(journal_entry.event_kind, EventKind):
        raise ValueError("INVALID_JOURNAL_KIND")
    # Provenance of the source content and signed metadata does not establish
    # whether any third-party model was actually wrong, or why.
    safe_headline = escape(sanitize_text(headline.strip()), quote=True)
    safe_model = escape(sanitize_text(failure.model), quote=True)
    safe_failure_id = escape(failure.failure_id, quote=True)
    safe_event_type = escape(journal_entry.event_kind.value, quote=True)
    source_links = "".join(
        '<li><a href="' + escape(u, quote=True)
        + '" rel="nofollow noopener noreferrer" referrerpolicy="no-referrer">'
        + escape(u, quote=True) + "</a></li>"
        for u in investigation.preflight.source_urls
    )
    # Do not include reproducer text, output, cause, model benchmark scores,
    # observer identifiers, raw receipts, private values or candidate repairs.
    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="robots" content="noindex, nofollow, noarchive">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
  <meta name="referrer" content="no-referrer">
  <title>INTERNAL REVIEW ONLY — SPE AI incident specimen</title>
</head>
<body>
  <main>
    <h1>INTERNAL REVIEW — NOT VERIFIED FOR PUBLICATION</h1>
    <p>Incident {safe_failure_id} | Model: {safe_model}</p>
    <h2>Unverified third-party report</h2>
    <p>{safe_headline}</p>
    <p>Source update classification: {safe_event_type}</p>
    <h2>Sources for independent review</h2>
    <ul>{source_links}</ul>
    <h2>Evidence boundaries</h2>
    <p>Source-review signature and Replay Capsule digest were checked.
    No authorized real-model reproduction, provider root cause, or
    independently verified repair is established by this preview.</p>
    <p>UNKNOWN remains UNKNOWN. Human and product publishing authority is
    required outside this mechanism. Do not publish, index, or advertise
    this reviewer-only preview as an AI incident resolution.</p>
  </main>
</body>
</html>"""
    return ReviewDraft(
        failure_id=failure.failure_id, html=html,
        content_sha256=hashlib.sha256(html.encode("utf-8")).hexdigest(),
    )
