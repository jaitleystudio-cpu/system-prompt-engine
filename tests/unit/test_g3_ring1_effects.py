"""G3 effect lifecycle + reconciliation tests."""

from __future__ import annotations

from pathlib import Path

import pytest

from spe_runtime.error_registry import ErrorCode, SpeTypedError
from spe_runtime.ring1.clock import FakeClock
from spe_runtime.ring1.effects import (
    create_effect_intent,
    dispatch_effect,
    get_effect,
    mark_sent_unknown,
    reconcile_effect,
    record_known_failure,
    record_known_success,
)
from spe_runtime.ring1.lease import acquire_worker_lease, cancel_mission
from spe_runtime.ring1.models import EffectState
from spe_runtime.ring1.recovery import recover_mission
from spe_runtime.ring1.store import create_mission, open_mission_store
from spe_runtime.ring1.testing import FakeDestination


@pytest.fixture
def clock() -> FakeClock:
    return FakeClock(2_000_000)


def _setup(store, mission="m1", owner="A"):
    create_mission(store, mission)
    lease = acquire_worker_lease(store, mission_id=mission, owner_id=owner, ttl_ms=60_000)
    return lease


def test_effect_transitions_and_timeout_not_failure(tmp_path, clock):
    db = tmp_path / "e.db"
    dest = FakeDestination()
    dest.force_timeout_keys.add("ik-1")
    with open_mission_store(db, clock=clock) as store:
        lease = _setup(store)
        create_effect_intent(
            store,
            mission_id="m1",
            owner_id="A",
            fencing_token=lease.fencing_token,
            effect_id="eff-1",
            operation_kind="fake_op",
            idempotency_key="ik-1",
            request_digest="req-1",
            destination_ref="fake",
        )
        with pytest.raises(SpeTypedError) as ei:
            dispatch_effect(
                store,
                mission_id="m1",
                owner_id="A",
                fencing_token=lease.fencing_token,
                effect_id="eff-1",
                destination=dest,
            )
        assert ei.value.code is ErrorCode.G3_EFFECT_SENT_UNKNOWN
        rec = get_effect(store, "eff-1")
        assert rec is not None
        assert rec.state is EffectState.SENT_UNKNOWN


def test_ambiguous_apply_response_lost_then_reconcile(tmp_path, clock):
    db = tmp_path / "e2.db"
    dest = FakeDestination()
    with open_mission_store(db, clock=clock) as store:
        lease = _setup(store)
        create_effect_intent(
            store,
            mission_id="m1",
            owner_id="A",
            fencing_token=lease.fencing_token,
            effect_id="eff-2",
            operation_kind="fake_op",
            idempotency_key="ik-2",
            request_digest="req-2",
            destination_ref="fake",
        )
        with pytest.raises(SpeTypedError):
            dispatch_effect(
                store,
                mission_id="m1",
                owner_id="A",
                fencing_token=lease.fencing_token,
                effect_id="eff-2",
                destination=dest,
                lose_response=True,
            )
        rec = get_effect(store, "eff-2")
        assert rec.state is EffectState.SENT_UNKNOWN
        assert dest.application_count("ik-2") == 1
        # restart recovery sees SENT_UNKNOWN
        state = recover_mission(store, "m1")
        assert "eff-2" in state.pending_reconciliation
        # blind retry prohibited: create_effect_intent same key returns existing
        again = create_effect_intent(
            store,
            mission_id="m1",
            owner_id="A",
            fencing_token=lease.fencing_token,
            effect_id="eff-2-new",
            operation_kind="fake_op",
            idempotency_key="ik-2",
            request_digest="req-2",
            destination_ref="fake",
        )
        assert again.effect_id == "eff-2"
        assert again.idempotency_key == "ik-2"
        # reconcile → KNOWN_SUCCESS; application count stays 1
        done = reconcile_effect(
            store,
            mission_id="m1",
            owner_id="A",
            fencing_token=lease.fencing_token,
            effect_id="eff-2",
            destination=dest,
        )
        assert done.state is EffectState.KNOWN_SUCCESS
        assert dest.application_count("ik-2") == 1


def test_unreconcilable_remains_sent_unknown(tmp_path, clock):
    db = tmp_path / "e3.db"
    dest = FakeDestination(lookup_enabled=False)
    with open_mission_store(db, clock=clock) as store:
        lease = _setup(store)
        create_effect_intent(
            store,
            mission_id="m1",
            owner_id="A",
            fencing_token=lease.fencing_token,
            effect_id="eff-3",
            operation_kind="op",
            idempotency_key="ik-3",
            request_digest="r",
            destination_ref="opaque",
        )
        mark_sent_unknown(
            store,
            mission_id="m1",
            owner_id="A",
            fencing_token=lease.fencing_token,
            effect_id="eff-3",
        )
        with pytest.raises(SpeTypedError) as ei:
            reconcile_effect(
                store,
                mission_id="m1",
                owner_id="A",
                fencing_token=lease.fencing_token,
                effect_id="eff-3",
                destination=dest,
            )
        assert ei.value.code is ErrorCode.G3_RECONCILIATION_REQUIRED
        assert get_effect(store, "eff-3").state is EffectState.SENT_UNKNOWN


def test_cannot_reset_sent_unknown_to_not_sent(tmp_path, clock):
    db = tmp_path / "e4.db"
    with open_mission_store(db, clock=clock) as store:
        lease = _setup(store)
        create_effect_intent(
            store,
            mission_id="m1",
            owner_id="A",
            fencing_token=lease.fencing_token,
            effect_id="eff-4",
            operation_kind="op",
            idempotency_key="ik-4",
            request_digest="r",
            destination_ref="fake",
        )
        mark_sent_unknown(
            store,
            mission_id="m1",
            owner_id="A",
            fencing_token=lease.fencing_token,
            effect_id="eff-4",
        )
        # Direct illegal SQL transition attempt should not be offered by API;
        # record_known_success without evidence fails
        with pytest.raises(SpeTypedError):
            record_known_success(
                store,
                mission_id="m1",
                owner_id="A",
                fencing_token=lease.fencing_token,
                effect_id="eff-4",
                response_digest="",
            )


def test_cancellation_does_not_erase_sent_unknown(tmp_path, clock):
    db = tmp_path / "e5.db"
    with open_mission_store(db, clock=clock) as store:
        lease = _setup(store)
        create_effect_intent(
            store,
            mission_id="m1",
            owner_id="A",
            fencing_token=lease.fencing_token,
            effect_id="eff-5",
            operation_kind="op",
            idempotency_key="ik-5",
            request_digest="r",
            destination_ref="fake",
        )
        mark_sent_unknown(
            store,
            mission_id="m1",
            owner_id="A",
            fencing_token=lease.fencing_token,
            effect_id="eff-5",
        )
        cancel_mission(store, "m1")
        state = recover_mission(store, "m1")
        assert state.cancelled
        assert get_effect(store, "eff-5").state is EffectState.SENT_UNKNOWN


def test_known_failure_requires_evidence(tmp_path, clock):
    db = tmp_path / "e6.db"
    with open_mission_store(db, clock=clock) as store:
        lease = _setup(store)
        create_effect_intent(
            store,
            mission_id="m1",
            owner_id="A",
            fencing_token=lease.fencing_token,
            effect_id="eff-6",
            operation_kind="op",
            idempotency_key="ik-6",
            request_digest="r",
            destination_ref="fake",
        )
        mark_sent_unknown(
            store,
            mission_id="m1",
            owner_id="A",
            fencing_token=lease.fencing_token,
            effect_id="eff-6",
        )
        with pytest.raises(SpeTypedError):
            record_known_failure(
                store,
                mission_id="m1",
                owner_id="A",
                fencing_token=lease.fencing_token,
                effect_id="eff-6",
                response_digest="",
            )
        ok = record_known_failure(
            store,
            mission_id="m1",
            owner_id="A",
            fencing_token=lease.fencing_token,
            effect_id="eff-6",
            response_digest="fail-evidence",
        )
        assert ok.state is EffectState.KNOWN_FAILURE


def test_idempotency_key_survives_reopen(tmp_path, clock):
    db = tmp_path / "e7.db"
    with open_mission_store(db, clock=clock) as store:
        lease = _setup(store)
        create_effect_intent(
            store,
            mission_id="m1",
            owner_id="A",
            fencing_token=lease.fencing_token,
            effect_id="eff-7",
            operation_kind="op",
            idempotency_key="stable-key",
            request_digest="r",
            destination_ref="fake",
        )
    with open_mission_store(db, clock=clock, create=False) as store2:
        rec = get_effect(store2, "eff-7")
        assert rec is not None
        assert rec.idempotency_key == "stable-key"
