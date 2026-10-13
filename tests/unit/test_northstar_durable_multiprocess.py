"""Cross-process R11 custody qualification: contention, SIGKILL, restart/replay.

These are LOCAL POSIX tests only. They do not prove cloud runner persistence,
power-cut guarantees of hardware, independent checkpoint storage or quorum.
"""
from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

from spe_runtime.failure_genome.durable_journal import DurableJournalStore
from spe_runtime.failure_genome.event_journal import SourceAuthority


ROOT = Path(__file__).resolve().parents[2]
SOURCE = {"official": SourceAuthority("official", "status.example.org", "/api/v2/incidents.json")}


def store(path):
    return DurableJournalStore(path, SOURCE)


def child_script(*, sleep=0, announce=False):
    return f"""
import hashlib
import sys
import time
from pathlib import Path
from spe_runtime.failure_genome.durable_journal import DurableJournalStore
from spe_runtime.failure_genome.event_journal import (
    SourceAuthority, SourceSnapshot, EventKind, JournalDecision,
)
path, event_id = Path(sys.argv[1]), sys.argv[2]
state = DurableJournalStore(path, {{
    'official': SourceAuthority('official', 'status.example.org', '/api/v2/incidents.json')
}})
with state.session() as journal:
    outcome = journal.ingest(SourceSnapshot(
        source_id='official', event_id=event_id,
        url='https://status.example.org/api/v2/incidents.json',
        content_sha256=hashlib.sha256(event_id.encode()).hexdigest(),
        source_published_at='2026-10-14T01:00:00Z',
        observed_at='2026-10-14T01:01:00Z',
        event_kind=EventKind.NOTICE,
        subject_model='PUBLIC_STATUS_METADATA_ONLY',
        title='Public status metadata only',
    ))
    assert outcome.decision in (JournalDecision.ADDED, JournalDecision.DUPLICATE)
    if {announce}:
        print('CHILD_WITH_UNCOMMITTED_EVENT', flush=True)
    time.sleep({sleep})
print('CHILD_SESSION_COMMITTED', flush=True)
"""


def run(path, event, *, sleep=0):
    return subprocess.Popen(
        [sys.executable, "-c", child_script(sleep=sleep),
         str(path), event], cwd=ROOT,
        env=os.environ.copy(), text=True,
        stdout=subprocess.PIPE, stderr=subprocess.PIPE,
    )


def test_concurrent_external_processes_serialized_by_owner_lock(tmp_path):
    path = tmp_path / "public-custody.json"
    first = run(path, "event-alpha", sleep=0.2)
    second = run(path, "event-beta", sleep=0.1)
    out1, err1 = first.communicate(timeout=15)
    out2, err2 = second.communicate(timeout=15)
    assert first.returncode == 0, err1
    assert second.returncode == 0, err2
    assert "CHILD_SESSION_COMMITTED" in out1
    assert "CHILD_SESSION_COMMITTED" in out2
    with store(path).session() as journal:
        assert journal.verify_chain()
        assert len(journal.entries) == 2
        assert {x.event_id for x in journal.entries} == {"event-alpha", "event-beta"}


def test_hard_kill_before_commit_preserves_prior_durable_head(tmp_path):
    path = tmp_path / "public-custody.json"
    first = run(path, "original-event")
    _, err = first.communicate(timeout=10)
    assert first.returncode == 0, err
    old = path.read_bytes()
    child = subprocess.Popen(
        [sys.executable, "-c", child_script(sleep=10, announce=True),
         str(path), "uncommitted-event"],
        cwd=ROOT, env=os.environ.copy(), text=True,
        stdout=subprocess.PIPE, stderr=subprocess.PIPE,
    )
    announced = child.stdout.readline().strip()
    assert announced == "CHILD_WITH_UNCOMMITTED_EVENT"
    child.kill()
    child.communicate(timeout=10)
    assert path.read_bytes() == old
    with store(path).session() as journal:
        assert journal.verify_chain()
        assert len(journal.entries) == 1
        assert journal.entries[0].event_id == "original-event"


def test_cross_process_duplicate_is_not_a_new_incident(tmp_path):
    path = tmp_path / "public-custody.json"
    one = run(path, "the-same-official-event")
    _, err1 = one.communicate(timeout=10)
    assert one.returncode == 0, err1
    head = store(path).audit().head_sha256
    two = run(path, "the-same-official-event")
    _, err2 = two.communicate(timeout=10)
    assert two.returncode == 0, err2
    assert store(path).audit().records == 1
    assert store(path).audit().head_sha256 == head
