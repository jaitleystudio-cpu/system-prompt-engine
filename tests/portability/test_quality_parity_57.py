"""Python ↔ Rust ↔ WASM parity for Task 57 quality semantics."""

from __future__ import annotations

import json
import subprocess
from pathlib import Path

from spe_runtime.portability.canonical import canonical_dumps
from spe_runtime.quality.engine import evaluate_request
from tests.unit.test_quality_task57 import (
    _quality_vectors,
    _reconstruction_vectors,
    _subject,
    _validate_vectors,
)

REPO = Path(__file__).resolve().parents[2]
RUST_BIN = REPO / "portable" / "spe-core-rs" / "target" / "debug" / "spe-core-eval"
PUBLIC_WASM = REPO / "apps" / "web" / "public" / "spe_wasm.wasm"
WASM_HOST = REPO / "tools" / "spe_wasm_node_host.js"


def _payloads() -> list[dict]:
    rows: list[dict] = []
    for row in _quality_vectors():
        rows.append({"id": row["id"], "spe_api": "quality", "op": "delta", "before": row["before"], "after": row["after"]})
    for row in _reconstruction_vectors():
        payload = {
            "id": row["id"],
            "spe_api": "quality",
            "op": "reconstruct",
            "subject": row["subject"],
            "attempt_index": row.get("attempt_index", 1),
        }
        if row.get("requested_repair"):
            payload["requested_repair"] = row["requested_repair"]
        rows.append(payload)
    for row in _validate_vectors():
        request = dict(row["request"])
        request.update({"id": row["id"], "spe_api": "quality", "op": "mode"})
        rows.append(request)
    rows.append({"id": "loop", "spe_api": "quality", "op": "loop", "subject": _subject(), "mode": "VALIDATE_ONLY"})
    return rows


def _run(cmd: list[str], payload: dict) -> dict:
    proc = subprocess.run(cmd, input=json.dumps(payload), capture_output=True, text=True, check=False)
    if proc.returncode != 0:
        raise AssertionError(proc.stderr[-2000:] or proc.stdout[-500:])
    wrapped = json.loads(proc.stdout)
    assert wrapped["status"] == "VALID", payload["id"]
    return wrapped["output"]


def test_python_rust_quality_parity() -> None:
    assert RUST_BIN.is_file()
    for payload in _payloads():
        py = evaluate_request(payload)
        rs = _run([str(RUST_BIN)], payload)
        assert canonical_dumps(py) == canonical_dumps(rs), payload["id"]


def test_python_wasm_quality_parity() -> None:
    assert PUBLIC_WASM.is_file() and WASM_HOST.is_file()
    for payload in _payloads():
        py = evaluate_request(payload)
        wasm = _run(["node", str(WASM_HOST), str(PUBLIC_WASM)], payload)
        assert canonical_dumps(py) == canonical_dumps(wasm), payload["id"]
