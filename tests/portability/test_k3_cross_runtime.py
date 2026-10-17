"""Python, native Rust, and committed WASM must agree on K3 vectors."""

from __future__ import annotations

import json
import subprocess
from pathlib import Path

from spe_runtime.k3.selector import select_prompt_techniques
from spe_runtime.portability.canonical import canonical_dumps
from tests.unit.test_k3_runtime import VECTORS, _prot

REPO = Path(__file__).resolve().parents[2]
RUST_BIN = REPO / "portable" / "spe-core-rs" / "target" / "debug" / "spe-core-eval"
PUBLIC_WASM = REPO / "apps" / "web" / "public" / "spe_wasm.wasm"
WASM_HOST = REPO / "tools" / "spe_wasm_node_host.js"


def _payload(row: dict) -> dict:
    return {
        "spe_api": "k3",
        "op": "select",
        "protected": _prot(**(row.get("protected") or {})),
        "category": row.get("category") or {},
        "task": row.get("task") or {},
    }


def _python(row: dict) -> dict:
    body = _payload(row)
    return select_prompt_techniques(body["protected"], body["category"], body["task"])


def _rust_bin() -> Path:
    if RUST_BIN.is_file():
        return RUST_BIN
    proc = subprocess.run(
        [
            "cargo",
            "build",
            "--manifest-path",
            str(REPO / "portable" / "spe-core-rs" / "Cargo.toml"),
            "--locked",
            "--bin",
            "spe-core-eval",
        ],
        cwd=REPO,
        capture_output=True,
        text=True,
        check=False,
    )
    if proc.returncode != 0:
        raise AssertionError(proc.stderr[-2000:])
    assert RUST_BIN.is_file()
    return RUST_BIN


def _run_json(cmd: list[str], payload: dict) -> dict:
    proc = subprocess.run(
        cmd,
        input=json.dumps(payload),
        capture_output=True,
        text=True,
        check=False,
    )
    if proc.returncode != 0:
        raise AssertionError(proc.stderr[-2000:] or proc.stdout[-500:])
    wrapped = json.loads(proc.stdout)
    assert wrapped["status"] == "VALID"
    assert wrapped["disposition"] == "VALID"
    return wrapped["output"]


def test_python_rust_k3_vectors_match() -> None:
    binary = _rust_bin()
    for row in VECTORS:
        payload = _payload(row)
        py = _python(row)
        rs = _run_json([str(binary)], payload)
        assert canonical_dumps(py) == canonical_dumps(rs), row["id"]


def test_python_wasm_k3_vectors_match() -> None:
    assert PUBLIC_WASM.is_file()
    assert WASM_HOST.is_file()
    for row in VECTORS:
        payload = _payload(row)
        py = _python(row)
        wasm = _run_json(
            ["node", str(WASM_HOST), str(PUBLIC_WASM)],
            payload,
        )
        assert canonical_dumps(py) == canonical_dumps(wasm), row["id"]
