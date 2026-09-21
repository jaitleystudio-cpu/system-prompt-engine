"""WASM runtime conformance: instantiate + EXECUTE spe_wasm.wasm in Node WebAssembly.

Distinguishes WASM_BUILDS vs WASM_RUNTIME_CONFORMANCE_PROVEN.
Forbidden: native Rust as WASM proof; file-exists-only; silent representative substitution.
Target: full 55/55 positives + 55/55 negatives through WASM runtime.
"""

from __future__ import annotations

import json
import shutil
from pathlib import Path

import pytest

from tools.sprint5_conformance import (
    REPO,
    compare_protected,
    ensure_wasm_artifact,
    load_reference_cases,
    run_python_reference_case,
    run_rust_case,
    run_wasm_case,
    wasm_artifact_path,
    wasm_node_host_path,
)

WASM_LIB = REPO / "portable" / "spe-wasm" / "src" / "lib.rs"
WASM_CARGO = REPO / "portable" / "spe-wasm" / "Cargo.toml"

POSITIVES = load_reference_cases(kind="positive")
NEGATIVES = load_reference_cases(kind="negative")


def test_wasm_depends_on_spe_core_rs_path():
    cargo = WASM_CARGO.read_text(encoding="utf-8")
    assert 'spe-core-rs = { path = "../spe-core-rs" }' in cargo
    assert "tokio" not in cargo
    assert "reqwest" not in cargo


def test_wasm_source_has_no_duplicated_semantic_validator():
    lib = WASM_LIB.read_text(encoding="utf-8")
    assert "spe_core_rs::evaluate_json_str" in lib
    forbidden = [
        "fn detect_attack",
        "P_PROVENANCE_REMOVED",
        "PROTECTED_FIELDS",
        "fn evaluate_capability",
        "X01_CONSTRAINT_WEAKENED",
    ]
    for token in forbidden:
        assert token not in lib, token


def test_wasm_builds_release_artifact():
    artifact = ensure_wasm_artifact()
    assert artifact.exists()
    assert artifact.stat().st_size > 0
    assert artifact.suffix == ".wasm"


def test_wasm_host_import_inspection_zero_imports():
    """Offline sandbox: compiled module must declare zero host imports."""
    import subprocess

    artifact = ensure_wasm_artifact()
    script = r"""
const fs = require('fs');
const buf = fs.readFileSync(process.argv[1]);
WebAssembly.compile(buf).then(mod => {
  const imports = WebAssembly.Module.imports(mod);
  const exports = WebAssembly.Module.exports(mod).map(e => e.name).sort();
  process.stdout.write(JSON.stringify({imports, exports}));
}).catch(e => { console.error(e); process.exit(1); });
"""
    proc = subprocess.run(
        [(shutil.which("node") or "node"), "-e", script, str(artifact)],
        capture_output=True,
        text=True,
        check=False,
    )
    assert proc.returncode == 0, proc.stderr
    meta = json.loads(proc.stdout)
    assert meta["imports"] == [], meta
    for name in ("memory", "spe_alloc", "spe_evaluate", "spe_free"):
        assert name in meta["exports"], meta["exports"]


def test_wasm_runtime_does_not_delegate_to_native_rust(monkeypatch):
    """Adversarial: if native Rust runner is broken, WASM must still execute."""

    def boom(_case):
        raise RuntimeError("NATIVE_RUST_MUST_NOT_BE_USED_AS_WASM_PROOF")

    monkeypatch.setattr(
        "tools.sprint5_conformance.run_rust_case", boom
    )
    # Import binding used by this module may already point at original;
    # call run_wasm_case from tools directly after patching its attribute.
    from tools import sprint5_conformance as s5

    monkeypatch.setattr(s5, "run_rust_case", boom)
    case = load_reference_cases(kind="positive")[0]
    wasm = s5.run_wasm_case(case)
    assert wasm["status"] == "VALID"
    assert wasm.get("runtime") == "node-webassembly"
    assert "NATIVE_RUST" not in str(wasm)


def test_wasm_node_host_exists():
    assert wasm_node_host_path().exists()
    assert wasm_node_host_path().read_text(encoding="utf-8").count("WebAssembly") >= 2


@pytest.mark.parametrize("case", POSITIVES, ids=lambda c: c["fixture_id"])
def test_wasm_all_positives_match_python_and_rust(case):
    py = run_python_reference_case(case)
    rs = run_rust_case(case)
    wasm = run_wasm_case(case)
    assert wasm.get("runtime") == "node-webassembly"
    assert wasm["status"] == "VALID", (case["fixture_id"], wasm)
    assert compare_protected(py, wasm), case["fixture_id"]
    assert compare_protected(rs, wasm), case["fixture_id"]


@pytest.mark.parametrize("case", NEGATIVES, ids=lambda c: c["fixture_id"])
def test_wasm_all_negatives_exact_reason(case):
    wasm = run_wasm_case(case)
    assert wasm.get("runtime") == "node-webassembly"
    assert wasm["disposition"] == case["expected"]["disposition"], case["fixture_id"]
    assert wasm["reason_code"] == case["expected"]["reason_code"], (
        case["fixture_id"],
        wasm,
    )


def test_wasm_corpus_denominator_is_full_55_55():
    assert len(POSITIVES) == 55
    assert len(NEGATIVES) == 55
