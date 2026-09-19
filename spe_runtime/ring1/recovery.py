"""Recovery — reconstruct authoritative state; never auto-dispatch effects."""

from __future__ import annotations

import sqlite3

from spe_runtime.error_registry import ErrorCode, SpeTypedError
from spe_runtime.ring1.models import (
    DurableMissionState,
    EffectRecord,
    EffectState,
    ExecutionCursor,
    LeaseStatus,
    SnapshotBinding,
    WorkerLeaseView,
)
from spe_runtime.ring1.store import Ring1Store


def recover_mission(store: Ring1Store, mission_id: str) -> DurableMissionState:
    """Open-path recovery inspection. Idempotent. Does not send effects."""
    try:
        store.validate_schema()
    except SpeTypedError:
        raise
    except Exception as exc:  # noqa: BLE001
        raise SpeTypedError(
            ErrorCode.G3_RECOVERY_BLOCKED,
            f"recovery blocked: {exc}",
        ) from exc

    conn = store.conn
    m = conn.execute(
        "SELECT * FROM missions WHERE mission_id = ?",
        (mission_id,),
    ).fetchone()
    if m is None:
        raise SpeTypedError(ErrorCode.G3_MISSION_MISMATCH, "mission not found")

    snap_row = conn.execute(
        "SELECT * FROM snapshot_binding WHERE mission_id = ?",
        (mission_id,),
    ).fetchone()
    snap = (
        SnapshotBinding(
            mission_id=snap_row["mission_id"],
            snapshot_id=snap_row["snapshot_id"],
            snapshot_version=int(snap_row["snapshot_version"]),
            semantic_digest=snap_row["semantic_digest"],
            proof_ledger_digest=snap_row["proof_ledger_digest"],
        )
        if snap_row
        else None
    )

    cur_row = conn.execute(
        "SELECT * FROM execution_cursor WHERE mission_id = ?",
        (mission_id,),
    ).fetchone()
    cursor = (
        ExecutionCursor(
            mission_id=cur_row["mission_id"],
            phase=cur_row["phase"],
            cursor_json=cur_row["cursor_json"],
        )
        if cur_row
        else None
    )

    lease_row = conn.execute(
        "SELECT * FROM worker_lease WHERE mission_id = ?",
        (mission_id,),
    ).fetchone()
    lease = None
    if lease_row:
        now = store.clock.now_ms()
        status = LeaseStatus(lease_row["status"])
        if status is LeaseStatus.ACTIVE and int(lease_row["deadline_ms"]) <= now:
            status = LeaseStatus.EXPIRED
        lease = WorkerLeaseView(
            mission_id=lease_row["mission_id"],
            owner_id=lease_row["owner_id"],
            fencing_token=int(lease_row["fencing_token"]),
            status=status,
            deadline_ms=int(lease_row["deadline_ms"]),
            last_heartbeat_ms=int(lease_row["last_heartbeat_ms"]),
        )

    effects = tuple(
        EffectRecord(
            effect_id=r["effect_id"],
            mission_id=r["mission_id"],
            operation_kind=r["operation_kind"],
            idempotency_key=r["idempotency_key"],
            request_digest=r["request_digest"],
            state=EffectState(r["state"]),
            attempt_count=int(r["attempt_count"]),
            destination_ref=r["destination_ref"],
            response_digest=r["response_digest"],
        )
        for r in conn.execute(
            "SELECT * FROM effects WHERE mission_id = ? ORDER BY effect_id",
            (mission_id,),
        ).fetchall()
    )
    pending = tuple(e.effect_id for e in effects if e.state is EffectState.SENT_UNKNOWN)

    # Journal / canonical coherence (committed snapshot must have journal entry)
    if snap is not None:
        j = conn.execute(
            """
            SELECT 1 FROM journal
            WHERE mission_id = ? AND event_kind = 'SEMANTIC_COMMITTED'
              AND snapshot_version = ?
            """,
            (mission_id, snap.snapshot_version),
        ).fetchone()
        if j is None:
            raise SpeTypedError(
                ErrorCode.G3_RECOVERY_BLOCKED,
                "snapshot binding without SEMANTIC_COMMITTED journal entry",
            )

    return DurableMissionState(
        mission_id=mission_id,
        cancelled=bool(int(m["cancelled"])),
        stop_requested=bool(int(m["stop_requested"])),
        snapshot=snap,
        cursor=cursor,
        lease=lease,
        effects=effects,
        pending_reconciliation=pending,
    )


__all__ = ["recover_mission"]
