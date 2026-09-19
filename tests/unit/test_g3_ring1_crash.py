"""G3 process-crash tests — real subprocess SIGKILL at failpoints."""

from __future__ import annotations

import os
import subprocess
import sys
import textwrap
from pathlib import Path

import pytest

from spe_runtime.ring1.clock import FakeClock
from spe_runtime.ring1.effects import create_effect_intent, get_effect
from spe_runtime.ring1.lease import acquire_worker_lease
from spe_runtime.ring1.models import EffectState
from spe_runtime.ring1.recovery import recover_mission
from spe_runtime.ring1.store import create_mission, open_mission_store
from spe_runtime.ring1.testing import FakeDestination

CRASH_WORKER = textwrap.dedent(
    r'''
import os, sys
from spe_runtime.ring1.clock import FakeClock
from spe_runtime.ring1.commit import commit_durable_semantic_transaction
from spe_runtime.ring1.failpoints import set_failpoint
from spe_runtime.ring1.lease import acquire_worker_lease
from spe_runtime.ring1.models import CommitRequest
from spe_runtime.ring1.store import create_mission, open_mission_store
from spe_runtime.ring1.effects import create_effect_intent, dispatch_effect
from spe_runtime.ring1.testing import FakeDestination

db, failpoint, mode = sys.argv[1], sys.argv[2], sys.argv[3]
os.environ["RING1_FAILPOINT"] = failpoint
set_failpoint(failpoint)
clock = FakeClock(3_000_000)
store = open_mission_store(db, clock=clock, create=False)
create_mission(store, "m1")
lease = acquire_worker_lease(store, mission_id="m1", owner_id="A", ttl_ms=60_000)
if mode == "commit":
    commit_durable_semantic_transaction(
        store,
        CommitRequest(
            mission_id="m1",
            owner_id="A",
            fencing_token=lease.fencing_token,
            expected_snapshot_id=None,
            expected_snapshot_version=0,
            next_snapshot_id="snap-crash",
            next_snapshot_version=1,
            semantic_digest="sem-1",
            proof_ledger_digest="proof-1",
            cursor_phase="p",
            cursor_json="{}",
        ),
    )
elif mode == "effect":
    create_effect_intent(
        store,
        mission_id="m1",
        owner_id="A",
        fencing_token=lease.fencing_token,
        effect_id="eff-crash",
        operation_kind="op",
        idempotency_key="ik-crash",
        request_digest="req",
        destination_ref="fake",
    )
    dest = FakeDestination()
    # Persist destination state path for parent to inspect? in-memory only —
    # parent uses DB state for SENT_UNKNOWN proof.
    dispatch_effect(
        store,
        mission_id="m1",
        owner_id="A",
        fencing_token=lease.fencing_token,
        effect_id="eff-crash",
        destination=dest,
        lose_response=(failpoint == "after_dispatch_response_lost"),
    )
print("UNEXPECTED_SURVIVED")
'''
)


def _run_crash_worker(db: Path, failpoint: str, mode: str = "commit") -> int:
    env = os.environ.copy()
    env["RING1_FAILPOINT"] = failpoint
    proc = subprocess.run(
        [sys.executable, "-c", CRASH_WORKER, str(db), failpoint, mode],
        env=env,
        capture_output=True,
        text=True,
        timeout=60,
    )
    return proc.returncode


@pytest.fixture
def prepared_db(tmp_path: Path) -> Path:
    db = tmp_path / "crash.db"
    with open_mission_store(db, clock=FakeClock(3_000_000)) as store:
        create_mission(store, "m1")
    return db


@pytest.mark.parametrize(
    "failpoint",
    [
        "before_transaction",
        "after_validation",
        "after_snapshot_write",
        "after_cursor_write",
        "after_journal_append",
        "before_commit",
    ],
)
def test_crash_before_commit_rolls_back(prepared_db, failpoint):
    rc = _run_crash_worker(prepared_db, failpoint, "commit")
    # SIGKILL typically -9
    assert rc != 0
    with open_mission_store(prepared_db, clock=FakeClock(3_000_000), create=False) as store:
        state = recover_mission(store, "m1")
        assert state.snapshot is None
        assert state.cursor is None
        # no SEMANTIC_COMMITTED journal
        n = store.conn.execute(
            "SELECT COUNT(*) FROM journal WHERE event_kind='SEMANTIC_COMMITTED'"
        ).fetchone()[0]
        assert n == 0


def test_crash_after_commit_persists(prepared_db):
    rc = _run_crash_worker(prepared_db, "after_commit", "commit")
    # after_commit fires after COMMIT returns — process dies but data is durable
    assert rc != 0
    with open_mission_store(prepared_db, clock=FakeClock(3_000_000), create=False) as store:
        state = recover_mission(store, "m1")
        assert state.snapshot is not None
        assert state.snapshot.snapshot_version == 1
        assert state.cursor is not None
        n = store.conn.execute(
            "SELECT COUNT(*) FROM journal WHERE event_kind='SEMANTIC_COMMITTED'"
        ).fetchone()[0]
        assert n == 1


def test_crash_after_sent_unknown_before_success(prepared_db, tmp_path):
    # Prepare destination file-backed? FakeDestination is in-process.
    # Simulate: mark SENT_UNKNOWN in parent, then crash worker before success —
    # use failpoint after_sent_unknown in a custom script.
    script = textwrap.dedent(
        r'''
import os, sys
from spe_runtime.ring1.clock import FakeClock
from spe_runtime.ring1.failpoints import set_failpoint
from spe_runtime.ring1.lease import acquire_worker_lease
from spe_runtime.ring1.effects import create_effect_intent, mark_sent_unknown
from spe_runtime.ring1.store import open_mission_store
from spe_runtime.ring1.testing import FakeDestination

db = sys.argv[1]
set_failpoint("after_sent_unknown")
os.environ["RING1_FAILPOINT"] = "after_sent_unknown"
store = open_mission_store(db, clock=FakeClock(3_000_000), create=False)
lease = acquire_worker_lease(store, mission_id="m1", owner_id="A", ttl_ms=60_000)
create_effect_intent(
    store, mission_id="m1", owner_id="A", fencing_token=lease.fencing_token,
    effect_id="eff-x", operation_kind="op", idempotency_key="ik-x",
    request_digest="r", destination_ref="fake",
)
# Apply in destination then die after SENT_UNKNOWN (destination apply separate)
dest = FakeDestination()
dest.apply("ik-x", "r")
mark_sent_unknown(
    store, mission_id="m1", owner_id="A", fencing_token=lease.fencing_token,
    effect_id="eff-x",
)
print("UNEXPECTED")
'''
    )
    # First ensure lease exists
    with open_mission_store(prepared_db, clock=FakeClock(3_000_000), create=False) as store:
        acquire_worker_lease(store, mission_id="m1", owner_id="A", ttl_ms=60_000)

    proc = subprocess.run(
        [sys.executable, "-c", script, str(prepared_db)],
        capture_output=True,
        text=True,
        timeout=60,
    )
    assert proc.returncode != 0
    with open_mission_store(prepared_db, clock=FakeClock(3_000_000), create=False) as store:
        rec = get_effect(store, "eff-x")
        assert rec is not None
        assert rec.state is EffectState.SENT_UNKNOWN
        state = recover_mission(store, "m1")
        assert "eff-x" in state.pending_reconciliation


def test_uncommitted_not_visible_to_second_connection(tmp_path):
    db = tmp_path / "vis.db"
    with open_mission_store(db, clock=FakeClock(1)) as store:
        create_mission(store, "m1")
        acquire_worker_lease(store, mission_id="m1", owner_id="A", ttl_ms=60_000)
        # Begin write without commit
        store.conn.execute("BEGIN IMMEDIATE")
        store.conn.execute(
            """
            INSERT INTO snapshot_binding(
              mission_id, snapshot_id, snapshot_version, semantic_digest, proof_ledger_digest
            ) VALUES ('m1','s',1,'a','b')
            """
        )
        # Second connection must not see uncommitted
        with open_mission_store(db, clock=FakeClock(1), create=False) as other:
            row = other.conn.execute(
                "SELECT * FROM snapshot_binding WHERE mission_id='m1'"
            ).fetchone()
            assert row is None
        store.conn.execute("ROLLBACK")
