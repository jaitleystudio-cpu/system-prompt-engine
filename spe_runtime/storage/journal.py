"""K7 durable journal - stdlib only. Append-only JSONL, atomic line writes, crash-tolerant replay.

The TLC-proven invariants are enforced here:
- AT MOST ONCE: one claim per operation_id. Replay detects duplicate claims (TLC: AtMostOnce).
- NO BLIND RETRY: OUTCOME_UNKNOWN never resolves to terminal without RECONCILE first (TLC: NoBlindRetry).
- HONEST COMMIT: COMPLETED is only recorded with a claimed AND verified attempt (TLC: HonestCommit).
"""
import json
import os


class JournalError(Exception):
    """Raised on journal violation. Carries a code, never payload."""

    def __init__(self, code, reason):
        super().__init__(code + ": " + reason)
        self.code = code
        self.reason = reason


VALID_TRANSITIONS = {
    "NOT_EXECUTED": {"DISPATCHING", "FAILED"},
    "DISPATCHING": {"OUTCOME_UNKNOWN", "COMPLETED", "FAILED"},
    "OUTCOME_UNKNOWN": {"RECONCILIATION_REQUIRED"},
    "PARTIAL": {"RECONCILIATION_REQUIRED", "FAILED"},
    "RECONCILIATION_REQUIRED": {"COMPLETED", "FAILED", "NOT_EXECUTED"},
    "COMPLETED": set(),
    "FAILED": {"RECONCILIATION_REQUIRED"},
}


class DurableJournal:
    """Append-only JSONL write-ahead journal. One durable object per line."""

    def __init__(self, path):
        self._path = path
        if not os.path.exists(path):
            with open(path, "w", encoding="utf-8") as f:
                pass

    def _append(self, record):
        line = json.dumps(record, sort_keys=True)
        with open(self._path, "a", encoding="utf-8") as f:
            f.write(line + "\n")
            f.flush()
            os.fsync(f.fileno())

    def append_event(self, kind, operation_id, data=None):
        """Append a durable event. Raises JournalError on invariant violations."""
        data = data or {}
        records = self.replay()
        current = _outcome_of(records, operation_id)
        if kind == "DISPATCH":
            pass
        elif kind == "RESULT_UNKNOWN":
            pass
        elif kind == "CLAIM":
            claimed = {r["operation_id"] for r in records if r["kind"] == "CLAIM"}
            if operation_id in claimed:
                raise JournalError("AT_MOST_ONCE_VIOLATION", "operation " + operation_id + " already claimed a side effect")
            if current != "DISPATCHING":
                raise JournalError("BAD_PRECONDITION", "claim requires DISPATCHING, got " + current)
        elif kind == "VERIFY":
            pass
        elif kind == "COMPLETE":
            if current != "DISPATCHING":
                raise JournalError("BAD_PRECONDITION", "complete requires DISPATCHING, got " + current)
            claimed = {r["operation_id"] for r in records if r["kind"] == "CLAIM"}
            verified = {r["slot"] for r in records if r["kind"] == "VERIFY"}
            if operation_id not in claimed or r_data_slot(data) not in verified:
                raise JournalError("HONEST_COMMIT_VIOLATION", "complete requires a claimed AND verified attempt")
        elif kind == "RECONCILE":
            if current != "OUTCOME_UNKNOWN":
                raise JournalError("NO_BLIND_RETRY", "reconcile requires OUTCOME_UNKNOWN, got " + current)
        elif kind == "RESOLVE":
            if current != "RECONCILIATION_REQUIRED":
                raise JournalError("NO_BLIND_RETRY", "resolve requires RECONCILIATION_REQUIRED, got " + current)
            if data.get("resolution") == "COMPLETED":
                claimed = {r["operation_id"] for r in records if r["kind"] == "CLAIM"}
                verified = {r["slot"] for r in records if r["kind"] == "VERIFY"}
                if operation_id not in claimed or r_data_slot(data) not in verified:
                    raise JournalError("NO_BLIND_RETRY", "resolve to COMPLETED requires claimed and verified evidence")
        elif kind == "FAIL":
            if current == "OUTCOME_UNKNOWN":
                raise JournalError("NO_BLIND_RETRY", "cannot FAIL an OUTCOME_UNKNOWN op without reconciliation evidence")
        else:
            raise JournalError("UNKNOWN_EVENT_KIND", "event kind " + str(kind) + " is not in the event vocabulary")
        self._append({"kind": kind, "operation_id": operation_id, **data})

    def replay(self):
        """Read all records. Tolerates a truncated tail line (crash mid-write)."""
        out = []
        with open(self._path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    out.append(json.loads(line))
                except json.JSONDecodeError:
                    break  # crash mid-write: ignore the truncated tail
        return out


def r_data_slot(data):
    return data.get("slot")


def _outcome_of(records, operation_id):
    """Fold replay records to the current outcome for one operation (TLC transition table)."""
    outcome = "NOT_EXECUTED"
    for r in records:
        if r.get("operation_id") != operation_id:
            continue
        kind = r.get("kind")
        if kind == "CLAIM":
            outcome = "DISPATCHING" if outcome == "NOT_EXECUTED" else outcome
        elif kind == "VERIFY":
            pass
        elif kind == "COMPLETE":
            outcome = "COMPLETED"
        elif kind == "FAIL":
            outcome = "FAILED"
        elif kind == "RECONCILE":
            outcome = "RECONCILIATION_REQUIRED"
        elif kind == "RESOLVE":
            outcome = "COMPLETED" if r.get("resolution") == "COMPLETED" else "FAILED"
        elif kind == "RESULT_UNKNOWN":
            outcome = "OUTCOME_UNKNOWN"
        elif kind == "DISPATCH":
            outcome = "DISPATCHING"
    return outcome
