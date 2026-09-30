"""Qualify the media donor and withhold mutation scores when the baseline is red.

The donor tree is read only. Mutant patches are applied in memory and parsed.
They are not written back and they are not scored while a qualification test fails.
UNKNOWN is not a pass.
"""

from __future__ import annotations

import ast
import importlib.util
import json
import subprocess
import sys
from pathlib import Path


REPO = Path(__file__).resolve().parents[2]
PROOF_PATH = REPO / "proof" / "media-r1" / "c2-media-r1-evidence.json"
PYTHON = REPO / ".venv" / "bin" / "python"
MUTANTS_PATH = Path(__file__).resolve().parent / "media_r1_mutants.py"
QUALIFICATION_TESTS = [
    "tests/unit/test_media_intelligence.py",
    "tests/unit/test_media_r1_qualification.py",
    "tests/web/test_v1_media_and_lab.py",
]
DONOR_PREFIXES = ("spe_runtime/", "portable/", "schemas/")


def _load_mutants() -> list[dict[str, object]]:
    spec = importlib.util.spec_from_file_location("media_r1_mutants", MUTANTS_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError("media mutant module is missing")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    mutants = module.MUTANTS
    if len(mutants) < 20:
        raise RuntimeError(f"expected at least 20 mutants, found {len(mutants)}")
    return list(mutants)


def _load_findings() -> list[dict[str, object]]:
    repo = str(REPO)
    if repo not in sys.path:
        sys.path.insert(0, repo)
    path = REPO / "tests" / "unit" / "test_media_r1_qualification.py"
    spec = importlib.util.spec_from_file_location("media_r1_qualification", path)
    if spec is None or spec.loader is None:
        raise RuntimeError("qualification module is missing")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return list(module.malformed_explicit_need_findings())


def _apply_edits(mutant: dict[str, object]) -> dict[str, object]:
    texts: dict[str, str] = {}
    applied: list[dict[str, object]] = []
    edits = mutant["edits"]
    if not isinstance(edits, list):
        raise RuntimeError("mutant edits must be a list")
    for edit in edits:
        if not isinstance(edit, dict):
            raise RuntimeError("mutant edit must be an object")
        relative = str(edit["path"])
        if not relative.startswith("spe_runtime/media/"):
            raise RuntimeError(f"mutant path escapes media foundation: {relative}")
        if relative not in texts:
            texts[relative] = (REPO / relative).read_text(encoding="utf-8")
        old = str(edit["old"])
        new = str(edit["new"])
        count = texts[relative].count(old)
        if count != 1:
            return {
                "id": mutant["id"],
                "fault": mutant["fault"],
                "status": "PATCH_NOT_UNIQUE",
                "path": relative,
                "count": count,
            }
        texts[relative] = texts[relative].replace(old, new, 1)
        applied.append({"path": relative, "changed": True})
    for relative, text in texts.items():
        ast.parse(text, filename=relative)
    return {
        "id": mutant["id"],
        "fault": mutant["fault"],
        "status": "APPLIES_IN_MEMORY",
        "files": sorted(texts),
        "edits": len(applied),
    }


def _git(*args: str) -> str:
    proc = subprocess.run(
        ["git", *args],
        cwd=REPO,
        check=False,
        capture_output=True,
        text=True,
    )
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr.strip() or f"git {' '.join(args)} failed")
    return proc.stdout.strip()


def _donor_dirty() -> list[str]:
    output = _git("diff", "--name-only", "--", "spe_runtime", "portable", "schemas")
    names = [line for line in output.splitlines() if line]
    return [name for name in names if name.startswith(DONOR_PREFIXES)]


def _run_pytest() -> dict[str, object]:
    python = str(PYTHON if PYTHON.is_file() else Path(sys.executable))
    proc = subprocess.run(
        [python, "-m", "pytest", *QUALIFICATION_TESTS, "-q", "--tb=short"],
        cwd=REPO,
        check=False,
        capture_output=True,
        text=True,
    )
    return {
        "exit_code": proc.returncode,
        "stdout": proc.stdout,
        "stderr": proc.stderr,
    }


def main() -> int:
    mutants = _load_mutants()
    patch_results = [_apply_edits(mutant) for mutant in mutants]
    patches_ok = all(item["status"] == "APPLIES_IN_MEMORY" for item in patch_results)
    findings = _load_findings()
    pytest_result = _run_pytest()
    dirty = _donor_dirty()
    baseline_green = pytest_result["exit_code"] == 0 and findings == [] and not dirty
    final = "HOLD"
    mutation_score = "WITHHELD"
    if not patches_ok:
        reason = "a mutant patch is not unique; scoring is withheld"
    elif not baseline_green:
        reason = (
            "baseline qualification is red or the donor tree changed; "
            "a kill/survive count would be UNKNOWN and UNKNOWN is not a pass"
        )
    else:
        reason = (
            "baseline is green and mutant patches apply, but this harness "
            "does not execute mutants; survived stays UNKNOWN"
        )
    proof = {
        "lane": "C2",
        "donor_sha": _git("rev-parse", "HEAD"),
        "branch": _git("branch", "--show-current"),
        "final": final,
        "hold_reason": None
        if final == "MEDIA_R1_QUALIFICATION_PASS"
        else (
            "Raw video retention accepts non-boolean explicitly_needed. "
            "bool('false') is True, so retention ON is stored and the compiled "
            "contract schema-validates as explicitly_needed true."
        ),
        "mutation_score": mutation_score,
        "mutation_reason": reason,
        "killed": None,
        "survived": None,
        "mutants_defined": len(mutants),
        "mutant_ids": [str(mutant["id"]) for mutant in mutants],
        "patches_ok": patches_ok,
        "patches": patch_results,
        "malformed_explicit_need_findings": findings,
        "pytest": pytest_result,
        "donor_runtime_dirty": dirty,
        "stt_implemented": "NO",
        "video_model_implemented": "NO",
        "semantic_authority": "NONE",
    }
    PROOF_PATH.parent.mkdir(parents=True, exist_ok=True)
    PROOF_PATH.write_text(json.dumps(proof, indent=2) + "\n", encoding="utf-8")
    print(f"final={final} mutation_score={mutation_score} proof={PROOF_PATH}")
    print(f"patches_ok={patches_ok} findings={len(findings)} pytest_exit={pytest_result['exit_code']}")
    if not patches_ok:
        return 3
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
