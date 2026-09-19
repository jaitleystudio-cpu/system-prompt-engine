"""Architecture: UI → Web Worker → actual spe_wasm.wasm → spe-core-rs.

TS must not duplicate SPE semantics. No Python in the browser path.
WASM failure must surface ENGINE_UNAVAILABLE — never a silent TS fallback.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

from tests.web.paths import REPO, WEB, web_source_text

SEMANTIC_TOKENS = [
    "function detect_attack",
    "fn detect_attack",
    "function semantic_equivalent",
    "PROTECTED_FIELDS",
    "function evaluate_capability",
    "P_PROVENANCE_REMOVED",
    "X01_CONSTRAINT_WEAKENED",
    "C07_EXECUTION_MISSING_AUTHORITY",
    "PORTABILITY_REQUIRED_CAPABILITY_MISSING",
]


def _engine_files() -> list[Path]:
    engine = WEB / "src" / "engine"
    assert engine.is_dir(), "apps/web/src/engine missing"
    return [
        p
        for p in engine.rglob("*")
        if p.suffix in {".ts", ".tsx", ".js", ".mjs"} and p.is_file()
    ]


def test_web_worker_loads_actual_wasm_not_ts_kernel():
    worker_candidates = list((WEB / "src").rglob("*worker*"))
    assert worker_candidates, "no Web Worker source under apps/web/src"
    text = "\n".join(p.read_text(encoding="utf-8") for p in worker_candidates)
    assert "spe_wasm.wasm" in text or "spe_wasm" in text
    assert "spe_evaluate" in text
    assert "spe_alloc" in text
    assert "WebAssembly" in text


def test_shipped_release_wasm_matches_kernel_artifact_hash():
    public_wasm = WEB / "public" / "spe_wasm.wasm"
    meta_path = WEB / "public" / "spe_wasm.sha256.json"
    assert public_wasm.is_file(), "release WASM not shipped into web public/"
    assert meta_path.is_file()
    meta = json.loads(meta_path.read_text(encoding="utf-8"))
    import hashlib

    digest = hashlib.sha256(public_wasm.read_bytes()).hexdigest()
    assert meta["sha256"] == digest
    assert meta["bytes"] == public_wasm.stat().st_size
    assert public_wasm.stat().st_size > 100_000
    # Prefer matching the Sprint-5 release artifact when present.
    rust_wasm = (
        REPO
        / "portable"
        / "spe-wasm"
        / "target"
        / "wasm32-unknown-unknown"
        / "release"
        / "spe_wasm.wasm"
    )
    if rust_wasm.is_file():
        rust_digest = hashlib.sha256(rust_wasm.read_bytes()).hexdigest()
        assert digest == rust_digest, "web WASM is not the spe-wasm release artifact"


def test_ts_does_not_duplicate_semantic_detectors():
    files = _engine_files()
    ui_files = [
        p
        for p in (WEB / "src").rglob("*")
        if p.suffix in {".ts", ".tsx", ".js", ".mjs"} and p.is_file()
    ]
    body = "\n".join(p.read_text(encoding="utf-8") for p in files + ui_files)
    # Displaying reason codes returned by WASM is allowed; implementing detectors is not.
    assert "function detect_attack" not in body
    assert "function semantic_equivalent" not in body
    assert "function evaluate_capability" not in body
    assert "PROTECTED_FIELDS" not in body
    # Must not contain a TS evaluator that returns VALID/INVALID itself.
    assert "function evaluate_fixture" not in body
    assert "evaluate_json_str" not in body or "spe_evaluate" in body


def test_engine_unavailable_on_wasm_failure_no_ts_fallback():
    text = web_source_text()
    assert "ENGINE_UNAVAILABLE" in text
    # A fallback evaluator would look like evaluating JSON without WebAssembly.
    engine_text = "\n".join(p.read_text(encoding="utf-8") for p in _engine_files())
    assert "fallback" not in engine_text.lower() or "no fallback" in engine_text.lower()
    assert re.search(r"ENGINE_UNAVAILABLE", engine_text)


def test_no_python_in_browser_path():
    text = web_source_text()
    assert "python" not in text.lower() or "no python" in text.lower()
    for p in (WEB / "src").rglob("*"):
        if p.suffix in {".ts", ".tsx", ".js", ".mjs"}:
            src = p.read_text(encoding="utf-8")
            assert "pyodide" not in src.lower()
            assert "cpython" not in src.lower()
            assert "/spe_runtime/" not in src


def test_wasm_integrity_checked_before_instantiate():
    engine_text = "\n".join(p.read_text(encoding="utf-8") for p in _engine_files())
    assert "sha256" in engine_text.lower() or "SHA-256" in engine_text or "SHA256" in engine_text
    assert "WASM_INTEGRITY_MISMATCH" in engine_text
