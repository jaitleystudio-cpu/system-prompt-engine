"""G3 Ring-1 unit tests — schema, lease, CAS, journal, atomicity, store fail-closed."""

from __future__ import annotations

import sqlite3
from pathlib import Path

import pytest

from spe_runtime.error_registry import ErrorCode, SpeTypedError
from spe_runtime.ring1.clock import FakeClock
from spe_runtime.ring1.commit import commit_durable_semantic_transaction
from spe_runtime.ring1.lease import (
    acquire_worker_lease,
    cancel_mission,
    heartbeat_worker_lease,
    reclaim_worker_lease,
)
from spe_runtime.ring1.models import CommitRequest
from spe_runtime.ring1.recovery import recover_mission
from spe_runtime.ring1.store import create_mission, open_mission_store


@pytest.fixture
def clock() -> FakeClock:
    return FakeClock(1_000_000)


@pytest.fixture
def db_path(tmp_path: Path) -> Path:
    return tmp_path / "mission.db"


def _commit(store, mission, owner, fence, *, exp_id=None, exp_ver=0, nxt_id="snap-1", nxt_ver=1):
    return commit_durable_semantic_transaction(
        store,
        CommitRequest(
            mission_id=mission,
            owner_id=owner,
            fencing_token=fence,
            expected_snapshot_id=exp_id,
            expected_snapshot_version=exp_ver,
            next_snapshot_id=nxt_id,
            next_snapshot_version=nxt_ver,
            semantic_digest=f"sem-{nxt_ver}",
            proof_ledger_digest=f"proof-{nxt_ver}",
            cursor_phase="committed",
            cursor_json=f'{{"v":{nxt_ver}}}',
        ),
    )


def test_schema_init_and_version(db_path, clock):
    with open_mission_store(db_path, clock=clock) as store:
        pragmas = store.read_pragmas()
        assert pragmas.foreign_keys == "ON"
        assert pragmas.journal_mode == "DELETE"
        assert pragmas.synchronous == "FULL"
        row = store.conn.execute(
            "SELECT value FROM ring1_meta WHERE key='ring1_schema_version'"
        ).fetchone()
        assert row[0] == "1"


def test_unknown_schema_fail_closed(db_path, clock):
    with open_mission_store(db_path, clock=clock) as store:
        store.conn.execute(
            "UPDATE ring1_meta SET value='99' WHERE key='ring1_schema_version'"
        )
    with pytest.raises(SpeTypedError) as ei:
        open_mission_store(db_path, clock=clock, create=False)
    assert ei.value.code is ErrorCode.G3_SCHEMA_MISMATCH


def test_missing_store_fail_closed(tmp_path, clock):
    missing = tmp_path / "nope.db"
    with pytest.raises(SpeTypedError) as ei:
        open_mission_store(missing, clock=clock, create=False)
    assert ei.value.code is ErrorCode.G3_STORE_UNAVAILABLE


def test_corrupt_store_fail_closed(db_path, clock):
    db_path.write_bytes(b"not-a-sqlite-database!!!!")
    with pytest.raises(SpeTypedError) as ei:
        open_mission_store(db_path, clock=clock, create=False)
    assert ei.value.code in {
        ErrorCode.G3_STORE_UNAVAILABLE,
        ErrorCode.G3_STORE_INTEGRITY_FAILURE,
        ErrorCode.G3_SCHEMA_MISMATCH,
    }


def test_mission_isolation(db_path, clock):
    with open_mission_store(db_path, clock=clock) as store:
        create_mission(store, "mission-a")
        create_mission(store, "mission-b")
        la = acquire_worker_lease(store, mission_id="mission-a", owner_id="wa", ttl_ms=10_000)
        _commit(store, "mission-a", "wa", la.fencing_token)
        # Cannot commit B without lease
        with pytest.raises(SpeTypedError) as ei:
            _commit(store, "mission-b", "wa", la.fencing_token)
        assert ei.value.code in {ErrorCode.G3_LEASE_NOT_OWNED, ErrorCode.G3_STALE_FENCE}


def test_snapshot_monotonic_and_cas(db_path, clock):
    with open_mission_store(db_path, clock=clock) as store:
        create_mission(store, "m1")
        lease = acquire_worker_lease(store, mission_id="m1", owner_id="w1", ttl_ms=10_000)
        _commit(store, "m1", "w1", lease.fencing_token, nxt_id="s1", nxt_ver=1)
        # stale CAS
        with pytest.raises(SpeTypedError) as ei:
            _commit(store, "m1", "w1", lease.fencing_token, exp_id=None, exp_ver=0, nxt_id="sX", nxt_ver=1)
        assert ei.value.code is ErrorCode.G3_CAS_CONFLICT
        _commit(
            store, "m1", "w1", lease.fencing_token,
            exp_id="s1", exp_ver=1, nxt_id="s2", nxt_ver=2,
        )
        state = recover_mission(store, "m1")
        assert state.snapshot is not None
        assert state.snapshot.snapshot_version == 2


def test_lease_fence_heartbeat_reclaim(db_path, clock):
    with open_mission_store(db_path, clock=clock) as store:
        create_mission(store, "m1")
        a = acquire_worker_lease(store, mission_id="m1", owner_id="A", ttl_ms=5_000)
        assert a.fencing_token == 1
        heartbeat_worker_lease(
            store, mission_id="m1", owner_id="A", fencing_token=1, ttl_ms=5_000
        )
        clock.advance_ms(6_000)
        b = reclaim_worker_lease(store, mission_id="m1", owner_id="B", ttl_ms=5_000)
        assert b.fencing_token == 2
        with pytest.raises(SpeTypedError) as ei:
            heartbeat_worker_lease(
                store, mission_id="m1", owner_id="A", fencing_token=1, ttl_ms=5_000
            )
        assert ei.value.code in {ErrorCode.G3_STALE_FENCE, ErrorCode.G3_LEASE_NOT_OWNED}
        with pytest.raises(SpeTypedError) as ei2:
            _commit(store, "m1", "A", 1)
        assert ei2.value.code in {ErrorCode.G3_STALE_FENCE, ErrorCode.G3_LEASE_NOT_OWNED}


def test_stale_worker_rejected_after_reclaim(db_path, clock):
    with open_mission_store(db_path, clock=clock) as store:
        create_mission(store, "m1")
        a = acquire_worker_lease(store, mission_id="m1", owner_id="A", ttl_ms=1_000)
        clock.advance_ms(2_000)
        b = reclaim_worker_lease(store, mission_id="m1", owner_id="B", ttl_ms=10_000)
        assert b.fencing_token > a.fencing_token
        with pytest.raises(SpeTypedError):
            _commit(store, "m1", "A", a.fencing_token)
        ok = _commit(store, "m1", "B", b.fencing_token)
        assert ok.snapshot_version == 1


def test_journal_append_only_db_enforced(db_path, clock):
    with open_mission_store(db_path, clock=clock) as store:
        create_mission(store, "m1")
        with pytest.raises(SpeTypedError) as ei:
            def _bad(conn):
                conn.execute("UPDATE journal SET event_kind='X' WHERE journal_seq=1")
            store.transactional(_bad)
        assert ei.value.code is ErrorCode.G3_JOURNAL_MUTATION_REJECTED
        with pytest.raises(SpeTypedError) as ei2:
            def _del(conn):
                conn.execute("DELETE FROM journal WHERE journal_seq=1")
            store.transactional(_del)
        assert ei2.value.code is ErrorCode.G3_JOURNAL_MUTATION_REJECTED


def test_atomic_commit_rollback_on_error(db_path, clock):
    with open_mission_store(db_path, clock=clock) as store:
        create_mission(store, "m1")
        lease = acquire_worker_lease(store, mission_id="m1", owner_id="A", ttl_ms=10_000)
        # Force failure via bad next version
        with pytest.raises(SpeTypedError):
            _commit(store, "m1", "A", lease.fencing_token, nxt_ver=5)
        state = recover_mission(store, "m1")
        assert state.snapshot is None


def test_cancellation_durable(db_path, clock):
    with open_mission_store(db_path, clock=clock) as store:
        create_mission(store, "m1")
        lease = acquire_worker_lease(store, mission_id="m1", owner_id="A", ttl_ms=10_000)
        cancel_mission(store, "m1", owner_id="A", fencing_token=lease.fencing_token)
        with pytest.raises(SpeTypedError) as ei:
            _commit(store, "m1", "A", lease.fencing_token)
        assert ei.value.code is ErrorCode.G3_MISSION_CANCELLED
        state = recover_mission(store, "m1")
        assert state.cancelled is True


def test_recovery_idempotent(db_path, clock):
    with open_mission_store(db_path, clock=clock) as store:
        create_mission(store, "m1")
        lease = acquire_worker_lease(store, mission_id="m1", owner_id="A", ttl_ms=10_000)
        _commit(store, "m1", "A", lease.fencing_token)
        s1 = recover_mission(store, "m1")
        s2 = recover_mission(store, "m1")
        assert s1.snapshot == s2.snapshot
        assert s1.cursor == s2.cursor
        # journal seq unchanged
        n1 = store.conn.execute("SELECT COUNT(*) FROM journal").fetchone()[0]
        recover_mission(store, "m1")
        n2 = store.conn.execute("SELECT COUNT(*) FROM journal").fetchone()[0]
        assert n1 == n2


def test_worker_lease_not_authority_grant():
    from spe_runtime.authority.models import AuthorityGrant
    from spe_runtime.proof.lease import SemanticProofLease, assert_not_authority_grant
    from spe_runtime.proof.types import LeaseStatus as SemStatus

    # Worker lease view is a different type
    from spe_runtime.ring1.models import WorkerLeaseView, LeaseStatus

    w = WorkerLeaseView(
        mission_id="m",
        owner_id="w",
        fencing_token=1,
        status=LeaseStatus.ACTIVE,
        deadline_ms=1,
        last_heartbeat_ms=1,
    )
    assert not isinstance(w, AuthorityGrant)
    assert type(w).__name__ != "SemanticProofLease"
    # Semantic lease still distinct
    assert SemStatus.ACTIVE.value == "ACTIVE"
