"""Ring-1 domain models — distinct from K2 SemanticProofLease / K4 AuthorityGrant."""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Any


class LeaseStatus(str, Enum):
    NONE = "NONE"
    ACTIVE = "ACTIVE"
    EXPIRED = "EXPIRED"


class EffectState(str, Enum):
    NOT_SENT = "NOT_SENT"
    SENT_UNKNOWN = "SENT_UNKNOWN"
    KNOWN_SUCCESS = "KNOWN_SUCCESS"
    KNOWN_FAILURE = "KNOWN_FAILURE"


class JournalEvent(str, Enum):
    MISSION_CREATED = "MISSION_CREATED"
    LEASE_ACQUIRED = "LEASE_ACQUIRED"
    LEASE_HEARTBEAT = "LEASE_HEARTBEAT"
    LEASE_RECLAIMED = "LEASE_RECLAIMED"
    SEMANTIC_COMMITTED = "SEMANTIC_COMMITTED"
    EFFECT_PREPARED = "EFFECT_PREPARED"
    EFFECT_SENT_UNKNOWN = "EFFECT_SENT_UNKNOWN"
    EFFECT_KNOWN_SUCCESS = "EFFECT_KNOWN_SUCCESS"
    EFFECT_KNOWN_FAILURE = "EFFECT_KNOWN_FAILURE"
    MISSION_CANCELLED = "MISSION_CANCELLED"


@dataclass(frozen=True)
class WorkerLeaseView:
    """Durable worker ownership epoch — NOT a SemanticProofLease."""

    mission_id: str
    owner_id: str
    fencing_token: int
    status: LeaseStatus
    deadline_ms: int
    last_heartbeat_ms: int


@dataclass(frozen=True)
class SnapshotBinding:
    mission_id: str
    snapshot_id: str
    snapshot_version: int
    semantic_digest: str
    proof_ledger_digest: str


@dataclass(frozen=True)
class ExecutionCursor:
    mission_id: str
    phase: str
    cursor_json: str


@dataclass(frozen=True)
class EffectRecord:
    effect_id: str
    mission_id: str
    operation_kind: str
    idempotency_key: str
    request_digest: str
    state: EffectState
    attempt_count: int
    destination_ref: str
    response_digest: str | None = None


@dataclass(frozen=True)
class DurableMissionState:
    mission_id: str
    cancelled: bool
    stop_requested: bool
    snapshot: SnapshotBinding | None
    cursor: ExecutionCursor | None
    lease: WorkerLeaseView | None
    effects: tuple[EffectRecord, ...]
    pending_reconciliation: tuple[str, ...]


@dataclass(frozen=True)
class CommitRequest:
    mission_id: str
    owner_id: str
    fencing_token: int
    expected_snapshot_id: str | None
    expected_snapshot_version: int
    next_snapshot_id: str
    next_snapshot_version: int
    semantic_digest: str
    proof_ledger_digest: str
    cursor_phase: str
    cursor_json: str
    payload: dict[str, Any] | None = None


__all__ = [
    "LeaseStatus",
    "EffectState",
    "JournalEvent",
    "WorkerLeaseView",
    "SnapshotBinding",
    "ExecutionCursor",
    "EffectRecord",
    "DurableMissionState",
    "CommitRequest",
]
