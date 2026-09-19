#!/usr/bin/env python3
"""G6-H coordinator readiness checklist.

Verifies study plumbing is ready for REAL humans.
Does NOT collect ratings. Does NOT invent ratings. Does NOT unblind.
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def run(cmd: list[str]) -> tuple[int, str]:
    proc = subprocess.run(cmd, cwd=str(ROOT), capture_output=True, text=True, check=False)
    return proc.returncode, proc.stdout + proc.stderr


def main() -> int:
    print("SPE Ω v2.4.1 — G6-H COORDINATOR READINESS")
    print("Cursor/self-certification STOP — humans required next")
    print()
    fails: list[str] = []

    checks = [
        ("freeze", [sys.executable, "tools/verify_g9_freeze.py"]),
        ("prestudy", [sys.executable, "tools/verify_g6h_prestudy.py"]),
        ("synthetic_unblind_control", [sys.executable, "tools/g6h_unblind.py", "--synthetic"]),
    ]
    for name, cmd in checks:
        code, out = run(cmd)
        ok = code == 0
        if name == "synthetic_unblind_control" and ok:
            data = json.loads(out)
            ok = data.get("reverse_map_detected") is True and data.get("human_evidence") is False
        print(f"  {'PASS' if ok else 'FAIL'}  {name}")
        if not ok:
            fails.append(name)

    human = json.loads((ROOT / "proofs/g6h/human_results.json").read_text(encoding="utf-8"))
    no_ratings = human.get("status") == "NO_RATINGS_YET" and human.get("do_not_fabricate") is True
    print(f"  {'PASS' if no_ratings else 'FAIL'}  human_results NO_RATINGS_YET / do_not_fabricate")
    if not no_ratings:
        fails.append("human_results")

    ui = ROOT / "evaluations/g6zc/blind_evaluator.html"
    pairs = ROOT / "evaluations/g6zc/blind_pairs.json"
    print(f"  {'PASS' if ui.is_file() else 'FAIL'}  blind_evaluator.html present")
    print(f"  {'PASS' if pairs.is_file() else 'FAIL'}  blind_pairs.json present")
    if not ui.is_file():
        fails.append("ui")
    if not pairs.is_file():
        fails.append("pairs")

    print()
    if fails:
        print("READINESS: FAIL")
        for f in fails:
            print(f"  - {f}")
        return 1

    print("READINESS: PASS — plumbing ready")
    print()
    print("COORDINATOR NEXT (humans, not Cursor):")
    print("  0. See proofs/g6h/HOW_TO_OPEN_EVALUATOR.md")
    print("  1. python -m http.server 8765 --bind 127.0.0.1")
    print("  2. Open http://127.0.0.1:8765/evaluations/g6zc/blind_evaluator.html")
    print("  3. Load evaluations/g6zc/blind_pairs.json in the UI")
    print("  4. Recruit real evaluators (pseudonymous E00x)")
    print("  5. Collect blinded ratings only (task + LEFT/RIGHT + rubric)")
    print("  6. Do NOT open randomization_manifest.json while rating")
    print("  7. Preserve skips/invalids separately (skip ≠ tie)")
    print("  8. python tools/g6h_lock_ratings.py --ratings EXPORT.json \\")
    print("       [--skipped skips.json] [--invalid invalids.json] --expected 120")
    print("  9. ONLY AFTER LOCK:")
    print("       python tools/g6h_unblind.py --ratings proofs/g6h/human_results_locked_bytes.json \\")
    print("         --allow-real --json-out proofs/g6h/unblinded_results.json")
    print(" 10. Adjudicate frozen thresholds → PASS/FAIL/INCOMPLETE/INVALID")
    print(" 11. STOP — do not modify SPE")
    print()
    print("NO public website URL — local serve only.")
    print("FORBIDDEN:")
    print("  synthetic → human_evidence")
    print("  automated scores → human votes")
    print("  unblind before lock")
    print("  open randomization map during rating")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
