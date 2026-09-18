"""G3R adversarial recheck — first-run attack tests against G3 HEAD."""

from __future__ import annotations

import multiprocessing as mp
import os
import shutil
import sqlite3
import subprocess
import sys
import textwrap
import traceback
from pathlib import Path

import pytest

from spe_runtime.error_registry import ErrorCode, SpeTypedError
from spe_runtime.proof.lease import SemanticProofLease
from spe_runtime.ring1.clock import FakeClock
from spe_runtime.ring1.commit import commit_durable_semantic_transaction
from spe_runtime.ring1.effects import (
    create_effect_intent,
    dispatch_effect,
    get_effect,
    mark_sent_unknown,
    reconcile_effect,
    record_known_success,
)
from spe_runtime.ring1.lease import (
    acquire_worker_lease,
    cancel_mission,
    heartbeat_worker_lease,
    reclaim_worker_lease,
)
from spe_runtime.ring1.models import CommitRequest, EffectState, WorkerLeaseView
from spe_runtime.ring1.recovery import recover_mission
from spe_runtime.ring1.store import (
    create_mission,
    create_new_mission_store,
    open_existing_mission_store,
    open_mission_store,
)
from spe_runtime.ring1.testing import FakeDestination
from spe_runtime.authority.models import AuthorityGrant


def _commit(store, mission, owner, fence, **kw):
    defaults = dict(
        mission_id=mission,
        owner_id=owner,
        fencing_token=fence,
        expected_snapshot_id=None,
        expected_snapshot_version=0,
        next_snapshot_id="s1",
        next_snapshot_version=1,
        semantic_digest="sem",
        proof_ledger_digest="proof",
        cursor_phase="c",
        cursor_json="{}",
    )
    defaults.update(kw)
    return commit_durable_semantic_transaction(store, CommitRequest(**defaults))


# ---------------------------------------------------------------------------
# Lease type / authority boundary
# ---------------------------------------------------------------------------

def test_g3r_lease_types_distinct():
    assert WorkerLeaseView is not SemanticProofLease
    w = WorkerLeaseView(
        mission_id="m", owner_id="w", fencing_token=1,
        status=__import__("spe_runtime.ring1.models", fromlist=["LeaseStatus"]).LeaseStatus.ACTIVE,
        deadline_ms=1, last_heartbeat_ms=1,
    )
    assert not isinstance(w, AuthorityGrant)
    assert not isinstance(w, SemanticProofLease)


# ---------------------------------------------------------------------------
# G3R-F01: lost store must not be treated as recovery via create=True
# ---------------------------------------------------------------------------

def test_g3r_f01_open_existing_fails_when_lost(tmp_path):
    db = tmp_path / "mission.db"
    clock = FakeClock(1_000_000)
    with open_mission_store(db, clock=clock, create=True) as store:
        create_mission(store, "m1")
        lease = acquire_worker_lease(store, mission_id="m1", owner_id="A", ttl_ms=10_000)
        _commit(store, "m1", "A", lease.fencing_token)
    db.unlink()
    with pytest.raises(SpeTypedError) as ei:
        open_existing_mission_store(db, clock=clock)
    assert ei.value.code is ErrorCode.G3_STORE_UNAVAILABLE


def test_g3r_f01_create_new_refuses_overwrite(tmp_path):
    db = tmp_path / "mission.db"
    clock = FakeClock(1)
    with create_new_mission_store(db, clock=clock) as store:
        create_mission(store, "m1")
    with pytest.raises(SpeTypedError) as ei:
        create_new_mission_store(db, clock=clock)
    assert ei.value.code is ErrorCode.G3_STORE_ALREADY_EXISTS


def test_g3r_open_existing_must_fail_when_missing(tmp_path):
    missing = tmp_path / "gone.db"
    with pytest.raises(SpeTypedError) as ei:
        open_existing_mission_store(missing, clock=FakeClock(1))
    assert ei.value.code is ErrorCode.G3_STORE_UNAVAILABLE


# ---------------------------------------------------------------------------
# G3R-F02: cancel requires fence — stale worker rejected
# ---------------------------------------------------------------------------

def test_g3r_f02_stale_worker_cannot_cancel_after_reclaim(tmp_path):
    db = tmp_path / "c.db"
    clock = FakeClock(1_000_000)
    with open_mission_store(db, clock=clock) as store:
        create_mission(store, "m1")
        a = acquire_worker_lease(store, mission_id="m1", owner_id="A", ttl_ms=1_000)
        clock.advance_ms(2_000)
        b = reclaim_worker_lease(store, mission_id="m1", owner_id="B", ttl_ms=10_000)
        assert b.fencing_token > a.fencing_token
        with pytest.raises(SpeTypedError) as ei:
            cancel_mission(
                store, "m1", owner_id="A", fencing_token=a.fencing_token
            )
        assert ei.value.code in {
            ErrorCode.G3_STALE_FENCE,
            ErrorCode.G3_LEASE_NOT_OWNED,
        }
        assert recover_mission(store, "m1").cancelled is False
        cancel_mission(store, "m1", owner_id="B", fencing_token=b.fencing_token)
        assert recover_mission(store, "m1").cancelled is True


# ---------------------------------------------------------------------------
# G3R-F03: same idempotency key + different request digest rejected
# ---------------------------------------------------------------------------

def test_g3r_f03_same_key_different_request_digest_rejected(tmp_path):
    db = tmp_path / "e.db"
    clock = FakeClock(1)
    with open_mission_store(db, clock=clock) as store:
        create_mission(store, "m1")
        lease = acquire_worker_lease(store, mission_id="m1", owner_id="A", ttl_ms=10_000)
        create_effect_intent(
            store, mission_id="m1", owner_id="A", fencing_token=lease.fencing_token,
            effect_id="e1", operation_kind="op", idempotency_key="ik",
            request_digest="digest-A", destination_ref="fake",
        )
        with pytest.raises(SpeTypedError) as ei:
            create_effect_intent(
                store, mission_id="m1", owner_id="A", fencing_token=lease.fencing_token,
                effect_id="e2", operation_kind="op", idempotency_key="ik",
                request_digest="digest-B-DIFFERENT", destination_ref="fake",
            )
        assert ei.value.code is ErrorCode.G3_IDEMPOTENCY_CONFLICT
        # same digest retry OK
        again = create_effect_intent(
            store, mission_id="m1", owner_id="A", fencing_token=lease.fencing_token,
            effect_id="e2", operation_kind="op", idempotency_key="ik",
            request_digest="digest-A", destination_ref="fake",
        )
        assert again.effect_id == "e1"


# ---------------------------------------------------------------------------
# Fence every mutation after reclaim
# ---------------------------------------------------------------------------

def test_g3r_stale_fence_blocks_all_mutations(tmp_path):
    db = tmp_path / "f.db"
    clock = FakeClock(1_000_000)
    with open_mission_store(db, clock=clock) as store:
        create_mission(store, "m1")
        a = acquire_worker_lease(store, mission_id="m1", owner_id="A", ttl_ms=1_000)
        create_effect_intent(
            store, mission_id="m1", owner_id="A", fencing_token=a.fencing_token,
            effect_id="e", operation_kind="op", idempotency_key="ik",
            request_digest="r", destination_ref="fake",
        )
        clock.advance_ms(2_000)
        b = reclaim_worker_lease(store, mission_id="m1", owner_id="B", ttl_ms=30_000)
        for call in [
            lambda: heartbeat_worker_lease(
                store, mission_id="m1", owner_id="A", fencing_token=a.fencing_token
            ),
            lambda: _commit(store, "m1", "A", a.fencing_token),
            lambda: mark_sent_unknown(
                store, mission_id="m1", owner_id="A",
                fencing_token=a.fencing_token, effect_id="e",
            ),
            lambda: reconcile_effect(
                store, mission_id="m1", owner_id="A",
                fencing_token=a.fencing_token, effect_id="e", destination=None,
            ),
        ]:
            with pytest.raises(SpeTypedError) as ei:
                call()
            assert ei.value.code in {
                ErrorCode.G3_STALE_FENCE,
                ErrorCode.G3_LEASE_NOT_OWNED,
            }


def test_g3r_clock_rollback_after_new_fence(tmp_path):
    db = tmp_path / "clk.db"
    clock = FakeClock(1_000_000)
    with open_mission_store(db, clock=clock) as store:
        create_mission(store, "m1")
        a = acquire_worker_lease(store, mission_id="m1", owner_id="A", ttl_ms=5_000)
        clock.advance_ms(6_000)
        b = reclaim_worker_lease(store, mission_id="m1", owner_id="B", ttl_ms=30_000)
        # Roll clock back before original deadline
        clock.set_ms(1_000_100)
        with pytest.raises(SpeTypedError):
            _commit(store, "m1", "A", a.fencing_token)
        # B still valid if we jump forward within B's deadline window
        clock.set_ms(1_006_000 + 1_000)
        _commit(store, "m1", "B", b.fencing_token)


def test_g3r_deadline_boundary_equality(tmp_path):
    """now == deadline_ms → expired (deadline_ms <= now)."""
    db = tmp_path / "eq.db"
    clock = FakeClock(1_000_000)
    with open_mission_store(db, clock=clock) as store:
        create_mission(store, "m1")
        acquire_worker_lease(store, mission_id="m1", owner_id="A", ttl_ms=5_000)
        # deadline = 1_005_000
        clock.set_ms(1_005_000)
        b = reclaim_worker_lease(store, mission_id="m1", owner_id="B", ttl_ms=5_000)
        assert b.fencing_token == 2


def test_g3r_cross_mission_rejected(tmp_path):
    db = tmp_path / "xm.db"
    clock = FakeClock(1)
    with open_mission_store(db, clock=clock) as store:
        create_mission(store, "ma")
        create_mission(store, "mb")
        la = acquire_worker_lease(store, mission_id="ma", owner_id="A", ttl_ms=10_000)
        with pytest.raises(SpeTypedError):
            _commit(store, "mb", "A", la.fencing_token)


def test_g3r_cas_id_and_version(tmp_path):
    db = tmp_path / "cas.db"
    clock = FakeClock(1)
    with open_mission_store(db, clock=clock) as store:
        create_mission(store, "m1")
        lease = acquire_worker_lease(store, mission_id="m1", owner_id="A", ttl_ms=10_000)
        _commit(store, "m1", "A", lease.fencing_token, next_snapshot_id="s1", next_snapshot_version=1)
        # wrong id same version
        with pytest.raises(SpeTypedError) as ei:
            _commit(
                store, "m1", "A", lease.fencing_token,
                expected_snapshot_id="WRONG", expected_snapshot_version=1,
                next_snapshot_id="s2", next_snapshot_version=2,
            )
        assert ei.value.code is ErrorCode.G3_CAS_CONFLICT


def test_g3r_lease_reclaim_preserves_sent_unknown(tmp_path):
    db = tmp_path / "pres.db"
    clock = FakeClock(1_000_000)
    with open_mission_store(db, clock=clock) as store:
        create_mission(store, "m1")
        a = acquire_worker_lease(store, mission_id="m1", owner_id="A", ttl_ms=1_000)
        create_effect_intent(
            store, mission_id="m1", owner_id="A", fencing_token=a.fencing_token,
            effect_id="e", operation_kind="op", idempotency_key="ik",
            request_digest="r", destination_ref="fake",
        )
        mark_sent_unknown(
            store, mission_id="m1", owner_id="A", fencing_token=a.fencing_token, effect_id="e",
        )
        clock.advance_ms(2_000)
        reclaim_worker_lease(store, mission_id="m1", owner_id="B", ttl_ms=10_000)
        assert get_effect(store, "e").state is EffectState.SENT_UNKNOWN


def test_g3r_new_owner_reconciles_same_effect(tmp_path):
    db = tmp_path / "own.db"
    clock = FakeClock(1_000_000)
    dest = FakeDestination()
    dest.apply("ik", "r")
    with open_mission_store(db, clock=clock) as store:
        create_mission(store, "m1")
        a = acquire_worker_lease(store, mission_id="m1", owner_id="A", ttl_ms=1_000)
        create_effect_intent(
            store, mission_id="m1", owner_id="A", fencing_token=a.fencing_token,
            effect_id="e", operation_kind="op", idempotency_key="ik",
            request_digest="r", destination_ref="fake",
        )
        mark_sent_unknown(
            store, mission_id="m1", owner_id="A", fencing_token=a.fencing_token, effect_id="e",
        )
        clock.advance_ms(2_000)
        b = reclaim_worker_lease(store, mission_id="m1", owner_id="B", ttl_ms=10_000)
        done = reconcile_effect(
            store, mission_id="m1", owner_id="B", fencing_token=b.fencing_token,
            effect_id="e", destination=dest,
        )
        assert done.state is EffectState.KNOWN_SUCCESS
        assert done.effect_id == "e"
        assert dest.application_count("ik") == 1


def test_g3r_timeout_not_known_failure(tmp_path):
    db = tmp_path / "to.db"
    clock = FakeClock(1)
    dest = FakeDestination()
    dest.force_timeout_keys.add("ik")
    with open_mission_store(db, clock=clock) as store:
        create_mission(store, "m1")
        lease = acquire_worker_lease(store, mission_id="m1", owner_id="A", ttl_ms=10_000)
        create_effect_intent(
            store, mission_id="m1", owner_id="A", fencing_token=lease.fencing_token,
            effect_id="e", operation_kind="op", idempotency_key="ik",
            request_digest="r", destination_ref="fake",
        )
        with pytest.raises(SpeTypedError) as ei:
            dispatch_effect(
                store, mission_id="m1", owner_id="A",
                fencing_token=lease.fencing_token, effect_id="e", destination=dest,
            )
        assert ei.value.code is ErrorCode.G3_EFFECT_SENT_UNKNOWN
        assert get_effect(store, "e").state is EffectState.SENT_UNKNOWN


def test_g3r_journal_db_append_only(tmp_path):
    db = tmp_path / "j.db"
    with open_mission_store(db, clock=FakeClock(1)) as store:
        create_mission(store, "m1")
        with pytest.raises(SpeTypedError) as ei:
            store.transactional(
                lambda c: c.execute("UPDATE journal SET event_kind='X' WHERE journal_seq=1")
            )
        assert ei.value.code is ErrorCode.G3_JOURNAL_MUTATION_REJECTED


def test_g3r_foreign_keys_on_every_connection(tmp_path):
    db = tmp_path / "fk.db"
    with open_mission_store(db, clock=FakeClock(1), create=True) as s1:
        create_mission(s1, "m1")
        assert s1.read_pragmas().foreign_keys == "ON"
    with open_mission_store(db, clock=FakeClock(1), create=False) as s2:
        assert s2.read_pragmas().foreign_keys == "ON"
        assert s2.read_pragmas().journal_mode == "DELETE"
        assert s2.read_pragmas().synchronous == "FULL"


def test_g3r_future_schema_rejected(tmp_path):
    db = tmp_path / "sch.db"
    with open_mission_store(db, clock=FakeClock(1)) as store:
        store.conn.execute(
            "UPDATE ring1_meta SET value='999' WHERE key='ring1_schema_version'"
        )
    with pytest.raises(SpeTypedError) as ei:
        open_mission_store(db, clock=FakeClock(1), create=False)
    assert ei.value.code is ErrorCode.G3_SCHEMA_MISMATCH


def test_g3r_response_received_crash_before_success(tmp_path):
    """C11: response in memory, crash before KNOWN_SUCCESS durability → SENT_UNKNOWN."""
    db = tmp_path / "c11.db"
    clock = FakeClock(1)
    with open_mission_store(db, clock=clock) as store:
        create_mission(store, "m1")
        acquire_worker_lease(store, mission_id="m1", owner_id="A", ttl_ms=60_000)

    script = textwrap.dedent(
        r'''
import os, sys
from spe_runtime.ring1.clock import FakeClock
from spe_runtime.ring1.failpoints import set_failpoint
from spe_runtime.ring1.lease import acquire_worker_lease
from spe_runtime.ring1.effects import create_effect_intent, dispatch_effect
from spe_runtime.ring1.store import open_mission_store
from spe_runtime.ring1.testing import FakeDestination
db = sys.argv[1]
set_failpoint("before_success_durability")
os.environ["RING1_FAILPOINT"] = "before_success_durability"
store = open_mission_store(db, clock=FakeClock(1), create=False)
lease = acquire_worker_lease(store, mission_id="m1", owner_id="A", ttl_ms=60_000)
create_effect_intent(
    store, mission_id="m1", owner_id="A", fencing_token=lease.fencing_token,
    effect_id="e", operation_kind="op", idempotency_key="ik",
    request_digest="r", destination_ref="fake",
)
dest = FakeDestination()
dispatch_effect(
    store, mission_id="m1", owner_id="A", fencing_token=lease.fencing_token,
    effect_id="e", destination=dest,
)
print("UNEXPECTED_SURVIVED")
'''
    )
    proc = subprocess.run(
        [sys.executable, "-c", script, str(db)],
        capture_output=True, text=True, timeout=60,
    )
    assert proc.returncode != 0
    with open_mission_store(db, clock=FakeClock(1), create=False) as store:
        assert get_effect(store, "e").state is EffectState.SENT_UNKNOWN


# ---------------------------------------------------------------------------
# Multiprocess reclaim race (barrier-orchestrated)
# ---------------------------------------------------------------------------

def _reclaim_worker(db: str, owner: str, barrier: mp.Barrier, q: mp.Queue) -> None:
    try:
        clock = FakeClock(1_002_000)  # past expiry at 1_001_000
        with open_mission_store(db, clock=clock, create=False) as store:
            barrier.wait(timeout=30)
            lease = reclaim_worker_lease(
                store, mission_id="m1", owner_id=owner, ttl_ms=30_000
            )
            q.put(("ok", owner, lease.fencing_token))
    except SpeTypedError as e:
        q.put(("err", owner, e.code.value))
    except Exception:
        q.put(("exc", owner, traceback.format_exc()))


def test_g3r_reclaim_race_one_winner(tmp_path):
    db = str(tmp_path / "rr.db")
    clock = FakeClock(1_000_000)
    with open_mission_store(db, clock=clock) as store:
        create_mission(store, "m1")
        acquire_worker_lease(store, mission_id="m1", owner_id="A", ttl_ms=1_000)

    iterations = 30
    double_winners = 0
    for i in range(iterations):
        # fresh expire each time: reopen and set expired lease
        idb = str(tmp_path / f"rr_{i}.db")
        shutil.copy(db, idb)
        # bump clock past deadline by writing nothing — workers use FakeClock 1_002_000
        q: mp.Queue = mp.Queue()
        barrier = mp.Barrier(2)
        p1 = mp.Process(target=_reclaim_worker, args=(idb, "B", barrier, q))
        p2 = mp.Process(target=_reclaim_worker, args=(idb, "C", barrier, q))
        p1.start(); p2.start()
        p1.join(30); p2.join(30)
        results = [q.get(timeout=5) for _ in range(2)]
        oks = [r for r in results if r[0] == "ok"]
        if len(oks) != 1:
            double_winners += 1
            continue
        # winner fence must be 2; loser err
        assert oks[0][2] == 2
        fences = [r[2] for r in oks]
        assert len(set(fences)) == 1
    assert double_winners == 0


def test_g3r_second_connection_no_half_commit(tmp_path):
    db = tmp_path / "vis.db"
    with open_mission_store(db, clock=FakeClock(1)) as store:
        create_mission(store, "m1")
        acquire_worker_lease(store, mission_id="m1", owner_id="A", ttl_ms=10_000)
        store.conn.execute("BEGIN IMMEDIATE")
        store.conn.execute(
            """
            INSERT INTO snapshot_binding(
              mission_id, snapshot_id, snapshot_version, semantic_digest, proof_ledger_digest
            ) VALUES ('m1','s',1,'a','b')
            """
        )
        with open_mission_store(db, clock=FakeClock(1), create=False) as other:
            assert other.conn.execute(
                "SELECT * FROM snapshot_binding WHERE mission_id='m1'"
            ).fetchone() is None
        store.conn.execute("ROLLBACK")
