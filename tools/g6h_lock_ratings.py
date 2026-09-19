"""G6-H ratings lock helper.

Validates exported evaluator JSON schema, writes ratings_lock.json,
and refuses empty / synthetic / premature locks.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
PACK = ROOT / "proofs/g6h"
REQUIRED_DIMS = [
    "V1_intent_fidelity",
    "V2_constraint_coverage",
    "V3_missing_requirement_handling",
    "V4_conflict_handling",
    "V5_executability",
    "V6_output_clarity",
    "V7_verification_testability",
    "V8_portability",
    "V9_unnecessary_complexity",
    "V10_overall_usefulness",
]
VALID_PREF = {"LEFT", "RIGHT", "TIE"}
VALID_CONF = {"LOW", "MEDIUM", "HIGH"}


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def validate_rating(r: dict[str, Any], *, idx: int) -> list[str]:
    errs: list[str] = []
    if not r.get("task_id"):
        errs.append(f"[{idx}] missing task_id")
    pref = r.get("blinded_side_preference")
    if pref not in VALID_PREF:
        errs.append(f"[{idx}] preference must be LEFT/RIGHT/TIE got {pref!r}")
    conf = r.get("confidence")
    if conf not in VALID_CONF:
        errs.append(f"[{idx}] confidence must be LOW/MEDIUM/HIGH got {conf!r}")
    if r.get("synthetic"):
        errs.append(f"[{idx}] synthetic flag forbidden in real lock")
    scores = r.get("rubric_scores") or {}
    for d in REQUIRED_DIMS:
        if d not in scores:
            errs.append(f"[{idx}] missing rubric dim {d}")
        else:
            try:
                v = int(scores[d])
            except (TypeError, ValueError):
                errs.append(f"[{idx}] {d} not int")
                continue
            if v < 0 or v > 4:
                errs.append(f"[{idx}] {d} out of 0–4 range: {v}")
    eid = (r.get("evaluator_id") or "").strip()
    if not eid or eid == "anonymous":
        errs.append(f"[{idx}] evaluator_id required (pseudonymous E00x)")
    return errs


def validate_payload(payload: dict[str, Any]) -> list[str]:
    errs: list[str] = []
    if payload.get("do_not_fabricate") is False:
        errs.append("do_not_fabricate must not be false")
    ratings = payload.get("ratings")
    if not isinstance(ratings, list):
        return ["ratings must be a list"]
    if not ratings:
        return ["NO_RATINGS_YET — refusing empty lock (NO_RATINGS ≠ ZERO)"]
    seen: set[tuple[str, str]] = set()
    for i, r in enumerate(ratings):
        errs.extend(validate_rating(r, idx=i))
        key = (str(r.get("evaluator_id")), str(r.get("task_id")))
        if key in seen:
            errs.append(f"duplicate evaluator_id+task_id {key}")
        seen.add(key)
    return errs


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--ratings", type=Path, required=True, help="Exported ratings JSON from UI")
    p.add_argument("--expected", type=int, default=None, help="Optional expected valid count")
    p.add_argument(
        "--out-dir",
        type=Path,
        default=PACK,
        help="Write human_results + ratings_lock here",
    )
    p.add_argument(
        "--dry-validate",
        action="store_true",
        help="Validate only; do not write lock files",
    )
    args = p.parse_args(argv)

    if not args.ratings.is_file():
        sys.stderr.write(f"missing ratings file: {args.ratings}\n")
        return 2

    raw = args.ratings.read_bytes()
    payload = json.loads(raw.decode("utf-8"))
    errs = validate_payload(payload)
    if errs:
        sys.stderr.write("VALIDATION_FAIL\n")
        for e in errs:
            sys.stderr.write(f"  - {e}\n")
        return 1

    ratings = payload["ratings"]
    evaluators = sorted({r["evaluator_id"] for r in ratings})
    lock = {
        "status": "LOCKED",
        "locked_at_utc": datetime.now(timezone.utc).isoformat(),
        "source_path": str(args.ratings),
        "human_results_sha256": hashlib.sha256(raw).hexdigest(),
        "byte_size": len(raw),
        "total_valid": len(ratings),
        "total_expected": args.expected,
        "skipped": 0,
        "invalid": 0,
        "evaluator_count": len(evaluators),
        "evaluators": evaluators,
        "schema": payload.get("schema", "g6zc.human_ratings.v1"),
        "do_not_fabricate": True,
        "note": "Lock precedes unblinding. Do not modify ratings after this digest.",
    }
    if args.expected is not None and len(ratings) < args.expected:
        lock["status"] = "LOCKED_INCOMPLETE"
        lock["warning"] = "valid < expected — adjudication may be G6_HUMAN_EVIDENCE_INCOMPLETE"

    report = {"validation": "PASS", "lock": lock}
    text = json.dumps(report, indent=2) + "\n"
    sys.stdout.write(text)

    if args.dry_validate:
        return 0

    out = args.out_dir
    out.mkdir(parents=True, exist_ok=True)
    human = {
        "status": "RATINGS_LOCKED",
        "do_not_fabricate": True,
        "schema": payload.get("schema", "g6zc.human_ratings.v1"),
        "evaluators": len(evaluators),
        "paired_evaluations": len(ratings),
        "SPE_preferred": None,
        "RAW_preferred": None,
        "ties": None,
        "note": "Blinded only — run tools/g6h_unblind.py --allow-real after lock",
        "ratings": ratings,
        "source_sha256": lock["human_results_sha256"],
    }
    (out / "human_results.json").write_text(json.dumps(human, indent=2) + "\n", encoding="utf-8")
    (out / "ratings_lock.json").write_text(json.dumps(lock, indent=2) + "\n", encoding="utf-8")
    # copy immutable bytes
    (out / "human_results_locked_bytes.json").write_bytes(raw)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
