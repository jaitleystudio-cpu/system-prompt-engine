"""I1: frozen Python reference is a read-only benchmark subject.

Compiled prompts may be attached. Missing prompts stay UNKNOWN.
No measurement is marked PASS.
"""

from __future__ import annotations

import ast
import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

from tools.run_spe_benchmark import REPO, UNKNOWN, build_report, load_cases
from tools.spe_benchmark_python_subject import (
    CORE_ENTRY,
    SubjectRefuse,
    assess_selection,
    case_to_protected,
    invoke_cases,
    observations_for,
)

HARNESS = REPO / "tools" / "run_spe_benchmark.py"
SUBJECT = REPO / "tools" / "spe_benchmark_python_subject.py"


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


def _statuses(report: dict, case_id: str, arm_id: str) -> dict[str, str]:
    for record in report["records"]:
        if record["case_id"] == case_id and record["arm_id"] == arm_id:
            return {name: slot["status"] for name, slot in record["measurements"].items()}
    raise AssertionError(f"missing record {case_id} {arm_id}")


def test_case_mapping_does_not_invent_category_or_score() -> None:
    case = next(item for item in load_cases() if item["case_id"] == "sbq-unknown-001")
    protected = case_to_protected(case)
    assert protected["goal"] == case["raw_prompt"]
    assert protected["hard_constraints"] == case["constraints"]
    assert protected["uncertainties"] == case["declared_unknowns"]
    assert "desired_output" not in protected
    assert "xcat_id" not in protected
    assert "score" not in protected


def test_absent_prompt_is_not_an_observation() -> None:
    capture = assess_selection(
        "sbq-intent-001",
        {"claims_pass": False, "prompt_effect_plan": {"claims_pass": False, "compiled_prompt": None}},
    )
    assert capture["prompt_attached"] is False
    assert observations_for([capture]) == []
    report = build_report(load_cases(), observations_for([capture]))
    assert report["marked_pass_count"] == 0
    record = next(
        item for item in report["records"] if item["case_id"] == "sbq-intent-001" and item["arm_id"] == "SPE"
    )
    assert record["spe_prompt"] == UNKNOWN


def test_core_claiming_pass_is_refused() -> None:
    with pytest.raises(SubjectRefuse, match="claims_pass"):
        assess_selection("sbq-intent-001", {"claims_pass": True, "prompt_effect_plan": {}})


def test_python_reference_attaches_prompts_without_scoring() -> None:
    cases = load_cases()
    captures = invoke_cases(cases)
    assert len(captures) == len(cases)
    assert all(item["claims_pass"] is False for item in captures)
    attached = [item for item in captures if item["prompt_attached"]]
    assert attached, "frozen Python reference returned no compiled prompt"
    report = build_report(cases, observations_for(captures))
    assert report["marked_pass_count"] == 0
    assert report["network_used"] is False
    assert report["provider_calls"] == 0
    assert report["harness_invented_scores"] is False
    for case in cases:
        spe = _statuses(report, case["case_id"], "SPE")
        raw = _statuses(report, case["case_id"], "RAW")
        assert all(status == UNKNOWN for status in spe.values())
        assert all(status == UNKNOWN for status in raw.values())
        raw_record = next(
            item for item in report["records"] if item["case_id"] == case["case_id"] and item["arm_id"] == "RAW"
        )
        assert raw_record["spe_prompt"] == UNKNOWN
    for capture in attached:
        case = next(item for item in cases if item["case_id"] == capture["case_id"])
        prompt = capture["spe_prompt"]
        assert isinstance(prompt, str)
        assert f"## Objective\n{case['raw_prompt']}" in prompt
        for constraint in case["constraints"]:
            assert constraint in prompt
        for unknown in case["declared_unknowns"]:
            assert unknown in prompt
        pair = next(item for item in report["comparison"]["pairs"] if item["case_id"] == case["case_id"])
        assert pair["raw_prompt"] == case["raw_prompt"]
        assert pair["spe_prompt"] == prompt
        assert pair["spe_prompt"] != pair["raw_prompt"]


def test_subject_cli_is_deterministic_and_not_a_pass(tmp_path: Path) -> None:
    trace = tmp_path / "trace.json"
    first = _run("--subject", "python-reference", "--format", "json", "--subject-trace-out", str(trace))
    second = _run("--subject", "python-reference", "--format", "json")
    assert first.returncode == 0, first.stderr
    assert second.returncode == 0, second.stderr
    assert first.stdout == second.stdout
    payload = json.loads(first.stdout)
    assert payload["marked_pass_count"] == 0
    assert payload["mode"] == "offline-record"
    assert payload["provider_calls"] == 0
    document = json.loads(trace.read_text(encoding="utf-8"))
    assert document["subject"] == "python-reference"
    assert document["core_entry"] == CORE_ENTRY
    assert document["scores_emitted"] is False
    assert document["marked_pass_count"] == 0
    assert document["prompts_attached"] >= 1
    assert document["network_used"] is False
    assert all(item["claims_pass"] is False for item in document["captures"])


def test_subject_module_is_the_only_runtime_importer() -> None:
    runner = ast.parse(HARNESS.read_text(encoding="utf-8"))
    imported: set[str] = set()
    for node in ast.walk(runner):
        if isinstance(node, ast.Import):
            imported.update(alias.name.split(".")[0] for alias in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module:
            imported.add(node.module.split(".")[0])
    assert "spe_runtime" not in imported
    subject = ast.parse(SUBJECT.read_text(encoding="utf-8"))
    subject_imports: set[str] = set()
    for node in ast.walk(subject):
        if isinstance(node, ast.Import):
            subject_imports.update(alias.name.split(".")[0] for alias in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module:
            subject_imports.add(node.module)
    runtime = {name for name in subject_imports if name == "spe_runtime" or name.startswith("spe_runtime.")}
    assert runtime == {"spe_runtime.k3.selector"}
    assert subject_imports.isdisjoint({"urllib", "socket", "requests", "http"})
