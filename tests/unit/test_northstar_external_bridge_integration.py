"""R15 real Statuspage ID → internal SPE case → reviewer and editorial staging."""
from __future__ import annotations

from dataclasses import replace
from types import SimpleNamespace
import hashlib

import pytest

from spe_runtime.ci_gate.receipt import generate_keypair, generate_authenticated_receipt
from spe_runtime.failure_genome.event_journal import (
    SourceEventJournal, SourceAuthority, SourceSnapshot, EventKind, JournalDecision,
)
from spe_runtime.failure_genome.incident_identity import propose_incident_link, incident_link_payload
from spe_runtime.failure_genome.incident_review import IncidentPreflight, ReviewState
from spe_runtime.failure_genome.investigation import InvestigationReport
from spe_runtime.failure_genome.review_preview import render_internal_review_draft
from spe_runtime.seo.incident_release_gate import (
    SourceNoticeDraft, EDITORIAL_SCOPE, RELEASE_SCOPE,
    stage_payload, prepare_staging_notice,
)

SPE_ID = "SPE-FG-2026-009900"
PROVIDER_ID = "provider-incident-8zxy"
URL = "https://status.example.org/incidents/8zxy"
PUBLISHED = "2026-10-14T01:00:00Z"
OBSERVED = "2026-10-14T01:02:00Z"


def original_case():
    return SimpleNamespace(
        failure_id=SPE_ID, scope="GLOBAL", consent=True,
        model="example-provider-model", model_version="pinned-model-revision",
        minimal_reproducer="Public exercise content. No real provider requests.",
    )


def source_journal():
    j = SourceEventJournal({
        "official": SourceAuthority("official", "status.example.org", "/incidents"),
    })
    status = j.ingest(SourceSnapshot(
        source_id="official", event_id=PROVIDER_ID, url=URL,
        content_sha256=hashlib.sha256(b"Frozen provider notice").hexdigest(),
        source_published_at=PUBLISHED, observed_at=OBSERVED,
        event_kind=EventKind.NOTICE, subject_model="PROVIDER_STATUS_NOT_MODEL_RUN",
        title="Provider status change",
    ))
    assert status.decision is JournalDecision.ADDED
    return j


def signed_link(case, j):
    proposal = propose_incident_link(
        case, j, source_id="official", external_event_id=PROVIDER_ID,
    )
    sk, pk = generate_keypair()
    receipt = generate_authenticated_receipt(
        incident_link_payload(proposal),
        signing_key=sk, public_key=pk, key_id="identity-reviewer",
    )
    return dict(
        identity_journal=j,
        identity_proposal=proposal,
        identity_receipt=receipt,
        trusted_identity_keys={receipt.signer_key_id: pk.hex()},
    )


def evidence_report(j):
    source = j.entries[-1]
    pre = IncidentPreflight(
        failure_id=SPE_ID, state=ReviewState.READY_FOR_INDEPENDENT_REVIEW,
        issue_codes=(), source_urls=(URL,),
    )
    return InvestigationReport(
        failure_id=SPE_ID, gate_version="r1-test-fixture",
        state="READY_FOR_INDEPENDENT_REVIEW", reason_codes=(),
        preflight=pre, source_receipt_signature_valid=True,
        source_review_content_sha256=source.content_sha256,
        source_review_published_at=source.source_published_at,
        source_review_observed_at=source.observed_at,
        replay_capsule_integrity_valid=True,
        quality_disposition="UNMEASURED", quality_evidence={}, evidence_graph={},
    )


def notice_draft(j):
    last = j.entries[-1]
    return SourceNoticeDraft(
        incident_id=SPE_ID,
        slug="provider-external-incident-8zxy",
        source_url=URL,
        source_content_sha256=last.content_sha256,
        source_published_at=last.source_published_at,
        headline="Official provider notice under independent review",
        attributed_facts=("Provider reported an incident on its status page.",),
        unknowns=("SPE has not reproduced a failure on a provider model.",),
        rights_reviewed=True,
    )


def signed_staging(draft):
    sk_ed, pk_ed = generate_keypair()
    sk_rel, pk_rel = generate_keypair()
    editorial = generate_authenticated_receipt(
        stage_payload(draft, EDITORIAL_SCOPE),
        signing_key=sk_ed, public_key=pk_ed, key_id="separate-editorial",
    )
    release = generate_authenticated_receipt(
        stage_payload(draft, RELEASE_SCOPE),
        signing_key=sk_rel, public_key=pk_rel, key_id="separate-releaser",
    )
    return dict(
        editorial_receipt=editorial, release_receipt=release,
        trusted_editor_keys={editorial.signer_key_id: pk_ed.hex()},
        trusted_release_keys={release.signer_key_id: pk_rel.hex()},
    )


def test_real_external_id_mismatch_without_signed_link_is_hold():
    j, case = source_journal(), original_case()
    evidence = evidence_report(j)
    assert SPE_ID != PROVIDER_ID
    with pytest.raises(PermissionError, match="EXTERNAL_INCIDENT_IDENTITY_NOT_VERIFIED"):
        render_internal_review_draft(
            failure=case, investigation=evidence,
            journal_entry=j.entries[-1], headline="Provider incident",
        )
    outcome = prepare_staging_notice(
        draft=notice_draft(j), investigation=evidence,
        journal=j.entries[-1], **signed_staging(notice_draft(j)),
    )
    assert outcome.state == "HOLD"
    assert "EXTERNAL_INCIDENT_IDENTITY_UNVERIFIED" in outcome.reason_codes
    assert outcome.html is None


def test_signed_link_unlocks_only_private_review_and_noindex_staging():
    j, case = source_journal(), original_case()
    identity = signed_link(case, j)
    report = evidence_report(j)
    reviewer = render_internal_review_draft(
        failure=case, investigation=report, journal_entry=j.entries[-1],
        headline="Official provider status notice", **identity,
    )
    assert 'content="noindex, nofollow, noarchive"' in reviewer.html
    assert not reviewer.publication_authorized
    assert "Public exercise content" not in reviewer.html
    assert "Provider status notice" in reviewer.html
    staged = prepare_staging_notice(
        draft=notice_draft(j), investigation=report, journal=j.entries[-1],
        failure=case, **identity, **signed_staging(notice_draft(j)),
    )
    assert staged.state == "READY_FOR_DEPLOYMENT_OWNER_REVIEW"
    assert 'content="noindex, nofollow, noarchive"' in staged.html
    assert not staged.owner_deployment_authorized
    assert not staged.is_indexable
    assert not staged.external_model_failure_proven
    assert not staged.root_cause_proven
    assert not staged.repair_validated


def test_fake_bare_identity_assessment_never_substitutes_for_signature():
    j, case = source_journal(), original_case()
    identity = signed_link(case, j)
    identity["trusted_identity_keys"] = None
    with pytest.raises(PermissionError):
        render_internal_review_draft(
            failure=case, investigation=evidence_report(j),
            journal_entry=j.entries[-1], headline="fake case", **identity,
        )
    package = prepare_staging_notice(
        draft=notice_draft(j), investigation=evidence_report(j),
        journal=j.entries[-1], failure=case,
        **identity, **signed_staging(notice_draft(j)),
    )
    assert package.state == "HOLD"


def test_any_source_revision_invalidates_old_link_before_review():
    j, case = source_journal(), original_case()
    old = signed_link(case, j)
    parent = j.entries[-1].content_sha256
    assert j.ingest(SourceSnapshot(
        source_id="official", event_id=PROVIDER_ID, url=URL,
        content_sha256=hashlib.sha256(b"Updated provider notice").hexdigest(),
        source_published_at="2026-10-14T01:30:00Z",
        observed_at="2026-10-14T01:31:00Z",
        event_kind=EventKind.UPDATE, subject_model="PROVIDER_STATUS_NOT_MODEL_RUN",
        title="Public update", predecessor_digest=parent,
    )).decision is JournalDecision.ADDED
    report = evidence_report(j)
    with pytest.raises(PermissionError):
        render_internal_review_draft(
            failure=case, investigation=report,
            journal_entry=j.entries[-1], headline="Updated notice", **old,
        )
    candidate = prepare_staging_notice(
        draft=notice_draft(j), investigation=report,
        journal=j.entries[-1], failure=case,
        **old, **signed_staging(notice_draft(j)),
    )
    assert candidate.state == "HOLD"
    assert "EXTERNAL_INCIDENT_IDENTITY_UNVERIFIED" in candidate.reason_codes


def test_private_case_or_mismatched_journal_entry_remains_hold():
    j, case = source_journal(), original_case()
    identity = signed_link(case, j)
    private = SimpleNamespace(**(vars(case) | {"scope": "PRIVATE"}))
    with pytest.raises(PermissionError):
        render_internal_review_draft(
            failure=private, investigation=evidence_report(j),
            journal_entry=j.entries[-1], headline="Private", **identity,
        )
    altered = replace(j.entries[-1], event_id="spoofed-source-id")
    with pytest.raises(PermissionError):
        render_internal_review_draft(
            failure=case, investigation=evidence_report(j),
            journal_entry=altered, headline="Changed source", **identity,
        )


def test_retracted_source_never_becomes_positive_editorial_staging():
    j, case = source_journal(), original_case()
    parent = j.entries[-1].content_sha256
    assert j.ingest(SourceSnapshot(
        source_id="official", event_id=PROVIDER_ID, url=URL,
        content_sha256=hashlib.sha256(b"Provider withdrew the notice").hexdigest(),
        source_published_at="2026-10-14T02:00:00Z",
        observed_at="2026-10-14T02:02:00Z",
        event_kind=EventKind.RETRACTION, subject_model="PROVIDER_STATUS_NOT_MODEL_RUN",
        title="Official notice withdrawn", predecessor_digest=parent,
    )).decision is JournalDecision.ADDED
    identity = signed_link(case, j)
    report = evidence_report(j)
    outcome = prepare_staging_notice(
        draft=notice_draft(j), investigation=report,
        journal=j.entries[-1], failure=case,
        **identity, **signed_staging(notice_draft(j)),
    )
    assert outcome.state == "HOLD"
    assert "RETRACTED_SOURCE_REQUIRES_CORRECTION_PROCESS" in outcome.reason_codes
