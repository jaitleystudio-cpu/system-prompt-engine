"""Python, native Rust, and WASM must agree on requirement-graph vectors."""

from __future__ import annotations

import json
import subprocess
from pathlib import Path

from spe_runtime.portability.canonical import canonical_dumps
from spe_runtime.requirements.project import build_requirement_graph

REPO = Path(__file__).resolve().parents[2]
VECTORS = json.loads(
    (REPO / "proofs" / "requirement_graph_closure_20260929" / "GRAPH_VECTORS.json").read_text(
        encoding="utf-8"
    )
)["vectors"]
RUST_BIN = REPO / "portable" / "spe-core-rs" / "target" / "debug" / "spe-core-eval"
PUBLIC_WASM = REPO / "apps" / "web" / "public" / "spe_wasm.wasm"
WASM_HOST = REPO / "tools" / "spe_wasm_node_host.js"


def _payload(row: dict) -> dict:
    return {
        "spe_api": "requirement_graph",
        "op": "build",
        "protected": row.get("protected") or {},
        "category": row.get("category"),
    }


def _python(row: dict) -> dict:
    body = _payload(row)
    return build_requirement_graph(body["protected"], body["category"])


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
    assert wrapped["status"] == "VALID", wrapped
    return wrapped["output"]


def test_python_rust_graph_vectors_match() -> None:
    binary = _rust_bin()
    mismatches = []
    for row in VECTORS:
        payload = _payload(row)
        if canonical_dumps(_python(row)) != canonical_dumps(_run_json([str(binary)], payload)):
            mismatches.append(row["id"])
    assert mismatches == []


def test_python_wasm_graph_vectors_match() -> None:
    assert PUBLIC_WASM.is_file()
    mismatches = []
    for row in VECTORS:
        payload = _payload(row)
        wasm = _run_json(["node", str(WASM_HOST), str(PUBLIC_WASM)], payload)
        if canonical_dumps(_python(row)) != canonical_dumps(wasm):
            mismatches.append(row["id"])
    assert mismatches == []


def test_vector_counts() -> None:
    normal = [row for row in VECTORS if row["class"] == "normal"]
    adversarial = [row for row in VECTORS if row["class"] == "adversarial"]
    assert len(normal) >= 30
    assert len(adversarial) >= 20
