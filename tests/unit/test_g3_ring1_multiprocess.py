"""G3 multi-process concurrency races (real OS processes)."""

from __future__ import annotations

import multiprocessing as mp
import traceback
from pathlib import Path

import pytest

from spe_runtime.error_registry import ErrorCode, SpeTypedError
from spe_runtime.ring1.clock import FakeClock
from spe_runtime.ring1.commit import commit_durable_semantic_transaction
from spe_runtime.ring1.lease import acquire_worker_lease, heartbeat_worker_lease, reclaim_worker_lease
from spe_runtime.ring1.models import CommitRequest
from spe_runtime.ring1.store import create_mission, open_mission_store


def _worker_acquire(db: str, mission: str, owner: str, ttl: int, q: mp.Queue) -> None:
    try:
        clock = FakeClock(1_000_000)
        with open_mission_store(db, clock=clock) as store:
            create_mission(store, mission)
            lease = acquire_worker_lease(
                store, mission_id=mission, owner_id=owner, ttl_ms=ttl
            )
            q.put(("ok", owner, lease.fencing_token))
    except SpeTypedError as e:
        q.put(("err", owner, e.code.value))
    except Exception:
        q.put(("exc", owner, traceback.format_exc()))


def test_two_worker_lease_race(tmp_path):
    db = str(tmp_path / "race.db")
    # Initialize schema once
    with open_mission_store(db, clock=FakeClock(1_000_000)) as store:
        create_mission(store, "m1")

    q: mp.Queue = mp.Queue()
    procs = [
        mp.Process(target=_worker_acquire, args=(db, "m1", "A", 30_000, q)),
        mp.Process(target=_worker_acquire, args=(db, "m1", "B", 30_000, q)),
    ]
    for p in procs:
        p.start()
    for p in procs:
        p.join(timeout=30)
        assert p.exitcode is not None
    results = [q.get(timeout=5) for _ in range(2)]
    oks = [r for r in results if r[0] == "ok"]
    errs = [r for r in results if r[0] == "err"]
    assert len(oks) == 1
    assert len(errs) == 1
    assert oks[0][2] == 1  # fence 1


def _stale_vs_new_commit(db: str, mission: str, owner: str, fence: int, q: mp.Queue) -> None:
    try:
        # Must be within B's post-reclaim lease window (deadline ~ 1_032_000)
        with open_mission_store(db, clock=FakeClock(1_010_000)) as store:
            commit_durable_semantic_transaction(
                store,
                CommitRequest(
                    mission_id=mission,
                    owner_id=owner,
                    fencing_token=fence,
                    expected_snapshot_id=None,
                    expected_snapshot_version=0,
                    next_snapshot_id=f"snap-{owner}",
                    next_snapshot_version=1,
                    semantic_digest="sem",
                    proof_ledger_digest="proof",
                    cursor_phase="c",
                    cursor_json="{}",
                ),
            )
            q.put(("ok", owner, fence))
    except SpeTypedError as e:
        q.put(("err", owner, e.code.value))
    except Exception:
        q.put(("exc", owner, traceback.format_exc()))


def test_fencing_race_repeated(tmp_path):
    iterations = 20
    stale_commits = 0
    winners = 0
    for i in range(iterations):
        db = str(tmp_path / f"fence_{i}.db")
        clock = FakeClock(1_000_000)
        with open_mission_store(db, clock=clock) as store:
            create_mission(store, "m1")
            a = acquire_worker_lease(store, mission_id="m1", owner_id="A", ttl_ms=1_000)
            assert a.fencing_token == 1
            clock.advance_ms(2_000)
            b = reclaim_worker_lease(store, mission_id="m1", owner_id="B", ttl_ms=30_000)
            assert b.fencing_token == 2

        q: mp.Queue = mp.Queue()
        pa = mp.Process(target=_stale_vs_new_commit, args=(db, "m1", "A", 1, q))
        pb = mp.Process(target=_stale_vs_new_commit, args=(db, "m1", "B", 2, q))
        for p in (pa, pb):
            p.start()
        for p in (pa, pb):
            p.join(timeout=30)
        results = [q.get(timeout=5) for _ in range(2)]
        by_owner = {r[1]: r for r in results}
        assert by_owner["A"][0] == "err"
        assert by_owner["A"][2] in {
            ErrorCode.G3_STALE_FENCE.value,
            ErrorCode.G3_LEASE_NOT_OWNED.value,
            ErrorCode.G3_CAS_CONFLICT.value,
        }
        if by_owner["B"][0] == "ok":
            winners += 1
        else:
            # B may lose to CAS if somehow raced with itself — should not happen
            pytest.fail(f"B should win fence race: {results}")
        stale_ok = [r for r in results if r[0] == "ok" and r[1] == "A"]
        stale_commits += len(stale_ok)

    assert winners == iterations
    assert stale_commits == 0


def _cas_worker(db: str, owner: str, fence: int, snap_id: str, q: mp.Queue) -> None:
    try:
        with open_mission_store(db, clock=FakeClock(1_000_000)) as store:
            commit_durable_semantic_transaction(
                store,
                CommitRequest(
                    mission_id="m1",
                    owner_id=owner,
                    fencing_token=fence,
                    expected_snapshot_id=None,
                    expected_snapshot_version=0,
                    next_snapshot_id=snap_id,
                    next_snapshot_version=1,
                    semantic_digest=f"sem-{owner}",
                    proof_ledger_digest=f"proof-{owner}",
                    cursor_phase="c",
                    cursor_json="{}",
                ),
            )
            q.put(("ok", owner))
    except SpeTypedError as e:
        q.put(("err", owner, e.code.value))


def test_cas_race(tmp_path):
    db = str(tmp_path / "cas.db")
    with open_mission_store(db, clock=FakeClock(1_000_000)) as store:
        create_mission(store, "m1")
        # Single owner holds lease; two commits same expected version — simulate by
        # giving same fence/owner in two processes (double submit)
        lease = acquire_worker_lease(store, mission_id="m1", owner_id="A", ttl_ms=60_000)

    q: mp.Queue = mp.Queue()
    p1 = mp.Process(target=_cas_worker, args=(db, "A", lease.fencing_token, "s-a", q))
    p2 = mp.Process(target=_cas_worker, args=(db, "A", lease.fencing_token, "s-b", q))
    p1.start()
    p2.start()
    p1.join(30)
    p2.join(30)
    results = [q.get(timeout=5) for _ in range(2)]
    oks = [r for r in results if r[0] == "ok"]
    errs = [r for r in results if r[0] == "err"]
    assert len(oks) == 1
    assert len(errs) == 1
    assert errs[0][2] == ErrorCode.G3_CAS_CONFLICT.value


def test_heartbeat_vs_reclaim_race(tmp_path):
    db = str(tmp_path / "hb.db")
    clock = FakeClock(1_000_000)
    with open_mission_store(db, clock=clock) as store:
        create_mission(store, "m1")
        acquire_worker_lease(store, mission_id="m1", owner_id="A", ttl_ms=1_000)

    def hb(q):
        try:
            with open_mission_store(db, clock=FakeClock(1_000_500)) as store:
                heartbeat_worker_lease(
                    store, mission_id="m1", owner_id="A", fencing_token=1, ttl_ms=30_000
                )
                q.put(("hb", "ok"))
        except SpeTypedError as e:
            q.put(("hb", e.code.value))

    def rc(q):
        try:
            with open_mission_store(db, clock=FakeClock(1_001_100)) as store:
                lease = reclaim_worker_lease(
                    store, mission_id="m1", owner_id="B", ttl_ms=30_000
                )
                q.put(("rc", "ok", lease.fencing_token))
        except SpeTypedError as e:
            q.put(("rc", e.code.value))

    # Near deadline: A heartbeats at T+500, B reclaims at T+1100 (expired if no hb win)
    q: mp.Queue = mp.Queue()
    p1 = mp.Process(target=hb, args=(q,))
    p2 = mp.Process(target=rc, args=(q,))
    p1.start()
    p2.start()
    p1.join(30)
    p2.join(30)
    results = [q.get(timeout=5) for _ in range(2)]
    # Exactly one authoritative ownership outcome — not both believing they own
    # If hb ok, reclaim should fail; if reclaim ok, hb may fail or have extended first.
    kinds = {r[0]: r for r in results}
    assert "hb" in kinds and "rc" in kinds
    if kinds["hb"][1] == "ok" and kinds["rc"][1] == "ok":
        # Both succeeding means reclaim saw expiry after hb extended — impossible
        # with proper CAS; fail
        pytest.fail(f"both heartbeat and reclaim succeeded: {results}")
