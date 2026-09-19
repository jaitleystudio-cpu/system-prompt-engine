"""G6-H prestudy custody — no fabricated ratings."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
VERIFY = ROOT / "tools" / "verify_g6h_prestudy.py"
PACK = ROOT / "proofs" / "g6h"


def test_g6h_prestudy_verifier_pass():
    proc = subprocess.run(
        [sys.executable, str(VERIFY)],
        cwd=str(ROOT),
        capture_output=True,
        text=True,
        check=False,
    )
    assert proc.returncode == 0, proc.stdout + proc.stderr
    assert "PRESTUDY_CUSTODY_ONLY" in proc.stdout
    assert "NO_RATINGS_YET" in proc.stdout


def test_g6h_no_fabricated_preferences():
    h = json.loads((PACK / "human_results.json").read_text(encoding="utf-8"))
    assert h["status"] == "NO_RATINGS_YET"
    assert h["do_not_fabricate"] is True
    assert h["SPE_preferred"] is None
    assert h["paired_evaluations"] == 0


def test_g6h_not_adjudicated():
    adj = json.loads((PACK / "threshold_adjudication.json").read_text(encoding="utf-8"))
    assert adj["status"] == "NOT_ADJUDICATED"
    lock = json.loads((PACK / "ratings_lock.json").read_text(encoding="utf-8"))
    assert lock["status"] == "NOT_LOCKED"


def test_g6h_randomization_sealed():
    r = json.loads((PACK / "randomization_custody.json").read_text(encoding="utf-8"))
    assert r["status"] == "SEALED"


def test_g6h_claim_boundary():
    c = json.loads((PACK / "claim_boundary.json").read_text(encoding="utf-8"))
    assert "REAL_USER_PRODUCT_VALUE_VERIFIED_WITHIN_TESTED_SCOPE" in c["not_earned"]
    assert "WORLD_1" in c["not_earned"]
    assert "invent ratings" in " ".join(c["cursor_may_not"])


def test_g6hm1_report_incomplete_not_pass():
    text = (PACK / "G6_H_FINAL_REPORT.md").read_text(encoding="utf-8")
    assert "G6_HUMAN_EVIDENCE_INCOMPLETE" in text
    assert "G6_REAL_USER_VALUE_PASS" not in text.split("FINAL VERDICT")[1].split("##")[0]
