"""R13 signed correction/retraction classification: never infer from source text."""
from dataclasses import replace
import hashlib

import pytest

from spe_runtime.ci_gate.receipt import generate_keypair, generate_authenticated_receipt
from spe_runtime.failure_genome.event_journal import (
    EventKind, JournalDecision, SourceAuthority, SourceEventJournal, SourceSnapshot,
)
from spe_runtime.failure_genome.revision_review import (
    OwnerReviewedRevision, classify_reviewed_revision, revision_receipt_payload,
)

SOURCE = "provider"
URL = "https://status.example.org/incidents/001"
PUBLISHED = "2026-10-14T01:00:00Z"
OBSERVED = "2026-10-14T01:01:00Z"
CORRECTED_TIME = "2026-10-14T02:00:00Z"
CORRECTED_OBSERVED = "2026-10-14T02:01:00Z"


def digest(value):
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def journal():
    obj = SourceEventJournal({
        SOURCE: SourceAuthority(SOURCE, "status.example.org", "/incidents"),
    })
    assert obj.ingest(SourceSnapshot(
        source_id=SOURCE, event_id="incident-001", url=URL,
        content_sha256=digest("public incident notice"),
        source_published_at=PUBLISHED, observed_at=OBSERVED,
        event_kind=EventKind.NOTICE, subject_model="SERVICE_SCOPE_ONLY",
        title="Source Notice",
    )).decision is JournalDecision.ADDED
    return obj


def request(owner=None, kind=EventKind.CORRECTION, **mutants):
    obj = owner or journal()
    last = obj.latest_entry(SOURCE, "incident-001")
    fields = dict(
        source_id=SOURCE, event_id="incident-001", source_url=URL,
        source_model_scope="SERVICE_SCOPE_ONLY", kind=kind,
        reason_code="PROVIDER_OFFICIAL_CORRECTION" if kind is EventKind.CORRECTION else "PROVIDER_OFFICIAL_RETRACTION",
        content_sha256=digest("official provider corrected notice" if kind is EventKind.CORRECTION else "provider retraction"),
        predecessor_digest=last.content_sha256,
        source_published_at=CORRECTED_TIME, observed_at=CORRECTED_OBSERVED,
        journal_parent_sha256=obj.entries[-1].chain_digest,
    )
    return OwnerReviewedRevision(**(fields | mutants))


def signed(req):
    sk, pk = generate_keypair()
    receipt = generate_authenticated_receipt(
        revision_receipt_payload(req),
        signing_key=sk, public_key=pk, key_id="separately-enrolled-reviewer",
    )
    return receipt, {receipt.signer_key_id: pk.hex()}


def apply(obj, req, *, receipt=None, roots=None):
    if receipt is None and roots is None:
        receipt, roots = signed(req)
    return classify_reviewed_revision(
        obj, req, reviewer_receipt=receipt, trusted_reviewer_keys=roots,
    )


def test_separately_signed_correction_appends_without_public_approval():
    obj = journal()
    req = request(obj)
    result = apply(obj, req)
    assert result.state == "RECORDED_OWNER_REVIEWED_METADATA_ONLY"
    assert result.entry.event_kind is EventKind.CORRECTION
    assert result.entry.predecessor_digest == digest("public incident notice")
    assert obj.verify_chain()
    assert len(obj.entries) == 2
    assert not result.independently_proven_provider_event
    assert not result.original_failure_explanation_verified
    assert not result.public_correction_published
    assert not result.publication_authorized


def test_retraction_is_terminal_after_owner_review():
    obj = journal()
    assert apply(obj, request(obj)).state == "RECORDED_OWNER_REVIEWED_METADATA_ONLY"
    updated = request(
        obj, EventKind.RETRACTION,
        observed_at="2026-10-14T03:05:00Z",
        source_published_at="2026-10-14T03:00:00Z",
    )
    out = apply(obj, updated)
    assert out.state == "RECORDED_OWNER_REVIEWED_METADATA_ONLY"
    assert obj.entries[-1].event_kind is EventKind.RETRACTION
    assert obj.verify_chain()
    next_req = request(
        obj, EventKind.CORRECTION,
        observed_at="2026-10-14T04:05:00Z",
        source_published_at="2026-10-14T04:00:00Z",
        content_sha256=digest("new contrary notice"),
    )
    reject = apply(obj, next_req)
    assert reject.state == "HOLD"
    assert "RETRACTED_EVENT_TERMINAL" in reject.reason_codes
    assert len(obj.entries) == 3


def test_plain_update_or_unsigned_claim_does_not_reclassify_a_correction():
    obj = journal()
    req = request(obj, EventKind.UPDATE)
    res = apply(obj, req)
    assert res.state == "HOLD"
    assert "UNREVIEWED_STATUS_CANNOT_RECLASSIFY_REVISION" in res.reason_codes
    assert len(obj.entries) == 1
    missing = classify_reviewed_revision(
        obj, request(obj), reviewer_receipt=None, trusted_reviewer_keys=None,
    )
    assert missing.state == "HOLD"
    assert len(obj.entries) == 1


@pytest.mark.parametrize("mutant", [
    {"source_url": "https://status.evil.test/incidents/001"},
    {"source_model_scope": "OTHER_MODEL"},
    {"predecessor_digest": "a" * 64},
    {"journal_parent_sha256": "b" * 64},
    {"observed_at": "2026-10-14T01:00:00Z"},
    {"source_published_at": "2026-10-14T04:00:00Z"},
    {"content_sha256": "not_sha256"},
    {"reason_code": "PROVIDER_OFFICIAL_RETRACTION"},
    {"reason_code": "OWNER_COMMAND_OVERWRITE"},
])
def test_signed_but_wrong_source_parent_time_reason_or_content_holds(mutant):
    obj = journal()
    res = apply(obj, request(obj, **mutant))
    assert res.state == "HOLD"
    assert len(obj.entries) == 1


def test_wrong_or_self_signed_key_never_enrolls_itself():
    obj = journal()
    req = request(obj)
    receipt, _keys = signed(req)
    no_root = classify_reviewed_revision(
        obj, req, reviewer_receipt=receipt, trusted_reviewer_keys=None,
    )
    assert no_root.state == "HOLD"
    assert "REVIEWER_TRUST_ROOT_MISSING" in no_root.reason_codes
    _, wrong_pk = generate_keypair()
    wrong = classify_reviewed_revision(
        obj, req, reviewer_receipt=receipt,
        trusted_reviewer_keys={receipt.signer_key_id: wrong_pk.hex()},
    )
    assert wrong.state == "HOLD"
    assert "REVIEWER_SIGNATURE_INVALID" in wrong.reason_codes
    assert len(obj.entries) == 1


def test_mutated_signed_payload_cannot_be_replayed():
    obj = journal()
    req = request(obj)
    receipt, roots = signed(req)
    bad = replace(receipt, canonical_payload=receipt.canonical_payload | {"event_id": "forged"})
    result = classify_reviewed_revision(
        obj, req, reviewer_receipt=bad, trusted_reviewer_keys=roots,
    )
    assert result.state == "HOLD"
    assert "REVIEWER_SIGNED_WRONG_REVISION" in result.reason_codes


def test_owner_review_does_not_bypass_journal_duplicate_defense():
    obj = journal()
    req = request(obj, content_sha256=digest("public incident notice"))
    result = apply(obj, req)
    assert result.state == "HOLD"
    assert "JOURNAL_REJECTED_OWNER_REVIEWED_REVISION" in result.reason_codes
    assert len(obj.entries) == 1


def test_invalid_source_identity_or_missing_predecessor_never_mints_record():
    obj = journal()
    req = request(obj, event_id="incident-does-not-exist")
    result = apply(obj, req)
    assert result.state == "HOLD"
    assert "PREDECESSOR_NOT_PRESENT" in result.reason_codes
    assert len(obj.entries) == 1


def test_owner_signature_is_single_use_against_changed_journal_head():
    obj = journal()
    req = request(obj)
    receipt, roots = signed(req)
    assert apply(obj, req, receipt=receipt, roots=roots).entry is not None
    replay = apply(obj, req, receipt=receipt, roots=roots)
    assert replay.state == "HOLD"
    assert "JOURNAL_CHANGED_SINCE_OWNER_REVIEW" in replay.reason_codes


def test_no_extra_egress_creds_data_or_publish_flags_stored_in_journal():
    obj = journal()
    outcome = apply(obj, request(obj))
    assert outcome.entry is not None
    assert "PUBLIC_STATUS_NOTICE_METADATA_ONLY" not in str(obj.entries)
    assert "Bearer" not in str(obj.entries)
    assert not outcome.publication_authorized
