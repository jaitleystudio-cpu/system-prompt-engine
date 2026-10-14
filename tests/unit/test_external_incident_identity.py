"""R14: provider event IDs differ from SPE-FG IDs and must be explicitly bound."""
from dataclasses import replace
from types import SimpleNamespace
import hashlib

import pytest

from spe_runtime.ci_gate.receipt import generate_authenticated_receipt, generate_keypair
from spe_runtime.failure_genome.event_journal import (
    SourceEventJournal, SourceAuthority, SourceSnapshot, EventKind, JournalDecision,
)
from spe_runtime.failure_genome.incident_identity import (
    propose_incident_link, incident_link_payload, verify_incident_link,
)

ID = "SPE-FG-2026-004002"
EXTERNAL = "official-provider-incident-777"
SOURCE = "provider-status"
URL = "https://status.example.org/api/v2/incidents.json"


def failure(**changes):
    return SimpleNamespace(**(dict(
        failure_id=ID, scope="GLOBAL", consent=True,
        model="provider-model-x", model_version="pinned-revision-2026-10",
        minimal_reproducer="Public fixture reproducer (not a real-model run)",
    ) | changes))


def journal():
    j = SourceEventJournal({
        SOURCE: SourceAuthority(SOURCE, "status.example.org", "/api/v2/incidents.json"),
    })
    outcome = j.ingest(SourceSnapshot(
        source_id=SOURCE, event_id=EXTERNAL, url=URL,
        content_sha256=hashlib.sha256(b"provider public status").hexdigest(),
        source_published_at="2026-10-14T00:00:00Z",
        observed_at="2026-10-14T00:01:00Z",
        event_kind=EventKind.NOTICE, subject_model="PROVIDER_SERVICE_NOT_PINNED_MODEL",
        title="Provider status report",
    ))
    assert outcome.decision is JournalDecision.ADDED
    return j


def signed(proposal):
    sk, pk = generate_keypair()
    receipt = generate_authenticated_receipt(
        incident_link_payload(proposal), signing_key=sk,
        public_key=pk, key_id="external-identity-reviewer",
    )
    return receipt, {receipt.signer_key_id: pk.hex()}


def review(j, f, p, rec=None, keys=None):
    if rec is None and keys is None:
        rec, keys = signed(p)
    return verify_incident_link(
        journal=j, failure=f, proposal=p,
        owner_receipt=rec, trusted_identity_keys=keys,
    )


def test_realistic_external_and_internal_ids_are_distinct_but_signed_link_possible():
    j, f = journal(), failure()
    p = propose_incident_link(f, j, source_id=SOURCE, external_event_id=EXTERNAL)
    assert p.failure_id == ID
    assert p.external_event_id == EXTERNAL
    assert p.external_event_id != p.failure_id
    assert p.source_content_sha256 == j.entries[-1].content_sha256
    assert p.journal_head_sha256 == j.entries[-1].chain_digest
    outcome = review(j, f, p)
    assert outcome.state == "OWNER_REVIEWED_SOURCE_IDENTITY_ONLY"
    assert outcome.owner_signature_valid
    assert outcome.source_identity_bound_within_scope
    assert not outcome.provider_model_revision_proven
    assert not outcome.external_failure_reproduced
    assert not outcome.root_cause_verified
    assert not outcome.repair_verified
    assert not outcome.publication_authorized


def test_private_unconsented_failure_cannot_obtain_public_identity_link():
    j = journal()
    for f in (failure(scope="PRIVATE"), failure(consent=False), failure(consent=1)):
        p = propose_incident_link(f, j, source_id=SOURCE, external_event_id=EXTERNAL)
        result = review(j, f, p)
        assert result.state == "HOLD"
        assert "PRIVATE_OR_UNCONSENTED_FAILURE" in result.reason_codes


def test_self_signed_receipt_without_enrolled_root_refused():
    j, f = journal(), failure()
    p = propose_incident_link(f, j, source_id=SOURCE, external_event_id=EXTERNAL)
    rec, _ = signed(p)
    result = review(j, f, p, rec=rec, keys=None)
    assert result.state == "HOLD"
    assert not result.owner_signature_valid
    assert "INDEPENDENT_IDENTITY_TRUST_ROOT_MISSING" in result.reason_codes


def test_key_mismatch_or_tampered_signature_holds():
    j, f = journal(), failure()
    p = propose_incident_link(f, j, source_id=SOURCE, external_event_id=EXTERNAL)
    rec, keys = signed(p)
    _, wrong_pk = generate_keypair()
    bad_key = review(j, f, p, rec=rec, keys={rec.signer_key_id: wrong_pk.hex()})
    assert bad_key.state == "HOLD"
    tampered = review(j, f, p, rec=replace(rec, signature_ed25519="0"*128, verified=True), keys=keys)
    assert tampered.state == "HOLD"
    assert "IDENTITY_OWNER_SIGNATURE_INVALID" in tampered.reason_codes


@pytest.mark.parametrize("mutation", [
    {"source_url": "https://attacker.invalid/status"},
    {"source_content_sha256": "a"*64},
    {"source_published_at": "2026-10-14T00:02:00Z"},
    {"source_observed_at": "2026-10-14T00:02:00Z"},
    {"model_revision": "provider-changed-model"},
    {"model_id": "some-other-model"},
    {"reproducer_sha256": "b"*64},
    {"journal_head_sha256": "f"*64},
    {"source_chain_digest": "f"*64},
    {"external_event_id": "spoofed-id"},
    {"failure_id": "SPE-FG-FAKE"},
])
def test_signed_but_forged_id_or_source_snapshot_fails(mutation):
    j, f = journal(), failure()
    p = propose_incident_link(f, j, source_id=SOURCE, external_event_id=EXTERNAL)
    tampered = replace(p, **mutation)
    result = review(j, f, tampered)
    assert result.state == "HOLD"
    assert "STALE_OR_FORGED_EXTERNAL_SOURCE_MAPPING" in result.reason_codes or "SOURCE_IDENTITY_NOT_FOUND_OR_INVALID" in result.reason_codes


def test_signed_link_is_invalidated_after_any_new_journal_head():
    j, f = journal(), failure()
    p = propose_incident_link(f, j, source_id=SOURCE, external_event_id=EXTERNAL)
    rec, keys = signed(p)
    assert review(j, f, p, rec=rec, keys=keys).owner_signature_valid
    assert j.ingest(SourceSnapshot(
        source_id=SOURCE, event_id="other-incident", url=URL,
        content_sha256=hashlib.sha256(b"other incident").hexdigest(),
        source_published_at="2026-10-14T00:10:00Z",
        observed_at="2026-10-14T00:11:00Z",
        event_kind=EventKind.NOTICE, subject_model="PROVIDER_SERVICE_NOT_PINNED_MODEL",
        title="Other source incident",
    )).decision is JournalDecision.ADDED
    result = review(j, f, p, rec=rec, keys=keys)
    assert result.state == "HOLD"
    assert "STALE_OR_FORGED_EXTERNAL_SOURCE_MAPPING" in result.reason_codes


def test_source_revision_requires_fresh_identity_review():
    j, f = journal(), failure()
    p = propose_incident_link(f, j, source_id=SOURCE, external_event_id=EXTERNAL)
    rec, keys = signed(p)
    assert j.ingest(SourceSnapshot(
        source_id=SOURCE, event_id=EXTERNAL, url=URL,
        content_sha256=hashlib.sha256(b"corrected source").hexdigest(),
        source_published_at="2026-10-14T00:10:00Z",
        observed_at="2026-10-14T00:11:00Z",
        event_kind=EventKind.UPDATE, subject_model="PROVIDER_SERVICE_NOT_PINNED_MODEL",
        title="New source version",
        predecessor_digest=j.entries[0].content_sha256,
    )).decision is JournalDecision.ADDED
    old_result = review(j, f, p, rec=rec, keys=keys)
    assert old_result.state == "HOLD"
    new_proposal = propose_incident_link(f, j, source_id=SOURCE, external_event_id=EXTERNAL)
    assert review(j, f, new_proposal).state == "OWNER_REVIEWED_SOURCE_IDENTITY_ONLY"


def test_missing_external_event_or_invalid_internal_id_refused():
    j = journal()
    with pytest.raises(ValueError, match="EXTERNAL_SOURCE_ID_NOT_IN_JOURNAL"):
        propose_incident_link(failure(), j, source_id=SOURCE, external_event_id="nonexistent")
    with pytest.raises(ValueError, match="INVALID_FAILURE_ID"):
        propose_incident_link(failure(failure_id="fake"), j, source_id=SOURCE, external_event_id=EXTERNAL)
