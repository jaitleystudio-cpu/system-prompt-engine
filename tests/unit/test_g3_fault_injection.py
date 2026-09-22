"""G3 fault-injection gates - the durable journal must survive the faults the plan names."""
import json
import os

import pytest

from spe_runtime.recovery import build_recovery_plan, RecoveryError
from spe_runtime.storage import DurableJournal, JournalError


def _journal(tmp_path, records):
    p = str(tmp_path / "journal.jsonl")
    j = DurableJournal(p)
    for kind, oid, data in records:
        j.append_event(kind, oid, data)
    return j


def test_at_most_once_claim_enforced(tmp_path):
    j = _journal(tmp_path, [
        ("DISPATCH", "op-1", {}),
        ("CLAIM", "op-1", {"slot": 0}),
    ])
    with pytest.raises(JournalError) as ei:
        j.append_event("CLAIM", "op-1", {"slot": 1})
    assert ei.value.code == "AT_MOST_ONCE_VIOLATION"


def test_honest_commit_requires_claim_and_verify(tmp_path):
    j = _journal(tmp_path, [("DISPATCH", "op-1", {})])
    with pytest.raises(JournalError) as ei:
        j.append_event("COMPLETE", "op-1", {"slot": 0})
    assert ei.value.code == "HONEST_COMMIT_VIOLATION"
    # now claim + verify, then complete succeeds
    j.append_event("CLAIM", "op-1", {"slot": 0})
    j.append_event("VERIFY", "op-1", {"slot": 0})
    j.append_event("COMPLETE", "op-1", {"slot": 0})


def test_no_blind_retry_from_unknown(tmp_path):
    j = _journal(tmp_path, [
        ("DISPATCH", "op-1", {}),
        ("RESULT_UNKNOWN", "op-1", {}),
    ])
    with pytest.raises(JournalError) as ei:
        j.append_event("FAIL", "op-1", {})
    assert ei.value.code == "NO_BLIND_RETRY"


def test_reconcile_then_resolve_requires_evidence(tmp_path):
    j = _journal(tmp_path, [
        ("DISPATCH", "op-1", {}),
        ("RESULT_UNKNOWN", "op-1", {}),
        ("RECONCILE", "op-1", {}),
    ])
    with pytest.raises(JournalError) as ei:
        j.append_event("RESOLVE", "op-1", {"resolution": "COMPLETED"})
    assert ei.value.code == "NO_BLIND_RETRY"


def test_truncated_tail_tolerated(tmp_path):
    j = _journal(tmp_path, [
        ("DISPATCH", "op-1", {}),
        ("CLAIM", "op-1", {"slot": 0}),
    ])
    # crash mid-write: corrupt the last line
    with open(j._path, "r+", encoding="utf-8") as f:
        lines = f.readlines()
        lines[-1] = lines[-1][:5]  # truncate the last line
        f.seek(0)
        f.writelines(lines)
        f.truncate()
    records = j.replay()
    assert all("kind" in r for r in records)  # all surviving lines parse


def test_recovery_plan_refuses_blind_retry(tmp_path):
    _journal(tmp_path, [
        ("DISPATCH", "op-1", {}),
        ("RESULT_UNKNOWN", "op-1", {}),
    ])
    plan = build_recovery_plan(str(tmp_path / "journal.jsonl"))
    op1 = next(o for o in plan.ops if o["operation_id"] == "op-1")
    assert op1["observed_outcome"] == "OUTCOME_UNKNOWN"
    assert op1["required_action"] == "RECONCILE"


def test_recovery_plan_marks_completed_none(tmp_path):
    _journal(tmp_path, [
        ("DISPATCH", "op-1", {}),
        ("CLAIM", "op-1", {"slot": 0}),
        ("VERIFY", "op-1", {"slot": 0}),
        ("COMPLETE", "op-1", {"slot": 0}),
    ])
    plan = build_recovery_plan(str(tmp_path / "journal.jsonl"))
    op1 = next(o for o in plan.ops if o["operation_id"] == "op-1")
    assert op1["observed_outcome"] == "COMPLETED"
    assert op1["required_action"] == "NONE"


def test_errors_never_carry_payload(tmp_path):
    j = _journal(tmp_path, [("DISPATCH", "op-1", {"goal_text": "secret-payload"})])
    with pytest.raises(JournalError) as ei:
        j.append_event("FAIL2", "op-1", {})
    assert "secret-payload" not in str(ei.value)
