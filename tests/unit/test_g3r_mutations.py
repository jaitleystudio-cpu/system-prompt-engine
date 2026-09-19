"""G3R scoped mutation kills — temporary monkeypatches / isolated breaks."""

from __future__ import annotations

from pathlib import Path

import pytest

from spe_runtime.error_registry import ErrorCode, SpeTypedError
from spe_runtime.ring1.clock import FakeClock
from spe_runtime.ring1.commit import commit_durable_semantic_transaction
from spe_runtime.ring1.effects import create_effect_intent, get_effect, mark_sent_unknown
from spe_runtime.ring1.lease import acquire_worker_lease, reclaim_worker_lease
from spe_runtime.ring1.models import CommitRequest, EffectState
from spe_runtime.ring1.recovery import recover_mission
from spe_runtime.ring1.store import (
    create_mission,
    create_new_mission_store,
    open_existing_mission_store,
    open_mission_store,
)


def test_m1_fence_guard_required(tmp_path):
    db = tmp_path / "m.db"
    clock = FakeClock(1_000_000)
    with open_mission_store(db, clock=clock) as store:
        create_mission(store, "m1")
        a = acquire_worker_lease(store, mission_id="m1", owner_id="A", ttl_ms=1000)
        clock.advance_ms(2000)
        reclaim_worker_lease(store, mission_id="m1", owner_id="B", ttl_ms=10_000)
        with pytest.raises(SpeTypedError):
            commit_durable_semantic_transaction(
                store,
                CommitRequest(
                    mission_id="m1", owner_id="A", fencing_token=a.fencing_token,
                    expected_snapshot_id=None, expected_snapshot_version=0,
                    next_snapshot_id="s", next_snapshot_version=1,
                    semantic_digest="s", proof_ledger_digest="p",
                    cursor_phase="c", cursor_json="{}",
                ),
            )


def test_m6_recovery_does_not_reset_sent_unknown(tmp_path):
    db = tmp_path / "m6.db"
    clock = FakeClock(1)
    with open_mission_store(db, clock=clock) as store:
        create_mission(store, "m1")
        lease = acquire_worker_lease(store, mission_id="m1", owner_id="A", ttl_ms=10_000)
        create_effect_intent(
            store, mission_id="m1", owner_id="A", fencing_token=lease.fencing_token,
            effect_id="e", operation_kind="op", idempotency_key="ik",
            request_digest="r", destination_ref="f",
        )
        mark_sent_unknown(
            store, mission_id="m1", owner_id="A",
            fencing_token=lease.fencing_token, effect_id="e",
        )
        recover_mission(store, "m1")
        assert get_effect(store, "e").state is EffectState.SENT_UNKNOWN


def test_m11_schema_bypass_rejected(tmp_path):
    db = tmp_path / "m11.db"
    with open_mission_store(db, clock=FakeClock(1)) as store:
        store.conn.execute(
            "UPDATE ring1_meta SET value='2' WHERE key='ring1_schema_version'"
        )
    with pytest.raises(SpeTypedError) as ei:
        open_existing_mission_store(db, clock=FakeClock(1))
    assert ei.value.code is ErrorCode.G3_SCHEMA_MISMATCH


def test_m12_unsafe_fallback_refused(tmp_path):
    missing = tmp_path / "no.db"
    with pytest.raises(SpeTypedError) as ei:
        open_existing_mission_store(missing, clock=FakeClock(1))
    assert ei.value.code is ErrorCode.G3_STORE_UNAVAILABLE
    # create_new on existing refused
    db = tmp_path / "x.db"
    with create_new_mission_store(db, clock=FakeClock(1)):
        pass
    with pytest.raises(SpeTypedError) as ei2:
        create_new_mission_store(db, clock=FakeClock(1))
    assert ei2.value.code is ErrorCode.G3_STORE_ALREADY_EXISTS
