"""G9-FREEZE / G6-H handoff — freeze integrity + anti-self-mint guards."""

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
VERIFY = ROOT / "tools" / "verify_g9_freeze.py"
MANIFEST = ROOT / "proofs" / "g9_freeze" / "QUALIFICATION_MANIFEST.json"
MANIFEST_SHA = ROOT / "proofs" / "g9_freeze" / "QUALIFICATION_MANIFEST.sha256"
HUMAN = ROOT / "proofs" / "g6zc" / "human_results.json"
INTEGRITY = ROOT / "proofs" / "g9_freeze" / "INTEGRITY.json"


def test_g9_freeze_verifier_pass():
    proc = subprocess.run(
        [sys.executable, str(VERIFY)],
        cwd=str(ROOT),
        capture_output=True,
        text=True,
        check=False,
    )
    assert proc.returncode == 0, proc.stdout + proc.stderr
    assert "G6 human value: PENDING" in proc.stdout
    assert "World #1: NOT_PROVEN" in proc.stdout
    assert "external G6-H" in proc.stdout


def test_g9_freeze_manifest_sha():
    assert (
        hashlib.sha256(MANIFEST.read_bytes()).hexdigest()
        == MANIFEST_SHA.read_text(encoding="utf-8").strip()
    )


def test_g9_freeze_human_results_unfabricated():
    h = json.loads(HUMAN.read_text(encoding="utf-8"))
    assert h["status"] == "NO_RATINGS_YET"
    assert h["do_not_fabricate"] is True
    assert h["paired_evaluations"] == 0
    assert h["SPE_preferred"] is None


def test_g9_freeze_integrity_pending_claims():
    integ = json.loads(INTEGRITY.read_text(encoding="utf-8"))
    assert integ["world_1"] == "NOT_PROVEN"
    assert integ["independently_replicated"] == "NOT_PROVEN"
    assert integ["g6_human_value"] == "PENDING"


def test_g9_freeze_forbidden_shortcuts():
    man = json.loads(MANIFEST.read_text(encoding="utf-8"))
    forbidden = set(man["exact_forbidden_claims"])
    for c in (
        "WORLD_1",
        "G9_PASS_IMPLIES_WORLD_1",
        "1041_TESTS_IMPLIES_WORLD_1",
        "HERMETIC_REPLAY_EQUALS_INDEPENDENT_REPLICATION",
        "FABRICATED_HUMAN_RATINGS",
        "REAL_USER_PRODUCT_VALUE_VERIFIED_WITHIN_TESTED_SCOPE",
    ):
        assert c in forbidden


def test_g9fm1_world_1_still_unqualifiable():
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
                revision="g9-freeze",
            ),
            claim_code="WORLD_1",
            policy_id="default_ring0",
        ),
        [],
    )
    assert q.verdict is QualificationVerdict.UNQUALIFIABLE_UNDER_POLICY


def test_g9fm2_tampered_manifest_sha_fails():
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
    finally:
        MANIFEST_SHA.write_text(original, encoding="utf-8")


def test_g9fm3_g6_artifacts_frozen():
    man = json.loads(MANIFEST.read_text(encoding="utf-8"))
    rubric = ROOT / "benchmarks/g6zc/rubric.json"
    thresh = ROOT / "benchmarks/g6zc/thresholds.json"
    assert (
        hashlib.sha256(rubric.read_bytes()).hexdigest()
        == man["custody"]["g6_rubric_sha256"]
    )
    assert (
        hashlib.sha256(thresh.read_bytes()).hexdigest()
        == man["custody"]["g6_thresholds_sha256"]
    )


def test_g9fm4_stop_flag_set():
    man = json.loads(MANIFEST.read_text(encoding="utf-8"))
    assert man["stop"]["no_more_self_certifying_engineering_missions"] is True
    assert man["stop"]["no_cursor_make_spe_better_until_g6h"] is True
    assert man["g6h_handoff"]["do_not_fabricate_ratings"] is True
