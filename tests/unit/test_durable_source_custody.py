"""R11 hostile durable custody: restarts, truncation, corruption, locks and crash.

No outbound traffic or provider calls. R2 journal behavior is reconstructed
through its public append owner; fixtures use public metadata only.
"""
from __future__ import annotations

import hashlib
import json
import os
from dataclasses import replace
from pathlib import Path

import pytest

from spe_runtime.failure_genome.durable_journal import (
    DurableJournalStore, JournalCustodyError,
)
from spe_runtime.failure_genome.event_journal import (
    EventKind, JournalDecision, SourceAuthority, SourceSnapshot,
)
from spe_runtime.failure_genome.source_watch import (
    FeedResponse, PublicStatusFeedObserver, TrustedStatusFeed,
)


SOURCE = "official"
HOST = "status.example.org"
PATH = "/api/v2/incidents.json"
T1 = "2026-10-14T01:01:00Z"
T2 = "2026-10-14T01:03:00Z"
T3 = "2026-10-14T01:05:00Z"


def state(tmp_path: Path, *, path=None, authorities=None, limit=32):
    return DurableJournalStore(
        path or (tmp_path / "status-state.json"),
        authorities or {SOURCE: SourceAuthority(SOURCE, HOST, PATH)},
        max_events=limit,
    )


def snapshot(*, content=b"original public source", event="inc-1001",
             event_kind=EventKind.NOTICE, predecessor=None, observed=T1,
             title="No raw input should be stored"):
    return SourceSnapshot(
        source_id=SOURCE,
        event_id=event,
        url=f"https://{HOST}{PATH}",
        content_sha256=hashlib.sha256(content).hexdigest(),
        source_published_at="2026-10-14T01:00:00Z",
        observed_at=observed,
        event_kind=event_kind,
        subject_model="PUBLIC_PROVIDER_SERVICE",
        title=title,
        predecessor_digest=predecessor,
    )


def add_one(store: DurableJournalStore):
    with store.session() as journal:
        outcome = journal.ingest(snapshot())
        assert outcome.decision is JournalDecision.ADDED
    return outcome.entry


def test_restart_restore_replay_and_duplicate_are_stable(tmp_path):
    first_store = state(tmp_path)
    first = add_one(first_store)
    second_store = state(tmp_path)
    with second_store.session() as journal:
        assert len(journal.entries) == 1
        assert journal.verify_chain()
        assert journal.entries[0] == first
        duplicate = journal.ingest(snapshot(observed=T2))
        assert duplicate.decision is JournalDecision.DUPLICATE
        updated = journal.ingest(snapshot(
            content=b"source changed", event_kind=EventKind.UPDATE,
            predecessor=first.content_sha256, observed=T2,
        ))
        assert updated.decision is JournalDecision.ADDED
    third_store = state(tmp_path)
    with third_store.session() as journal:
        assert len(journal.entries) == 2
        assert journal.latest_entry(SOURCE, "inc-1001") == updated.entry
        assert journal.verify_chain()
    assert third_store.audit().records == 2
    assert not third_store.audit().rollback_resistant_checkpoint
    assert not third_store.audit().publication_authorized


def test_untrusted_title_and_source_body_never_persist(tmp_path):
    store = state(tmp_path)
    s = snapshot(title="Public potentially identifying text Alice Example")
    with store.session() as journal:
        journal.ingest(s)
    body = store.path.read_text("utf-8")
    assert "Alice Example" not in body
    assert "No raw input" not in body
    assert "PUBLIC_STATUS_NOTICE_METADATA_ONLY" not in body
    assert "source_body" not in body
    assert "password" not in body
    assert s.content_sha256 in body


@pytest.mark.parametrize("mutation", [
    lambda b: b[:15],
    lambda b: b + b"<script>",
    lambda b: b.replace(b'"count":1', b'"count":2'),
    lambda b: b.replace(b'"event_id":"inc-1001"', b'"event_id":"inc-9999"'),
    lambda b: b.replace(b'"chain_digest":"', b'"chain_digest":"0'),
    lambda b: b"{\"schema\": \"rogue\"}",
])
def test_corrupted_or_truncated_state_holds_without_reinitializing(tmp_path, mutation):
    store = state(tmp_path)
    add_one(store)
    before = store.path.read_bytes()
    bad = mutation(before)
    store.path.write_bytes(bad)
    with pytest.raises(JournalCustodyError):
        with store.session() as journal:
            journal.ingest(snapshot(event="inc-2002"))
    assert store.path.read_bytes() == bad


def test_locally_forged_document_digest_still_fails_replay(tmp_path):
    store = state(tmp_path)
    add_one(store)
    blob = json.loads(store.path.read_text("utf-8"))
    blob["observations"][0]["event_id"] = "inc-fraud"
    from spe_runtime.failure_genome.durable_journal import _sha, _json_bytes
    blob["document_sha256"] = _sha({k: v for k, v in blob.items() if k != "document_sha256"})
    store.path.write_bytes(_json_bytes(blob))
    with pytest.raises(JournalCustodyError, match="STATE_HISTORY_NOT_REPRODUCIBLE"):
        store.audit()


def test_allowlist_change_is_hold_not_namespace_reuse(tmp_path):
    first = state(tmp_path)
    add_one(first)
    changed = {
        SOURCE: SourceAuthority(SOURCE, "status.attacker.example.org", PATH),
    }
    other = state(tmp_path, authorities=changed)
    with pytest.raises(JournalCustodyError, match="STATE_ALLOWLIST_OR_VERSION_CHANGED"):
        other.audit()


def test_state_and_lock_files_permissions_are_private(tmp_path):
    store = state(tmp_path)
    add_one(store)
    assert store.path.stat().st_mode & 0o077 == 0
    assert store.path.with_name(store.path.name + ".lock").stat().st_mode & 0o077 == 0


def test_symlink_state_and_lock_files_refused(tmp_path):
    source = tmp_path / "outside.json"
    source.write_text('{"private":"do not touch"}')
    path = tmp_path / "status-state.json"
    path.symlink_to(source)
    store = state(tmp_path)
    with pytest.raises(JournalCustodyError):
        store.audit()
    assert source.read_text() == '{"private":"do not touch"}'
    path.unlink()
    lock = path.with_name(path.name + ".lock")
    lock.unlink(missing_ok=True)
    lock.symlink_to(source)
    with pytest.raises(JournalCustodyError):
        store.audit()
    assert source.read_text() == '{"private":"do not touch"}'


def test_hardlink_state_files_refused(tmp_path):
    first = state(tmp_path)
    add_one(first)
    second = tmp_path / "second-hardlinked-copy"
    os.link(first.path, second)
    with pytest.raises(JournalCustodyError, match="STATE_FILE_UNSAFE"):
        first.audit()


def test_unsafe_parent_directory_is_not_accepted(tmp_path):
    unsafe = tmp_path / "world-writable"
    unsafe.mkdir(mode=0o777)
    unsafe.chmod(0o777)
    with pytest.raises(JournalCustodyError, match="STATE_DIRECTORY_UNSAFE"):
        state(tmp_path, path=unsafe / "status.json")


def test_write_interruption_keeps_old_state_and_blocks_fake_commit(tmp_path, monkeypatch):
    store = state(tmp_path)
    original = add_one(store)
    baseline = store.path.read_bytes()
    import spe_runtime.failure_genome.durable_journal as module

    def io_crash(*args, **kwargs):
        raise OSError("simulated power loss")

    monkeypatch.setattr(module.os, "replace", io_crash)
    with pytest.raises(OSError, match="simulated power loss"):
        with store.session() as journal:
            outcome = journal.ingest(snapshot(
                event_kind=EventKind.UPDATE,
                content=b"new public source", observed=T2,
                predecessor=original.content_sha256,
            ))
            assert outcome.decision is JournalDecision.ADDED
    assert store.path.read_bytes() == baseline
    monkeypatch.undo()
    assert store.audit().records == 1


def test_transaction_exception_does_not_commit_partial_work(tmp_path):
    store = state(tmp_path)
    add_one(store)
    with pytest.raises(RuntimeError):
        with store.session() as journal:
            journal.ingest(snapshot(event="inc-two", observed=T2))
            raise RuntimeError("caller crashed before commit")
    assert store.audit().records == 1


def test_event_budget_exceeded_is_not_silently_truncated(tmp_path):
    store = state(tmp_path, limit=1)
    add_one(store)
    with store.session() as journal:
        result = journal.ingest(snapshot(event="inc-2002", observed=T2))
        assert result.decision is JournalDecision.HOLD
    assert store.audit().records == 1


def _response(version=1):
    incident = {
        "id": "inc-1001", "name": "External provider incident",
        "status": "investigating" if version == 1 else "monitoring",
        "updated_at": "2026-10-14T01:00:00Z" if version == 1 else T2,
        "incident_updates": [{"body": "Provider notice version " + str(version)}],
    }
    return FeedResponse(
        200, f"https://{HOST}{PATH}", "application/json",
        json.dumps({"incidents": [incident]}).encode("utf-8"),
    )


def test_poll_after_restart_uses_restored_state_not_a_new_journal(tmp_path):
    store = state(tmp_path)
    feed = TrustedStatusFeed(SOURCE, HOST, enabled=True)
    with store.session() as journal:
        observer = PublicStatusFeedObserver(
            (feed,), journal=journal,
            transport=lambda *_: _response(1),
        )
        assert observer.poll(SOURCE, allow_network=True, observed_at=T1).added == 1
    with store.session() as journal:
        observer = PublicStatusFeedObserver(
            (feed,), journal=journal,
            transport=lambda *_: _response(1),
        )
        duplicate = observer.poll(SOURCE, allow_network=True, observed_at=T2)
        assert duplicate.duplicates == 1
        assert duplicate.added == 0
    with store.session() as journal:
        observer = PublicStatusFeedObserver(
            (feed,), journal=journal,
            transport=lambda *_: _response(2),
        )
        updated = observer.poll(SOURCE, allow_network=True, observed_at=T3)
        assert updated.added == 1
        assert journal.entries[-1].event_kind == EventKind.UPDATE
    assert store.audit().records == 2


def test_injected_journal_must_match_exact_source_owner(tmp_path):
    store = state(tmp_path)
    with store.session() as journal:
        with pytest.raises(ValueError, match="INJECTED_JOURNAL_OWNER_OR_CHAIN_MISMATCH"):
            PublicStatusFeedObserver((
                TrustedStatusFeed(SOURCE, "status.other.example.org", enabled=True),
            ), journal=journal, transport=lambda *_: _response(1))


def test_cli_live_request_with_no_persistent_state_never_touches_network(monkeypatch, capsys):
    import tools.spe_public_incident_watch as cli
    monkeypatch.setattr("sys.argv", ["watch", "--live"])
    monkeypatch.setenv("SPE_PUBLIC_INCIDENT_WATCH_ENABLED", "true")
    monkeypatch.setenv("SPE_PUBLIC_INCIDENT_OWNER_APPROVED", "true")
    monkeypatch.delenv("SPE_PUBLIC_INCIDENT_STATE_PATH", raising=False)
    assert cli.main() == 2
    result = json.loads(capsys.readouterr().out)
    assert result["status"] == "HOLD_NO_DURABLE_HOST"
    assert result["network_calls"] == 0
