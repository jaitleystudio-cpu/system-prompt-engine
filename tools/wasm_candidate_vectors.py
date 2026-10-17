#!/usr/bin/env python3
"""Run the 55+55 conformance vectors against an explicit WASM candidate.

Does not build, does not call ensure_wasm_artifact, and does not read or
write apps/web/public. The artifact path is the only WASM input.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any

_REPO_ROOT = Path(__file__).resolve().parents[1]
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

from tools.sprint5_conformance import (
    REPO,
    compare_protected,
    load_reference_cases,
    protected_drift,
    run_python_reference_case,
    run_rust_case,
    wasm_node_host_path,
)

REQUIRED_EXPORTS = ("memory", "spe_alloc", "spe_evaluate", "spe_free")


def _inspect(artifact: Path) -> dict[str, Any]:
    script = r"""
const fs = require("fs");
WebAssembly.compile(fs.readFileSync(process.argv[1])).then((mod) => {
  const imports = WebAssembly.Module.imports(mod).map((item) => item.module + "." + item.name);
  const exports = WebAssembly.Module.exports(mod).map((item) => item.name).sort();
  process.stdout.write(JSON.stringify({ imports, exports }));
}).catch((error) => {
  process.stderr.write(String(error && error.stack || error));
  process.exit(1);
});
"""
    proc = subprocess.run(
        [shutil.which("node") or "node", "-e", script, str(artifact)],
        capture_output=True,
        text=True,
        check=False,
    )
    if proc.returncode != 0:
        raise RuntimeError(f"WASM_INSPECT_FAILED: {proc.stderr}")
    return json.loads(proc.stdout)


def _run_wasm(artifact: Path, case: dict[str, Any]) -> dict[str, Any]:
    host = wasm_node_host_path()
    payload = case.get("raw") or case
    proc = subprocess.run(
        [shutil.which("node") or "node", str(host), str(artifact)],
        input=json.dumps(payload, ensure_ascii=False),
        capture_output=True,
        text=True,
        check=False,
    )
    if proc.returncode != 0:
        raise RuntimeError(
            f"WASM_RUNTIME_FAILED id={case.get('fixture_id')} rc={proc.returncode} stderr={proc.stderr!r}"
        )
    result = json.loads(proc.stdout)
    if not isinstance(result, dict):
        raise RuntimeError("WASM_RUNTIME_NON_OBJECT")
    return result


def evaluate(artifact: Path) -> dict[str, Any]:
    digest = hashlib.sha256(artifact.read_bytes()).hexdigest()
    inspected = _inspect(artifact)
    positives = load_reference_cases("positive")
    negatives = load_reference_cases("negative")
    summary: dict[str, Any] = {
        "bytes": artifact.stat().st_size,
        "sha256": digest,
        "imports": inspected["imports"],
        "exports": inspected["exports"],
        "positive_count": len(positives),
        "negative_count": len(negatives),
        "semantic_mismatches": 0,
        "runtime_errors": 0,
        "python_rust_mismatches": 0,
        "rust_wasm_mismatches": 0,
        "python_wasm_mismatches": 0,
        "negative_reason_mismatches": 0,
        "authority_mismatches": 0,
        "protocol_mismatches": 0,
        "mismatch_ids": [],
    }
    missing = [name for name in REQUIRED_EXPORTS if name not in inspected["exports"]]
    if inspected["imports"] or missing:
        summary["runtime_errors"] += 1
        summary["mismatch_ids"].append("module-surface")

    def _note(fixture_id: str, kind: str) -> None:
        summary["semantic_mismatches"] += 1
        summary["mismatch_ids"].append(f"{fixture_id}:{kind}")

    for case in positives:
        fixture_id = case["fixture_id"]
        try:
            py = run_python_reference_case(case)
            rs = run_rust_case(case)
            wasm = _run_wasm(artifact, case)
        except (RuntimeError, json.JSONDecodeError) as exc:
            summary["runtime_errors"] += 1
            summary["mismatch_ids"].append(f"{fixture_id}:runtime:{exc}")
            continue
        if not compare_protected(py, rs):
            summary["python_rust_mismatches"] += 1
            _note(fixture_id, "python-rust")
        if not compare_protected(rs, wasm):
            summary["rust_wasm_mismatches"] += 1
            _note(fixture_id, "rust-wasm")
        if not compare_protected(py, wasm):
            summary["python_wasm_mismatches"] += 1
            _note(fixture_id, "python-wasm")
        drift = protected_drift(py, wasm)
        if drift.get("authority"):
            summary["authority_mismatches"] += 1
        if drift.get("operation_id"):
            summary["protocol_mismatches"] += 1
        if wasm.get("status") != "VALID":
            _note(fixture_id, "status")

    for case in negatives:
        fixture_id = case["fixture_id"]
        expected = (case.get("expected") or {}).get("reason_code")
        try:
            py = run_python_reference_case(case)
            rs = run_rust_case(case)
            wasm = _run_wasm(artifact, case)
        except (RuntimeError, json.JSONDecodeError) as exc:
            summary["runtime_errors"] += 1
            summary["mismatch_ids"].append(f"{fixture_id}:runtime:{exc}")
            continue
        reasons = {
            "python": py.get("reason_code"),
            "rust": rs.get("reason_code"),
            "wasm": wasm.get("reason_code"),
        }
        if reasons["python"] != expected or reasons["rust"] != expected or reasons["wasm"] != expected:
            summary["negative_reason_mismatches"] += 1
            _note(fixture_id, "reason")
        if reasons["python"] != reasons["rust"]:
            summary["python_rust_mismatches"] += 1
        if reasons["rust"] != reasons["wasm"]:
            summary["rust_wasm_mismatches"] += 1
        if reasons["python"] != reasons["wasm"]:
            summary["python_wasm_mismatches"] += 1
        if wasm.get("disposition") != "INVALID" or rs.get("disposition") != "INVALID" or py.get("disposition") != "INVALID":
            _note(fixture_id, "disposition")

    summary["pass"] = (
        summary["positive_count"] == 55
        and summary["negative_count"] == 55
        and summary["semantic_mismatches"] == 0
        and summary["runtime_errors"] == 0
        and summary["python_rust_mismatches"] == 0
        and summary["rust_wasm_mismatches"] == 0
        and summary["python_wasm_mismatches"] == 0
        and summary["negative_reason_mismatches"] == 0
        and summary["imports"] == []
    )
    summary["repo"] = str(REPO)
    return summary


def main() -> int:
    parser = argparse.ArgumentParser(description="Evaluate one explicit SPE WASM candidate")
    parser.add_argument("artifact", type=Path)
    parser.add_argument("--out", type=Path, default=None)
    args = parser.parse_args()
    artifact = args.artifact.resolve()
    if not artifact.is_file():
        print(f"missing artifact: {artifact}", file=sys.stderr)
        return 1
    summary = evaluate(artifact)
    # Drop the absolute repo path from machine-readable output used in proofs.
    public = {key: value for key, value in summary.items() if key != "repo"}
    text = json.dumps(public, indent=2, sort_keys=True) + "\n"
    if args.out:
        args.out.write_text(text, encoding="utf-8")
    sys.stdout.write(text)
    return 0 if summary["pass"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
