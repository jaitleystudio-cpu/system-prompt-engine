#!/usr/bin/env python3
"""Verify G6-H PRESTUDY custody only.

Confirms freeze PASS record, prestudy hashes, and NO_RATINGS_YET.
Does NOT invent ratings or adjudicate product value.
"""

from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PACK = ROOT / "proofs/g6h"
PRESTUDY = PACK / "prestudy_manifest.json"
HUMAN_G6 = ROOT / "proofs/g6zc/human_results.json"
HUMAN_G6H = PACK / "human_results.json"
FREEZE_TOOL = ROOT / "tools/verify_g9_freeze.py"


class Failures(list):
    def check(self, cond: bool, msg: str) -> None:
        if not cond:
            self.append(msg)

    def ok(self, msg: str) -> None:
        print(f"  PASS  {msg}")


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> int:
    fails = Failures()
    print("SPE Ω v2.4.1 — G6-H PRESTUDY custody verifier")
    print("mode: prestudy_only (no rating invention / no adjudication)")
    print()

    for p in (
        PRESTUDY,
        PACK / "COORDINATOR_HANDOFF.md",
        PACK / "threshold_custody.json",
        PACK / "rubric_custody.json",
        PACK / "randomization_custody.json",
        PACK / "freeze_verifier_result.txt",
        HUMAN_G6,
        HUMAN_G6H,
        FREEZE_TOOL,
    ):
        fails.check(p.is_file(), f"missing {p.relative_to(ROOT)}")
    if fails:
        for f in fails:
            print(f"  FAIL  {f}")
        return 1
    fails.ok("prestudy pack present")

    # Live freeze must still PASS
    import subprocess

    proc = subprocess.run(
        [sys.executable, str(FREEZE_TOOL)],
        cwd=str(ROOT),
        capture_output=True,
        text=True,
        check=False,
    )
    fails.check(proc.returncode == 0, "live verify_g9_freeze.py failed")
    if proc.returncode == 0:
        fails.ok("live verify_g9_freeze.py PASS")

    pre = json.loads(PRESTUDY.read_text(encoding="utf-8"))
    fails.check(pre.get("do_not_fabricate") is True, "do_not_fabricate")
    fails.check(pre.get("ratings_status") == "NO_RATINGS_YET", "ratings_status")
    fails.check(pre.get("phase") == "PRESTUDY_CUSTODY_ONLY", "phase")
    fails.check(pre.get("freeze_verifier", {}).get("exit_code") == 0, "recorded freeze exit")

    for item in pre.get("inputs", []):
        path = ROOT / item["path"]
        fails.check(path.is_file(), f"missing input {item['path']}")
        if path.is_file():
            got = sha256_file(path)
            fails.check(got == item["sha256"], f"hash drift {item['path']}")
    fails.ok(f"prestudy input hashes ({len(pre.get('inputs', []))})")

    for hp in (HUMAN_G6, HUMAN_G6H):
        h = json.loads(hp.read_text(encoding="utf-8"))
        fails.check(h.get("status") == "NO_RATINGS_YET", f"{hp.name} status")
        fails.check(h.get("do_not_fabricate") is True, f"{hp.name} do_not_fabricate")
        fails.check(h.get("paired_evaluations", 0) == 0, f"{hp.name} paired_evaluations")
        fails.check(h.get("SPE_preferred") is None, f"{hp.name} SPE_preferred must be null")
    fails.ok("human_results unfabricated")

    lock = json.loads((PACK / "ratings_lock.json").read_text(encoding="utf-8"))
    fails.check(lock.get("status") == "NOT_LOCKED", "ratings must not be locked prestudy")
    adj = json.loads((PACK / "threshold_adjudication.json").read_text(encoding="utf-8"))
    fails.check(adj.get("status") == "NOT_ADJUDICATED", "must not adjudicate prestudy")
    fails.ok("no premature lock/adjudication")

    # sealed randomization note
    rand = json.loads((PACK / "randomization_custody.json").read_text(encoding="utf-8"))
    fails.check(rand.get("status") == "SEALED", "randomization not sealed")
    fails.ok("randomization sealed")

    if fails:
        print()
        print("VERDICT: FAIL")
        for f in fails:
            print(f"  FAIL  {f}")
        return 1

    print()
    print("VERDICT: PASS")
    print("phase: PRESTUDY_CUSTODY_ONLY")
    print("G6: HUMAN_VALUE_EVIDENCE_PENDING")
    print("ratings: NO_RATINGS_YET")
    print("next: external blinded humans")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
