"""Canonical durable semantic commit — snapshot + proof + cursor in one txn."""

from __future__ import annotations

import hashlib
import json
import sqlite3
from typing import Any

from spe_runtime.error_registry import ErrorCode, SpeTypedError
from spe_runtime.ring1.failpoints import check_failpoint
from spe_runtime.ring1.lease import assert_fence_owner
from spe_runtime.ring1.models import CommitRequest, SnapshotBinding
from spe_runtime.ring1.store import Ring1Store


def _digest(payload: dict[str, Any]) -> str:
    blob = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()
    return hashlib.sha256(blob).hexdigest()


def commit_durable_semantic_transaction(
    store: Ring1Store,
    req: CommitRequest,
) -> SnapshotBinding:
    """Atomic local commit of snapshot binding + proof digest + cursor + journal.

    Requires matching worker lease owner + fencing token + CAS expected state.
    Does NOT grant K4 authority. Does NOT replace SemanticProofLease checks
    (caller remains responsible for Ring-0 semantic authorization before calling).
    """
    check_failpoint("before_transaction")

    def _tx(conn: sqlite3.Connection) -> SnapshotBinding:
        check_failpoint("after_validation_start")
        # Mission + stop
        m = conn.execute(
            "SELECT cancelled, stop_requested FROM missions WHERE mission_id = ?",
            (req.mission_id,),
        ).fetchone()
        if m is None:
            raise SpeTypedError(ErrorCode.G3_MISSION_MISMATCH, "unknown mission")
        if int(m["cancelled"]) or int(m["stop_requested"]):
            raise SpeTypedError(ErrorCode.G3_MISSION_CANCELLED, "mission cancelled")

        now = store.clock.now_ms()
        assert_fence_owner(
            conn,
            mission_id=req.mission_id,
            owner_id=req.owner_id,
            fencing_token=req.fencing_token,
            now_ms=now,
        )

        cur_snap = conn.execute(
            "SELECT * FROM snapshot_binding WHERE mission_id = ?",
            (req.mission_id,),
        ).fetchone()

        if cur_snap is None:
            if req.expected_snapshot_id is not None or req.expected_snapshot_version != 0:
                raise SpeTypedError(
                    ErrorCode.G3_CAS_CONFLICT,
                    "expected initial version 0 with no snapshot",
                )
            if req.next_snapshot_version != 1:
                raise SpeTypedError(
                    ErrorCode.G3_CAS_CONFLICT,
                    "first commit must advance to version 1",
                )
        else:
            if (
                cur_snap["snapshot_id"] != req.expected_snapshot_id
                or int(cur_snap["snapshot_version"]) != int(req.expected_snapshot_version)
            ):
                raise SpeTypedError(
                    ErrorCode.G3_CAS_CONFLICT,
                    "snapshot CAS mismatch",
                )
            if int(req.next_snapshot_version) != int(cur_snap["snapshot_version"]) + 1:
                raise SpeTypedError(
                    ErrorCode.G3_CAS_CONFLICT,
                    "snapshot version must strictly increase by 1",
                )

        check_failpoint("after_validation")

        # Snapshot write
        if cur_snap is None:
            conn.execute(
                """
                INSERT INTO snapshot_binding(
                  mission_id, snapshot_id, snapshot_version, semantic_digest, proof_ledger_digest
                ) VALUES (?, ?, ?, ?, ?)
                """,
                (
                    req.mission_id,
                    req.next_snapshot_id,
                    req.next_snapshot_version,
                    req.semantic_digest,
                    req.proof_ledger_digest,
                ),
            )
        else:
            cur = conn.execute(
                """
                UPDATE snapshot_binding
                SET snapshot_id = ?, snapshot_version = ?,
                    semantic_digest = ?, proof_ledger_digest = ?
                WHERE mission_id = ?
                  AND snapshot_id = ?
                  AND snapshot_version = ?
                """,
                (
                    req.next_snapshot_id,
                    req.next_snapshot_version,
                    req.semantic_digest,
                    req.proof_ledger_digest,
                    req.mission_id,
                    req.expected_snapshot_id,
                    req.expected_snapshot_version,
                ),
            )
            if cur.rowcount != 1:
                raise SpeTypedError(ErrorCode.G3_CAS_CONFLICT, "snapshot update lost")

        check_failpoint("after_snapshot_write")

        # Proof binding is stored in snapshot_binding.proof_ledger_digest (same row).
        # Cursor write
        conn.execute(
            """
            INSERT INTO execution_cursor(mission_id, phase, cursor_json)
            VALUES (?, ?, ?)
            ON CONFLICT(mission_id) DO UPDATE SET
              phase = excluded.phase,
              cursor_json = excluded.cursor_json
            """,
            (req.mission_id, req.cursor_phase, req.cursor_json),
        )
        check_failpoint("after_proof_write")
        check_failpoint("after_cursor_write")

        digest = _digest(
            {
                "mission_id": req.mission_id,
                "snapshot_id": req.next_snapshot_id,
                "version": req.next_snapshot_version,
                "semantic_digest": req.semantic_digest,
                "proof_ledger_digest": req.proof_ledger_digest,
                "fence": req.fencing_token,
            }
        )
        store.append_journal(
            conn,
            mission_id=req.mission_id,
            event_kind="SEMANTIC_COMMITTED",
            fencing_token=req.fencing_token,
            snapshot_id=req.next_snapshot_id,
            snapshot_version=req.next_snapshot_version,
            content_digest=digest,
            payload=req.payload or {},
        )
        check_failpoint("after_journal_append")
        check_failpoint("before_commit")

        return SnapshotBinding(
            mission_id=req.mission_id,
            snapshot_id=req.next_snapshot_id,
            snapshot_version=req.next_snapshot_version,
            semantic_digest=req.semantic_digest,
            proof_ledger_digest=req.proof_ledger_digest,
        )

    result = store.transactional(_tx)
    check_failpoint("after_commit")
    return result


__all__ = ["commit_durable_semantic_transaction"]
