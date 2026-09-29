#!/usr/bin/env python3
"""SPE benchmark and qualification harness.

Records structure for a measurement run. A missing measurement stays UNKNOWN.
This tool never invents a PASS.

Fixture mode does not compile prompts, call providers, open a browser, or
import spe_runtime. `--subject python-reference` lazily loads
tools.spe_benchmark_python_subject and attaches a compiled prompt only when
the frozen Python reference returns one. That attachment is not a score.

Offline observation and human-rating files can be merged later. PASS and FAIL
are stored only when that file explicitly supplies them with evidence. Human
ratings are stored as records and are not aggregated into a verdict.
"""

from __future__ import annotations

import argparse
import hashlib
import importlib
import json
import re
import sys
from pathlib import Path
from typing import Any, Mapping

import jsonschema

REPO = Path(__file__).resolve().parents[1]
EVAL_DIR = REPO / "evaluations" / "spe_benchmark_qualification_v1"
SCHEMA_DIR = REPO / "schemas"
HASHES_PATH = EVAL_DIR / "hashes.sha256"
MANIFEST_PATH = EVAL_DIR / "manifest.json"

DATASET_ID = "spe-benchmark-qualification-v1"
CASE_SCHEMA_VERSION = "spe_benchmark_case.v1"
DATASET_SCHEMA_VERSION = "spe_benchmark_dataset.v1"
RESULT_SCHEMA_VERSION = "spe_benchmark_result.v1"
COMPARISON_SCHEMA_VERSION = "spe_benchmark_comparison.v1"
MANIFEST_SCHEMA_VERSION = "spe_benchmark_manifest.v1"
HUMAN_SCHEMA_VERSION = "spe_benchmark_human_rating.v1"
OBSERVATION_SCHEMA_VERSION = "spe_benchmark_observation.v1"
UNKNOWN = "UNKNOWN"
PROBE_NOTES = "Unlabeled fixture. No verdict is stored."
STAMP_RE = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$")

MEASUREMENTS: tuple[str, ...] = (
    "constraint_preservation",
    "intent_preservation",
    "unknown_preservation",
    "category_accuracy",
    "repair_effectiveness",
    "unsupported_claim_detection",
    "provider_portability",
    "large_input_preservation",
    "grounding_fidelity",
    "latency",
    "browser_qualification",
    "human_blinded_evaluation",
)
ARMS: tuple[str, ...] = ("RAW", "SPE")
VERDICT_STATUSES = frozenset({"UNKNOWN", "PASS", "FAIL", "NOT_APPLICABLE"})
LATENCY_STATUSES = frozenset({"UNKNOWN", "MEASURED", "NOT_APPLICABLE"})

FROZEN_FILES: tuple[tuple[str, str], ...] = (
    ("evaluations/spe_benchmark_qualification_v1/README.md", "reproduction_instructions"),
    ("evaluations/spe_benchmark_qualification_v1/cases.jsonl", "frozen_cases"),
    ("evaluations/spe_benchmark_qualification_v1/dataset.json", "dataset_header"),
    (
        "evaluations/spe_benchmark_qualification_v1/human_ratings.example.jsonl",
        "human_rating_format_example",
    ),
    ("schemas/spe_benchmark_case.schema.json", "schema_case"),
    ("schemas/spe_benchmark_comparison.schema.json", "schema_comparison"),
    ("schemas/spe_benchmark_dataset.schema.json", "schema_dataset"),
    ("schemas/spe_benchmark_human_rating.schema.json", "schema_human_rating"),
    ("schemas/spe_benchmark_manifest.schema.json", "schema_manifest"),
    ("schemas/spe_benchmark_observation.schema.json", "schema_observation"),
    ("schemas/spe_benchmark_result.schema.json", "schema_result"),
)

PROTECTED_WRITE_PATHS = frozenset(
    rel for rel, _role in FROZEN_FILES
) | {
    "evaluations/spe_benchmark_qualification_v1/hashes.sha256",
    "evaluations/spe_benchmark_qualification_v1/manifest.json",
}


class BenchmarkReject(Exception):
    """The harness refuses a result rather than turning it into PASS."""


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_text(text: str) -> str:
    return sha256_bytes(text.encode("utf-8"))


def _schema(name: str) -> dict[str, Any]:
    path = SCHEMA_DIR / name
    if not path.is_file():
        raise BenchmarkReject(f"missing schema: {path.relative_to(REPO)}")
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise BenchmarkReject(f"{name} must be an object")
    return payload


def _validate(instance: Any, schema_name: str) -> None:
    schema = _schema(schema_name)
    try:
        jsonschema.validate(instance, schema)
    except jsonschema.ValidationError as exc:
        message = exc.message
        if len(message) > 400:
            message = message[:400] + "..."
        raise BenchmarkReject(f"{schema_name}: {message}") from exc


def _load_json(path: Path) -> Any:
    if not path.is_file():
        raise BenchmarkReject(f"missing file: {path}")
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise BenchmarkReject(f"{path}: invalid JSON: {exc}") from exc


def _load_jsonl(path: Path) -> list[dict[str, Any]]:
    if not path.is_file():
        raise BenchmarkReject(f"missing file: {path}")
    rows: list[dict[str, Any]] = []
    for line_no, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        if not line.strip():
            continue
        try:
            obj = json.loads(line)
        except json.JSONDecodeError as exc:
            raise BenchmarkReject(f"{path}:{line_no}: invalid JSON: {exc}") from exc
        if not isinstance(obj, dict):
            raise BenchmarkReject(f"{path}:{line_no}: expected an object")
        rows.append(obj)
    return rows


def load_dataset() -> dict[str, Any]:
    payload = _load_json(EVAL_DIR / "dataset.json")
    _validate(payload, "spe_benchmark_dataset.schema.json")
    if payload.get("measurements") != list(MEASUREMENTS):
        raise BenchmarkReject("dataset measurements drifted from the harness catalog")
    if payload.get("cases_file") != "cases.jsonl":
        raise BenchmarkReject("cases_file must be cases.jsonl inside the evaluation directory")
    return payload


def load_cases() -> list[dict[str, Any]]:
    rows = _load_jsonl(EVAL_DIR / "cases.jsonl")
    if not rows:
        raise BenchmarkReject("cases.jsonl is empty")
    seen: set[str] = set()
    covered: set[str] = set()
    for row in rows:
        _validate(row, "spe_benchmark_case.schema.json")
        case_id = str(row["case_id"])
        if case_id in seen:
            raise BenchmarkReject(f"duplicate case_id {case_id}")
        seen.add(case_id)
        if row.get("label_status") != "UNLABELED":
            raise BenchmarkReject(f"{case_id} must stay UNLABELED")
        if row.get("frozen") is not True:
            raise BenchmarkReject(f"{case_id} must be frozen")
        eligible = row.get("eligible_measurements")
        if not isinstance(eligible, list) or not eligible:
            raise BenchmarkReject(f"{case_id} needs eligible_measurements")
        covered.update(str(item) for item in eligible)
    missing = [name for name in MEASUREMENTS if name not in covered]
    if missing:
        raise BenchmarkReject(f"cases do not cover measurements: {missing}")
    return rows


def blank_slot(measurement: str) -> dict[str, Any]:
    slot: dict[str, Any] = {
        "status": UNKNOWN,
        "evidence_ref": None,
        "method": None,
        "measured_at": None,
        "notes": None,
        "value_ms": None,
    }
    if measurement == "human_blinded_evaluation":
        slot["records"] = []
    return slot


def blank_measurements() -> dict[str, Any]:
    return {name: blank_slot(name) for name in MEASUREMENTS}


def status_from_supplied(raw: object) -> str:
    """Map a supplied status. Omitted or blank stays UNKNOWN, never PASS."""
    if raw is None:
        return UNKNOWN
    if not isinstance(raw, str):
        raise BenchmarkReject("status must be a string when it is present")
    token = raw.strip()
    if token == "" or token.upper() == UNKNOWN or token.lower() == "null":
        return UNKNOWN
    if token not in VERDICT_STATUSES | LATENCY_STATUSES:
        raise BenchmarkReject(
            f"unsupported status {token!r}; a missing measurement stays UNKNOWN"
        )
    return token


def _require_evidence(obj: Mapping[str, Any], *, what: str, time_field: str) -> None:
    evidence = obj.get("evidence_ref")
    method = obj.get("method")
    stamp = obj.get(time_field)
    if not isinstance(evidence, str) or not evidence.strip() or evidence.strip() == UNKNOWN:
        raise BenchmarkReject(
            f"{what} requires evidence_ref; without evidence the measurement stays UNKNOWN"
        )
    if not isinstance(method, str) or not method.strip() or method.strip() == UNKNOWN:
        raise BenchmarkReject(f"{what} requires method")
    if not isinstance(stamp, str) or STAMP_RE.fullmatch(stamp) is None:
        raise BenchmarkReject(f"{what} requires {time_field} as an ISO-8601 UTC Z timestamp")


def _apply_status(measurement: str, slot: dict[str, Any], obs: Mapping[str, Any], status: str) -> None:
    allowed = LATENCY_STATUSES if measurement == "latency" else VERDICT_STATUSES
    if status not in allowed:
        raise BenchmarkReject(
            f"{measurement} cannot be recorded as {status}; unmeasured stays UNKNOWN"
        )
    if measurement == "human_blinded_evaluation":
        raise BenchmarkReject(
            "human_blinded_evaluation is recorded as rating rows, not aggregated to PASS"
        )
    if status == UNKNOWN:
        return
    if status == "NOT_APPLICABLE":
        notes = obs.get("notes")
        if not isinstance(notes, str) or not notes.strip():
            raise BenchmarkReject("NOT_APPLICABLE requires notes; it is not a PASS")
        slot["status"] = "NOT_APPLICABLE"
        slot["notes"] = notes.strip()
        slot["evidence_ref"] = None
        slot["method"] = None
        slot["measured_at"] = None
        slot["value_ms"] = None
        return
    if status in {"PASS", "FAIL", "MEASURED"}:
        _require_evidence(obs, what=f"{measurement} {status}", time_field="measured_at")
        if status == "MEASURED":
            value = obs.get("value_ms")
            if isinstance(value, bool) or not isinstance(value, (int, float)) or value < 0:
                raise BenchmarkReject("latency MEASURED requires numeric value_ms >= 0")
            slot["value_ms"] = value
        elif obs.get("value_ms") is not None:
            raise BenchmarkReject("value_ms is recorded only for latency")
        else:
            slot["value_ms"] = None
        slot["status"] = status
        evidence = obs.get("evidence_ref")
        method = obs.get("method")
        assert isinstance(evidence, str) and isinstance(method, str)
        slot["evidence_ref"] = evidence.strip()
        slot["method"] = method.strip()
        slot["measured_at"] = obs.get("measured_at")
        notes = obs.get("notes")
        slot["notes"] = notes if isinstance(notes, str) and notes.strip() else None
        return
    raise BenchmarkReject(f"unhandled status {status}")


def apply_observation(
    records: dict[tuple[str, str], dict[str, Any]],
    obs: Mapping[str, Any],
    cases_by_id: Mapping[str, Mapping[str, Any]],
    seen: set[tuple[str, str, str]],
) -> None:
    _validate(dict(obs), "spe_benchmark_observation.schema.json")
    case_id = str(obs["case_id"])
    if case_id not in cases_by_id:
        raise BenchmarkReject(f"observation case_id is not in the frozen dataset: {case_id}")
    arm_id = str(obs["arm_id"])
    if arm_id not in ARMS:
        raise BenchmarkReject(f"observation arm_id must be RAW or SPE, got {arm_id}")
    record = records[(case_id, arm_id)]
    kind = str(obs["record_kind"])
    if kind == "spe_prompt":
        if arm_id != "SPE":
            raise BenchmarkReject("an SPE prompt attaches to the SPE arm only")
        dedupe_key = (case_id, arm_id, "spe_prompt")
        if dedupe_key in seen:
            raise BenchmarkReject(f"duplicate spe_prompt observation for {case_id}")
        seen.add(dedupe_key)
        text = obs.get("spe_prompt")
        if not isinstance(text, str) or not text.strip() or text.strip() == UNKNOWN:
            raise BenchmarkReject("spe_prompt text is absent; the slot stays UNKNOWN")
        _require_evidence(obs, what="spe_prompt", time_field="measured_at")
        record["spe_prompt"] = text
        record["spe_prompt_sha256"] = sha256_text(text)
        return
    if kind != "measurement":
        raise BenchmarkReject(f"unknown observation record_kind {kind}")
    measurement = str(obs["measurement"])
    if measurement not in MEASUREMENTS:
        raise BenchmarkReject(f"unknown measurement {measurement}")
    dedupe_key = (case_id, arm_id, measurement)
    if dedupe_key in seen:
        raise BenchmarkReject(f"duplicate observation for {case_id} {arm_id} {measurement}")
    seen.add(dedupe_key)
    status = status_from_supplied(obs.get("status"))
    _apply_status(measurement, record["measurements"][measurement], obs, status)


def apply_human_rating(
    records: dict[tuple[str, str], dict[str, Any]],
    row: Mapping[str, Any],
    cases_by_id: Mapping[str, Mapping[str, Any]],
    seen_raters: set[tuple[str, str, str]],
) -> None:
    _validate(dict(row), "spe_benchmark_human_rating.schema.json")
    if row.get("example_only") is True:
        raise BenchmarkReject("the human-rating format example is not a collected rating")
    case_id = str(row["case_id"])
    if case_id not in cases_by_id:
        raise BenchmarkReject(f"human rating case_id is not in the frozen dataset: {case_id}")
    arm_id = str(row["arm_id"])
    if arm_id not in ARMS:
        raise BenchmarkReject(f"human rating arm_id must be RAW or SPE, got {arm_id}")
    rater_id = str(row["rater_id"])
    dedupe_key = (case_id, arm_id, rater_id)
    if dedupe_key in seen_raters:
        raise BenchmarkReject(f"duplicate human rating from {rater_id} for {case_id} {arm_id}")
    seen_raters.add(dedupe_key)
    rating = status_from_supplied(row.get("rating"))
    if rating == "MEASURED":
        raise BenchmarkReject("a human rating cannot be MEASURED")
    if rating in {"PASS", "FAIL"}:
        if row.get("blinded") is not True:
            raise BenchmarkReject("a PASS or FAIL human rating must be blinded")
        _require_evidence(row, what=f"human rating {rating}", time_field="rated_at")
    elif rating == "NOT_APPLICABLE":
        notes = row.get("notes")
        if not isinstance(notes, str) or not notes.strip():
            raise BenchmarkReject("NOT_APPLICABLE human rating requires notes")
    slot = records[(case_id, arm_id)]["measurements"]["human_blinded_evaluation"]
    if slot["status"] != UNKNOWN:
        raise BenchmarkReject("human ratings must not overwrite a measurement verdict")
    evidence = row.get("evidence_ref")
    method = row.get("method")
    stored = {
        "rater_id": rater_id,
        "blinded": bool(row["blinded"]),
        "rating": rating,
        "evidence_ref": evidence.strip() if isinstance(evidence, str) and evidence.strip() else None,
        "method": method.strip() if isinstance(method, str) and method.strip() else None,
        "rated_at": row.get("rated_at") if isinstance(row.get("rated_at"), str) else None,
        "notes": row.get("notes") if isinstance(row.get("notes"), str) else None,
    }
    slot["records"].append(stored)
    slot["status"] = UNKNOWN
    slot["evidence_ref"] = None
    slot["method"] = None
    slot["measured_at"] = None
    slot["value_ms"] = None


def _count_marked_pass(records: list[dict[str, Any]]) -> int:
    total = 0
    for record in records:
        measurements = record["measurements"]
        for name in MEASUREMENTS:
            if measurements[name]["status"] == "PASS":
                total += 1
    return total


def _enforce_unknown_or_evidenced(records: list[dict[str, Any]]) -> None:
    for record in records:
        if record["spe_prompt"] == UNKNOWN and record["spe_prompt_sha256"] != UNKNOWN:
            raise BenchmarkReject("UNKNOWN spe_prompt cannot carry a hash")
        if record["spe_prompt"] != UNKNOWN and record["spe_prompt_sha256"] == UNKNOWN:
            raise BenchmarkReject("a recorded spe_prompt requires its sha256")
        for name in MEASUREMENTS:
            slot = record["measurements"][name]
            status = slot["status"]
            if status == UNKNOWN:
                if slot["evidence_ref"] is not None or slot["method"] is not None:
                    raise BenchmarkReject(f"{name} UNKNOWN cannot carry evidence")
                if slot["measured_at"] is not None or slot["value_ms"] is not None:
                    raise BenchmarkReject(f"{name} UNKNOWN cannot carry a measurement value")
                continue
            if status in {"PASS", "FAIL", "MEASURED"}:
                _require_evidence(slot, what=f"{record['case_id']} {name} {status}", time_field="measured_at")
                continue
            if status == "NOT_APPLICABLE":
                notes = slot.get("notes")
                if not isinstance(notes, str) or not notes.strip():
                    raise BenchmarkReject(f"{name} NOT_APPLICABLE requires notes")
                if slot["value_ms"] is not None:
                    raise BenchmarkReject(f"{name} NOT_APPLICABLE cannot carry value_ms")
                continue
            raise BenchmarkReject(f"unhandled stored status {status}")


def build_comparison(
    cases_by_id: Mapping[str, Mapping[str, Any]],
    records: Mapping[tuple[str, str], Mapping[str, Any]],
) -> dict[str, Any]:
    pairs: list[dict[str, Any]] = []
    for case_id in sorted(cases_by_id):
        case = cases_by_id[case_id]
        spe = records[(case_id, "SPE")]
        pair = {
            "case_id": case_id,
            "raw_prompt": case["raw_prompt"],
            "raw_prompt_sha256": sha256_text(str(case["raw_prompt"])),
            "spe_prompt": spe["spe_prompt"],
            "spe_prompt_sha256": spe["spe_prompt_sha256"],
            "fixture": {
                "constraints": list(case["constraints"]),
                "intent_summary": case["intent_summary"],
                "declared_unknowns": list(case["declared_unknowns"]),
                "eligible_measurements": list(case["eligible_measurements"]),
            },
            "arms": {
                arm: {"measurements": records[(case_id, arm)]["measurements"]}
                for arm in ARMS
            },
        }
        pairs.append(pair)
    return {
        "schema_version": COMPARISON_SCHEMA_VERSION,
        "dataset_id": DATASET_ID,
        "harness_invented_scores": False,
        "measurement_default": UNKNOWN,
        "pairs": pairs,
    }


def build_report(
    cases: list[dict[str, Any]],
    observations: list[dict[str, Any]] | None = None,
    human_rows: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    observations = list(observations or [])
    human_rows = list(human_rows or [])
    cases_by_id = {str(case["case_id"]): case for case in cases}
    records: dict[tuple[str, str], dict[str, Any]] = {}
    for case in cases:
        case_id = str(case["case_id"])
        raw_hash = sha256_text(str(case["raw_prompt"]))
        for arm in ARMS:
            records[(case_id, arm)] = {
                "case_id": case_id,
                "arm_id": arm,
                "raw_prompt_sha256": raw_hash,
                "spe_prompt": UNKNOWN,
                "spe_prompt_sha256": UNKNOWN,
                "measurements": blank_measurements(),
            }
    seen_obs: set[tuple[str, str, str]] = set()
    for obs in observations:
        apply_observation(records, obs, cases_by_id, seen_obs)
    seen_raters: set[tuple[str, str, str]] = set()
    for row in human_rows:
        apply_human_rating(records, row, cases_by_id, seen_raters)
    record_list = [records[key] for key in sorted(records)]
    _enforce_unknown_or_evidenced(record_list)
    comparison = build_comparison(cases_by_id, records)
    marked_pass_count = _count_marked_pass(record_list)
    mode = "offline-record" if observations or human_rows else "fixture-only"
    report = {
        "schema_version": RESULT_SCHEMA_VERSION,
        "mode": mode,
        "dataset_id": DATASET_ID,
        "network_used": False,
        "provider_calls": 0,
        "harness_invented_scores": False,
        "human_ratings_aggregated": False,
        "measurement_default": UNKNOWN,
        "marked_pass_count": marked_pass_count,
        "case_count": len(cases_by_id),
        "record_count": len(record_list),
        "records": record_list,
        "comparison": comparison,
    }
    _validate(report, "spe_benchmark_result.schema.json")
    _validate(comparison, "spe_benchmark_comparison.schema.json")
    return report


def render_text(report: Mapping[str, Any]) -> str:
    lines = [
        "spe_benchmark_qualification",
        f"mode={report['mode']}",
        "fixture_structure=VALID",
        "measurement_default=UNKNOWN",
        f"marked_pass_count={report['marked_pass_count']}",
        "harness_invented_scores=false",
        "human_ratings_aggregated=false",
        "network_used=false",
        "provider_calls=0",
        f"cases={report['case_count']}",
        f"records={report['record_count']}",
    ]
    comparison = report["comparison"]
    assert isinstance(comparison, dict)
    pairs = comparison["pairs"]
    assert isinstance(pairs, list)
    for pair in pairs:
        assert isinstance(pair, dict)
        statuses: set[str] = set()
        arms = pair["arms"]
        assert isinstance(arms, dict)
        for arm in arms.values():
            assert isinstance(arm, dict)
            measurements = arm["measurements"]
            assert isinstance(measurements, dict)
            for slot in measurements.values():
                assert isinstance(slot, dict)
                statuses.add(str(slot["status"]))
        listed = ",".join(sorted(statuses))
        lines.append(
            f"compare {pair['case_id']} spe_prompt={pair['spe_prompt']} "
            f"measurement_statuses={listed}"
        )
    return "\n".join(lines) + "\n"


def render_json(payload: Mapping[str, Any]) -> str:
    return json.dumps(payload, sort_keys=True, ensure_ascii=False) + "\n"


def frozen_digest_map() -> dict[str, str]:
    digests: dict[str, str] = {}
    for rel, _role in FROZEN_FILES:
        path = REPO / rel
        if not path.is_file():
            raise BenchmarkReject(f"frozen file missing: {rel}")
        digests[rel] = sha256_bytes(path.read_bytes())
    return digests


def build_manifest(cases: list[dict[str, Any]]) -> dict[str, Any]:
    digests = frozen_digest_map()
    frozen_files = [
        {"path": rel, "sha256": digests[rel], "role": role}
        for rel, role in sorted(FROZEN_FILES, key=lambda item: item[0])
    ]
    manifest = {
        "schema_version": MANIFEST_SCHEMA_VERSION,
        "dataset_id": DATASET_ID,
        "hash_algorithm": "sha256",
        "frozen_files": frozen_files,
        "case_count": len(cases),
        "case_ids": sorted(str(case["case_id"]) for case in cases),
        "measurements": list(MEASUREMENTS),
        "scores_included": False,
        "measurement_default": UNKNOWN,
        "network_used": False,
        "provider_calls": 0,
    }
    _validate(manifest, "spe_benchmark_manifest.schema.json")
    return manifest


def format_hashes(digests: Mapping[str, str]) -> str:
    lines = [f"{digests[rel]}  {rel}" for rel in sorted(digests)]
    return "\n".join(lines) + "\n"


def parse_hashes(text: str) -> dict[str, str]:
    found: dict[str, str] = {}
    for line_no, line in enumerate(text.splitlines(), 1):
        if not line:
            continue
        digest, separator, rel = line.partition("  ")
        if separator != "  " or not rel:
            raise BenchmarkReject(f"hashes.sha256:{line_no}: expected sha256sum lines")
        if len(digest) != 64 or any(char not in "0123456789abcdef" for char in digest):
            raise BenchmarkReject(f"hashes.sha256:{line_no}: expected a sha256 hex digest")
        if rel in found:
            raise BenchmarkReject(f"hashes.sha256:{line_no}: duplicate path {rel}")
        found[rel] = digest
    return found


def hash_mismatches(expected: Mapping[str, str], actual: Mapping[str, str]) -> list[str]:
    problems: list[str] = []
    for rel in sorted(set(expected) | set(actual)):
        if rel not in expected:
            problems.append(f"unexpected hash entry {rel}")
        elif rel not in actual:
            problems.append(f"missing hash entry {rel}")
        elif expected[rel] != actual[rel]:
            problems.append(f"hash mismatch {rel}")
    return problems


def verify_frozen_hashes(cases: list[dict[str, Any]]) -> None:
    if not HASHES_PATH.is_file():
        raise BenchmarkReject(f"missing {HASHES_PATH.relative_to(REPO)}")
    if not MANIFEST_PATH.is_file():
        raise BenchmarkReject(f"missing {MANIFEST_PATH.relative_to(REPO)}")
    expected = frozen_digest_map()
    actual = parse_hashes(HASHES_PATH.read_text(encoding="utf-8"))
    problems = hash_mismatches(expected, actual)
    manifest = _load_json(MANIFEST_PATH)
    _validate(manifest, "spe_benchmark_manifest.schema.json")
    if manifest.get("scores_included") is not False:
        problems.append("manifest scores_included must stay false")
    if manifest.get("measurement_default") != UNKNOWN:
        problems.append("manifest measurement_default must stay UNKNOWN")
    if manifest.get("case_ids") != sorted(str(case["case_id"]) for case in cases):
        problems.append("manifest case_ids do not match the frozen cases")
    if manifest.get("case_count") != len(cases):
        problems.append("manifest case_count does not match the frozen cases")
    if manifest.get("measurements") != list(MEASUREMENTS):
        problems.append("manifest measurements drifted")
    listed = manifest.get("frozen_files")
    if not isinstance(listed, list):
        problems.append("manifest frozen_files missing")
    else:
        from_manifest = {
            str(item["path"]): str(item["sha256"])
            for item in listed
            if isinstance(item, dict)
        }
        problems.extend(f"manifest {item}" for item in hash_mismatches(expected, from_manifest))
    if problems:
        raise BenchmarkReject("; ".join(problems))


def write_manifest_files(cases: list[dict[str, Any]]) -> None:
    manifest = build_manifest(cases)
    digests = {item["path"]: item["sha256"] for item in manifest["frozen_files"]}
    HASHES_PATH.write_text(format_hashes(digests), encoding="utf-8")
    MANIFEST_PATH.write_text(
        json.dumps(manifest, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def _resolve_comparison_out(raw: str) -> Path:
    path = Path(raw)
    if not path.is_absolute():
        path = Path.cwd() / path
    resolved = path.resolve()
    try:
        relative = resolved.relative_to(REPO.resolve()).as_posix()
    except ValueError:
        relative = ""
    if relative in PROTECTED_WRITE_PATHS:
        raise BenchmarkReject(f"refusing to overwrite frozen harness file {relative}")
    return resolved


def _read_import(path_raw: str | None, *, kind: str) -> list[dict[str, Any]]:
    if path_raw is None:
        return []
    path = Path(path_raw)
    if not path.is_file():
        raise BenchmarkReject(f"missing {kind} import: {path}")
    return _load_jsonl(path)


def run_checked(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description=(
            "SPE benchmark and qualification harness. "
            "Missing measurements stay UNKNOWN and never become PASS."
        )
    )
    parser.add_argument(
        "--fixture-only",
        action="store_true",
        help="Validate frozen cases and emit UNKNOWN measurement slots. No network.",
    )
    parser.add_argument(
        "--format",
        choices=("text", "json"),
        default="text",
        help="Stdout format for a fixture or offline-record run.",
    )
    parser.add_argument(
        "--comparison-out",
        help="Write the raw-vs-SPE comparison JSON to this path.",
    )
    parser.add_argument(
        "--check-hashes",
        action="store_true",
        help="Recompute frozen-file hashes and compare them to the manifest.",
    )
    parser.add_argument(
        "--write-manifest",
        action="store_true",
        help="Rewrite hashes.sha256 and manifest.json from frozen inputs. Does not score cases.",
    )
    parser.add_argument("--import-observations", help="Offline observation JSONL to record.")
    parser.add_argument("--import-human-ratings", help="Offline human-rating JSONL to record.")
    parser.add_argument(
        "--subject",
        choices=("python-reference",),
        help=(
            "Call the frozen Python reference read-only and attach compiled prompts. "
            "Measurements stay UNKNOWN. This does not score PASS."
        ),
    )
    parser.add_argument(
        "--subject-trace-out",
        help="Write the python-reference capture trace JSON. Not a score file.",
    )
    parser.add_argument(
        "--live",
        action="store_true",
        help=argparse.SUPPRESS,
    )
    args = parser.parse_args(argv)

    if args.live:
        raise BenchmarkReject("live provider and browser runs are refused")
    if args.subject_trace_out and args.subject != "python-reference":
        raise BenchmarkReject("--subject-trace-out requires --subject python-reference")
    if args.subject and (args.import_observations or args.import_human_ratings):
        raise BenchmarkReject(
            "python-reference subject does not merge imported observations; measurements stay UNKNOWN"
        )
    if args.subject and args.write_manifest:
        raise BenchmarkReject("the manifest records frozen inputs and does not capture a subject")
    if args.write_manifest and (args.import_observations or args.import_human_ratings):
        raise BenchmarkReject("the manifest hashes frozen inputs and does not record imports")
    if (args.import_observations or args.import_human_ratings) and not args.fixture_only:
        raise BenchmarkReject("imports require --fixture-only; they still do not call providers")
    if not (args.fixture_only or args.check_hashes or args.write_manifest or args.subject):
        raise BenchmarkReject(
            "pass --fixture-only, --check-hashes, --write-manifest, or --subject python-reference. "
            "There is no live mode."
        )

    load_dataset()
    cases = load_cases()
    chunks: list[str] = []

    if args.write_manifest:
        write_manifest_files(cases)
        chunks.append("manifest_written=true\nscores_included=false\nmeasurement_default=UNKNOWN\n")

    if args.check_hashes or args.write_manifest:
        verify_frozen_hashes(cases)
        if args.check_hashes or not args.fixture_only:
            chunks.append(
                "hashes=OK\n"
                f"frozen_files={len(FROZEN_FILES)}\n"
                "measurement_default=UNKNOWN\n"
                "scores_included=false\n"
            )

    if args.fixture_only or args.subject:
        if args.subject:
            repo_path = str(REPO)
            if repo_path not in sys.path:
                sys.path.insert(0, repo_path)
            subject_mod = importlib.import_module("tools.spe_benchmark_python_subject")
            try:
                captures = subject_mod.invoke_cases(cases)
            except subject_mod.SubjectRefuse as exc:
                raise BenchmarkReject(str(exc)) from exc
            observations = subject_mod.observations_for(captures)
            human_rows = []
        else:
            captures = []
            observations = _read_import(args.import_observations, kind="observation")
            human_rows = _read_import(args.import_human_ratings, kind="human-rating")
        report = build_report(cases, observations, human_rows)
        if args.subject:
            attached = sum(1 for item in captures if item["prompt_attached"])
            absent = len(captures) - attached
            if args.format == "text":
                chunks.append(
                    "subject=python-reference\n"
                    "core_entry=spe_runtime.k3.selector.select_prompt_techniques\n"
                    f"subject_prompts_attached={attached}\n"
                    f"subject_prompts_absent={absent}\n"
                    "scores_claimed=false\n"
                )
            if args.subject_trace_out:
                trace = subject_mod.trace_document(captures, marked_pass_count=report["marked_pass_count"])
                rendered_trace = render_json(trace)
                if args.subject_trace_out == "-":
                    if args.format == "json":
                        raise BenchmarkReject("subject trace on stdout would mix with the JSON report")
                    chunks.append(rendered_trace)
                else:
                    destination = _resolve_comparison_out(args.subject_trace_out)
                    destination.parent.mkdir(parents=True, exist_ok=True)
                    destination.write_text(rendered_trace, encoding="utf-8")
        if args.format == "json":
            chunks.append(render_json(report))
        else:
            chunks.append(render_text(report))
        if args.comparison_out:
            comparison = report["comparison"]
            rendered = render_json(comparison)
            if args.comparison_out == "-":
                chunks.append(rendered)
            else:
                destination = _resolve_comparison_out(args.comparison_out)
                destination.parent.mkdir(parents=True, exist_ok=True)
                destination.write_text(rendered, encoding="utf-8")

    sys.stdout.write("".join(chunks))
    return 0


def main(argv: list[str] | None = None) -> int:
    try:
        return run_checked(argv)
    except BenchmarkReject as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
