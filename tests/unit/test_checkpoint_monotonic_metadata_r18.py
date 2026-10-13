"""R18: signed current metadata must extend pinned PRIOR full-metadata history.

No provider API, secret, external trust store or publication. Cryptographic
signing keys are temporary deterministic test fixtures, never enrolled for
production authority.
"""
from __future__ import annotations

import hashlib
from dataclasses import replace
from datetime import datetime, timedelta, timezone

import pytest

from spe_runtime.ci_gate.receipt import generate_authenticated_receipt, generate_keypair
from spe_runtime.failure_genome.checkpoint_review import (
    OwnerPinnedFloor, checkpoint_payload, verify_owner_checkpoint,
)
from spe_runtime.failure_genome.durable_journal import (
    CustodyStatus, _allowlist_digest, metadata_document_sha256,
)
from spe_runtime.failure_genome.event_journal import (
    EventKind, JournalDecision, SourceAuthority, SourceEventJournal, SourceSnapshot,
)

NOW = datetime(2026, 10, 14, 6, 0, tzinfo=timezone.utc)
SOURCE = "official"
URL = "https://status.example.org/api/v2/incidents.json"
AUTH = {SOURCE: SourceAuthority(SOURCE, "status.example.org", "/api/v2/incidents.json")}
ALLOWED = _allowlist_digest(AUTH)


def observation(incident="inc-001", *, model="PROVIDER_STATUS", kind=EventKind.NOTICE,
                predecessor=None, version=1, observed="2026-10-14T01:05:00Z",
                published="2026-10-14T01:00:00Z"):
    return SourceSnapshot(
        source_id=SOURCE, event_id=incident, url=URL,
        content_sha256=hashlib.sha256(f"{incident}-v{version}".encode()).hexdigest(),
        source_published_at=published, observed_at=observed,
        event_kind=kind, subject_model=model, title="Untrusted public incident",
        predecessor_digest=predecessor,
    )


def journal(*, mutated_model=False, include_second=False):
    j = SourceEventJournal(AUTH)
    first = observation(model="FORGED_SCOPE" if mutated_model else "PROVIDER_STATUS")
    assert j.ingest(first).decision is JournalDecision.ADDED
    if include_second:
        assert j.ingest(observation(
            "inc-002", observed="2026-10-14T02:05:00Z",
            published="2026-10-14T02:00:00Z",
        )).decision is JournalDecision.ADDED
    return j


def status(j):
    return CustodyStatus(
        records=len(j.entries),
        head_sha256=j.entries[-1].chain_digest if j.entries else "0" * 64,
        allowlist_sha256=ALLOWED,
        metadata_document_sha256=metadata_document_sha256(j, ALLOWED),
    )


def keys():
    return generate_keypair()


def receipt(j, keypair, seq=1, issued_at=None):
    sk, pk = keypair
    r = generate_authenticated_receipt(
        checkpoint_payload(
            status(j), sequence=seq, issued_at=issued_at or NOW.isoformat(),
        ),
        signing_key=sk, public_key=pk, key_id="external-trust-authority",
    )
    return r, {r.signer_key_id: pk.hex()}


def review(j, signed, keys_map, floor, *, when=None):
    return verify_owner_checkpoint(
        journal=j, expected_allowlist_sha256=ALLOWED,
        signed_receipt=signed, trusted_checkpoint_keys=keys_map,
        owner_pinned_floor=floor, now=when or NOW,
    )


def genesis():
    return OwnerPinnedFloor(
        minimum_sequence=0, known_record_count=0,
        known_head_sha256="0" * 64, allowlist_sha256=ALLOWED,
    )


def test_prior_full_metadata_digest_is_preserved_on_verified_new_checkpoint():
    keypair = keys()
    original = journal()
    r1, trust1 = receipt(original, keypair, seq=1)
    first = review(original, r1, trust1, genesis())
    assert first.state == "OWNER_CHECKPOINT_VERIFIED_WITHIN_TESTED_LOCAL_SCOPE"
    assert first.next_floor_candidate.known_metadata_document_sha256 == status(original).metadata_document_sha256
    extended = journal(include_second=True)
    r2, trust2 = receipt(extended, keypair, seq=2, issued_at=(NOW + timedelta(minutes=1)).isoformat())
    second = review(extended, r2, trust2, first.next_floor_candidate, when=NOW + timedelta(minutes=2))
    assert second.state == "OWNER_CHECKPOINT_VERIFIED_WITHIN_TESTED_LOCAL_SCOPE"
    assert second.next_floor_candidate.known_metadata_document_sha256 == status(extended).metadata_document_sha256
    assert second.next_floor_candidate.known_record_count == 2
    assert not second.rollback_protection_independently_deployed
    assert not second.publication_authorized


@pytest.mark.parametrize("old_field", ["subject_model", "url"])
def test_full_metadata_prefix_tamper_rejected_even_with_new_valid_signature(old_field):
    keypair = keys()
    original = journal()
    r1, root1 = receipt(original, keypair, seq=1)
    first = review(original, r1, root1, genesis())
    floor = first.next_floor_candidate
    rewritten = SourceEventJournal(AUTH)
    source = original.observations[0]
    changes = (
        {"subject_model": "ATTACKER_DECLARED_MODEL_SCOPE"}
        if old_field == "subject_model" else
        {"url": URL + "/forged"}
    )
    assert rewritten.ingest(replace(source, **changes)).decision is JournalDecision.ADDED
    assert rewritten.ingest(observation(
        "inc-002", observed="2026-10-14T02:05:00Z",
        published="2026-10-14T02:00:00Z",
    )).decision is JournalDecision.ADDED
    unmodified = journal(include_second=True)
    # The legacy R2 head is identical because the old chain did not bind
    # model scope and source URL. Current R16 v2 signature is freshly valid.
    assert unmodified.entries[-1].chain_digest == rewritten.entries[-1].chain_digest
    assert status(unmodified).metadata_document_sha256 != status(rewritten).metadata_document_sha256
    r2, root2 = receipt(rewritten, keypair, seq=2, issued_at=(NOW + timedelta(minutes=1)).isoformat())
    verdict = review(rewritten, r2, root2, floor, when=NOW + timedelta(minutes=2))
    assert verdict.state == "HOLD"
    assert verdict.signer_authenticated_against_owner_root
    assert "OWNER_PINNED_METADATA_ANCESTRY_BROKEN" in verdict.reason_codes
    assert verdict.next_floor_candidate is None
    assert not verdict.rollback_protection_independently_deployed


def test_old_floor_without_metadata_digest_must_be_refused_not_downgraded():
    keypair = keys()
    original = journal()
    r1, root = receipt(original, keypair)
    good = review(original, r1, root, genesis())
    lost = replace(good.next_floor_candidate, known_metadata_document_sha256=None)
    extended = journal(include_second=True)
    r2, root2 = receipt(extended, keypair, seq=2, issued_at=(NOW + timedelta(minutes=1)).isoformat())
    result = review(extended, r2, root2, lost, when=NOW + timedelta(minutes=2))
    assert result.state == "HOLD"
    assert "OWNER_PINNED_METADATA_FLOOR_MISSING" in result.reason_codes


def test_wrong_prefix_digest_does_not_promote_even_with_valid_current_receipt():
    keypair = keys()
    original = journal()
    r1, root = receipt(original, keypair)
    accepted = review(original, r1, root, genesis())
    wrong = replace(accepted.next_floor_candidate, known_metadata_document_sha256="a" * 64)
    current = journal(include_second=True)
    r2, root2 = receipt(current, keypair, seq=2, issued_at=(NOW + timedelta(minutes=1)).isoformat())
    bad = review(current, r2, root2, wrong, when=NOW + timedelta(minutes=2))
    assert bad.state == "HOLD"
    assert "OWNER_PINNED_METADATA_ANCESTRY_BROKEN" in bad.reason_codes


def test_reused_sequence_cannot_sign_new_metadata_under_same_head():
    keypair = keys()
    first = journal()
    r1, keys1 = receipt(first, keypair, seq=1)
    accepted = review(first, r1, keys1, genesis())
    mutated = journal(mutated_model=True)
    assert mutated.entries[-1].chain_digest == first.entries[-1].chain_digest
    new_receipt, new_keys = receipt(mutated, keypair, seq=1)
    veto = review(mutated, new_receipt, new_keys, accepted.next_floor_candidate)
    assert veto.state == "HOLD"
    assert "CHECKPOINT_SEQUENCE_REUSED_ON_NEW_METADATA" in veto.reason_codes
    assert "OWNER_PINNED_METADATA_ANCESTRY_BROKEN" in veto.reason_codes


def test_forged_floor_with_malformed_metadata_digest_is_hold():
    original = journal()
    keypair = keys()
    r1, trusted = receipt(original, keypair)
    accepted = review(original, r1, trusted, genesis())
    for mutated_digest in ("invalid", "", "Z" * 64, None):
        tampered = replace(
            accepted.next_floor_candidate,
            known_metadata_document_sha256=mutated_digest,
        )
        bad = review(original, r1, trusted, tampered)
        assert bad.state == "HOLD"
        assert not bad.publication_authorized
