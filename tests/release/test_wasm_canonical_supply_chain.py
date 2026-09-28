"""Supply-chain checks for the canonical WASM candidate build.

These tests prove the build recipe rejects floating inputs and does not
promote a candidate. They do not claim a broader security property.
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
PUBLIC = REPO / "apps" / "web" / "public" / "spe_wasm.wasm"
MANIFEST = REPO / "proofs" / "wasm_rebaseline_candidate_20260928" / "candidate-manifest.json"
LEGACY_SHA256 = "8d482a17404d873a599b6804181d0637ae20a021ffe912ca19fdf99139c52830"
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
    assert _public_sha() == before == LEGACY_SHA256


def test_wrong_target_rejected():
    before = _public_sha()
    proc = _run_build({"SPE_WASM_TARGET": "wasm32-wasip1"})
    assert proc.returncode == 2, proc.stderr
    assert "wrong target rejected" in proc.stderr
    assert _public_sha() == before == LEGACY_SHA256


def test_public_promotion_target_rejected():
    before = _public_sha()
    planted = REPO / "apps" / "web" / "public" / "not-a-candidate-target"
    proc = _run_build({"SPE_WASM_CANDIDATE_TARGET_DIR": str(planted)})
    assert proc.returncode == 2, proc.stderr
    assert "does not promote" in proc.stderr
    assert not planted.exists()
    assert _public_sha() == before == LEGACY_SHA256
    copy_source = REPO / "portable" / "spe-wasm" / "target"
    proc_copy = _run_build({"SPE_WASM_CANDIDATE_TARGET_DIR": str(copy_source)})
    assert proc_copy.returncode == 2, proc_copy.stderr
    assert "promotion path" in proc_copy.stderr


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
    assert artifact.stat().st_size > 100_000
    assert f"sha256={rebuilt}" in proc.stdout
    assert "imports=0" in proc.stdout
    assert "promoted=no" in proc.stdout
    assert "path_class=external-clean-target" in proc.stdout
    blob = artifact.read_bytes()
    for marker in ABSOLUTE_MARKERS:
        assert marker.encode() not in blob
    assert _public_sha() == before == LEGACY_SHA256


def test_candidate_manifest_matches_artifact_and_hides_absolute_paths():
    assert MANIFEST.is_file(), "candidate manifest must be committed with the recipe"
    payload = json.loads(MANIFEST.read_text(encoding="utf-8"))
    text = MANIFEST.read_text(encoding="utf-8")
    for marker in ("/workspace", "/home/", "/Users/", "/tmp/", ".codex", ".chatgpt-projects"):
        assert marker not in text
    assert payload["build_a_sha256"] == payload["build_b_sha256"] == payload["artifact_sha256"]
    assert payload["legacy_sha256"] == LEGACY_SHA256
    assert payload["imports"] == 0
    assert payload["artifact_size"] > 100_000
    canonical = (
        REPO
        / "portable"
        / "spe-wasm"
        / "target-canonical"
        / "wasm32-unknown-unknown"
        / "release"
        / "spe_wasm.wasm"
    )
    if canonical.is_file():
        digest = hashlib.sha256(canonical.read_bytes()).hexdigest()
        assert digest == payload["artifact_sha256"]
    assert _public_sha() == LEGACY_SHA256


def test_tracked_public_wasm_bytes_remain_legacy():
    meta = json.loads((PUBLIC.parent / "spe_wasm.sha256.json").read_text(encoding="utf-8"))
    assert _public_sha() == LEGACY_SHA256
    assert meta["sha256"] == LEGACY_SHA256
    assert PUBLIC.stat().st_size == 671614
