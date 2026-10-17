#!/usr/bin/env python3
"""Independent context/protocol benchmark harness (Task 9).

Namespace: evaluations/context_protocol_v1/
Does not reuse or mutate frozen G6-H evidence.

--fixture-only: deterministic offline dry run. No network, no provider calls.
Human ratings remain NO_RATINGS_YET and are never auto-filled.
Load-reduction claims are forbidden until measured.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any

REPO = Path(__file__).resolve().parents[1]
EVAL_DIR = REPO / "evaluations" / "context_protocol_v1"
TASKS_PATH = EVAL_DIR / "tasks.jsonl"
ARMS_PATH = EVAL_DIR / "arms.json"

HUMAN_RATING_SENTINEL = "NO_RATINGS_YET"
REQUIRED_STRESS_CLASSES = frozenset(
    {
        "trivial",
        "ambiguous",
        "contradictory",
        "multilingual",
        "typo/noisy",
        "missing-context",
        "overconstrained",
        "high-stakes informational",
        "multi-domain",
        "adversarial",
        "long input",
        "media-assisted",
        "URL-assisted",
    }
)
REQUIRED_ARMS = frozenset(
    {
        "RAW",
        "SPE_BASE",
        "SPE_GROUNDING_ONLY",
        "SPE_PROTOCOL_ONLY",
        "SPE_FULL",
    }
)
REQUIRED_RECORD_FIELDS = (
    "task_id",
    "arm_id",
    "task_success",
    "constraint_fidelity",
    "grounding",
    "completeness",
    "unsupported_claim_count",
    "token_count",
    "latency_ms",
    "tool_calls",
    "adapter_id",
    "human_ratings",
)
ROUTING_SLOTS = (
    "base_model_tokens",
    "total_tokens",
    "tool_calls",
    "latency_ms",
    "correctness",
    "unsupported_claims",
)

# Ablation match helpers for research-like stage keys/titles.
_CONTRADICTION_MARKERS = ("contradict",)
_VERIFICATION_MARKERS = ("verif", "independent_check", "replication")
_HYPOTHESIS_MARKERS = ("hypothes",)


def _die(msg: str, code: int = 1) -> None:
    print(f"ERROR: {msg}", file=sys.stderr)
    raise SystemExit(code)


def _load_jsonl(path: Path) -> list[dict[str, Any]]:
    if not path.is_file():
        _die(f"missing tasks file: {path}")
    rows: list[dict[str, Any]] = []
    for line_no, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        line = line.strip()
        if not line:
            continue
        try:
            obj = json.loads(line)
        except json.JSONDecodeError as exc:
            _die(f"{path}:{line_no}: invalid JSON: {exc}")
        if not isinstance(obj, dict):
            _die(f"{path}:{line_no}: expected object")
        rows.append(obj)
    return rows


def _load_arms(path: Path) -> dict[str, Any]:
    if not path.is_file():
        _die(f"missing arms file: {path}")
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        _die("arms.json must be an object")
    return payload


def _assert_no_network_flag() -> None:
    if os.environ.get("SPE_BENCHMARK_ALLOW_NETWORK", "0") not in ("0", "", "false", "False"):
        # Fixture-only ignores allow-network; still refuse accidental live mode here.
        pass
    # Harden: strip common proxy hints for this process when fixture-only.
    for key in ("HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "http_proxy", "https_proxy"):
        os.environ.pop(key, None)


def validate_fixtures(tasks: list[dict[str, Any]], arms_payload: dict[str, Any]) -> list[str]:
    """Return human-readable validation notes; raise SystemExit on hard failure."""
    notes: list[str] = []
    arms = arms_payload.get("arms")
    if not isinstance(arms, list) or not arms:
        _die("arms.json: 'arms' must be a non-empty list")
    arm_ids = {str(a.get("id")) for a in arms}
    missing_arms = REQUIRED_ARMS - arm_ids
    if missing_arms:
        _die(f"missing required arms: {sorted(missing_arms)}")
    notes.append(f"arms_ok:{len(arm_ids)}")

    ablation = arms_payload.get("ablation_matrix")
    if not isinstance(ablation, list) or not ablation:
        _die("arms.json: 'ablation_matrix' must be a non-empty list")
    ablation_ids = {str(a.get("id")) for a in ablation}
    for required in ("full", "compact", "no_contradiction", "no_verification", "no_hypothesis"):
        if required not in ablation_ids:
            _die(f"ablation_matrix missing {required!r}")
    notes.append(f"ablation_ok:{len(ablation_ids)}")

    if not tasks:
        _die("tasks.jsonl is empty")
    seen_stress = {str(t.get("stress_class", "")) for t in tasks}
    missing_stress = REQUIRED_STRESS_CLASSES - seen_stress
    if missing_stress:
        _die(f"missing stress classes: {sorted(missing_stress)}")
    notes.append(f"stress_classes_ok:{len(REQUIRED_STRESS_CLASSES)}")

    routing_count = 0
    for task in tasks:
        tid = task.get("task_id")
        if not tid:
            _die("task missing task_id")
        ratings = task.get("human_ratings", HUMAN_RATING_SENTINEL)
        if ratings != HUMAN_RATING_SENTINEL:
            _die(
                f"task {tid}: human_ratings must be {HUMAN_RATING_SENTINEL!r}, "
                f"got {ratings!r}"
            )
        if task.get("measures_routing_efficiency"):
            routing_count += 1
            slots = set(task.get("routing_measurement_slots") or [])
            missing = set(ROUTING_SLOTS) - slots
            if missing:
                _die(f"task {tid}: missing routing slots {sorted(missing)}")
    if routing_count < 1:
        _die("at least one measures_routing_efficiency task required")
    notes.append(f"routing_tasks:{routing_count}")
    notes.append(f"tasks:{len(tasks)}")
    return notes


def _arm_by_id(arms_payload: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {str(a["id"]): a for a in arms_payload["arms"]}


def _node_matches_markers(node: Any, markers: tuple[str, ...]) -> bool:
    blob = " ".join(
        [
            str(getattr(node, "merge_key", "") or ""),
            str(getattr(node, "node_id", "") or ""),
            str(getattr(node, "title", "") or ""),
            str(getattr(node, "stage", "") or ""),
        ]
    ).lower()
    return any(m in blob for m in markers)


def apply_ablation(
    domain_id: str,
    ablation: dict[str, Any],
) -> dict[str, Any]:
    """Apply one ablation config against the local protocol registry (offline)."""
    from spe_runtime.protocols.models import ProtocolDepth
    from spe_runtime.protocols.registry import load_protocol

    compact = bool(ablation.get("compact"))
    depth = ProtocolDepth.STANDARD if compact else ProtocolDepth.CRITICAL
    max_depth = ablation.get("compact_max_depth")
    if compact and max_depth:
        depth = ProtocolDepth(str(max_depth))

    try:
        graph = load_protocol(domain_id, depth)
    except KeyError:
        return {
            "ablation_id": ablation["id"],
            "domain_id": domain_id,
            "status": "DOMAIN_NOT_IN_REGISTRY",
            "node_count_before": 0,
            "node_count_after": 0,
            "removed_node_ids": [],
        }

    before = list(graph.nodes)
    mode = str(ablation.get("mode") or "full")
    prefixes = tuple(ablation.get("remove_merge_key_prefixes") or ())
    title_subs = tuple(ablation.get("remove_title_substrings") or ())

    removed: list[str] = []
    kept = []
    for node in before:
        drop = False
        if mode == "remove_stages":
            mk = str(node.merge_key or "")
            title = str(node.title or "")
            if any(mk.startswith(p) or p in mk for p in prefixes if p):
                drop = True
            if any(s.lower() in title.lower() for s in title_subs if s):
                drop = True
            # Marker fallbacks for the three named ablations.
            aid = str(ablation.get("id"))
            if aid == "no_contradiction" and _node_matches_markers(node, _CONTRADICTION_MARKERS):
                drop = True
            if aid == "no_verification" and _node_matches_markers(node, _VERIFICATION_MARKERS):
                drop = True
            if aid == "no_hypothesis" and _node_matches_markers(node, _HYPOTHESIS_MARKERS):
                drop = True
        if drop:
            removed.append(node.node_id)
        else:
            kept.append(node)

    return {
        "ablation_id": ablation["id"],
        "domain_id": domain_id,
        "status": "OK",
        "protocol_id": graph.protocol_id,
        "depth": depth.value,
        "node_count_before": len(before),
        "node_count_after": len(kept),
        "removed_node_ids": sorted(removed),
    }


def build_ablation_report(arms_payload: dict[str, Any]) -> list[dict[str, Any]]:
    report: list[dict[str, Any]] = []
    for ablation in arms_payload["ablation_matrix"]:
        categories = ablation.get("relevant_categories") or ["research"]
        for domain_id in categories:
            report.append(apply_ablation(str(domain_id), ablation))
    # Stable order for determinism.
    report.sort(key=lambda r: (r["ablation_id"], r["domain_id"]))
    return report


def _unmeasured_record(
    task: dict[str, Any],
    arm: dict[str, Any],
) -> dict[str, Any]:
    """Per-task machine-readable record with unmeasured slots (fixture-only)."""
    record: dict[str, Any] = {
        "task_id": task["task_id"],
        "arm_id": arm["id"],
        "adapter_id": arm.get("adapter_id"),
        "stress_class": task.get("stress_class"),
        "domain_tags": list(task.get("domain_tags") or []),
        # Outcome slots — unmeasured in fixture-only (null), never fabricated.
        "task_success": None,
        "constraint_fidelity": None,
        "grounding": None,
        "completeness": None,
        "unsupported_claim_count": None,
        "token_count": None,
        "latency_ms": None,
        "tool_calls": None,
        "human_ratings": HUMAN_RATING_SENTINEL,
        "measurement_status": "UNMEASURED_FIXTURE_ONLY",
        "load_reduction_claimed": False,
    }
    if task.get("measures_routing_efficiency"):
        record["routing_efficiency"] = {
            slot: None for slot in ROUTING_SLOTS
        }
        record["routing_efficiency"]["note"] = (
            "Slots reserved; do not claim load reduction until measured."
        )
        record["capability_scenario"] = task.get("capability_scenario")
    return record


def run_fixture_only(*, fmt: str) -> int:
    _assert_no_network_flag()
    tasks = _load_jsonl(TASKS_PATH)
    arms_payload = _load_arms(ARMS_PATH)
    notes = validate_fixtures(tasks, arms_payload)
    arm_map = _arm_by_id(arms_payload)

    # Deterministic iteration order.
    tasks_sorted = sorted(tasks, key=lambda t: str(t["task_id"]))
    arm_ids_sorted = sorted(REQUIRED_ARMS)

    records: list[dict[str, Any]] = []
    for task in tasks_sorted:
        for arm_id in arm_ids_sorted:
            records.append(_unmeasured_record(task, arm_map[arm_id]))

    ablation_report = build_ablation_report(arms_payload)

    payload = {
        "mode": "fixture-only",
        "schema_version": "context_protocol_benchmark_result.v1",
        "eval_dir": str(EVAL_DIR.relative_to(REPO)),
        "g6h_untouched": True,
        "network_used": False,
        "provider_calls": 0,
        "validation_notes": notes,
        "arm_ids": arm_ids_sorted,
        "task_count": len(tasks_sorted),
        "record_count": len(records),
        "ablation_report": ablation_report,
        "routing_efficiency_policy": arms_payload.get("routing_efficiency_policy"),
        "human_ratings_default": HUMAN_RATING_SENTINEL,
        "records": records,
    }

    # Integrity: every record has required fields + sentinel ratings.
    for rec in records:
        for field in REQUIRED_RECORD_FIELDS:
            if field not in rec:
                _die(f"internal: record missing {field}")
        if rec["human_ratings"] != HUMAN_RATING_SENTINEL:
            _die("internal: human_ratings must not be auto-filled")

    if fmt == "json":
        # sort_keys for byte-stable stdout across runs.
        sys.stdout.write(json.dumps(payload, sort_keys=True, ensure_ascii=False))
        sys.stdout.write("\n")
    else:
        # Stable text summary (also used for determinism check).
        lines = [
            "context_protocol_benchmark fixture-only PASS",
            f"tasks={len(tasks_sorted)}",
            f"arms={len(arm_ids_sorted)}",
            f"records={len(records)}",
            f"ablation_rows={len(ablation_report)}",
            f"human_ratings={HUMAN_RATING_SENTINEL}",
            "network_used=false",
            "load_reduction_claimed=false",
        ]
        for note in notes:
            lines.append(f"note={note}")
        for row in ablation_report:
            lines.append(
                "ablation="
                f"{row['ablation_id']}|{row['domain_id']}|"
                f"{row['status']}|{row['node_count_before']}->{row['node_count_after']}"
            )
        sys.stdout.write("\n".join(lines) + "\n")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Context/protocol benchmark harness (independent of G6-H)."
    )
    parser.add_argument(
        "--fixture-only",
        action="store_true",
        help="Deterministic offline dry run; no network/provider calls.",
    )
    parser.add_argument(
        "--format",
        choices=("text", "json"),
        default="text",
        help="Output format (fixture-only).",
    )
    args = parser.parse_args(argv)

    if not args.fixture_only:
        _die(
            "Live provider runs are not enabled in this revision. "
            "Use --fixture-only for deterministic offline validation."
        )
    return run_fixture_only(fmt=args.format)


if __name__ == "__main__":
    raise SystemExit(main())
