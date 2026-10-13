"""SEO owner R10: dual-reviewed, source-bound non-indexable release staging.

This is NOT an autonomous public publishing endpoint. Only independently
pinned editorial AND release signatures can prepare an offline staging page.
The page is always noindex and requires the separate existing deployment owner
to approve and publish. It attributes the source report, never fabricates
observed model errors, provider-internal cause, or verified prompt repairs.
"""
from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass
from html import escape
from typing import TYPE_CHECKING, Mapping
from urllib.parse import urlsplit

from spe_runtime.ci_gate.receipt import AuthenticatedReceipt, verify_receipt_signature
from spe_runtime.failure_genome.event_journal import EventKind, JournalEntry, SourceEventJournal
from spe_runtime.failure_genome.incident_identity import IncidentLinkProposal, verified_external_entry_binding
from spe_runtime.failure_genome.investigation import InvestigationReport
from spe_runtime.failure_genome.store import sanitize_text

if TYPE_CHECKING:
    from spe_runtime.failure_genome.models import FailureGenomeEntry

CANONICAL_ORIGIN = "https://systempromptengine.com"
EDITORIAL_SCOPE = "SPE_OFFICIAL_SOURCE_ATTRIBUTION_REVIEW_ONLY"
RELEASE_SCOPE = "SPE_STAGING_RELEASE_ELIGIBILITY_NOT_DEPLOYMENT"
_SLUG = re.compile(r"^[a-z0-9][a-z0-9-]{4,95}$")


@dataclass(frozen=True)
class SourceNoticeDraft:
    incident_id: str
    slug: str
    source_url: str
    source_content_sha256: str
    source_published_at: str
    headline: str
    attributed_facts: tuple[str, ...]
    unknowns: tuple[str, ...]
    rights_reviewed: bool = False
    claim_kind: str = "PROVIDER_STATUS_NOTICE"


@dataclass(frozen=True)
class StagingPackage:
    state: str
    reason_codes: tuple[str, ...]
    canonical_candidate: str | None = None
    html: str | None = None
    content_sha256: str | None = None
    owner_deployment_authorized: bool = False
    is_indexable: bool = False
    external_model_failure_proven: bool = False
    root_cause_proven: bool = False
    repair_validated: bool = False


def _digest(value: object) -> str:
    return hashlib.sha256(json.dumps(
        value, sort_keys=True, separators=(",", ":"),
        ensure_ascii=False, allow_nan=False,
    ).encode("utf-8")).hexdigest()


def stage_payload(draft: SourceNoticeDraft, scope: str) -> dict[str, object]:
    """Exact editorial/release signature payload; signed roles must differ."""
    return {
        "version": "spe.ai_incident.staging.v1",
        "scope": scope,
        "incident_id": draft.incident_id,
        "slug": draft.slug,
        "source_url": draft.source_url,
        "source_sha256": draft.source_content_sha256,
        "source_published_at": draft.source_published_at,
        "body_sha256": _digest({
            "headline": draft.headline,
            "attributed_facts": draft.attributed_facts,
            "unknowns": draft.unknowns,
            "rights_reviewed": draft.rights_reviewed,
            "claim_kind": draft.claim_kind,
        }),
        "canonical_candidate": f"{CANONICAL_ORIGIN}/ai-incidents/{draft.slug}",
    }


def _receipt_valid(
    receipt: AuthenticatedReceipt | None,
    allowed_keys: Mapping[str, str] | None,
    expected: dict[str, object],
) -> tuple[bool, str | None]:
    if not isinstance(receipt, AuthenticatedReceipt):
        return False, None
    if not isinstance(allowed_keys, Mapping) or not allowed_keys:
        return False, None
    pinned = allowed_keys.get(receipt.signer_key_id)
    if (
        not isinstance(pinned, str) or len(pinned) != 64
        or receipt.spec_version != "0.1.0"
        or receipt.canonical_payload != expected
    ):
        return False, None
    if not verify_receipt_signature(receipt, pinned):
        return False, None
    return True, pinned


def _safe_public_sentence(sentence: object, max_chars: int) -> bool:
    if not isinstance(sentence, str) or not sentence.strip() or len(sentence) > max_chars:
        return False
    if sanitize_text(sentence) != sentence or "\x00" in sentence:
        return False
    return all(ord(char) >= 32 or char == "\n" for char in sentence)


def prepare_staging_notice(
    *,
    draft: SourceNoticeDraft,
    investigation: InvestigationReport,
    journal: JournalEntry,
    editorial_receipt: AuthenticatedReceipt | None = None,
    release_receipt: AuthenticatedReceipt | None = None,
    trusted_editor_keys: Mapping[str, str] | None = None,
    trusted_release_keys: Mapping[str, str] | None = None,
    failure: FailureGenomeEntry | None = None,
    identity_journal: SourceEventJournal | None = None,
    identity_proposal: IncidentLinkProposal | None = None,
    identity_receipt: AuthenticatedReceipt | None = None,
    trusted_identity_keys: Mapping[str, str] | None = None,
) -> StagingPackage:
    """Return staging-only HTML if and only if source + two roles are bound."""
    codes: set[str] = set()
    if not isinstance(draft, SourceNoticeDraft) or not isinstance(investigation, InvestigationReport) or not isinstance(journal, JournalEntry):
        return StagingPackage("HOLD", ("INVALID_EVIDENCE_TYPES",))
    if (
        not _SLUG.fullmatch(draft.slug) or draft.claim_kind != "PROVIDER_STATUS_NOTICE"
        or not draft.rights_reviewed
        or not _safe_public_sentence(draft.headline, 180)
        or not 1 <= len(draft.attributed_facts) <= 8
        or not 1 <= len(draft.unknowns) <= 8
        or any(not _safe_public_sentence(x, 400) for x in (*draft.attributed_facts, *draft.unknowns))
    ):
        codes.add("SOURCE_FACTS_OR_RIGHTS_NOT_REVIEWED")
    if (
        draft.incident_id != investigation.failure_id or
        investigation.state != "READY_FOR_INDEPENDENT_REVIEW" or
        not investigation.source_receipt_signature_valid or
        not investigation.replay_capsule_integrity_valid or
        draft.source_content_sha256 != journal.content_sha256 or
        draft.source_content_sha256 != investigation.source_review_content_sha256 or
        draft.source_published_at != journal.source_published_at or
        draft.source_published_at != investigation.source_review_published_at or
        journal.observed_at != investigation.source_review_observed_at or
        draft.source_url not in investigation.preflight.source_urls or
        not isinstance(journal.event_kind, EventKind)
    ):
        codes.add("SOURCE_EVIDENCE_BINDING_INVALID")
    # External provider IDs are not SPE-FG IDs. Require the actual case
    # specimen and recheck the enrolled signer against the current journal.
    if journal.event_id != draft.incident_id:
        if (
            failure is None or getattr(failure, "failure_id", None) != draft.incident_id
            or not verified_external_entry_binding(
                failure=failure, entry=journal, journal=identity_journal,
                proposal=identity_proposal, receipt=identity_receipt,
                owner_keys=trusted_identity_keys,
            )
        ):
            codes.add("EXTERNAL_INCIDENT_IDENTITY_UNVERIFIED")
    if journal.event_kind is EventKind.RETRACTION:
        codes.add("RETRACTED_SOURCE_REQUIRES_CORRECTION_PROCESS")
    origin = urlsplit(draft.source_url)
    if origin.scheme != "https" or not origin.hostname or origin.username or origin.password or origin.fragment:
        codes.add("UNSAFE_ATTRIBUTED_SOURCE_URL")
    editor_ok, editor_key = _receipt_valid(
        editorial_receipt, trusted_editor_keys, stage_payload(draft, EDITORIAL_SCOPE),
    )
    release_ok, release_key = _receipt_valid(
        release_receipt, trusted_release_keys, stage_payload(draft, RELEASE_SCOPE),
    )
    if not editor_ok:
        codes.add("INDEPENDENT_EDITORIAL_SIGNATURE_MISSING")
    if not release_ok:
        codes.add("INDEPENDENT_RELEASE_SIGNATURE_MISSING")
    if editor_ok and release_ok and editor_key == release_key:
        codes.add("EDITORIAL_AND_RELEASE_SIGNERS_NOT_INDEPENDENT")
    if codes:
        return StagingPackage("HOLD", tuple(sorted(codes)))

    esc = lambda x: escape(x, quote=True)
    facts = "\n".join(f"<li>{esc(x)}</li>" for x in draft.attributed_facts)
    unknowns = "\n".join(f"<li>{esc(x)}</li>" for x in draft.unknowns)
    safe_url = esc(draft.source_url)
    candidate = f"{CANONICAL_ORIGIN}/ai-incidents/{draft.slug}"
    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="robots" content="noindex, nofollow, noarchive">
  <meta name="referrer" content="no-referrer">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; base-uri 'none'; form-action 'none'; style-src 'unsafe-inline'">
  <title>RELEASE STAGING — {esc(draft.headline)}</title>
</head>
<body>
  <main>
    <p>INTERNAL RELEASE STAGING — NOT YET PUBLICLY VERIFIED OR PUBLISHED</p>
    <h1>{esc(draft.headline)}</h1>
    <p>Source attribution: the following statements are from a provider notice,
    not independent model reproduction or internal causal proof.</p>
    <h2>Attributed source statements</h2>
    <ul>{facts}</ul>
    <h2>What SPE cannot independently establish yet</h2>
    <ul>{unknowns}</ul>
    <p>Model behavior reproduced: NOT PROVEN. Provider root cause: NOT PROVEN.
    Tested repair: NOT PROVEN. No automatic publication authorization.</p>
    <p>Original public status feed:
    <a href="{safe_url}" rel="nofollow noopener noreferrer" referrerpolicy="no-referrer">{safe_url}</a></p>
  </main>
</body>
</html>"""
    return StagingPackage(
        "READY_FOR_DEPLOYMENT_OWNER_REVIEW",
        ("STAGING_ONLY_HUMAN_RELEASE_REQUIRED",),
        canonical_candidate=candidate,
        html=html,
        content_sha256=hashlib.sha256(html.encode("utf-8")).hexdigest(),
    )
