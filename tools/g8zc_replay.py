"""G8-ZC hermetic full-system replay — zero-cost offline custody pack.

Replays a frozen golden corpus through compile → .spe → reload and verifies
content digests / artifact ids. Does NOT mint K7 INDEPENDENTLY_REPLICATED.
Does NOT claim World #1.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from spe_runtime.contract import ProtectedIntentContract, propose_requirement
from spe_runtime.core import compile_and_persist_spe, compile_portable_request
from spe_runtime.error_registry import ErrorCode, SpeTypedError
from spe_runtime.prompt import build_prompt_artifact
from spe_runtime.provenance import Provenance
from spe_runtime.requirements import RequirementKind
from spe_runtime.storage import load_spe

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CORPUS = ROOT / "benchmarks" / "g8zc" / "golden_corpus.json"


@dataclass(frozen=True)
class TaskResult:
    task_id: str
    ok: bool
    detail: str


def corpus_sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _kwargs(task: dict[str, Any]) -> dict[str, Any]:
    return {
        "must": tuple(task.get("must") or ()),
        "must_not": tuple(task.get("must_not") or ()),
        "should": tuple(task.get("should") or ()),
        "preferences": tuple(task.get("preferences") or ()),
        "context_blocks": task.get("context"),
    }


def replay_success(task: dict[str, Any], work: Path) -> TaskResult:
    tid = task["id"]
    kw = _kwargs(task)
    r = compile_portable_request(task["goal"], **kw)
    if r.prompt_artifact.prompt_content_digest != task["prompt_content_digest"]:
        return TaskResult(tid, False, "prompt_content_digest mismatch")
    spe_path = work / f"{tid}.spe"
    r2 = compile_and_persist_spe(task["goal"], spe_path, **kw)
    if r2.spe_artifact is None or r2.spe_artifact.artifact_id != task["spe_artifact_id"]:
        return TaskResult(tid, False, "spe_artifact_id mismatch on persist")
    loaded = load_spe(spe_path)
    if loaded.artifact_id != task["spe_artifact_id"]:
        return TaskResult(tid, False, "spe_artifact_id mismatch on reload")
    # second independent compile path
    r3 = compile_portable_request(task["goal"], **kw)
    if r3.prompt_artifact.prompt_content_digest != task["prompt_content_digest"]:
        return TaskResult(tid, False, "second compile digest drift")
    return TaskResult(tid, True, "replay_match")


def replay_invalid(task: dict[str, Any]) -> TaskResult:
    tid = task["id"]
    try:
        compile_portable_request(task["goal"], **_kwargs(task))
        return TaskResult(tid, False, "expected SpeTypedError")
    except SpeTypedError as e:
        expected = task.get("error_code")
        if expected and e.code.name != expected:
            return TaskResult(tid, False, f"error_code {e.code.name} != {expected}")
        return TaskResult(tid, True, e.code.name)


def replay_conflict(task: dict[str, Any]) -> TaskResult:
    """Same semantic_key MUST + MUST_NOT → CONFLICTED → prompt build fail-closed."""
    tid = task["id"]
    key = task["semantic_key"]
    value = task["value"]
    c = ProtectedIntentContract()
    c = propose_requirement(
        c,
        semantic_key=key,
        kind=RequirementKind.MUST,
        value=value,
        provenance=Provenance.USER_EXPLICIT,
        source_ref="g8.must",
    )
    c = propose_requirement(
        c,
        semantic_key=key,
        kind=RequirementKind.MUST_NOT,
        value=value,
        provenance=Provenance.USER_EXPLICIT,
        source_ref="g8.must_not",
    )
    from spe_runtime.contract import ContractValidity

    if str(c.validity) != "ContractValidity.CONFLICTED" and c.validity.value != "CONFLICTED":
        # tolerate enum compare
        if c.validity is not ContractValidity.CONFLICTED:
            return TaskResult(tid, False, f"validity={c.validity}")
    try:
        build_prompt_artifact(c)
        return TaskResult(tid, False, "expected conflict fail-closed")
    except SpeTypedError as e:
        if e.code is not ErrorCode.K3_PROMPT_CONFLICTED_SOURCE:
            return TaskResult(tid, False, f"code={e.code}")
        return TaskResult(tid, True, e.code.name)


def run_corpus(corpus_path: Path) -> dict[str, Any]:
    data = json.loads(corpus_path.read_text(encoding="utf-8"))
    results: list[TaskResult] = []
    with tempfile.TemporaryDirectory(prefix="g8zc-") as td:
        work = Path(td)
        for task in data["tasks"]:
            expect = task["expect"]
            if expect == "success":
                results.append(replay_success(task, work))
            elif expect == "invalid":
                results.append(replay_invalid(task))
            elif expect == "conflict":
                results.append(replay_conflict(task))
            else:
                results.append(TaskResult(task["id"], False, f"unknown expect={expect}"))
    passed = sum(1 for r in results if r.ok)
    failed = [r for r in results if not r.ok]
    return {
        "corpus": str(corpus_path),
        "corpus_sha256": corpus_sha256(corpus_path),
        "total": len(results),
        "passed": passed,
        "failed": len(failed),
        "failures": [{"id": r.task_id, "detail": r.detail} for r in failed],
        "exit": 0 if not failed else 1,
        "claim_note": (
            "Hermetic local full-system replay within tested corpus — "
            "NOT K7 INDEPENDENTLY_REPLICATED / NOT World #1"
        ),
    }


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="G8-ZC hermetic SPE core replay")
    p.add_argument("--corpus", type=Path, default=DEFAULT_CORPUS)
    p.add_argument("--json-out", type=Path, default=None)
    args = p.parse_args(argv)
    report = run_corpus(args.corpus)
    text = json.dumps(report, indent=2) + "\n"
    if args.json_out:
        args.json_out.parent.mkdir(parents=True, exist_ok=True)
        args.json_out.write_text(text, encoding="utf-8")
    sys.stdout.write(text)
    return int(report["exit"])


if __name__ == "__main__":
    raise SystemExit(main())
