"""WorkerExecutionLease — durable ownership + fencing (≠ SemanticProofLease)."""

from __future__ import annotations

import sqlite3

from spe_runtime.error_registry import ErrorCode, SpeTypedError
from spe_runtime.ring1.models import LeaseStatus, WorkerLeaseView
from spe_runtime.ring1.store import Ring1Store, create_mission

DEFAULT_LEASE_TTL_MS = 30_000


def _row_to_lease(row: sqlite3.Row) -> WorkerLeaseView:
    return WorkerLeaseView(
        mission_id=row["mission_id"],
        owner_id=row["owner_id"],
        fencing_token=int(row["fencing_token"]),
        status=LeaseStatus(row["status"]),
        deadline_ms=int(row["deadline_ms"]),
        last_heartbeat_ms=int(row["last_heartbeat_ms"]),
    )


def get_lease(store: Ring1Store, mission_id: str) -> WorkerLeaseView | None:
    row = store.conn.execute(
        "SELECT * FROM worker_lease WHERE mission_id = ?",
        (mission_id,),
    ).fetchone()
    return _row_to_lease(row) if row else None


def acquire_worker_lease(
    store: Ring1Store,
    *,
    mission_id: str,
    owner_id: str,
    ttl_ms: int = DEFAULT_LEASE_TTL_MS,
) -> WorkerLeaseView:
    """Acquire lease when none exists or current is expired. Issues fence >= 1."""
    if not owner_id:
        raise SpeTypedError(ErrorCode.G3_LEASE_NOT_OWNED, "owner_id required")
    create_mission(store, mission_id)

    def _tx(conn: sqlite3.Connection) -> WorkerLeaseView:
        _assert_mission_active(conn, mission_id)
        now = store.clock.now_ms()
        row = conn.execute(
            "SELECT * FROM worker_lease WHERE mission_id = ?",
            (mission_id,),
        ).fetchone()
        if row is None:
            fence = 1
            deadline = now + int(ttl_ms)
            conn.execute(
                """
                INSERT INTO worker_lease(
                  mission_id, owner_id, fencing_token, status, deadline_ms, last_heartbeat_ms
                ) VALUES (?, ?, ?, 'ACTIVE', ?, ?)
                """,
                (mission_id, owner_id, fence, deadline, now),
            )
            store.append_journal(
                conn,
                mission_id=mission_id,
                event_kind="LEASE_ACQUIRED",
                fencing_token=fence,
                content_digest=f"lease:{mission_id}:{fence}:{owner_id}",
                payload={"owner_id": owner_id, "fencing_token": fence},
            )
            return WorkerLeaseView(
                mission_id=mission_id,
                owner_id=owner_id,
                fencing_token=fence,
                status=LeaseStatus.ACTIVE,
                deadline_ms=deadline,
                last_heartbeat_ms=now,
            )

        # Existing lease: only acquire if expired
        if row["status"] == "ACTIVE" and int(row["deadline_ms"]) > now:
            if row["owner_id"] == owner_id and int(row["fencing_token"]) >= 1:
                # Same owner still holds — return current (idempotent acquire)
                return _row_to_lease(row)
            raise SpeTypedError(
                ErrorCode.G3_LEASE_NOT_OWNED,
                "lease held by another owner; use reclaim after expiry",
            )
        # Expired → reclaim path increments fence
        return _reclaim_in_tx(
            store, conn, mission_id=mission_id, owner_id=owner_id, ttl_ms=ttl_ms, now=now
        )

    return store.transactional(_tx)


def reclaim_worker_lease(
    store: Ring1Store,
    *,
    mission_id: str,
    owner_id: str,
    ttl_ms: int = DEFAULT_LEASE_TTL_MS,
) -> WorkerLeaseView:
    """Reclaim expired lease; always increments fencing token."""

    def _tx(conn: sqlite3.Connection) -> WorkerLeaseView:
        _assert_mission_active(conn, mission_id)
        now = store.clock.now_ms()
        return _reclaim_in_tx(
            store, conn, mission_id=mission_id, owner_id=owner_id, ttl_ms=ttl_ms, now=now
        )

    return store.transactional(_tx)


def _reclaim_in_tx(
    store: Ring1Store,
    conn: sqlite3.Connection,
    *,
    mission_id: str,
    owner_id: str,
    ttl_ms: int,
    now: int,
) -> WorkerLeaseView:
    row = conn.execute(
        "SELECT * FROM worker_lease WHERE mission_id = ?",
        (mission_id,),
    ).fetchone()
    if row is None:
        raise SpeTypedError(ErrorCode.G3_LEASE_NOT_OWNED, "no lease to reclaim")
    if row["status"] == "ACTIVE" and int(row["deadline_ms"]) > now:
        raise SpeTypedError(
            ErrorCode.G3_LEASE_NOT_OWNED,
            "lease not expired; reclaim refused",
        )
    new_fence = int(row["fencing_token"]) + 1
    deadline = now + int(ttl_ms)
    cur = conn.execute(
        """
        UPDATE worker_lease
        SET owner_id = ?, fencing_token = ?, status = 'ACTIVE',
            deadline_ms = ?, last_heartbeat_ms = ?
        WHERE mission_id = ?
          AND fencing_token = ?
          AND (status = 'EXPIRED' OR deadline_ms <= ?)
        """,
        (owner_id, new_fence, deadline, now, mission_id, int(row["fencing_token"]), now),
    )
    if cur.rowcount != 1:
        raise SpeTypedError(
            ErrorCode.G3_CAS_CONFLICT,
            "lease reclaim lost race",
        )
    store.append_journal(
        conn,
        mission_id=mission_id,
        event_kind="LEASE_RECLAIMED",
        fencing_token=new_fence,
        content_digest=f"reclaim:{mission_id}:{new_fence}:{owner_id}",
        payload={"owner_id": owner_id, "fencing_token": new_fence},
    )
    return WorkerLeaseView(
        mission_id=mission_id,
        owner_id=owner_id,
        fencing_token=new_fence,
        status=LeaseStatus.ACTIVE,
        deadline_ms=deadline,
        last_heartbeat_ms=now,
    )


def heartbeat_worker_lease(
    store: Ring1Store,
    *,
    mission_id: str,
    owner_id: str,
    fencing_token: int,
    ttl_ms: int = DEFAULT_LEASE_TTL_MS,
) -> WorkerLeaseView:
    """Extend deadline only for matching owner+fence. Never lowers fence."""

    def _tx(conn: sqlite3.Connection) -> WorkerLeaseView:
        _assert_mission_active(conn, mission_id)
        now = store.clock.now_ms()
        row = conn.execute(
            "SELECT * FROM worker_lease WHERE mission_id = ?",
            (mission_id,),
        ).fetchone()
        if row is None:
            raise SpeTypedError(ErrorCode.G3_LEASE_NOT_OWNED, "no lease")
        if row["owner_id"] != owner_id:
            raise SpeTypedError(ErrorCode.G3_LEASE_NOT_OWNED, "wrong owner")
        if int(row["fencing_token"]) != int(fencing_token):
            raise SpeTypedError(ErrorCode.G3_STALE_FENCE, "stale fence heartbeat")
        if row["status"] != "ACTIVE" or int(row["deadline_ms"]) <= now:
            raise SpeTypedError(ErrorCode.G3_LEASE_NOT_OWNED, "lease not active")
        deadline = now + int(ttl_ms)
        cur = conn.execute(
            """
            UPDATE worker_lease
            SET deadline_ms = ?, last_heartbeat_ms = ?
            WHERE mission_id = ? AND owner_id = ? AND fencing_token = ? AND status = 'ACTIVE'
            """,
            (deadline, now, mission_id, owner_id, int(fencing_token)),
        )
        if cur.rowcount != 1:
            raise SpeTypedError(ErrorCode.G3_STALE_FENCE, "heartbeat rejected")
        store.append_journal(
            conn,
            mission_id=mission_id,
            event_kind="LEASE_HEARTBEAT",
            fencing_token=int(fencing_token),
            content_digest=f"hb:{mission_id}:{fencing_token}:{now}",
            payload={"owner_id": owner_id},
        )
        return WorkerLeaseView(
            mission_id=mission_id,
            owner_id=owner_id,
            fencing_token=int(fencing_token),
            status=LeaseStatus.ACTIVE,
            deadline_ms=deadline,
            last_heartbeat_ms=now,
        )

    return store.transactional(_tx)


def assert_fence_owner(
    conn: sqlite3.Connection,
    *,
    mission_id: str,
    owner_id: str,
    fencing_token: int,
    now_ms: int,
) -> None:
    row = conn.execute(
        "SELECT * FROM worker_lease WHERE mission_id = ?",
        (mission_id,),
    ).fetchone()
    if row is None:
        raise SpeTypedError(ErrorCode.G3_LEASE_NOT_OWNED, "no worker lease")
    if row["owner_id"] != owner_id:
        raise SpeTypedError(ErrorCode.G3_LEASE_NOT_OWNED, "wrong lease owner")
    if int(row["fencing_token"]) != int(fencing_token):
        raise SpeTypedError(ErrorCode.G3_STALE_FENCE, "stale fencing token")
    if row["status"] != "ACTIVE" or int(row["deadline_ms"]) <= now_ms:
        raise SpeTypedError(ErrorCode.G3_LEASE_NOT_OWNED, "lease expired")


def _assert_mission_active(conn: sqlite3.Connection, mission_id: str) -> None:
    row = conn.execute(
        "SELECT cancelled, stop_requested FROM missions WHERE mission_id = ?",
        (mission_id,),
    ).fetchone()
    if row is None:
        raise SpeTypedError(ErrorCode.G3_MISSION_MISMATCH, "unknown mission")
    if int(row["cancelled"]) or int(row["stop_requested"]):
        raise SpeTypedError(ErrorCode.G3_MISSION_CANCELLED, "mission cancelled/stopped")


def cancel_mission(
    store: Ring1Store,
    mission_id: str,
    *,
    owner_id: str,
    fencing_token: int,
) -> None:
    """Cancel mission under current worker ownership (fence required).

    Stale workers after reclaim cannot cancel. Cancellation does not erase
    SENT_UNKNOWN effect uncertainty.
    """

    def _tx(conn: sqlite3.Connection) -> None:
        assert_fence_owner(
            conn,
            mission_id=mission_id,
            owner_id=owner_id,
            fencing_token=fencing_token,
            now_ms=store.clock.now_ms(),
        )
        cur = conn.execute(
            "UPDATE missions SET cancelled = 1, stop_requested = 1 WHERE mission_id = ?",
            (mission_id,),
        )
        if cur.rowcount != 1:
            raise SpeTypedError(ErrorCode.G3_MISSION_MISMATCH, "unknown mission")
        store.append_journal(
            conn,
            mission_id=mission_id,
            event_kind="MISSION_CANCELLED",
            fencing_token=int(fencing_token),
            content_digest=f"cancel:{mission_id}",
            payload={"owner_id": owner_id, "fencing_token": int(fencing_token)},
        )

    store.transactional(_tx)


__all__ = [
    "acquire_worker_lease",
    "reclaim_worker_lease",
    "heartbeat_worker_lease",
    "get_lease",
    "assert_fence_owner",
    "cancel_mission",
    "DEFAULT_LEASE_TTL_MS",
]
