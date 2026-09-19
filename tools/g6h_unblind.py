"""G6-H mechanical unblinding — A/B (LEFT/RIGHT) → SPE/RAW/TIE.

Does NOT invent ratings. Does NOT adjudicate frozen thresholds.
Requires either --synthetic fixtures or a locked real ratings file.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_MAP = ROOT / "benchmarks/g6zc/randomization_manifest.json"


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load_mapping(path: Path) -> dict[str, dict[str, str]]:
    data = json.loads(path.read_text(encoding="utf-8"))
    mapping = data.get("mapping", data)
    if not isinstance(mapping, dict):
        raise ValueError("randomization manifest must contain mapping object")
    return mapping


def unblind_preference(
    *,
    task_id: str,
    blinded_side_preference: str,
    mapping: dict[str, dict[str, str]],
) -> str:
    """Map LEFT/RIGHT/TIE → SPE/RAW/TIE using frozen side assignment."""
    pref = (blinded_side_preference or "").strip().upper()
    if pref == "TIE":
        return "TIE"
    if pref not in {"LEFT", "RIGHT"}:
        raise ValueError(f"{task_id}: invalid preference {blinded_side_preference!r}")
    entry = mapping.get(task_id)
    if not entry:
        raise KeyError(f"{task_id}: missing from randomization map")
    spe_side = str(entry["spe_side"]).upper()
    raw_side = str(entry["raw_side"]).upper()
    if {spe_side, raw_side} != {"LEFT", "RIGHT"}:
        raise ValueError(f"{task_id}: spe_side/raw_side must be LEFT/RIGHT pair")
    if spe_side == raw_side:
        raise ValueError(f"{task_id}: spe_side and raw_side collide")
    if pref == spe_side:
        return "SPE"
    if pref == raw_side:
        return "RAW"
    raise RuntimeError(f"{task_id}: unreachable preference mapping")


def reverse_mapping(mapping: dict[str, dict[str, str]]) -> dict[str, dict[str, str]]:
    """Mutation control: swap SPE/RAW sides — must invert unblinded arms."""
    out: dict[str, dict[str, str]] = {}
    for tid, entry in mapping.items():
        out[tid] = {
            **entry,
            "spe_side": entry["raw_side"],
            "raw_side": entry["spe_side"],
        }
    return out


def unblind_ratings(
    ratings: list[dict[str, Any]],
    mapping: dict[str, dict[str, str]],
) -> list[dict[str, Any]]:
    out = []
    for r in ratings:
        tid = r["task_id"]
        arm = unblind_preference(
            task_id=tid,
            blinded_side_preference=r["blinded_side_preference"],
            mapping=mapping,
        )
        row = dict(r)
        row["unblinded_preference"] = arm
        row["spe_side"] = mapping[tid]["spe_side"]
        row["raw_side"] = mapping[tid]["raw_side"]
        out.append(row)
    return out


def preference_counts(unblinded: list[dict[str, Any]]) -> dict[str, int]:
    counts = {"SPE": 0, "RAW": 0, "TIE": 0}
    for r in unblinded:
        arm = r["unblinded_preference"]
        if arm not in counts:
            raise ValueError(f"bad arm {arm}")
        counts[arm] += 1
    return counts


def make_synthetic_ratings(mapping: dict[str, dict[str, str]], n: int = 12) -> list[dict[str, Any]]:
    """Synthetic fixtures with known arms — NOT human evidence.

    Pattern is asymmetric (more SPE than RAW) so reverse-map control cannot
    pass by coincidence when SPE==RAW counts.
    """
    items = []
    # 0,1 → SPE; 2 → RAW; 3 → TIE  => for n=12: SPE=6 RAW=3 TIE=3
    for i, (tid, entry) in enumerate(list(mapping.items())[:n]):
        mode = i % 4
        if mode in (0, 1):
            pref = entry["spe_side"]
        elif mode == 2:
            pref = entry["raw_side"]
        else:
            pref = "TIE"
        items.append(
            {
                "task_id": tid,
                "blinded_side_preference": pref,
                "rubric_scores": {"V1_intent_fidelity": 3},
                "confidence": "HIGH",
                "comment": "SYNTHETIC_FIXTURE_NOT_HUMAN",
                "evaluator_id": "SYNTH-E000",
                "timestamp_local": "1970-01-01T00:00:00Z",
                "synthetic": True,
            }
        )
    return items


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--mapping", type=Path, default=DEFAULT_MAP)
    p.add_argument("--ratings", type=Path, default=None, help="Locked human ratings JSON")
    p.add_argument(
        "--synthetic",
        action="store_true",
        help="Run synthetic fixture unblind + reverse-map control (NOT human evidence)",
    )
    p.add_argument("--json-out", type=Path, default=None)
    p.add_argument(
        "--allow-real",
        action="store_true",
        help="Required to unblind a real ratings file (after ratings_lock)",
    )
    args = p.parse_args(argv)

    mapping = load_mapping(args.mapping)
    map_sha = sha256_file(args.mapping)

    if args.synthetic:
        ratings = make_synthetic_ratings(mapping)
        unblinded = unblind_ratings(ratings, mapping)
        counts = preference_counts(unblinded)
        rev = unblind_ratings(ratings, reverse_mapping(mapping))
        rev_counts = preference_counts(rev)
        # reverse map must swap SPE/RAW (ties unchanged)
        ok_reverse = (
            counts["SPE"] == rev_counts["RAW"]
            and counts["RAW"] == rev_counts["SPE"]
            and counts["TIE"] == rev_counts["TIE"]
            and counts["SPE"] != counts["RAW"]  # asymmetry required for strong control
        )
        report = {
            "mode": "SYNTHETIC_FIXTURE_ONLY",
            "human_evidence": False,
            "mapping_sha256": map_sha,
            "n": len(unblinded),
            "counts": counts,
            "reversed_counts": rev_counts,
            "reverse_map_detected": ok_reverse,
            "note": "Synthetic plumbing test — does NOT mint G6 human value",
        }
        if not ok_reverse:
            report["error"] = "reverse mapping control FAILED"
            text = json.dumps(report, indent=2) + "\n"
            sys.stdout.write(text)
            return 1
        text = json.dumps(report, indent=2) + "\n"
        if args.json_out:
            args.json_out.parent.mkdir(parents=True, exist_ok=True)
            args.json_out.write_text(text, encoding="utf-8")
        sys.stdout.write(text)
        return 0

    if not args.ratings:
        sys.stderr.write("Provide --ratings PATH or --synthetic\n")
        return 2
    if not args.allow_real:
        sys.stderr.write(
            "Refusing real unblind without --allow-real "
            "(complete ratings_lock first; do not unblind mid-study)\n"
        )
        return 2

    payload = json.loads(args.ratings.read_text(encoding="utf-8"))
    if payload.get("synthetic") or payload.get("mode") == "SYNTHETIC_FIXTURE_ONLY":
        sys.stderr.write("Refusing: ratings file marked synthetic\n")
        return 2
    ratings = payload.get("ratings")
    if not isinstance(ratings, list) or not ratings:
        sys.stderr.write("Refusing: empty ratings — NO_RATINGS ≠ study complete\n")
        return 2
    if any(r.get("synthetic") for r in ratings):
        sys.stderr.write("Refusing: synthetic rows mixed into real ratings\n")
        return 2

    unblinded = unblind_ratings(ratings, mapping)
    counts = preference_counts(unblinded)
    report = {
        "mode": "REAL_UNBLIND",
        "human_evidence": True,
        "mapping_sha256": map_sha,
        "ratings_sha256": sha256_file(args.ratings),
        "n": len(unblinded),
        "counts": counts,
        "rows": unblinded,
    }
    text = json.dumps(report, indent=2) + "\n"
    if args.json_out:
        args.json_out.parent.mkdir(parents=True, exist_ok=True)
        args.json_out.write_text(text, encoding="utf-8")
    sys.stdout.write(text)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
