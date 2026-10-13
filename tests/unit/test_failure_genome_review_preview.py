"""R4 independently reviewed publication drafting: must NEVER make a public asset."""
from dataclasses import replace
from types import SimpleNamespace
import hashlib

import pytest

from spe_runtime.failure_genome.event_journal import EventKind, JournalEntry
from spe_runtime.failure_genome.incident_review import IncidentPreflight, ReviewState
from spe_runtime.failure_genome.investigation import InvestigationReport
from spe_runtime.failure_genome.review_preview import render_internal_review_draft

FAILURE_ID = "SPE-FG-2026-000789"
CONTENT = hashlib.sha256(b"frozen provider notice").hexdigest()
URL = "https://status.example.org/incidents/789"
PUBLISHED = "2026-10-13T10:00:00Z"
OBSERVED = "2026-10-13T10:02:00Z"


def specimen(**changes):
    d = dict(failure_id=FAILURE_ID, scope="GLOBAL", consent=True,
             model="example-model", model_version="rev-2026-10",
             minimal_reproducer="Private reproducer — never published")
    return SimpleNamespace(**(d | changes))


def investigation(**changes):
    pre = IncidentPreflight(
        failure_id=FAILURE_ID, state=ReviewState.READY_FOR_INDEPENDENT_REVIEW,
        issue_codes=(), source_urls=(URL,),
    )
    d = dict(
        failure_id=FAILURE_ID, gate_version="r1-test",
        state="READY_FOR_INDEPENDENT_REVIEW", reason_codes=(),
        preflight=pre, source_receipt_signature_valid=True,
        source_review_content_sha256=CONTENT,
        source_review_published_at=PUBLISHED,
        source_review_observed_at=OBSERVED,
        replay_capsule_integrity_valid=True,
        quality_disposition="IMPROVED", quality_evidence={}, evidence_graph={},
    )
    return InvestigationReport(**(d | changes))


def journal(**changes):
    d = dict(source_id="status", event_id=FAILURE_ID,
             content_sha256=CONTENT, source_published_at=PUBLISHED,
             observed_at=OBSERVED, event_kind=EventKind.NOTICE,
             chain_parent="0" * 64, chain_digest="a" * 64,
             predecessor_digest=None)
    return JournalEntry(**(d | changes))


def render(**changes):
    d = dict(failure=specimen(), investigation=investigation(),
             journal_entry=journal(), headline="Potential model degradation reported")
    return render_internal_review_draft(**(d | changes))


def test_internal_review_is_nonindexable_and_never_published():
    r = render()
    assert r.status == "REVIEW_REQUIRED"
    assert not r.publication_authorized
    assert not r.externally_verified
    assert 'content="noindex, nofollow, noarchive"' in r.html
    assert 'rel="nofollow noopener noreferrer"' in r.html
    assert "Private reproducer" not in r.html
    assert "verified repair" not in r.html.lower().replace("independently verified repair", "")
    assert "INTERNAL REVIEW" in r.html
    assert "<script" not in r.html
    assert hashlib.sha256(r.html.encode("utf-8")).hexdigest() == r.content_sha256


def test_untrusted_headline_escaped_and_credentials_redacted():
    r = render(headline='<script>alert(1)</script> Send sk-ABCDEFGHIJKLMNOPQRSTUVWXYZ123456 to alice@example.org')
    assert "<script>" not in r.html
    assert "&lt;script&gt;" in r.html
    assert "sk-ABCDEFGHIJKLMNOPQRSTUVWXYZ123456" not in r.html
    assert "alice@example.org" not in r.html
    assert "[REDACTED_API_KEY]" in r.html
    assert "[REDACTED_EMAIL]" in r.html


@pytest.mark.parametrize("field", [
    {"failure": specimen(scope="PRIVATE")},
    {"failure": specimen(consent=False)},
    {"failure": specimen(failure_id="OTHER")},
    {"investigation": investigation(state="HOLD")},
    {"investigation": investigation(source_receipt_signature_valid=False)},
    {"investigation": investigation(replay_capsule_integrity_valid=False)},
    {"investigation": investigation(preflight=replace(investigation().preflight, state=ReviewState.HOLD))},
])
def test_private_missing_signed_review_or_hold_is_refused(field):
    with pytest.raises(PermissionError):
        render(**field)


@pytest.mark.parametrize("field", [
    {"journal_entry": journal(content_sha256="b" * 64)},
    {"journal_entry": journal(event_id="OTHER")},
    {"journal_entry": journal(source_published_at="2026-10-13T09:00:00Z")},
    {"journal_entry": journal(observed_at="2026-10-13T10:03:00Z")},
    {"investigation": investigation(source_review_content_sha256=None)},
])
def test_snapshot_cross_owner_binding_rejects_mismatches(field):
    with pytest.raises(PermissionError, match="INCIDENT_SOURCE_SNAPSHOT_NOT_BOUND"):
        render(**field)


def test_retraction_is_still_unverified_not_a_success_claim():
    r = render(journal_entry=journal(event_kind=EventKind.RETRACTION))
    assert "RETRACTION" in r.html
    assert not r.publication_authorized
    assert "UNKNOWN remains UNKNOWN" in r.html


def test_bounded_title_only():
    with pytest.raises(ValueError):
        render(headline=" ")
    with pytest.raises(ValueError):
        render(headline="A" * 301)
