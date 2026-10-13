"""R2 event journal adversarial tests; no network, secrets, or publishing."""
import hashlib
from dataclasses import replace

import pytest

from spe_runtime.failure_genome.event_journal import (
    EventKind,
    JournalDecision,
    SourceAuthority,
    SourceEventJournal,
    SourceSnapshot,
)


def new_journal(max_events=20):
    return SourceEventJournal(
        {"provider": SourceAuthority("provider", "status.example.org", "/incidents")},
        max_events=max_events,
    )


def sample(**changes):
    data = {
        "source_id": "provider",
        "event_id": "incident_101",
        "url": "https://status.example.org/incidents/101",
        "content_sha256": hashlib.sha256(b"original public source response").hexdigest(),
        "source_published_at": "2026-10-13T10:00:00Z",
        "observed_at": "2026-10-13T10:01:00Z",
        "event_kind": EventKind.NOTICE,
        "subject_model": "model-v123",
        "title": "Illustrative provider incident",
    }
    return SourceSnapshot(**(data | changes))


def test_original_then_update_then_correction_then_retraction_is_append_only():
    journal = new_journal()
    first = journal.ingest(sample())
    assert first.decision == JournalDecision.ADDED
    original = first.entry
    assert original.publication_authorized is False
    assert original.external_incident_confirmed is False
    second_hash = hashlib.sha256(b"official update").hexdigest()
    second = journal.ingest(sample(
        content_sha256=second_hash, predecessor_digest=original.content_sha256,
        observed_at="2026-10-13T10:03:00Z", event_kind=EventKind.UPDATE,
    ))
    assert second.decision == JournalDecision.ADDED
    third_hash = hashlib.sha256(b"corrected incident claim").hexdigest()
    third = journal.ingest(sample(
        content_sha256=third_hash, predecessor_digest=second_hash,
        observed_at="2026-10-13T10:05:00Z", event_kind=EventKind.CORRECTION,
    ))
    assert third.decision == JournalDecision.ADDED
    final_hash = hashlib.sha256(b"provider withdrawal notice").hexdigest()
    fourth = journal.ingest(sample(
        content_sha256=final_hash, predecessor_digest=third_hash,
        observed_at="2026-10-13T10:07:00Z", event_kind=EventKind.RETRACTION,
    ))
    assert fourth.decision == JournalDecision.ADDED
    assert journal.verify_chain()
    assert len(journal.entries) == 4
    assert journal.entries[0] == original
    assert not any(e.publication_authorized for e in journal.entries)
    assert journal.ingest(sample(content_sha256="f" * 64, predecessor_digest=final_hash,
                                 event_kind=EventKind.UPDATE, observed_at="2026-10-13T10:09:00Z")).decision == JournalDecision.HOLD


def test_duplicate_is_idempotent_without_extra_storage():
    journal = new_journal()
    assert journal.ingest(sample()).decision == JournalDecision.ADDED
    assert journal.ingest(sample(observed_at="2026-10-13T10:02:00Z")).decision == JournalDecision.DUPLICATE
    assert len(journal.entries) == 1


@pytest.mark.parametrize("url", [
    "http://status.example.org/incidents/101",
    "https://status.example.org.attacker.test/incidents/101",
    "https://evil.example.org/incidents/101",
    "https://status.example.org.evil.test/incidents/101",
    "https://status.example.org:8080/incidents/101",
    "https://user:pass@status.example.org/incidents/101",
    "https://status.example.org/incidents/101?token=private",
    "https://status.example.org/incidents/101#fragment",
    "https://status.example.org/incident/101",
    "https://127.0.0.1/incidents/101",
    "https://status.example.org/incidents/101\nForged: yes",
])
def test_sources_outside_exact_trusted_host_path_and_format_are_refused(url):
    assert new_journal().ingest(sample(url=url)).decision == JournalDecision.HOLD


def test_source_cannot_self_register_as_trusted():
    journal = new_journal()
    changed = sample(source_id="attacker")
    response = journal.ingest(changed)
    assert response.decision == JournalDecision.HOLD
    assert "SOURCE_NOT_ALLOWLISTED" in response.reason_codes


@pytest.mark.parametrize("change", [
    {"source_published_at": "2026-10-13T10:04:00Z"},
    {"observed_at": "2026-10-13T09:00:00Z"},
    {"observed_at": "2026-10-13T10:01:00"},
    {"source_published_at": "not-a-time"},
    {"event_id": "../incident"},
    {"event_id": ""},
    {"subject_model": ""},
    {"content_sha256": "hash"},
    {"title": "<script>alert('bad')</script>"},
    {"title": "a\nb"},
    {"event_kind": "NOTICE"},
])
def test_malformed_source_event_is_hold(change):
    assert new_journal().ingest(sample(**change)).decision == JournalDecision.HOLD


@pytest.mark.parametrize("change", [
    {"event_kind": EventKind.UPDATE},
    {"event_kind": EventKind.CORRECTION},
    {"event_kind": EventKind.RETRACTION},
    {"predecessor_digest": "0" * 64},
])
def test_first_event_cannot_claim_correction_or_parent(change):
    assert new_journal().ingest(sample(**change)).decision == JournalDecision.HOLD


def test_update_requires_prior_digest_and_monotonic_observation():
    journal = new_journal()
    assert journal.ingest(sample()).decision == JournalDecision.ADDED
    for change in (
        {"predecessor_digest": "f" * 64},
        {"predecessor_digest": None},
        {"observed_at": "2026-10-13T10:00:00Z", "predecessor_digest": sample().content_sha256},
        {"event_kind": EventKind.NOTICE, "predecessor_digest": sample().content_sha256},
        {"url": "https://status.example.org/incidents/different", "predecessor_digest": sample().content_sha256},
    ):
        r = journal.ingest(sample(**(
            {"content_sha256": "a" * 64, "event_kind": EventKind.UPDATE, "observed_at": "2026-10-13T10:03:00Z"} | change
        )))
        assert r.decision == JournalDecision.HOLD
    assert len(journal.entries) == 1


def test_global_budget_and_mutation_detected():
    journal = new_journal(max_events=1)
    assert journal.ingest(sample()).decision == JournalDecision.ADDED
    assert journal.ingest(sample(event_id="other", content_sha256="a" * 64)).decision == JournalDecision.HOLD
    assert journal.verify_chain()
    journal._entries[0] = replace(journal.entries[0], content_sha256="f" * 64)
    assert not journal.verify_chain()


def test_no_raw_body_or_private_prompt_fields_persisted():
    journal = new_journal()
    event = sample(title="Untrusted source text", subject_model="example-model")
    journal.ingest(event)
    snapshot = journal.entries[0]
    assert not hasattr(snapshot, "title")
    assert not hasattr(snapshot, "prompt_input")
    assert not hasattr(snapshot, "raw_body")
