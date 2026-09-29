"""Foundation tests for the SPE benchmark and qualification harness.

Unlabeled fixtures stay unlabeled. A missing measurement stays UNKNOWN.
The harness must not invent PASS.
"""

from __future__ import annotations

import ast
import json
import os
import subprocess
import sys
from pathlib import Path

import jsonschema
import pytest

from tools.run_spe_benchmark import (
    DATASET_ID,
    EVAL_DIR,
    FROZEN_FILES,
    HASHES_PATH,
    MANIFEST_PATH,
    MEASUREMENTS,
    REPO,
    UNKNOWN,
    BenchmarkReject,
    build_report,
    hash_mismatches,
    load_cases,
    load_dataset,
    status_from_supplied,
)

HARNESS = REPO / "tools" / "run_spe_benchmark.py"
SCHEMA_DIR = REPO / "schemas"
STAMP = "2026-09-30T00:00:00Z"
FORBIDDEN_CASE_KEYS = {
    "gold",
    "score",
    "verdict",
    "task_success",
    "human_score",
    "expected_verdict",
    "pass",
}


def _run(*args: str) -> subprocess.CompletedProcess[str]:
    env = dict(os.environ)
    env.update(
        {
            "SPE_BENCHMARK_ALLOW_NETWORK": "0",
            "NO_PROXY": "*",
            "HTTP_PROXY": "",
            "HTTPS_PROXY": "",
        }
    )
    return subprocess.run(
        [sys.executable, str(HARNESS), *args],
        cwd=REPO,
        check=False,
        capture_output=True,
        text=True,
        env=env,
    )


def _observation(measurement: str, status: str, **extra: object) -> dict[str, object]:
    evidence_ref = extra.pop("evidence_ref", None)
    method = extra.pop("method", None)
    measured_at = extra.pop("measured_at", None)
    row: dict[str, object] = {
        "schema_version": "spe_benchmark_observation.v1",
        "record_kind": "measurement",
        "case_id": extra.pop("case_id", "sbq-constraint-001"),
        "arm_id": "SPE",
        "measurement": measurement,
        "status": status,
        "evidence_ref": evidence_ref,
        "method": method,
        "measured_at": measured_at,
    }
    row.update(extra)
    return row


def _statuses(report: dict, case_id: str, arm_id: str) -> dict[str, str]:
    for record in report["records"]:
        if record["case_id"] == case_id and record["arm_id"] == arm_id:
            return {name: slot["status"] for name, slot in record["measurements"].items()}
    raise AssertionError(f"missing record {case_id} {arm_id}")


def test_harness_files_exist() -> None:
    assert HARNESS.is_file()
    assert (EVAL_DIR / "README.md").is_file()
    assert (EVAL_DIR / "dataset.json").is_file()
    assert (EVAL_DIR / "cases.jsonl").is_file()
    assert (EVAL_DIR / "human_ratings.example.jsonl").is_file()
    assert HASHES_PATH.is_file()
    assert MANIFEST_PATH.is_file()
    for name in (
        "spe_benchmark_case.schema.json",
        "spe_benchmark_dataset.schema.json",
        "spe_benchmark_result.schema.json",
        "spe_benchmark_comparison.schema.json",
        "spe_benchmark_manifest.schema.json",
        "spe_benchmark_human_rating.schema.json",
        "spe_benchmark_observation.schema.json",
    ):
        assert (SCHEMA_DIR / name).is_file()


def test_dataset_catalog_matches_runner_and_schemas() -> None:
    dataset = load_dataset()
    assert dataset["dataset_id"] == DATASET_ID
    assert dataset["measurement_default"] == UNKNOWN
    assert dataset["measurements"] == list(MEASUREMENTS)
    assert dataset["provider_calls"] == 0
    result_schema = json.loads((SCHEMA_DIR / "spe_benchmark_result.schema.json").read_text())
    recorded = result_schema["properties"]["records"]["items"]["properties"]["measurements"]
    assert recorded["required"] == list(MEASUREMENTS)
    latency_enum = recorded["properties"]["latency"]["properties"]["status"]["enum"]
    assert "PASS" not in latency_enum
    assert "UNKNOWN" in latency_enum


def test_cases_are_unlabeled_and_cover_every_measurement() -> None:
    cases = load_cases()
    assert len(cases) == 12
    covered: set[str] = set()
    for case in cases:
        assert case["label_status"] == "UNLABELED"
        assert case["frozen"] is True
        assert case["probe_notes"] == "Unlabeled fixture. No verdict is stored."
        assert not (set(case) & FORBIDDEN_CASE_KEYS)
        covered.update(case["eligible_measurements"])
        assert "https://" not in case["raw_prompt"]
        assert "http://" not in case["raw_prompt"]
    assert covered == set(MEASUREMENTS)
    large = next(case for case in cases if case["case_id"] == "sbq-large-input-001")
    assert large["raw_prompt"].count("SPE_BENCH_MARKER_sbq-large-input-001") >= 2
    unknown = next(case for case in cases if case["case_id"] == "sbq-unknown-001")
    assert unknown["declared_unknowns"]
    assert "PASS" not in (EVAL_DIR / "cases.jsonl").read_text(encoding="utf-8")


def test_blank_and_missing_status_stay_unknown() -> None:
    assert status_from_supplied(None) == UNKNOWN
    assert status_from_supplied("") == UNKNOWN
    assert status_from_supplied("  ") == UNKNOWN
    assert status_from_supplied("UNKNOWN") == UNKNOWN
    assert status_from_supplied("null") == UNKNOWN
    with pytest.raises(BenchmarkReject):
        status_from_supplied("pass")
    with pytest.raises(BenchmarkReject):
        status_from_supplied("OK")


def test_fixture_report_keeps_every_measurement_unknown() -> None:
    report = build_report(load_cases())
    assert report["mode"] == "fixture-only"
    assert report["marked_pass_count"] == 0
    assert report["harness_invented_scores"] is False
    assert report["human_ratings_aggregated"] is False
    assert report["network_used"] is False
    assert report["provider_calls"] == 0
    assert report["record_count"] == 24
    blob = json.dumps(report)
    assert "PASS" not in blob
    for record in report["records"]:
        assert record["spe_prompt"] == UNKNOWN
        assert record["spe_prompt_sha256"] == UNKNOWN
        for name in MEASUREMENTS:
            slot = record["measurements"][name]
            assert slot["status"] == UNKNOWN
            assert slot["evidence_ref"] is None
            assert slot["value_ms"] is None
    pair = next(
        item for item in report["comparison"]["pairs"] if item["case_id"] == "sbq-large-input-001"
    )
    assert pair["spe_prompt"] == UNKNOWN
    assert "SPE_BENCH_MARKER_sbq-large-input-001" in pair["raw_prompt"]
    assert pair["arms"]["SPE"]["measurements"]["large_input_preservation"]["status"] == UNKNOWN


def test_pass_without_evidence_is_rejected() -> None:
    cases = load_cases()
    with pytest.raises(BenchmarkReject):
        build_report(cases, [_observation("constraint_preservation", "PASS")])
    report = build_report(cases)
    assert report["marked_pass_count"] == 0


def test_evidenced_pass_does_not_fill_other_measurements() -> None:
    cases = load_cases()
    report = build_report(
        cases,
        [
            _observation(
                "constraint_preservation",
                "PASS",
                evidence_ref="audit/constraint-001.txt",
                method="offline_audit",
                measured_at=STAMP,
            )
        ],
    )
    statuses = _statuses(report, "sbq-constraint-001", "SPE")
    assert statuses["constraint_preservation"] == "PASS"
    assert statuses["intent_preservation"] == UNKNOWN
    assert statuses["unknown_preservation"] == UNKNOWN
    assert report["marked_pass_count"] == 1
    assert report["harness_invented_scores"] is False
    raw_statuses = _statuses(report, "sbq-constraint-001", "RAW")
    assert all(status == UNKNOWN for status in raw_statuses.values())


def test_spe_prompt_attachment_is_not_a_pass() -> None:
    cases = load_cases()
    compiled = "Tell the team the review is Thursday. Do not book the old slot."
    report = build_report(
        cases,
        [
            {
                "schema_version": "spe_benchmark_observation.v1",
                "record_kind": "spe_prompt",
                "case_id": "sbq-intent-001",
                "arm_id": "SPE",
                "spe_prompt": compiled,
                "evidence_ref": "compile/intent-001.txt",
                "method": "offline_capture",
                "measured_at": STAMP,
            }
        ],
    )
    record = next(
        item
        for item in report["records"]
        if item["case_id"] == "sbq-intent-001" and item["arm_id"] == "SPE"
    )
    assert record["spe_prompt"] == compiled
    assert record["spe_prompt_sha256"] != UNKNOWN
    assert record["measurements"]["intent_preservation"]["status"] == UNKNOWN
    assert report["marked_pass_count"] == 0
    pair = next(item for item in report["comparison"]["pairs"] if item["case_id"] == "sbq-intent-001")
    assert pair["spe_prompt"] == compiled
    assert pair["raw_prompt"].startswith("need a short note")


def test_human_rating_pass_is_stored_and_not_aggregated() -> None:
    cases = load_cases()
    report = build_report(
        cases,
        human_rows=[
            {
                "schema_version": "spe_benchmark_human_rating.v1",
                "case_id": "sbq-human-001",
                "arm_id": "SPE",
                "rater_id": "rater-blind-01",
                "blinded": True,
                "rating": "PASS",
                "evidence_ref": "ratings/human-001.txt",
                "method": "blinded_review",
                "rated_at": STAMP,
                "notes": "Supplied by the test, not by the harness.",
            }
        ],
    )
    slot = next(
        item["measurements"]["human_blinded_evaluation"]
        for item in report["records"]
        if item["case_id"] == "sbq-human-001" and item["arm_id"] == "SPE"
    )
    assert slot["status"] == UNKNOWN
    assert slot["evidence_ref"] is None
    assert slot["records"][0]["rating"] == "PASS"
    assert report["human_ratings_aggregated"] is False
    assert report["marked_pass_count"] == 0
    assert _statuses(report, "sbq-human-001", "SPE")["constraint_preservation"] == UNKNOWN


def test_example_human_rating_is_rejected() -> None:
    example = EVAL_DIR / "human_ratings.example.jsonl"
    row = json.loads(example.read_text(encoding="utf-8"))
    assert row["example_only"] is True
    assert row["rating"] == UNKNOWN
    with pytest.raises(BenchmarkReject, match="format example"):
        build_report(load_cases(), human_rows=[row])


def test_latency_cannot_become_pass_and_measured_needs_a_value() -> None:
    cases = load_cases()
    with pytest.raises(BenchmarkReject, match="latency"):
        build_report(
            cases,
            [
                _observation(
                    "latency",
                    "PASS",
                    case_id="sbq-latency-001",
                    evidence_ref="timing/latency-001.txt",
                    method="wall_clock",
                    measured_at=STAMP,
                )
            ],
        )
    report = build_report(
        cases,
        [
            _observation(
                "latency",
                "MEASURED",
                case_id="sbq-latency-001",
                evidence_ref="timing/latency-001.txt",
                method="wall_clock",
                measured_at=STAMP,
                value_ms=12.5,
            )
        ],
    )
    slot = next(
        item["measurements"]["latency"]
        for item in report["records"]
        if item["case_id"] == "sbq-latency-001" and item["arm_id"] == "SPE"
    )
    assert slot["status"] == "MEASURED"
    assert slot["value_ms"] == 12.5
    assert report["marked_pass_count"] == 0


def test_schema_rejects_pass_without_evidence() -> None:
    report = build_report(load_cases())
    report["records"][0]["measurements"]["constraint_preservation"]["status"] = "PASS"
    schema = json.loads((SCHEMA_DIR / "spe_benchmark_result.schema.json").read_text())
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.validate(report, schema)


def test_hash_mismatch_is_reported_and_committed_hashes_match() -> None:
    assert hash_mismatches({"a": "1"}, {"a": "2"}) == ["hash mismatch a"]
    assert hash_mismatches({"a": "1"}, {}) == ["missing hash entry a"]
    completed = _run("--check-hashes")
    assert completed.returncode == 0, completed.stderr
    assert "hashes=OK" in completed.stdout
    assert "measurement_default=UNKNOWN" in completed.stdout
    assert "scores_included=false" in completed.stdout
    assert "PASS" not in completed.stdout
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    assert manifest["scores_included"] is False
    assert manifest["measurement_default"] == UNKNOWN
    assert manifest["provider_calls"] == 0
    assert len(manifest["frozen_files"]) == len(FROZEN_FILES)


def test_fixture_cli_is_deterministic_and_offline() -> None:
    first = _run("--fixture-only", "--format", "json")
    second = _run("--fixture-only", "--format", "json")
    assert first.returncode == 0, first.stderr
    assert second.returncode == 0, second.stderr
    assert first.stdout == second.stdout
    payload = json.loads(first.stdout)
    assert payload["mode"] == "fixture-only"
    assert payload["marked_pass_count"] == 0
    assert "PASS" not in first.stdout
    text = _run("--fixture-only")
    assert text.returncode == 0, text.stderr
    assert "spe_prompt=UNKNOWN" in text.stdout
    assert "measurement_statuses=UNKNOWN" in text.stdout
    assert "PASS" not in text.stdout


def test_cli_rejects_live_mode_example_import_and_frozen_overwrite(tmp_path: Path) -> None:
    live = _run("--live")
    assert live.returncode == 1
    assert "refused" in live.stderr
    example = _run(
        "--fixture-only",
        "--import-human-ratings",
        str(EVAL_DIR / "human_ratings.example.jsonl"),
    )
    assert example.returncode == 1
    assert example.stdout == ""
    assert "format example" in example.stderr
    overwrite = _run(
        "--fixture-only",
        "--comparison-out",
        "evaluations/spe_benchmark_qualification_v1/cases.jsonl",
    )
    assert overwrite.returncode == 1
    assert "refusing to overwrite" in overwrite.stderr
    destination = tmp_path / "comparison.json"
    written = _run("--fixture-only", "--comparison-out", str(destination))
    assert written.returncode == 0, written.stderr
    comparison = json.loads(destination.read_text(encoding="utf-8"))
    assert comparison["measurement_default"] == UNKNOWN
    assert all(pair["spe_prompt"] == UNKNOWN for pair in comparison["pairs"])


def test_runner_does_not_import_runtime_or_network_libraries() -> None:
    tree = ast.parse(HARNESS.read_text(encoding="utf-8"))
    imported: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            imported.update(alias.name.split(".")[0] for alias in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module:
            imported.add(node.module.split(".")[0])
    assert imported.isdisjoint({"spe_runtime", "urllib", "socket", "requests", "http"})
