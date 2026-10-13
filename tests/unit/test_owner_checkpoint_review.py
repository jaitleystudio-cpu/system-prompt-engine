"""R12 rollback and source-custody proof gates using local fake owner keys only."""
from __future__ import annotations

from dataclasses import replace
from datetime import datetime, timedelta, timezone

import pytest

from spe_runtime.ci_gate.receipt import (
    generate_keypair, generate_authenticated_receipt,
)
from spe_runtime.failure_genome.checkpoint_review import (
    OwnerPinnedFloor, checkpoint_payload, verify_owner_checkpoint,
)
from spe_runtime.failure_genome.durable_journal import DurableJournalStore
from spe_runtime.failure_genome.event_journal import (
    EventKind, JournalDecision, SourceAuthority, SourceSnapshot,
)


SOURCE = "official"
URL = "https://status.example.org/api/v2/incidents.json"
NOW = datetime(2026, 10, 14, 3, 0, tzinfo=timezone.utc)


def prepared(tmp_path):
    store = DurableJournalStore(
        tmp_path / "trusted-source.json",
        {SOURCE: SourceAuthority(SOURCE, "status.example.org", "/api/v2/incidents.json")},
    )
    with store.session() as journal:
        from hashlib import sha256
        event = SourceSnapshot(
            source_id=SOURCE, event_id="inc-01", url=URL,
            content_sha256=sha256(b"Official public incident notice").hexdigest(),
            source_published_at="2026-10-14T01:00:00Z",
            observed_at="2026-10-14T01:05:00Z",
            event_kind=EventKind.NOTICE,
            subject_model="PUBLIC_SERVICE_SCOPE",
            title="Untrusted title",
        )
        assert journal.ingest(event).decision is JournalDecision.ADDED
    return store


def genesis_floor(store):
    return OwnerPinnedFloor(
        minimum_sequence=0,
        known_record_count=0,
        known_head_sha256="0" * 64,
        allowlist_sha256=store.allowlist_sha256,
    )


def signed_checkpoint(store, *, sequence=1, issued_at=None):
    sk, pk = generate_keypair()
    receipt = generate_authenticated_receipt(
        checkpoint_payload(
            store.audit(), sequence=sequence,
            issued_at=issued_at or NOW.isoformat(),
        ),
        signing_key=sk, public_key=pk, key_id="external-checkpoint-owner",
    )
    return receipt, {receipt.signer_key_id: pk.hex()}


def assess(store, receipt, key_map, floor=None, *, now=None):
    with store.session() as journal:
        return verify_owner_checkpoint(
            journal=journal, expected_allowlist_sha256=store.allowlist_sha256,
            signed_receipt=receipt, trusted_checkpoint_keys=key_map,
            owner_pinned_floor=floor or genesis_floor(store),
            now=now or NOW,
        )


def test_owner_pinned_checkpoint_reaches_only_local_custody_verification(tmp_path):
    store = prepared(tmp_path)
    receipt, keys = signed_checkpoint(store)
    verdict = assess(store, receipt, keys)
    assert verdict.state == "OWNER_CHECKPOINT_VERIFIED_WITHIN_TESTED_LOCAL_SCOPE"
    assert verdict.signer_authenticated_against_owner_root
    assert verdict.previous_owner_pin_ancestry_verified
    assert verdict.record_count == 1
    assert verdict.next_floor_candidate.minimum_sequence == 1
    assert verdict.next_floor_candidate.known_record_count == 1
    assert verdict.next_floor_candidate.known_head_sha256 == store.audit().head_sha256
    assert not verdict.trusted_source_content_verified
    assert not verdict.model_failure_proven
    assert not verdict.rollback_protection_independently_deployed
    assert not verdict.publication_authorized


def test_next_owner_pin_requires_proven_ancestry(tmp_path):
    store = prepared(tmp_path)
    r1, k1 = signed_checkpoint(store)
    v1 = assess(store, r1, k1)
    with store.session() as journal:
        from hashlib import sha256
        parent = journal.entries[-1].content_sha256
        assert journal.ingest(SourceSnapshot(
            source_id=SOURCE, event_id="inc-01", url=URL,
            content_sha256=sha256(b"Public notice update").hexdigest(),
            source_published_at="2026-10-14T01:10:00Z",
            observed_at="2026-10-14T01:15:00Z",
            event_kind=EventKind.UPDATE,
            subject_model="PUBLIC_SERVICE_SCOPE",
            title="Public update",
            predecessor_digest=parent,
        )).decision is JournalDecision.ADDED
    r2, k2 = signed_checkpoint(store, sequence=2, issued_at=(NOW + timedelta(minutes=1)).isoformat())
    v2 = assess(store, r2, k2, floor=v1.next_floor_candidate, now=NOW + timedelta(minutes=2))
    assert v2.state == "OWNER_CHECKPOINT_VERIFIED_WITHIN_TESTED_LOCAL_SCOPE"
    assert v2.next_floor_candidate.known_record_count == 2
    assert v2.next_floor_candidate.minimum_sequence == 2
    old = assess(store, r1, k1, floor=v2.next_floor_candidate)
    assert old.state == "HOLD"
    assert "CHECKPOINT_SEQUENCE_ROLLBACK" in old.reason_codes or "CHECKPOINT_CONTENT_OR_SEQUENCE_MISMATCH" in old.reason_codes


def test_unenrolled_ephemeral_key_cannot_self_certify(tmp_path):
    store = prepared(tmp_path)
    receipt, _ = signed_checkpoint(store)
    verdict = assess(store, receipt, None)
    assert verdict.state == "HOLD"
    assert "CHECKPOINT_OWNER_TRUST_ROOT_MISSING" in verdict.reason_codes
    assert not verdict.signer_authenticated_against_owner_root


def test_bad_signature_fails_even_if_receipt_verified_flag_true(tmp_path):
    store = prepared(tmp_path)
    receipt, keys = signed_checkpoint(store)
    forged = replace(receipt, signature_ed25519="0" * 128, verified=True)
    verdict = assess(store, forged, keys)
    assert verdict.state == "HOLD"
    assert "CHECKPOINT_SIGNATURE_INVALID" in verdict.reason_codes
    assert not verdict.signer_authenticated_against_owner_root


def test_wrong_owner_root_is_not_accepted(tmp_path):
    store = prepared(tmp_path)
    receipt, keys = signed_checkpoint(store)
    _, wrong_public = generate_keypair()
    keys = {receipt.signer_key_id: wrong_public.hex()}
    verdict = assess(store, receipt, keys)
    assert verdict.state == "HOLD"
    assert not verdict.signer_authenticated_against_owner_root


@pytest.mark.parametrize("timestamp,now", [
    ("2026-10-10T01:00:00Z", NOW),
    ("2026-10-14T04:00:00Z", NOW),
    ("2026-10-14T01:00:00", NOW),
    ("not-a-timestamp", NOW),
])
def test_stale_future_or_timezone_naive_checkpoint_refused(tmp_path, timestamp, now):
    store = prepared(tmp_path)
    receipt, keys = signed_checkpoint(store, issued_at=timestamp)
    verdict = assess(store, receipt, keys, now=now)
    assert verdict.state == "HOLD"
    assert any(x in verdict.reason_codes for x in (
        "CHECKPOINT_TIMESTAMP_INVALID", "CHECKPOINT_STALE_OR_FUTURE_DATED",
    ))


def test_changed_allowlist_untrusted_floor_or_missing_anchor_is_hold(tmp_path):
    store = prepared(tmp_path)
    receipt, keys = signed_checkpoint(store)
    for floor in [
        replace(genesis_floor(store), allowlist_sha256="a" * 64),
        replace(genesis_floor(store), known_head_sha256="f" * 64),
        replace(genesis_floor(store), known_record_count=999),
        replace(genesis_floor(store), minimum_sequence=-1),
        replace(genesis_floor(store), known_head_sha256=None),
    ]:
        verdict = assess(store, receipt, keys, floor=floor)
        assert verdict.state == "HOLD"
    with store.session() as journal:
        no_floor = verify_owner_checkpoint(
            journal=journal, expected_allowlist_sha256=store.allowlist_sha256,
            signed_receipt=receipt, trusted_checkpoint_keys=keys,
            owner_pinned_floor=None, now=NOW,
        )
    assert no_floor.state == "HOLD"


def test_rewrite_and_recompute_local_hashes_cannot_match_old_signed_checkpoint(tmp_path):
    store = prepared(tmp_path)
    receipt, keys = signed_checkpoint(store)
    blob = __import__("json").loads(store.path.read_text("utf-8"))
    blob["observations"][0]["event_id"] = "attacker-new"
    blob["observations"][0]["chain_digest"] = "e" * 64
    from spe_runtime.failure_genome.durable_journal import _sha, _json_bytes
    blob["head"] = "e" * 64
    blob["document_sha256"] = _sha({k: v for k, v in blob.items() if k != "document_sha256"})
    store.path.write_bytes(_json_bytes(blob))
    with pytest.raises(Exception):
        store.audit()
    # A forged state cannot even reach the signed-checkpoint review gate.
    assert not receipt.canonical_payload["head_sha256"] == "e" * 64


def test_reused_checkpoint_sequence_with_different_head_is_hold(tmp_path):
    store = prepared(tmp_path)
    receipt, keys = signed_checkpoint(store, sequence=2)
    floor = replace(
        genesis_floor(store),
        minimum_sequence=2,
        known_record_count=0,
        known_head_sha256="0" * 64,
    )
    result = assess(store, receipt, keys, floor=floor)
    assert result.state == "HOLD"
    assert "CHECKPOINT_SEQUENCE_REUSED_ON_NEW_HEAD" in result.reason_codes


def test_synthetic_or_other_domain_scope_cannot_promote_checkpoint(tmp_path):
    store = prepared(tmp_path)
    receipt, keys = signed_checkpoint(store)
    wrong = replace(receipt, canonical_payload=receipt.canonical_payload | {"scope": "REAL_MODEL_VERIFIED"})
    verdict = assess(store, wrong, keys)
    assert verdict.state == "HOLD"
    assert "CHECKPOINT_CONTENT_OR_SEQUENCE_MISMATCH" in verdict.reason_codes


def test_no_key_enrollment_or_receipt_never_changes_live_journal(tmp_path):
    store = prepared(tmp_path)
    before = store.path.read_bytes()
    with store.session() as journal:
        verdict = verify_owner_checkpoint(
            journal=journal, expected_allowlist_sha256=store.allowlist_sha256,
            signed_receipt=None, trusted_checkpoint_keys=None,
            owner_pinned_floor=genesis_floor(store), now=NOW,
        )
    assert verdict.state == "HOLD"
    assert store.path.read_bytes() == before
