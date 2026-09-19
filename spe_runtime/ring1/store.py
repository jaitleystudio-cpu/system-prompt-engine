"""Authoritative Ring-1 SQLite store — fail closed; no in-memory fallback."""

from __future__ import annotations

import json
import sqlite3
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, TypeVar

from spe_runtime.error_registry import ErrorCode, SpeTypedError
from spe_runtime.ring1.clock import Clock, SystemClock
from spe_runtime.ring1.schema import DDL, REQUIRED_TABLES, RING1_SCHEMA_VERSION

T = TypeVar("T")

DEFAULT_BUSY_TIMEOUT_MS = 5000
DEFAULT_RETRY_BUDGET = 8


@dataclass
class SqlitePragmas:
    foreign_keys: str
    journal_mode: str
    synchronous: str
    busy_timeout: int


class Ring1Store:
    """One process-owned connection to one mission shard DB file."""

    def __init__(
        self,
        path: str | Path,
        *,
        clock: Clock | None = None,
        busy_timeout_ms: int = DEFAULT_BUSY_TIMEOUT_MS,
        retry_budget: int = DEFAULT_RETRY_BUDGET,
        create: bool = True,
    ) -> None:
        self.path = Path(path)
        self.clock = clock or SystemClock()
        self.busy_timeout_ms = int(busy_timeout_ms)
        self.retry_budget = int(retry_budget)
        self._conn: sqlite3.Connection | None = None
        try:
            if not create and not self.path.exists():
                raise SpeTypedError(
                    ErrorCode.G3_STORE_UNAVAILABLE,
                    f"authoritative store missing: {self.path}",
                )
            self.path.parent.mkdir(parents=True, exist_ok=True)
            self._conn = sqlite3.connect(
                str(self.path),
                timeout=self.busy_timeout_ms / 1000.0,
                isolation_level=None,  # manual BEGIN
                check_same_thread=False,
            )
            self._conn.row_factory = sqlite3.Row
            self._apply_pragmas()
            if create:
                self._ensure_schema()
            else:
                self.validate_schema()
        except SpeTypedError:
            self.close()
            raise
        except sqlite3.Error as exc:
            self.close()
            raise SpeTypedError(
                ErrorCode.G3_STORE_UNAVAILABLE,
                f"cannot open authoritative store: {exc}",
            ) from exc

    @property
    def conn(self) -> sqlite3.Connection:
        if self._conn is None:
            raise SpeTypedError(
                ErrorCode.G3_STORE_UNAVAILABLE,
                "store connection closed",
            )
        return self._conn

    def close(self) -> None:
        if self._conn is not None:
            try:
                self._conn.close()
            except sqlite3.Error:
                pass
            self._conn = None

    def __enter__(self) -> Ring1Store:
        return self

    def __exit__(self, *args: object) -> None:
        self.close()

    def _apply_pragmas(self) -> None:
        c = self.conn
        # Conservative reference durability (not physical power-loss proof).
        c.execute("PRAGMA foreign_keys = ON")
        c.execute("PRAGMA journal_mode = DELETE")  # rollback journal
        c.execute("PRAGMA synchronous = FULL")
        c.execute(f"PRAGMA busy_timeout = {self.busy_timeout_ms}")

    def read_pragmas(self) -> SqlitePragmas:
        c = self.conn
        fk = c.execute("PRAGMA foreign_keys").fetchone()[0]
        jm = c.execute("PRAGMA journal_mode").fetchone()[0]
        syn = c.execute("PRAGMA synchronous").fetchone()[0]
        # busy_timeout not always queryable the same way; record configured
        return SqlitePragmas(
            foreign_keys="ON" if fk else "OFF",
            journal_mode=str(jm).upper(),
            synchronous={1: "NORMAL", 2: "FULL", 0: "OFF"}.get(int(syn), str(syn)),
            busy_timeout=self.busy_timeout_ms,
        )

    def _ensure_schema(self) -> None:
        c = self.conn
        c.executescript(DDL)
        row = c.execute(
            "SELECT value FROM ring1_meta WHERE key = 'ring1_schema_version'"
        ).fetchone()
        if row is None:
            c.execute(
                "INSERT INTO ring1_meta(key, value) VALUES ('ring1_schema_version', ?)",
                (str(RING1_SCHEMA_VERSION),),
            )
        else:
            ver = int(row[0])
            if ver != RING1_SCHEMA_VERSION:
                raise SpeTypedError(
                    ErrorCode.G3_SCHEMA_MISMATCH,
                    f"unsupported schema version {ver}; expected {RING1_SCHEMA_VERSION}",
                )

    def validate_schema(self) -> None:
        try:
            c = self.conn
            tables = {
                r[0]
                for r in c.execute(
                    "SELECT name FROM sqlite_master WHERE type='table'"
                ).fetchall()
            }
            missing = [t for t in REQUIRED_TABLES if t not in tables]
            if missing:
                raise SpeTypedError(
                    ErrorCode.G3_SCHEMA_MISMATCH,
                    f"missing required tables: {missing}",
                )
            row = c.execute(
                "SELECT value FROM ring1_meta WHERE key = 'ring1_schema_version'"
            ).fetchone()
            if row is None:
                raise SpeTypedError(
                    ErrorCode.G3_SCHEMA_MISMATCH,
                    "ring1_schema_version missing",
                )
            ver = int(row[0])
            if ver != RING1_SCHEMA_VERSION:
                raise SpeTypedError(
                    ErrorCode.G3_SCHEMA_MISMATCH,
                    f"unsupported schema version {ver}; expected {RING1_SCHEMA_VERSION}",
                )
            # integrity check
            ok = c.execute("PRAGMA quick_check").fetchone()[0]
            if str(ok).lower() != "ok":
                raise SpeTypedError(
                    ErrorCode.G3_STORE_INTEGRITY_FAILURE,
                    f"sqlite quick_check failed: {ok}",
                )
        except SpeTypedError:
            raise
        except sqlite3.Error as exc:
            raise SpeTypedError(
                ErrorCode.G3_STORE_INTEGRITY_FAILURE,
                f"schema/integrity validation failed: {exc}",
            ) from exc

    def transactional(self, fn: Callable[[sqlite3.Connection], T]) -> T:
        """BEGIN IMMEDIATE … COMMIT with bounded busy retry; re-validate inside fn."""
        last_exc: Exception | None = None
        for _attempt in range(self.retry_budget):
            try:
                self.conn.execute("BEGIN IMMEDIATE")
                result = fn(self.conn)
                self.conn.execute("COMMIT")
                return result
            except SpeTypedError:
                try:
                    self.conn.execute("ROLLBACK")
                except sqlite3.Error:
                    pass
                raise
            except sqlite3.OperationalError as exc:
                try:
                    self.conn.execute("ROLLBACK")
                except sqlite3.Error:
                    pass
                msg = str(exc).lower()
                if "locked" in msg or "busy" in msg:
                    last_exc = exc
                    continue
                raise SpeTypedError(
                    ErrorCode.G3_STORE_UNAVAILABLE,
                    f"sqlite operational error: {exc}",
                ) from exc
            except sqlite3.Error as exc:
                try:
                    self.conn.execute("ROLLBACK")
                except sqlite3.Error:
                    pass
                # journal mutation abort
                if "G3_JOURNAL_MUTATION_REJECTED" in str(exc):
                    raise SpeTypedError(
                        ErrorCode.G3_JOURNAL_MUTATION_REJECTED,
                        str(exc),
                    ) from exc
                raise SpeTypedError(
                    ErrorCode.G3_STORE_UNAVAILABLE,
                    f"sqlite error: {exc}",
                ) from exc
        raise SpeTypedError(
            ErrorCode.G3_BUSY_EXHAUSTED,
            f"sqlite busy/locked after {self.retry_budget} attempts: {last_exc}",
        )

    def next_journal_seq(self, conn: sqlite3.Connection, mission_id: str) -> int:
        row = conn.execute(
            "SELECT COALESCE(MAX(journal_seq), 0) FROM journal WHERE mission_id = ?",
            (mission_id,),
        ).fetchone()
        return int(row[0]) + 1

    def append_journal(
        self,
        conn: sqlite3.Connection,
        *,
        mission_id: str,
        event_kind: str,
        content_digest: str,
        fencing_token: int | None = None,
        snapshot_id: str | None = None,
        snapshot_version: int | None = None,
        effect_id: str | None = None,
        payload: dict[str, Any] | None = None,
    ) -> int:
        seq = self.next_journal_seq(conn, mission_id)
        conn.execute(
            """
            INSERT INTO journal(
              mission_id, journal_seq, event_kind, fencing_token,
              snapshot_id, snapshot_version, effect_id, content_digest,
              payload_json, created_at_ms
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                mission_id,
                seq,
                event_kind,
                fencing_token,
                snapshot_id,
                snapshot_version,
                effect_id,
                content_digest,
                json.dumps(payload or {}, sort_keys=True),
                self.clock.now_ms(),
            ),
        )
        return seq


def open_mission_store(
    path: str | Path,
    *,
    clock: Clock | None = None,
    create: bool = True,
) -> Ring1Store:
    """Low-level open.

    Prefer :func:`create_new_mission_store` / :func:`open_existing_mission_store`
    at call sites. ``create=True`` on a missing path creates a fresh empty store —
    that must never be used as recovery for a lost authoritative store.
    """
    return Ring1Store(path, clock=clock, create=create)


def create_new_mission_store(
    path: str | Path,
    *,
    clock: Clock | None = None,
) -> Ring1Store:
    """Intentionally create a NEW mission shard. Fails if path already exists."""
    p = Path(path)
    if p.exists():
        raise SpeTypedError(
            ErrorCode.G3_STORE_ALREADY_EXISTS,
            f"refuse to create over existing authoritative store: {p}",
        )
    return Ring1Store(p, clock=clock, create=True)


def open_existing_mission_store(
    path: str | Path,
    *,
    clock: Clock | None = None,
) -> Ring1Store:
    """Open an EXISTING mission shard. Fails closed if missing/corrupt."""
    return Ring1Store(path, clock=clock, create=False)


def create_mission(store: Ring1Store, mission_id: str) -> None:
    if not mission_id or not isinstance(mission_id, str):
        raise SpeTypedError(ErrorCode.G3_MISSION_MISMATCH, "mission_id required")

    def _tx(conn: sqlite3.Connection) -> None:
        existing = conn.execute(
            "SELECT mission_id FROM missions WHERE mission_id = ?",
            (mission_id,),
        ).fetchone()
        if existing:
            return
        now = store.clock.now_ms()
        conn.execute(
            "INSERT INTO missions(mission_id, cancelled, stop_requested, created_at_ms) VALUES (?, 0, 0, ?)",
            (mission_id, now),
        )
        store.append_journal(
            conn,
            mission_id=mission_id,
            event_kind="MISSION_CREATED",
            content_digest=f"mission:{mission_id}",
            payload={"mission_id": mission_id},
        )

    store.transactional(_tx)


__all__ = [
    "Ring1Store",
    "SqlitePragmas",
    "open_mission_store",
    "create_new_mission_store",
    "open_existing_mission_store",
    "create_mission",
    "DEFAULT_BUSY_TIMEOUT_MS",
    "DEFAULT_RETRY_BUDGET",
]
