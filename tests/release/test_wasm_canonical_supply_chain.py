"""Supply-chain checks for the canonical WASM build and promotion path.

These tests prove the build recipe rejects floating inputs and that
copy-wasm only publishes the reviewed canonical hash. They do not claim
a broader security property.
"""

from __future__ import annotations

import hashlib
import json
import os
import shutil
import subprocess
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
BUILD = REPO / "tools" / "wasm_canonical_build.mjs"
WRAPPER = REPO / "tools" / "spe_wasm_rustc_wrapper.mjs"
COPY = REPO / "apps" / "web" / "scripts" / "copy-wasm.mjs"
PUBLIC = REPO / "apps" / "web" / "public" / "spe_wasm.wasm"
PUBLIC_META = REPO / "apps" / "web" / "public" / "spe_wasm.sha256.json"
HISTORICAL_MANIFEST = (
    REPO / "proofs" / "wasm_rebaseline_candidate_20260928" / "candidate-manifest.json"
)
MANIFEST = REPO / "proofs" / "k3_effect_binding_20260929" / "candidate-manifest.json"
GRAPH_MANIFEST = REPO / "proofs" / "k3_runtime_closure_20260929" / "candidate-manifest.json"
LEGACY_SHA256 = "8d482a17404d873a599b6804181d0637ae20a021ffe912ca19fdf99139c52830"
PREVIOUS_CANONICAL_SHA256 = "9325f9ec82815f1d3e5dbb3923997244e9190755168d23690140944575dbf6c6"
PREVIOUS_CANONICAL_BYTES = 671621
CANONICAL_SHA256 = "48ad95f5873bd7fb7933354d93fbbe732c57bc6f85956f64762fe1f5f44f2c33"
CANONICAL_BYTES = 937763
GRAPH_CLOSURE_SHA256 = "9cda3a8ef0f314dba152fbd442b8b3c8476d6f2be8b6e3221fb8abcdac6eb686"
GRAPH_CLOSURE_BYTES = 870560
CANONICAL_CANDIDATE = (
    REPO
    / "portable"
    / "spe-wasm"
    / "target-canonical"
    / "wasm32-unknown-unknown"
    / "release"
    / "spe_wasm.wasm"
)
ABSOLUTE_MARKERS = ("/workspace", "/home/", "/Users/", "/tmp/", ".codex/", ".chatgpt-projects/")


def _public_sha() -> str:
    return hashlib.sha256(PUBLIC.read_bytes()).hexdigest()


def _run_build(extra_env: dict[str, str], cwd: Path | None = None) -> subprocess.CompletedProcess[str]:
    env = os.environ.copy()
    env.update(extra_env)
    return subprocess.run(
        ["node", str(BUILD)],
        cwd=str(cwd or REPO),
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )


def _run_copy(extra_env: dict[str, str] | None = None) -> subprocess.CompletedProcess[str]:
    env = os.environ.copy()
    if extra_env:
        env.update(extra_env)
    return subprocess.run(
        ["node", str(COPY)],
        cwd=str(REPO / "apps" / "web"),
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )


def test_build_script_never_copies_into_public():
    text = BUILD.read_text(encoding="utf-8")
    assert "copyFileSync" not in text
    assert "scripts/copy-wasm.mjs" not in text
    assert "apps/web/public/spe_wasm.wasm" in text
    assert "promoted=no" in text
    wrapper = WRAPPER.read_text(encoding="utf-8")
    assert "spe-canonical-v1-" in wrapper
    assert "spe_core_rs" in wrapper
    assert "spe_wasm" in wrapper


def test_floating_rust_toolchain_rejected(tmp_path: Path):
    before = _public_sha()
    declared = tmp_path / "rust-toolchain.toml"
    declared.write_text(
        '[toolchain]\nchannel = "stable"\ntargets = ["wasm32-unknown-unknown"]\n',
        encoding="utf-8",
    )
    proc = _run_build({"SPE_WASM_TOOLCHAIN_FILE": str(declared)})
    assert proc.returncode == 2, proc.stderr
    assert "rejected" in proc.stderr
    assert _public_sha() == before == CANONICAL_SHA256


def test_wrong_target_rejected():
    before = _public_sha()
    proc = _run_build({"SPE_WASM_TARGET": "wasm32-wasip1"})
    assert proc.returncode == 2, proc.stderr
    assert "wrong target rejected" in proc.stderr
    assert _public_sha() == before == CANONICAL_SHA256


def test_public_and_arbitrary_target_dirs_rejected():
    before = _public_sha()
    planted = REPO / "apps" / "web" / "public" / "not-a-candidate-target"
    proc = _run_build({"SPE_WASM_CANDIDATE_TARGET_DIR": str(planted)})
    assert proc.returncode == 2, proc.stderr
    assert "does not promote" in proc.stderr
    assert not planted.exists()
    assert _public_sha() == before == CANONICAL_SHA256
    arbitrary = REPO / "portable" / "spe-wasm" / "target"
    proc_copy = _run_build({"SPE_WASM_CANDIDATE_TARGET_DIR": str(arbitrary)})
    assert proc_copy.returncode == 2, proc_copy.stderr
    assert "arbitrary cargo target" in proc_copy.stderr


def test_dirty_candidate_is_rebuilt_and_not_trusted(tmp_path: Path):
    """A pre-existing wasm in the target dir must not be returned as the candidate."""
    before = _public_sha()
    target = tmp_path / "candidate-target"
    artifact = target / "wasm32-unknown-unknown" / "release" / "spe_wasm.wasm"
    artifact.parent.mkdir(parents=True)
    artifact.write_bytes(b"\x00asm-not-a-real-module")
    planted = hashlib.sha256(artifact.read_bytes()).hexdigest()
    proc = _run_build({"SPE_WASM_CANDIDATE_TARGET_DIR": str(target)})
    assert proc.returncode == 0, proc.stderr
    assert artifact.is_file()
    rebuilt = hashlib.sha256(artifact.read_bytes()).hexdigest()
    assert rebuilt != planted
    assert rebuilt == CANONICAL_SHA256
    assert artifact.stat().st_size == CANONICAL_BYTES
    assert f"sha256={rebuilt}" in proc.stdout
    assert "imports=0" in proc.stdout
    assert "promoted=no" in proc.stdout
    assert "path_class=external-clean-target" in proc.stdout
    blob = artifact.read_bytes()
    for marker in ABSOLUTE_MARKERS:
        assert marker.encode() not in blob
    assert _public_sha() == before == CANONICAL_SHA256


def test_candidate_manifest_matches_artifact_and_hides_absolute_paths():
    assert MANIFEST.is_file(), "candidate manifest must be committed with the recipe"
    historical = json.loads(HISTORICAL_MANIFEST.read_text(encoding="utf-8"))
    assert historical["artifact_sha256"] == PREVIOUS_CANONICAL_SHA256
    assert historical["artifact_size"] == PREVIOUS_CANONICAL_BYTES
    assert historical["build_a_sha256"] == historical["build_b_sha256"] == PREVIOUS_CANONICAL_SHA256
    graph_manifest = json.loads(GRAPH_MANIFEST.read_text(encoding="utf-8"))
    assert graph_manifest["artifact_sha256"] == GRAPH_CLOSURE_SHA256
    assert graph_manifest["artifact_size"] == GRAPH_CLOSURE_BYTES
    payload = json.loads(MANIFEST.read_text(encoding="utf-8"))
    text = MANIFEST.read_text(encoding="utf-8")
    for marker in ("/workspace", "/home/", "/Users/", "/tmp/", ".codex", ".chatgpt-projects"):
        assert marker not in text
    assert payload["build_a_sha256"] == payload["build_b_sha256"] == payload["artifact_sha256"]
    assert payload["legacy_sha256"] == LEGACY_SHA256
    assert payload["artifact_sha256"] == CANONICAL_SHA256
    assert payload["imports"] == 0
    assert payload["artifact_size"] == CANONICAL_BYTES
    if CANONICAL_CANDIDATE.is_file():
        digest = hashlib.sha256(CANONICAL_CANDIDATE.read_bytes()).hexdigest()
        assert digest == payload["artifact_sha256"] == CANONICAL_SHA256
    assert _public_sha() == CANONICAL_SHA256


def test_tracked_public_wasm_bytes_are_canonical():
    meta = json.loads(PUBLIC_META.read_text(encoding="utf-8"))
    assert _public_sha() == CANONICAL_SHA256
    assert meta["sha256"] == CANONICAL_SHA256
    assert PUBLIC.stat().st_size == CANONICAL_BYTES
    assert meta["bytes"] == CANONICAL_BYTES
    assert meta["legacy_sha256"] == LEGACY_SHA256
    assert meta["sha256"] != LEGACY_SHA256


def test_copy_wasm_rejects_missing_candidate(tmp_path: Path):
    before = _public_sha()
    before_meta = PUBLIC_META.read_text(encoding="utf-8")
    # Move candidate aside if present.
    backup = None
    if CANONICAL_CANDIDATE.is_file():
        backup = tmp_path / "spe_wasm.wasm.bak"
        shutil.move(str(CANONICAL_CANDIDATE), str(backup))
    try:
        proc = _run_copy()
        assert proc.returncode != 0, proc.stdout + proc.stderr
        assert "missing canonical candidate" in proc.stderr
        assert _public_sha() == before == CANONICAL_SHA256
        assert PUBLIC_META.read_text(encoding="utf-8") == before_meta
    finally:
        if backup is not None:
            backup.replace(CANONICAL_CANDIDATE)


def test_copy_wasm_rejects_wrong_candidate_hash(tmp_path: Path):
    before = _public_sha()
    before_meta = PUBLIC_META.read_text(encoding="utf-8")
    CANONICAL_CANDIDATE.parent.mkdir(parents=True, exist_ok=True)
    original = None
    if CANONICAL_CANDIDATE.is_file():
        original = CANONICAL_CANDIDATE.read_bytes()
    planted = b"\x00asm" + b"\x00" * (CANONICAL_BYTES - 4)
    assert len(planted) == CANONICAL_BYTES
    CANONICAL_CANDIDATE.write_bytes(planted)
    try:
        proc = _run_copy()
        assert proc.returncode != 0, proc.stdout + proc.stderr
        assert "sha256" in proc.stderr and "expected" in proc.stderr
        assert _public_sha() == before == CANONICAL_SHA256
        assert PUBLIC_META.read_text(encoding="utf-8") == before_meta
    finally:
        if original is not None:
            CANONICAL_CANDIDATE.write_bytes(original)
        elif CANONICAL_CANDIDATE.is_file():
            CANONICAL_CANDIDATE.unlink()


def test_copy_wasm_never_reads_arbitrary_target_path():
    text = COPY.read_text(encoding="utf-8")
    assert "target-canonical" in text
    assert "EXPECTED_SHA256" in text
    assert CANONICAL_SHA256 in text
    assert "FORBIDDEN_ARBITRARY_SOURCE" in text
    assert "portable/spe-wasm/target/wasm32-unknown-unknown/release/spe_wasm.wasm" in text
    # Source path for copy must be the canonical path, not the arbitrary one as primary.
    assert 'CANONICAL_SOURCE =\n  "portable/spe-wasm/target-canonical/' in text or (
        'CANONICAL_SOURCE =' in text and "target-canonical" in text
    )


def test_package_build_wires_canonical_before_copy():
    pkg = json.loads((REPO / "apps" / "web" / "package.json").read_text(encoding="utf-8"))
    build = pkg["scripts"]["build"]
    assert "wasm:build-canonical" in build
    assert "copy-wasm" in build
    assert build.index("wasm:build-canonical") < build.index("copy-wasm")
