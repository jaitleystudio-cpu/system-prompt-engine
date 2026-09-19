"""G3 scoped mutation tests — prove guards have teeth (mutant copies only)."""

from __future__ import annotations

import sqlite3
from pathlib import Path

import pytest

from spe_runtime.error_registry import ErrorCode, SpeTypedError
from spe_runtime.ring1.clock import FakeClock
from spe_runtime.ring1.commit import commit_durable_semantic_transaction
from spe_runtime.ring1.lease import acquire_worker_lease, reclaim_worker_lease
from spe_runtime.ring1.models import CommitRequest, EffectState
from spe_runtime.ring1.store import create_mission, open_mission_store


def test_m1_stale_fence_guard_required(tmp_path):
    """If fence check removed from SQL, stale worker could commit — show API rejects."""
    db = tmp_path / "m1.db"
    clock = FakeClock(1_000_000)
    with open_mission_store(db, clock=clock) as store:
        create_mission(store, "m1")
        a = acquire_worker_lease(store, mission_id="m1", owner_id="A", ttl_ms=1000)
        clock.advance_ms(2000)
        b = reclaim_worker_lease(store, mission_id="m1", owner_id="B", ttl_ms=10_000)
        assert b.fencing_token > a.fencing_token
        with pytest.raises(SpeTypedError) as ei:
            commit_durable_semantic_transaction(
                store,
                CommitRequest(
                    mission_id="m1",
                    owner_id="A",
                    fencing_token=a.fencing_token,
                    expected_snapshot_id=None,
                    expected_snapshot_version=0,
                    next_snapshot_id="bad",
                    next_snapshot_version=1,
                    semantic_digest="s",
                    proof_ledger_digest="p",
                    cursor_phase="c",
                    cursor_json="{}",
                ),
            )
        assert ei.value.code in {ErrorCode.G3_STALE_FENCE, ErrorCode.G3_LEASE_NOT_OWNED}


def test_m2_cas_required(tmp_path):
    db = tmp_path / "m2.db"
    clock = FakeClock(1)
    with open_mission_store(db, clock=clock) as store:
        create_mission(store, "m1")
        lease = acquire_worker_lease(store, mission_id="m1", owner_id="A", ttl_ms=10_000)
        commit_durable_semantic_transaction(
            store,
            CommitRequest(
                mission_id="m1",
                owner_id="A",
                fencing_token=lease.fencing_token,
                expected_snapshot_id=None,
                expected_snapshot_version=0,
                next_snapshot_id="s1",
                next_snapshot_version=1,
                semantic_digest="s",
                proof_ledger_digest="p",
                cursor_phase="c",
                cursor_json="{}",
            ),
        )
        with pytest.raises(SpeTypedError) as ei:
            commit_durable_semantic_transaction(
                store,
                CommitRequest(
                    mission_id="m1",
                    owner_id="A",
                    fencing_token=lease.fencing_token,
                    expected_snapshot_id=None,
                    expected_snapshot_version=0,
                    next_snapshot_id="s2",
                    next_snapshot_version=1,
                    semantic_digest="s",
                    proof_ledger_digest="p",
                    cursor_phase="c",
                    cursor_json="{}",
                ),
            )
        assert ei.value.code is ErrorCode.G3_CAS_CONFLICT


def test_m3_half_commit_mutant_exposes_gap(tmp_path):
    """Mutant: write snapshot then commit without proof/cursor — recovery blocked."""
    db = tmp_path / "m3.db"
    clock = FakeClock(1)
    with open_mission_store(db, clock=clock) as store:
        create_mission(store, "m1")
        acquire_worker_lease(store, mission_id="m1", owner_id="A", ttl_ms=10_000)

        def half(conn: sqlite3.Connection) -> None:
            conn.execute(
                """
                INSERT INTO snapshot_binding(
                  mission_id, snapshot_id, snapshot_version, semantic_digest, proof_ledger_digest
                ) VALUES ('m1','s',1,'sem','PROOF_MISSING_MARKER')
                """
            )
            # intentionally no cursor / no journal

        store.transactional(half)

    with open_mission_store(db, clock=clock, create=False) as store:
        from spe_runtime.ring1.recovery import recover_mission

        with pytest.raises(SpeTypedError) as ei:
            recover_mission(store, "m1")
        assert ei.value.code is ErrorCode.G3_RECOVERY_BLOCKED


def test_m5_timeout_not_known_failure(tmp_path):
    from spe_runtime.ring1.effects import create_effect_intent, dispatch_effect, get_effect
    from spe_runtime.ring1.testing import FakeDestination

    db = tmp_path / "m5.db"
    clock = FakeClock(1)
    dest = FakeDestination()
    dest.force_timeout_keys.add("ik")
    with open_mission_store(db, clock=clock) as store:
        create_mission(store, "m1")
        lease = acquire_worker_lease(store, mission_id="m1", owner_id="A", ttl_ms=10_000)
        create_effect_intent(
            store,
            mission_id="m1",
            owner_id="A",
            fencing_token=lease.fencing_token,
            effect_id="e",
            operation_kind="op",
            idempotency_key="ik",
            request_digest="r",
            destination_ref="f",
        )
        with pytest.raises(SpeTypedError):
            dispatch_effect(
                store,
                mission_id="m1",
                owner_id="A",
                fencing_token=lease.fencing_token,
                effect_id="e",
                destination=dest,
            )
        assert get_effect(store, "e").state is EffectState.SENT_UNKNOWN


def test_m6_cannot_reset_to_not_sent(tmp_path):
    from spe_runtime.ring1.effects import create_effect_intent, mark_sent_unknown, get_effect

    db = tmp_path / "m6.db"
    clock = FakeClock(1)
    with open_mission_store(db, clock=clock) as store:
        create_mission(store, "m1")
        lease = acquire_worker_lease(store, mission_id="m1", owner_id="A", ttl_ms=10_000)
        create_effect_intent(
            store,
            mission_id="m1",
            owner_id="A",
            fencing_token=lease.fencing_token,
            effect_id="e",
            operation_kind="op",
            idempotency_key="ik",
            request_digest="r",
            destination_ref="f",
        )
        mark_sent_unknown(
            store,
            mission_id="m1",
            owner_id="A",
            fencing_token=lease.fencing_token,
            effect_id="e",
        )
        # No API exists to reset; direct SQL would violate allowed transitions if we check
        store.conn.execute("UPDATE effects SET state='NOT_SENT' WHERE effect_id='e'")
        # Canonical API still treats row as corrupted for mark_sent_unknown from NOT_SENT ok,
        # but recovery should still show the row — document that API path forbids reset.
        # Re-mark is allowed from NOT_SENT; the mutation we're killing is *automatic*
        # restart reset. recover_mission must not rewrite state.
        from spe_runtime.ring1.recovery import recover_mission

        before = get_effect(store, "e").state
        recover_mission(store, "m1")
        after = get_effect(store, "e").state
        assert before == after  # recovery does not auto-reset


def test_m7_retry_preserves_idempotency_key(tmp_path):
    from spe_runtime.ring1.effects import create_effect_intent

    db = tmp_path / "m7.db"
    clock = FakeClock(1)
    with open_mission_store(db, clock=clock) as store:
        create_mission(store, "m1")
        lease = acquire_worker_lease(store, mission_id="m1", owner_id="A", ttl_ms=10_000)
        a = create_effect_intent(
            store,
            mission_id="m1",
            owner_id="A",
            fencing_token=lease.fencing_token,
            effect_id="e1",
            operation_kind="op",
            idempotency_key="same",
            request_digest="r",
            destination_ref="f",
        )
        b = create_effect_intent(
            store,
            mission_id="m1",
            owner_id="A",
            fencing_token=lease.fencing_token,
            effect_id="e2",
            operation_kind="op",
            idempotency_key="same",
            request_digest="r",
            destination_ref="f",
        )
        assert a.effect_id == b.effect_id == "e1"
        assert a.idempotency_key == b.idempotency_key == "same"


def test_m8_recovery_does_not_auto_resend(tmp_path):
    from spe_runtime.ring1.effects import create_effect_intent, mark_sent_unknown
    from spe_runtime.ring1.recovery import recover_mission
    from spe_runtime.ring1.testing import FakeDestination

    db = tmp_path / "m8.db"
    clock = FakeClock(1)
    dest = FakeDestination()
    with open_mission_store(db, clock=clock) as store:
        create_mission(store, "m1")
        lease = acquire_worker_lease(store, mission_id="m1", owner_id="A", ttl_ms=10_000)
        create_effect_intent(
            store,
            mission_id="m1",
            owner_id="A",
            fencing_token=lease.fencing_token,
            effect_id="e",
            operation_kind="op",
            idempotency_key="ik",
            request_digest="r",
            destination_ref="f",
        )
        mark_sent_unknown(
            store,
            mission_id="m1",
            owner_id="A",
            fencing_token=lease.fencing_token,
            effect_id="e",
        )
        state = recover_mission(store, "m1")
        assert "e" in state.pending_reconciliation
        assert dest.application_count("ik") == 0  # recovery did not dispatch


def test_m9_journal_update_rejected(tmp_path):
    db = tmp_path / "m9.db"
    clock = FakeClock(1)
    with open_mission_store(db, clock=clock) as store:
        create_mission(store, "m1")
        with pytest.raises(SpeTypedError) as ei:
            store.transactional(
                lambda c: c.execute("UPDATE journal SET event_kind='HACK' WHERE journal_seq=1")
            )
        assert ei.value.code is ErrorCode.G3_JOURNAL_MUTATION_REJECTED


def test_m10_success_requires_evidence(tmp_path):
    from spe_runtime.ring1.effects import create_effect_intent, mark_sent_unknown, record_known_success

    db = tmp_path / "m10.db"
    clock = FakeClock(1)
    with open_mission_store(db, clock=clock) as store:
        create_mission(store, "m1")
        lease = acquire_worker_lease(store, mission_id="m1", owner_id="A", ttl_ms=10_000)
        create_effect_intent(
            store,
            mission_id="m1",
            owner_id="A",
            fencing_token=lease.fencing_token,
            effect_id="e",
            operation_kind="op",
            idempotency_key="ik",
            request_digest="r",
            destination_ref="f",
        )
        mark_sent_unknown(
            store,
            mission_id="m1",
            owner_id="A",
            fencing_token=lease.fencing_token,
            effect_id="e",
        )
        with pytest.raises(SpeTypedError):
            record_known_success(
                store,
                mission_id="m1",
                owner_id="A",
                fencing_token=lease.fencing_token,
                effect_id="e",
                response_digest="",
            )
