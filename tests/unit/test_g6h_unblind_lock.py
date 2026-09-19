"""G6-H unblind + lock plumbing — synthetic fixtures only; no human ratings."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools"))
import g6h_unblind  # noqa: E402
import g6h_lock_ratings  # noqa: E402

MAP = ROOT / "benchmarks/g6zc/randomization_manifest.json"
PACK = ROOT / "proofs/g6h"


def test_g6h_synthetic_unblind_reverse_map_detected():
    proc = subprocess.run(
        [sys.executable, str(ROOT / "tools/g6h_unblind.py"), "--synthetic"],
        cwd=str(ROOT),
        capture_output=True,
        text=True,
        check=False,
    )
    assert proc.returncode == 0, proc.stderr + proc.stdout
    data = json.loads(proc.stdout)
    assert data["human_evidence"] is False
    assert data["reverse_map_detected"] is True
    assert data["counts"]["SPE"] == data["reversed_counts"]["RAW"]
    assert data["counts"]["RAW"] == data["reversed_counts"]["SPE"]


def test_g6h_unblind_unit_spe_raw_tie():
    mapping = g6h_unblind.load_mapping(MAP)
    tid, entry = next(iter(mapping.items()))
    assert (
        g6h_unblind.unblind_preference(
            task_id=tid,
            blinded_side_preference=entry["spe_side"],
            mapping=mapping,
        )
        == "SPE"
    )
    assert (
        g6h_unblind.unblind_preference(
            task_id=tid,
            blinded_side_preference=entry["raw_side"],
            mapping=mapping,
        )
        == "RAW"
    )
    assert (
        g6h_unblind.unblind_preference(
            task_id=tid,
            blinded_side_preference="TIE",
            mapping=mapping,
        )
        == "TIE"
    )


def test_g6h_reverse_mapping_mutation_inverts_arms():
    mapping = g6h_unblind.load_mapping(MAP)
    ratings = g6h_unblind.make_synthetic_ratings(mapping, n=24)
    a = g6h_unblind.preference_counts(g6h_unblind.unblind_ratings(ratings, mapping))
    b = g6h_unblind.preference_counts(
        g6h_unblind.unblind_ratings(ratings, g6h_unblind.reverse_mapping(mapping))
    )
    assert a["SPE"] == b["RAW"]
    assert a["RAW"] == b["SPE"]
    assert a["TIE"] == b["TIE"]


def test_g6h_refuse_real_unblind_without_allow():
    proc = subprocess.run(
        [
            sys.executable,
            str(ROOT / "tools/g6h_unblind.py"),
            "--ratings",
            str(PACK / "human_results.json"),
        ],
        cwd=str(ROOT),
        capture_output=True,
        text=True,
        check=False,
    )
    assert proc.returncode == 2
    assert "allow-real" in proc.stderr


def test_g6h_lock_refuses_empty_ratings(tmp_path):
    empty = tmp_path / "empty.json"
    empty.write_text(json.dumps({"schema": "g6zc.human_ratings.v1", "ratings": []}))
    proc = subprocess.run(
        [sys.executable, str(ROOT / "tools/g6h_lock_ratings.py"), "--ratings", str(empty)],
        cwd=str(ROOT),
        capture_output=True,
        text=True,
        check=False,
    )
    assert proc.returncode == 1
    assert "NO_RATINGS" in proc.stderr or "empty" in proc.stderr.lower()


def test_g6h_lock_accepts_valid_schema_dry(tmp_path):
    mapping = g6h_unblind.load_mapping(MAP)
    # Build a non-synthetic-looking valid fixture for schema validation only
    tid, entry = next(iter(mapping.items()))
    row = {
        "task_id": tid,
        "blinded_side_preference": "TIE",
        "rubric_scores": {d: 2 for d in g6h_lock_ratings.REQUIRED_DIMS},
        "confidence": "MEDIUM",
        "comment": "",
        "evaluator_id": "E001",
        "timestamp_local": "2026-09-19T00:00:00Z",
    }
    path = tmp_path / "one.json"
    path.write_text(json.dumps({"schema": "g6zc.human_ratings.v1", "ratings": [row]}))
    proc = subprocess.run(
        [
            sys.executable,
            str(ROOT / "tools/g6h_lock_ratings.py"),
            "--ratings",
            str(path),
            "--dry-validate",
        ],
        cwd=str(ROOT),
        capture_output=True,
        text=True,
        check=False,
    )
    assert proc.returncode == 0, proc.stderr + proc.stdout
    assert json.loads(proc.stdout)["validation"] == "PASS"


def test_g6h_prestudy_human_still_no_ratings():
    h = json.loads((PACK / "human_results.json").read_text(encoding="utf-8"))
    assert h["status"] == "NO_RATINGS_YET"
    assert h["do_not_fabricate"] is True
