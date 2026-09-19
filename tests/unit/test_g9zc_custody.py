"""G9-ZC release-custody verifier tests + mutations."""

from __future__ import annotations

import hashlib
import json
import subprocess
import sys
from pathlib import Path

import pytest

from spe_runtime.qualification import (
    ClaimCandidate,
    ClaimScope,
    ClaimStage,
    QualificationVerdict,
    qualify_claim,
)

ROOT = Path(__file__).resolve().parents[2]
VERIFY = ROOT / "tools" / "verify_g9_checkpoint.py"
MANIFEST = ROOT / "proofs" / "g9zc" / "QUALIFICATION_MANIFEST.json"
MANIFEST_SHA = ROOT / "proofs" / "g9zc" / "QUALIFICATION_MANIFEST.sha256"
INTEGRITY = ROOT / "proofs" / "g9zc" / "INTEGRITY.json"


def test_g9_verifier_exit_zero():
    proc = subprocess.run(
        [sys.executable, str(VERIFY)],
        cwd=str(ROOT),
        capture_output=True,
        text=True,
        check=False,
    )
    assert proc.returncode == 0, proc.stdout + proc.stderr
    assert "World #1: NOT_PROVEN" in proc.stdout
    assert "VERDICT: PASS" in proc.stdout


def test_g9_manifest_sha_matches():
    got = hashlib.sha256(MANIFEST.read_bytes()).hexdigest()
    assert got == MANIFEST_SHA.read_text(encoding="utf-8").strip()


def test_g9_integrity_declares_world_1_not_proven():
    integ = json.loads(INTEGRITY.read_text(encoding="utf-8"))
    assert integ["world_1"] == "NOT_PROVEN"


def test_g9_forbidden_claims_listed():
    man = json.loads(MANIFEST.read_text(encoding="utf-8"))
    forbidden = set(man["exact_forbidden_claims"])
    for c in ("WORLD_1", "INDEPENDENTLY_REPLICATED", "PRODUCTION_READY"):
        assert c in forbidden


def test_g9m1_world_1_still_unqualifiable():
    q = qualify_claim(
        ClaimCandidate(
            claim_key="WORLD_1",
            subject_id="spe",
            requested_stage=ClaimStage.INDEPENDENTLY_REPLICATED,
            scope=ClaimScope(
                component="world",
                platform="python",
                runtime="cpython",
                environment="local",
                revision="g9zc",
            ),
            claim_code="WORLD_1",
            policy_id="default_ring0",
        ),
        [],
    )
    assert q.verdict is QualificationVerdict.UNQUALIFIABLE_UNDER_POLICY


def test_g9m2_tampered_manifest_fails_verifier(tmp_path, monkeypatch):
    # Copy pack, tamper a tracked evidence hash entry by rewriting local copy
    # Verifier reads from repo paths — instead assert hash check logic via subprocess
    # after temporarily breaking MANIFEST_SHA file content expectation.
    original = MANIFEST_SHA.read_text(encoding="utf-8")
    try:
        MANIFEST_SHA.write_text("0" * 64 + "\n", encoding="utf-8")
        proc = subprocess.run(
            [sys.executable, str(VERIFY)],
            cwd=str(ROOT),
            capture_output=True,
            text=True,
            check=False,
        )
        assert proc.returncode == 1
        assert "FAIL" in proc.stdout or "FAIL" in proc.stderr
    finally:
        MANIFEST_SHA.write_text(original, encoding="utf-8")


def test_g9m3_no_omega_path():
    assert not (ROOT / "spe_runtime" / "omega").exists()


def test_g9m4_verifier_no_network_imports():
    src = VERIFY.read_text(encoding="utf-8")
    assert "urlopen" not in src
    assert "requests" not in src
    assert "openai" not in src.lower()
