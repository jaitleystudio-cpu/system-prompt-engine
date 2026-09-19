"""Ring-1 schema version 1 — fail closed on mismatch."""

from __future__ import annotations

RING1_SCHEMA_VERSION = 1

DDL = """
CREATE TABLE IF NOT EXISTS ring1_meta (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS missions (
  mission_id TEXT PRIMARY KEY NOT NULL,
  cancelled INTEGER NOT NULL DEFAULT 0,
  stop_requested INTEGER NOT NULL DEFAULT 0,
  created_at_ms INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS snapshot_binding (
  mission_id TEXT PRIMARY KEY NOT NULL REFERENCES missions(mission_id),
  snapshot_id TEXT NOT NULL,
  snapshot_version INTEGER NOT NULL CHECK(snapshot_version >= 0),
  semantic_digest TEXT NOT NULL,
  proof_ledger_digest TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS execution_cursor (
  mission_id TEXT PRIMARY KEY NOT NULL REFERENCES missions(mission_id),
  phase TEXT NOT NULL,
  cursor_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS worker_lease (
  mission_id TEXT PRIMARY KEY NOT NULL REFERENCES missions(mission_id),
  owner_id TEXT NOT NULL,
  fencing_token INTEGER NOT NULL CHECK(fencing_token >= 1),
  status TEXT NOT NULL CHECK(status IN ('ACTIVE','EXPIRED')),
  deadline_ms INTEGER NOT NULL,
  last_heartbeat_ms INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS journal (
  mission_id TEXT NOT NULL REFERENCES missions(mission_id),
  journal_seq INTEGER NOT NULL,
  event_kind TEXT NOT NULL,
  fencing_token INTEGER,
  snapshot_id TEXT,
  snapshot_version INTEGER,
  effect_id TEXT,
  content_digest TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at_ms INTEGER NOT NULL,
  PRIMARY KEY (mission_id, journal_seq)
);

CREATE TABLE IF NOT EXISTS effects (
  effect_id TEXT PRIMARY KEY NOT NULL,
  mission_id TEXT NOT NULL REFERENCES missions(mission_id),
  operation_kind TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  request_digest TEXT NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('NOT_SENT','SENT_UNKNOWN','KNOWN_SUCCESS','KNOWN_FAILURE')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  destination_ref TEXT NOT NULL,
  response_digest TEXT,
  UNIQUE (mission_id, idempotency_key)
);

-- Append-only journal: reject UPDATE/DELETE at DB level
CREATE TRIGGER IF NOT EXISTS journal_no_update
BEFORE UPDATE ON journal
BEGIN
  SELECT RAISE(ABORT, 'G3_JOURNAL_MUTATION_REJECTED: journal is append-only');
END;

CREATE TRIGGER IF NOT EXISTS journal_no_delete
BEFORE DELETE ON journal
BEGIN
  SELECT RAISE(ABORT, 'G3_JOURNAL_MUTATION_REJECTED: journal is append-only');
END;
"""

REQUIRED_TABLES = (
    "ring1_meta",
    "missions",
    "snapshot_binding",
    "execution_cursor",
    "worker_lease",
    "journal",
    "effects",
)

__all__ = ["RING1_SCHEMA_VERSION", "DDL", "REQUIRED_TABLES"]
