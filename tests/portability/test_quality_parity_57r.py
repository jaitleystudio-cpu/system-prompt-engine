"""Python ↔ Rust ↔ WASM parity for Task57R from_k3 receipt custody."""

from __future__ import annotations

import json
import subprocess
from pathlib import Path

from spe_runtime.portability.canonical import canonical_dumps
from spe_runtime.quality.engine import evaluate_request
from tests.unit.test_quality_task57 import _subject
from tests.unit.test_quality_task57r import _k3_output, _verified_evidence

REPO = Path(__file__).resolve().parents[2]
RUST_BIN = REPO / "portable" / "spe-core-rs" / "target" / "debug" / "spe-core-eval"
PUBLIC_WASM = REPO / "apps" / "web" / "public" / "spe_wasm.wasm"
WASM_HOST = REPO / "tools" / "spe_wasm_node_host.js"


def _payloads() -> list[dict]:
    base = _subject()
    k3 = _k3_output(base)
    k3["protected_binding"] = {**k3["protected_binding"], "category": "C99"}
    common = {
        "compiled_prompt": base["compiled_prompt"],
        "k3_output": k3,
        "mode": "VALIDATE_ONLY",
        "op": "from_k3",
        "proof_class": "ENFORCEMENT_VERIFIED",
        "spe_api": "quality",
        "wasm_available": True,
        "wasm_sha256": "ab" * 32,
    }
    witnessed = dict(common)
    witnessed["runtime_evidence"] = _verified_evidence("cd" * 32)
    execute = dict(witnessed)
    execute["mode"] = "EXECUTE"
    execute["proof_class"] = "EXECUTION_OBSERVED"
    return [common, witnessed, execute]


def _run(cmd: list[str], payload: dict) -> dict:
    proc = subprocess.run(cmd, input=json.dumps(payload), capture_output=True, text=True, check=False)
    if proc.returncode != 0:
        raise AssertionError(proc.stderr[-2000:] or proc.stdout[-500:])
    wrapped = json.loads(proc.stdout)
    assert wrapped["status"] == "VALID", payload.get("mode")
    return wrapped["output"]


def test_python_rust_from_k3_parity() -> None:
    assert RUST_BIN.is_file()
    for payload in _payloads():
        py = evaluate_request(payload)
        rs = _run([str(RUST_BIN)], payload)
        assert canonical_dumps(py) == canonical_dumps(rs), payload["mode"]


def test_python_wasm_from_k3_parity() -> None:
    assert PUBLIC_WASM.is_file() and WASM_HOST.is_file()
    for payload in _payloads():
        py = evaluate_request(payload)
        wasm = _run(["node", str(WASM_HOST), str(PUBLIC_WASM)], payload)
        assert canonical_dumps(py) == canonical_dumps(wasm), payload["mode"]
