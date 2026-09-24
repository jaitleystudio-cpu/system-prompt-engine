"""Fixture validation for the independent context/protocol benchmark harness (Task 9).

Does not touch frozen G6-H evidence. Human ratings must remain NO_RATINGS_YET
until real blinded ratings are collected; they must never be auto-filled.
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[2]
EVAL_DIR = REPO / "evaluations" / "context_protocol_v1"
TASKS_PATH = EVAL_DIR / "tasks.jsonl"
ARMS_PATH = EVAL_DIR / "arms.json"
README_PATH = EVAL_DIR / "README.md"
HARNESS = REPO / "tools" / "run_context_protocol_benchmark.py"

# Canonical stress classes from the approved plan/spec (exact spellings).
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

HUMAN_RATING_SENTINEL = "NO_RATINGS_YET"


def _load_jsonl(path: Path) -> list[dict]:
    rows: list[dict] = []
    text = path.read_text(encoding="utf-8")
    for line_no, line in enumerate(text.splitlines(), start=1):
        line = line.strip()
        if not line:
            continue
        obj = json.loads(line)
        if not isinstance(obj, dict):
            raise AssertionError(f"{path}:{line_no}: expected object")
        rows.append(obj)
    return rows


def test_benchmark_fixture_files_exist():
    assert README_PATH.is_file(), f"missing {README_PATH}"
    assert TASKS_PATH.is_file(), f"missing {TASKS_PATH}"
    assert ARMS_PATH.is_file(), f"missing {ARMS_PATH}"
    assert HARNESS.is_file(), f"missing {HARNESS}"


def test_arms_cover_required_matrix():
    payload = json.loads(ARMS_PATH.read_text(encoding="utf-8"))
    assert isinstance(payload, dict)
    arms = payload.get("arms")
    assert isinstance(arms, list) and arms
    ids = {str(a["id"]) for a in arms}
    missing = REQUIRED_ARMS - ids
    assert not missing, f"missing arms: {sorted(missing)}"


def test_tasks_cover_all_stress_classes():
    tasks = _load_jsonl(TASKS_PATH)
    assert tasks, "tasks.jsonl must contain at least one task"
    seen = {str(t.get("stress_class", "")) for t in tasks}
    missing = REQUIRED_STRESS_CLASSES - seen
    assert not missing, f"missing stress classes: {sorted(missing)}"


def test_human_ratings_default_to_sentinel_never_fabricated():
    tasks = _load_jsonl(TASKS_PATH)
    for task in tasks:
        ratings = task.get("human_ratings", HUMAN_RATING_SENTINEL)
        assert ratings == HUMAN_RATING_SENTINEL, (
            f"task {task.get('task_id')}: human_ratings must be "
            f"{HUMAN_RATING_SENTINEL!r}, got {ratings!r}"
        )
        # Explicit ban on numeric / fabricated rating fields.
        for key in ("human_score", "blind_rating", "rater_scores"):
            assert key not in task or task[key] == HUMAN_RATING_SENTINEL


def test_ablation_matrix_declared():
    payload = json.loads(ARMS_PATH.read_text(encoding="utf-8"))
    ablation = payload.get("ablation_matrix")
    assert isinstance(ablation, list) and ablation, "ablation_matrix required"
    ids = {str(a["id"]) for a in ablation}
    for required in (
        "full",
        "compact",
        "no_contradiction",
        "no_verification",
        "no_hypothesis",
    ):
        assert required in ids, f"ablation_matrix missing {required!r}"


def test_routing_efficiency_fields_declared_for_capability_cases():
    tasks = _load_jsonl(TASKS_PATH)
    routing = [t for t in tasks if t.get("measures_routing_efficiency")]
    assert routing, "at least one capability-routing efficiency task required"
    required_slots = {
        "base_model_tokens",
        "total_tokens",
        "tool_calls",
        "latency_ms",
        "correctness",
        "unsupported_claims",
    }
    for task in routing:
        slots = set(task.get("routing_measurement_slots") or [])
        missing = required_slots - slots
        assert not missing, (
            f"task {task.get('task_id')}: missing routing slots {sorted(missing)}"
        )


def test_fixture_only_harness_is_deterministic_and_offline():
    """--fixture-only must PASS with no network/provider calls."""
    assert HARNESS.is_file()
    env = {
        **dict(**{k: v for k, v in __import__("os").environ.items()}),
        "SPE_BENCHMARK_ALLOW_NETWORK": "0",
        "NO_PROXY": "*",
        "HTTP_PROXY": "",
        "HTTPS_PROXY": "",
        "ALL_PROXY": "",
    }
    # Strip provider keys so a buggy harness cannot accidentally call out.
    for key in list(env):
        upper = key.upper()
        if any(
            token in upper
            for token in (
                "API_KEY",
                "OPENAI",
                "ANTHROPIC",
                "GEMINI",
                "AZURE_OPENAI",
                "PROVIDER",
            )
        ):
            env.pop(key, None)

    first = subprocess.run(
        [sys.executable, str(HARNESS), "--fixture-only"],
        cwd=str(REPO),
        capture_output=True,
        text=True,
        env=env,
        check=False,
    )
    assert first.returncode == 0, (
        f"fixture-only failed:\nSTDOUT:\n{first.stdout}\nSTDERR:\n{first.stderr}"
    )
    second = subprocess.run(
        [sys.executable, str(HARNESS), "--fixture-only"],
        cwd=str(REPO),
        capture_output=True,
        text=True,
        env=env,
        check=False,
    )
    assert second.returncode == 0
    assert first.stdout == second.stdout, "fixture-only output must be deterministic"


def test_fixture_only_emits_machine_readable_per_task_records():
    result = subprocess.run(
        [sys.executable, str(HARNESS), "--fixture-only", "--format", "json"],
        cwd=str(REPO),
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0, result.stderr
    payload = json.loads(result.stdout)
    assert payload.get("mode") == "fixture-only"
    records = payload.get("records")
    assert isinstance(records, list) and records
    required_fields = {
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
    }
    for rec in records:
        missing = required_fields - set(rec)
        assert not missing, f"record missing fields: {sorted(missing)}"
        assert rec["human_ratings"] == HUMAN_RATING_SENTINEL
        # Never auto-fill human ratings with fabricated numbers.
        assert not isinstance(rec["human_ratings"], (int, float))
