"""Oracle independence + fixture independence merge-gate controls."""

from __future__ import annotations

import hashlib
from pathlib import Path

from tools.sprint5_conformance import (
    REPO,
    load_reference_cases,
    run_python_reference_case,
    run_rust_case,
    run_wasm_case,
)


def test_oracle_break_control_rust_and_wasm_remain_independent(monkeypatch):
    from tools import sprint5_conformance as s5

    cases = [c for c in load_reference_cases("negative") if c.get("attack") == "PROVENANCE_REMOVED"]
    assert cases
    case = cases[0]
    expect = case["expected"]["reason_code"]

    monkeypatch.setattr(s5, "detect_attack", lambda a, b: "BROKEN_ORACLE")
    py = s5.run_python_reference_case(case)
    assert py.get("status") == "ERROR"
    assert py.get("oracle_mismatch") is True
    assert py.get("reason_code") == "BROKEN_ORACLE"

    rs = s5.run_rust_case(case)
    wasm = s5.run_wasm_case(case)
    assert rs.get("reason_code") == expect
    assert wasm.get("reason_code") == expect
    assert wasm.get("runtime") == "node-webassembly"


def test_fixture_files_immutable_under_in_memory_mutation():
    pos = REPO / "data" / "conformance" / "universal_core_v1.jsonl"
    neg = REPO / "data" / "conformance" / "universal_negative_v1.jsonl"
    h1 = hashlib.sha256(pos.read_bytes()).hexdigest()
    h2 = hashlib.sha256(neg.read_bytes()).hexdigest()
    cases = load_reference_cases("positive")
    cases[0]["payload"]["envelope_id"] = "MUTATED_IN_MEMORY_ONLY"
    assert hashlib.sha256(pos.read_bytes()).hexdigest() == h1
    assert hashlib.sha256(neg.read_bytes()).hexdigest() == h2
