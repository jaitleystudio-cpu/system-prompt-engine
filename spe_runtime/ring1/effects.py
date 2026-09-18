"""Durable effect lifecycle — NOT_SENT / SENT_UNKNOWN / KNOWN_* .

Protocol: transition NOT_SENT → SENT_UNKNOWN in DB BEFORE dispatch to avoid
the escaped-request-still-NOT_SENT window. No universal exactly-once claim.
"""

from __future__ import annotations

import hashlib
import json
import sqlite3
from typing import Any, Protocol

from spe_runtime.error_registry import ErrorCode, SpeTypedError
from spe_runtime.ring1.failpoints import check_failpoint
from spe_runtime.ring1.lease import assert_fence_owner
from spe_runtime.ring1.models import EffectRecord, EffectState
from spe_runtime.ring1.store import Ring1Store

DEFAULT_EFFECT_RETRY_BUDGET = 3

_ALLOWED: dict[EffectState, frozenset[EffectState]] = {
    EffectState.NOT_SENT: frozenset({EffectState.SENT_UNKNOWN}),
    EffectState.SENT_UNKNOWN: frozenset(
        {EffectState.KNOWN_SUCCESS, EffectState.KNOWN_FAILURE}
    ),
    EffectState.KNOWN_SUCCESS: frozenset(),
    EffectState.KNOWN_FAILURE: frozenset(),
}


class EffectDestination(Protocol):
    """Adapter surface for reconciliation (test fake or future provider)."""

    def lookup(self, idempotency_key: str) -> dict[str, Any] | None: ...

    def apply(self, idempotency_key: str, request_digest: str) -> dict[str, Any]: ...


def _row_to_effect(row: sqlite3.Row) -> EffectRecord:
    return EffectRecord(
        effect_id=row["effect_id"],
        mission_id=row["mission_id"],
        operation_kind=row["operation_kind"],
        idempotency_key=row["idempotency_key"],
        request_digest=row["request_digest"],
        state=EffectState(row["state"]),
        attempt_count=int(row["attempt_count"]),
        destination_ref=row["destination_ref"],
        response_digest=row["response_digest"],
    )


def get_effect(store: Ring1Store, effect_id: str) -> EffectRecord | None:
    row = store.conn.execute(
        "SELECT * FROM effects WHERE effect_id = ?",
        (effect_id,),
    ).fetchone()
    return _row_to_effect(row) if row else None


def create_effect_intent(
    store: Ring1Store,
    *,
    mission_id: str,
    owner_id: str,
    fencing_token: int,
    effect_id: str,
    operation_kind: str,
    idempotency_key: str,
    request_digest: str,
    destination_ref: str,
) -> EffectRecord:
    """Persist NOT_SENT intent before any dispatch. Same key reused on retry."""

    def _tx(conn: sqlite3.Connection) -> EffectRecord:
        assert_fence_owner(
            conn,
            mission_id=mission_id,
            owner_id=owner_id,
            fencing_token=fencing_token,
            now_ms=store.clock.now_ms(),
        )
        m = conn.execute(
            "SELECT cancelled FROM missions WHERE mission_id = ?",
            (mission_id,),
        ).fetchone()
        if m is None:
            raise SpeTypedError(ErrorCode.G3_MISSION_MISMATCH, "unknown mission")
        if int(m["cancelled"]):
            raise SpeTypedError(ErrorCode.G3_MISSION_CANCELLED, "mission cancelled")

        existing = conn.execute(
            "SELECT * FROM effects WHERE mission_id = ? AND idempotency_key = ?",
            (mission_id, idempotency_key),
        ).fetchone()
        if existing:
            # Preserve key — do not mint a new logical effect
            return _row_to_effect(existing)

        conn.execute(
            """
            INSERT INTO effects(
              effect_id, mission_id, operation_kind, idempotency_key,
              request_digest, state, attempt_count, destination_ref, response_digest
            ) VALUES (?, ?, ?, ?, ?, 'NOT_SENT', 0, ?, NULL)
            """,
            (
                effect_id,
                mission_id,
                operation_kind,
                idempotency_key,
                request_digest,
                destination_ref,
            ),
        )
        store.append_journal(
            conn,
            mission_id=mission_id,
            event_kind="EFFECT_PREPARED",
            fencing_token=fencing_token,
            effect_id=effect_id,
            content_digest=f"effect:{effect_id}:{idempotency_key}",
            payload={"idempotency_key": idempotency_key},
        )
        check_failpoint("after_effect_intent")
        return EffectRecord(
            effect_id=effect_id,
            mission_id=mission_id,
            operation_kind=operation_kind,
            idempotency_key=idempotency_key,
            request_digest=request_digest,
            state=EffectState.NOT_SENT,
            attempt_count=0,
            destination_ref=destination_ref,
            response_digest=None,
        )

    return store.transactional(_tx)


def mark_sent_unknown(
    store: Ring1Store,
    *,
    mission_id: str,
    owner_id: str,
    fencing_token: int,
    effect_id: str,
    retry_budget: int = DEFAULT_EFFECT_RETRY_BUDGET,
) -> EffectRecord:
    """Conservative pre-dispatch transition NOT_SENT → SENT_UNKNOWN."""

    def _tx(conn: sqlite3.Connection) -> EffectRecord:
        assert_fence_owner(
            conn,
            mission_id=mission_id,
            owner_id=owner_id,
            fencing_token=fencing_token,
            now_ms=store.clock.now_ms(),
        )
        row = conn.execute(
            "SELECT * FROM effects WHERE effect_id = ? AND mission_id = ?",
            (effect_id, mission_id),
        ).fetchone()
        if row is None:
            raise SpeTypedError(ErrorCode.G3_MISSION_MISMATCH, "unknown effect")
        cur_state = EffectState(row["state"])
        if cur_state is EffectState.SENT_UNKNOWN:
            return _row_to_effect(row)
        if EffectState.SENT_UNKNOWN not in _ALLOWED[cur_state]:
            raise SpeTypedError(
                ErrorCode.G3_INVALID_EFFECT_TRANSITION,
                f"cannot transition {cur_state} → SENT_UNKNOWN",
            )
        attempts = int(row["attempt_count"]) + 1
        if attempts > retry_budget:
            raise SpeTypedError(ErrorCode.G3_RETRY_EXHAUSTED, "effect retry budget exhausted")
        cur = conn.execute(
            """
            UPDATE effects SET state = 'SENT_UNKNOWN', attempt_count = ?
            WHERE effect_id = ? AND state = 'NOT_SENT'
            """,
            (attempts, effect_id),
        )
        if cur.rowcount != 1:
            raise SpeTypedError(ErrorCode.G3_CAS_CONFLICT, "effect state race")
        store.append_journal(
            conn,
            mission_id=mission_id,
            event_kind="EFFECT_SENT_UNKNOWN",
            fencing_token=fencing_token,
            effect_id=effect_id,
            content_digest=f"sent_unknown:{effect_id}:{attempts}",
        )
        out = get_effect_in_conn(conn, effect_id)
        assert out is not None
        return out

    result = store.transactional(_tx)
    check_failpoint("after_sent_unknown")
    return result


def get_effect_in_conn(conn: sqlite3.Connection, effect_id: str) -> EffectRecord | None:
    row = conn.execute("SELECT * FROM effects WHERE effect_id = ?", (effect_id,)).fetchone()
    return _row_to_effect(row) if row else None


def record_known_success(
    store: Ring1Store,
    *,
    mission_id: str,
    owner_id: str,
    fencing_token: int,
    effect_id: str,
    response_digest: str,
) -> EffectRecord:
    if not response_digest:
        raise SpeTypedError(
            ErrorCode.G3_INVALID_EFFECT_TRANSITION,
            "KNOWN_SUCCESS requires response/evidence digest",
        )
    return _terminal_transition(
        store,
        mission_id=mission_id,
        owner_id=owner_id,
        fencing_token=fencing_token,
        effect_id=effect_id,
        target=EffectState.KNOWN_SUCCESS,
        response_digest=response_digest,
        journal_kind="EFFECT_KNOWN_SUCCESS",
    )


def record_known_failure(
    store: Ring1Store,
    *,
    mission_id: str,
    owner_id: str,
    fencing_token: int,
    effect_id: str,
    response_digest: str,
) -> EffectRecord:
    """KNOWN_FAILURE only with definitive failure evidence — not mere timeout."""
    if not response_digest:
        raise SpeTypedError(
            ErrorCode.G3_INVALID_EFFECT_TRANSITION,
            "KNOWN_FAILURE requires evidence digest",
        )
    return _terminal_transition(
        store,
        mission_id=mission_id,
        owner_id=owner_id,
        fencing_token=fencing_token,
        effect_id=effect_id,
        target=EffectState.KNOWN_FAILURE,
        response_digest=response_digest,
        journal_kind="EFFECT_KNOWN_FAILURE",
    )


def _terminal_transition(
    store: Ring1Store,
    *,
    mission_id: str,
    owner_id: str,
    fencing_token: int,
    effect_id: str,
    target: EffectState,
    response_digest: str,
    journal_kind: str,
) -> EffectRecord:
    def _tx(conn: sqlite3.Connection) -> EffectRecord:
        assert_fence_owner(
            conn,
            mission_id=mission_id,
            owner_id=owner_id,
            fencing_token=fencing_token,
            now_ms=store.clock.now_ms(),
        )
        row = conn.execute(
            "SELECT * FROM effects WHERE effect_id = ? AND mission_id = ?",
            (effect_id, mission_id),
        ).fetchone()
        if row is None:
            raise SpeTypedError(ErrorCode.G3_MISSION_MISMATCH, "unknown effect")
        cur_state = EffectState(row["state"])
        if target not in _ALLOWED[cur_state]:
            raise SpeTypedError(
                ErrorCode.G3_INVALID_EFFECT_TRANSITION,
                f"cannot transition {cur_state} → {target}",
            )
        # Forbidden: SENT_UNKNOWN → NOT_SENT
        cur = conn.execute(
            f"""
            UPDATE effects SET state = ?, response_digest = ?
            WHERE effect_id = ? AND state = 'SENT_UNKNOWN'
            """,
            (target.value, response_digest, effect_id),
        )
        if cur.rowcount != 1:
            raise SpeTypedError(ErrorCode.G3_CAS_CONFLICT, "effect terminal race")
        store.append_journal(
            conn,
            mission_id=mission_id,
            event_kind=journal_kind,
            fencing_token=fencing_token,
            effect_id=effect_id,
            content_digest=f"{target.value}:{effect_id}:{response_digest}",
        )
        check_failpoint("after_effect_terminal")
        out = get_effect_in_conn(conn, effect_id)
        assert out is not None
        return out

    return store.transactional(_tx)


def reconcile_effect(
    store: Ring1Store,
    *,
    mission_id: str,
    owner_id: str,
    fencing_token: int,
    effect_id: str,
    destination: EffectDestination | None,
) -> EffectRecord:
    """Reconcile SENT_UNKNOWN via destination lookup. Does not blind-retry.

    If destination is None / cannot answer: remain SENT_UNKNOWN and raise
    G3_RECONCILIATION_REQUIRED.
    """
    check_failpoint("during_reconciliation")

    def _tx(conn: sqlite3.Connection) -> EffectRecord:
        assert_fence_owner(
            conn,
            mission_id=mission_id,
            owner_id=owner_id,
            fencing_token=fencing_token,
            now_ms=store.clock.now_ms(),
        )
        row = conn.execute(
            "SELECT * FROM effects WHERE effect_id = ? AND mission_id = ?",
            (effect_id, mission_id),
        ).fetchone()
        if row is None:
            raise SpeTypedError(ErrorCode.G3_MISSION_MISMATCH, "unknown effect")
        rec = _row_to_effect(row)
        if rec.state is not EffectState.SENT_UNKNOWN:
            return rec
        if destination is None:
            raise SpeTypedError(
                ErrorCode.G3_RECONCILIATION_REQUIRED,
                "no destination reconciliation API; remain SENT_UNKNOWN",
            )
        found = destination.lookup(rec.idempotency_key)
        if found is None:
            raise SpeTypedError(
                ErrorCode.G3_RECONCILIATION_REQUIRED,
                "destination has no record; remain SENT_UNKNOWN (no blind retry)",
            )
        status = str(found.get("status", "")).upper()
        resp = str(found.get("response_digest") or found.get("operation_id") or "")
        if not resp:
            resp = hashlib.sha256(
                json.dumps(found, sort_keys=True).encode()
            ).hexdigest()
        if status in {"SUCCESS", "APPLIED", "KNOWN_SUCCESS"}:
            conn.execute(
                """
                UPDATE effects SET state = 'KNOWN_SUCCESS', response_digest = ?
                WHERE effect_id = ? AND state = 'SENT_UNKNOWN'
                """,
                (resp, effect_id),
            )
            store.append_journal(
                conn,
                mission_id=mission_id,
                event_kind="EFFECT_KNOWN_SUCCESS",
                fencing_token=fencing_token,
                effect_id=effect_id,
                content_digest=f"reconcile_success:{effect_id}:{resp}",
            )
        elif status in {"FAILURE", "FAILED", "KNOWN_FAILURE"}:
            conn.execute(
                """
                UPDATE effects SET state = 'KNOWN_FAILURE', response_digest = ?
                WHERE effect_id = ? AND state = 'SENT_UNKNOWN'
                """,
                (resp, effect_id),
            )
            store.append_journal(
                conn,
                mission_id=mission_id,
                event_kind="EFFECT_KNOWN_FAILURE",
                fencing_token=fencing_token,
                effect_id=effect_id,
                content_digest=f"reconcile_failure:{effect_id}:{resp}",
            )
        else:
            raise SpeTypedError(
                ErrorCode.G3_RECONCILIATION_REQUIRED,
                f"unrecognized destination status {status!r}; remain SENT_UNKNOWN",
            )
        out = get_effect_in_conn(conn, effect_id)
        assert out is not None
        return out

    return store.transactional(_tx)


def dispatch_effect(
    store: Ring1Store,
    *,
    mission_id: str,
    owner_id: str,
    fencing_token: int,
    effect_id: str,
    destination: EffectDestination,
    lose_response: bool = False,
) -> EffectRecord:
    """Mark SENT_UNKNOWN first, then apply. If response lost → remain SENT_UNKNOWN."""
    # Pre-send transition (closes NOT_SENT escape window)
    rec = mark_sent_unknown(
        store,
        mission_id=mission_id,
        owner_id=owner_id,
        fencing_token=fencing_token,
        effect_id=effect_id,
    )
    check_failpoint("before_dispatch")
    try:
        result = destination.apply(rec.idempotency_key, rec.request_digest)
    except Exception as exc:  # noqa: BLE001 — network-like ambiguity
        # Timeout / transport error ⇒ remain SENT_UNKNOWN (NOT KNOWN_FAILURE)
        raise SpeTypedError(
            ErrorCode.G3_EFFECT_SENT_UNKNOWN,
            f"dispatch ambiguous; remain SENT_UNKNOWN: {exc}",
        ) from exc
    check_failpoint("after_dispatch_applied")
    if lose_response:
        check_failpoint("after_dispatch_response_lost")
        raise SpeTypedError(
            ErrorCode.G3_EFFECT_SENT_UNKNOWN,
            "response lost after possible apply; remain SENT_UNKNOWN",
        )
    resp = str(result.get("response_digest") or result.get("operation_id") or "")
    check_failpoint("before_success_durability")
    return record_known_success(
        store,
        mission_id=mission_id,
        owner_id=owner_id,
        fencing_token=fencing_token,
        effect_id=effect_id,
        response_digest=resp,
    )


__all__ = [
    "EffectState",
    "EffectDestination",
    "create_effect_intent",
    "mark_sent_unknown",
    "record_known_success",
    "record_known_failure",
    "reconcile_effect",
    "dispatch_effect",
    "get_effect",
    "DEFAULT_EFFECT_RETRY_BUDGET",
]
