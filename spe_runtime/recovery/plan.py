"""K7 recovery plan builder - stdlib only. Refuses blind retry per TLC-proven NoBlindRetry."""
import datetime
import hashlib
import json

from spe_runtime.storage.journal import JournalError


class RecoveryError(Exception):
    """Raised on recovery-plan violation. Carries a code, never payload."""

    def __init__(self, code, reason):
        super().__init__(code + ": " + reason)
        self.code = code
        self.reason = reason


# What recovery may do per observed outcome - mirrors the TLC transition table exactly
_ACTION = {
    "NOT_EXECUTED": "RETRY",
    "DISPATCHING": "RECONCILE",          # in-flight at crash time: outcome is unknown
    "OUTCOME_UNKNOWN": "RECONCILE",
    "PARTIAL": "RECONCILE",
    "COMPLETED": "NONE",
    "FAILED": "NONE",
    "RECONCILIATION_REQUIRED": "RESOLVE_WITH_EVIDENCE",
}


def build_recovery_plan(journal_path):
    """Build a RecoveryPlan from a replayed journal."""
    from spe_runtime.storage.journal import DurableJournal

    journal = DurableJournal(journal_path)
    records = journal.replay()
    with open(journal_path, "rb") as f:
        digest = hashlib.sha256(f.read()).hexdigest()

    ops = {}
    for r in records:
        oid = r.get("operation_id")
        if oid is None:
            continue
        ops[oid] = _fold_outcome(ops.get(oid, "NOT_EXECUTED"), r.get("kind"), r)

    plan_ops = []
    for oid, outcome in sorted(ops.items()):
        plan_ops.append({
            "operation_id": oid,
            "observed_outcome": outcome,
            "required_action": _ACTION[outcome],
        })

    pid = "rp-" + hashlib.sha256(digest.encode("utf-8")).hexdigest()[:12]
    return RecoveryPlan(plan_id=pid, created_at_utc=datetime.datetime.now(datetime.timezone.utc).isoformat(), journal_sha256=digest, ops=plan_ops)


def _fold_outcome(current, kind, r):
    if kind == "CLAIM":
        return "DISPATCHING" if current == "NOT_EXECUTED" else current
    if kind == "DISPATCH":
        return "DISPATCHING"
    if kind == "RESULT_UNKNOWN":
        return "OUTCOME_UNKNOWN"
    if kind == "COMPLETE":
        return "COMPLETED"
    if kind == "FAIL":
        return "FAILED"
    if kind == "RECONCILE":
        return "RECONCILIATION_REQUIRED"
    if kind == "RESOLVE":
        return "COMPLETED" if r.get("resolution") == "COMPLETED" else "FAILED"
    return current


class RecoveryPlan:
    def __init__(self, plan_id, created_at_utc, journal_sha256, ops):
        self.plan_id = plan_id
        self.created_at_utc = created_at_utc
        self.journal_sha256 = journal_sha256
        self.ops = ops

    def has_action(self, operation_id):
        return any(o["operation_id"] == operation_id for o in self.ops)

    def to_dict(self):
        return {"plan_id": self.plan_id, "created_at_utc": self.created_at_utc, "journal_sha256": self.journal_sha256, "ops": self.ops}


# Back-compat alias (the plan calls the module recovery.plan; tests may use either name)
build_plan = build_recovery_plan
