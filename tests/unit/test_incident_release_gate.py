"""R10 staging only: independent editorial/release attestations cannot publish."""
from __future__ import annotations

from dataclasses import replace
from types import SimpleNamespace

import pytest

from spe_runtime.ci_gate.receipt import generate_authenticated_receipt, generate_keypair
from spe_runtime.failure_genome.event_journal import EventKind, JournalEntry
from spe_runtime.failure_genome.incident_review import IncidentPreflight, ReviewState
from spe_runtime.failure_genome.investigation import InvestigationReport
from spe_runtime.seo.incident_release_gate import (
    EDITORIAL_SCOPE, RELEASE_SCOPE, SourceNoticeDraft,
    prepare_staging_notice, stage_payload,
)

FAILURE = "SPE-FG-2026-000400"
SHA = "a" * 64
URL = "https://status.claude.com/api/v2/incidents.json"
PUBLISHED = "2026-10-14T00:00:00Z"
OBSERVED = "2026-10-14T00:01:00Z"


def draft(**changes):
    return SourceNoticeDraft(**(dict(
        incident_id=FAILURE,
        slug="claude-status-incident-00400",
        source_url=URL,
        source_content_sha256=SHA,
        source_published_at=PUBLISHED,
        headline="Provider reports temporary degraded service",
        attributed_facts=("Provider status page reports degraded service.",),
        unknowns=("Independent SPE model reproduction has not been established.",),
        rights_reviewed=True,
    ) | changes))


def investigation(**changes):
    pre = IncidentPreflight(
        failure_id=FAILURE, state=ReviewState.READY_FOR_INDEPENDENT_REVIEW,
        issue_codes=(), source_urls=(URL,),
    )
    return InvestigationReport(**(dict(
        failure_id=FAILURE, gate_version="r1",
        state="READY_FOR_INDEPENDENT_REVIEW", reason_codes=(),
        preflight=pre, source_receipt_signature_valid=True,
        source_review_content_sha256=SHA,
        source_review_published_at=PUBLISHED,
        source_review_observed_at=OBSERVED,
        replay_capsule_integrity_valid=True,
        quality_disposition="UNMEASURED", quality_evidence={}, evidence_graph={},
    ) | changes))


def journal(**changes):
    return JournalEntry(**(dict(
        source_id="claude-status", event_id=FAILURE,
        content_sha256=SHA,
        observed_at=OBSERVED, source_published_at=PUBLISHED,
        event_kind=EventKind.NOTICE,
        chain_parent="0" * 64, chain_digest="b" * 64,
        predecessor_digest=None,
    ) | changes))


def signed(d=None, *, same_key=False):
    candidate = d or draft()
    private_ed, public_ed = generate_keypair()
    private_rel, public_rel = (private_ed, public_ed) if same_key else generate_keypair()
    editor = generate_authenticated_receipt(
        stage_payload(candidate, EDITORIAL_SCOPE),
        signing_key=private_ed, public_key=public_ed, key_id="editorial-owner",
    )
    releaser = generate_authenticated_receipt(
        stage_payload(candidate, RELEASE_SCOPE),
        signing_key=private_rel, public_key=public_rel, key_id="release-owner",
    )
    return dict(
        draft=candidate, investigation=investigation(), journal=journal(),
        editorial_receipt=editor, release_receipt=releaser,
        trusted_editor_keys={editor.signer_key_id: public_ed.hex()},
        trusted_release_keys={releaser.signer_key_id: public_rel.hex()},
    )


def test_two_distinct_signed_roles_prepare_inert_noindex_staging_only():
    r = prepare_staging_notice(**signed())
    assert r.state == "READY_FOR_DEPLOYMENT_OWNER_REVIEW"
    assert r.canonical_candidate == "https://systempromptengine.com/ai-incidents/claude-status-incident-00400"
    assert "NOT PROVEN" in r.html
    assert 'content="noindex, nofollow, noarchive"' in r.html
    assert "<script" not in r.html
    assert 'rel="nofollow noopener noreferrer"' in r.html
    assert not r.is_indexable
    assert not r.owner_deployment_authorized
    assert not r.root_cause_proven
    assert not r.repair_validated


@pytest.mark.parametrize("missing", [
    "editorial_receipt", "release_receipt",
    "trusted_editor_keys", "trusted_release_keys",
])
def test_missing_attestation_or_key_holds_and_renders_nothing(missing):
    args = signed()
    args[missing] = None
    r = prepare_staging_notice(**args)
    assert r.state == "HOLD"
    assert r.html is None
    assert not r.owner_deployment_authorized


def test_same_key_different_role_ids_is_not_independent():
    r = prepare_staging_notice(**signed(same_key=True))
    assert r.state == "HOLD"
    assert "EDITORIAL_AND_RELEASE_SIGNERS_NOT_INDEPENDENT" in r.reason_codes


@pytest.mark.parametrize("change", [
    {"source_content_sha256": "f" * 64},
    {"incident_id": "SPE-FG-2026-other"},
    {"source_published_at": "2026-10-14T00:20:00Z"},
    {"source_url": "https://attacker.example.org/fake.json"},
    {"claim_kind": "INTERNAL_MODEL_CAUSAL_PROOF"},
    {"rights_reviewed": False},
])
def test_even_dual_signed_mismatched_or_unsupported_claims_cannot_ship(change):
    args = signed(draft(**change))
    r = prepare_staging_notice(**args)
    assert r.state == "HOLD"
    assert r.html is None


def test_retraction_blocks_original_release():
    args = signed()
    args["journal"] = journal(event_kind=EventKind.RETRACTION)
    r = prepare_staging_notice(**args)
    assert r.state == "HOLD"
    assert "RETRACTED_SOURCE_REQUIRES_CORRECTION_PROCESS" in r.reason_codes


def test_source_discrepancy_and_false_replay_claims_cannot_succeed():
    args = signed()
    args["investigation"] = investigation(
        source_receipt_signature_valid=False,
        replay_capsule_integrity_valid=False,
    )
    r = prepare_staging_notice(**args)
    assert r.state == "HOLD"
    assert "SOURCE_EVIDENCE_BINDING_INVALID" in r.reason_codes


def test_xss_is_html_escaped_in_signed_review_staging():
    v = draft(headline="AI incident <script>alert(1)</script>",
              attributed_facts=('Provider said: <img src=x onerror=alert(1)>',))
    r = prepare_staging_notice(**signed(v))
    assert r.state == "READY_FOR_DEPLOYMENT_OWNER_REVIEW"
    assert "<script>" not in r.html
    assert "<img" not in r.html
    assert "&lt;script&gt;" in r.html
    assert "&lt;img" in r.html
    assert not r.is_indexable


def test_email_or_private_token_in_claim_blocks_public_staging():
    for value in ("Send to alice@example.org", "Use sk-ABCDEFGHIJKLMNOPQRSTUVWXYZ123456"):
        r = prepare_staging_notice(**signed(draft(attributed_facts=(value,))))
        assert r.state == "HOLD"
        assert "SOURCE_FACTS_OR_RIGHTS_NOT_REVIEWED" in r.reason_codes
        assert r.html is None


def test_mutated_editor_signature_or_article_payload_is_rejected():
    args = signed()
    args["editorial_receipt"] = replace(args["editorial_receipt"], signature_ed25519="0" * 128, verified=True)
    r = prepare_staging_notice(**args)
    assert r.state == "HOLD"
    assert "INDEPENDENT_EDITORIAL_SIGNATURE_MISSING" in r.reason_codes


def test_unapproved_page_is_never_an_indexing_candidate():
    r = prepare_staging_notice(**signed())
    assert r.is_indexable is False
    assert r.owner_deployment_authorized is False
    assert "STAGING_ONLY_HUMAN_RELEASE_REQUIRED" in r.reason_codes
