"""WASM wrapper conformance: same kernel, no duplicated validators."""

from __future__ import annotations

from pathlib import Path

from tools.sprint5_conformance import (
    REPO,
    compare_protected,
    ensure_wasm_artifact,
    load_reference_cases,
    run_python_reference_case,
    run_rust_case,
    run_wasm_case,
)

WASM_LIB = REPO / "portable" / "spe-wasm" / "src" / "lib.rs"
WASM_CARGO = REPO / "portable" / "spe-wasm" / "Cargo.toml"


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


def test_wasm_wrapper_positive_matches_python_and_rust():
    case = load_reference_cases(kind="positive")[0]
    py = run_python_reference_case(case)
    rs = run_rust_case(case)
    wasm = run_wasm_case(case)
    assert wasm["status"] == "VALID"
    assert compare_protected(py, wasm)
    assert compare_protected(rs, wasm)


def test_wasm_wrapper_negative_matches_exact_reason():
    case = load_reference_cases(kind="negative")[0]
    wasm = run_wasm_case(case)
    assert wasm["disposition"] == case["expected"]["disposition"]
    assert wasm["reason_code"] == case["expected"]["reason_code"]
