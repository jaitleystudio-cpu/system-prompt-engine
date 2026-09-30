"""Qualify media R1 and score MR1-01 through MR1-20 on a green baseline.

Mutant patches are applied to a temporary copy of the media files, the
qualification tests are run, and the originals are restored. A red baseline
withholds the score. UNKNOWN is not a pass. The repair passes only when the
baseline has 0 failed tests and every mutant is killed.
"""

from __future__ import annotations

import ast
import importlib.util
import json
import re
import shutil
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
DONOR_SHA = "32f1ae20347ca728a6a7b062107289b64ed88eed"
MUTANT_TIMEOUT_S = 180
SCORE_TESTS = [
    "tests/unit/test_media_intelligence.py",
    "tests/unit/test_media_r1_qualification.py",
]


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
    output = _git("diff", "HEAD", "--name-only", "--", "spe_runtime", "portable", "schemas")
    names = [line for line in output.splitlines() if line]
    return [name for name in names if name.startswith(DONOR_PREFIXES)]


def _python() -> str:
    return str(PYTHON if PYTHON.is_file() else Path(sys.executable))


def _pytest_counts(stdout: str) -> dict[str, int]:
    failed = re.search(r"(\d+) failed", stdout)
    passed = re.search(r"(\d+) passed", stdout)
    return {
        "failed": int(failed.group(1)) if failed else 0,
        "passed": int(passed.group(1)) if passed else 0,
    }


def _run_pytest(tests: list[str], *, timeout: int | None = None) -> dict[str, object]:
    try:
        proc = subprocess.run(
            [_python(), "-m", "pytest", *tests, "-q", "--tb=line"],
            cwd=REPO,
            check=False,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
    except subprocess.TimeoutExpired as exc:
        stdout = exc.stdout if isinstance(exc.stdout, str) else ""
        stderr = exc.stderr if isinstance(exc.stderr, str) else ""
        return {
            "exit_code": None,
            "stdout": stdout,
            "stderr": stderr or "pytest timed out",
            "counts": {"failed": 0, "passed": 0},
            "timed_out": True,
        }
    return {
        "exit_code": proc.returncode,
        "stdout": proc.stdout,
        "stderr": proc.stderr,
        "counts": _pytest_counts(proc.stdout),
        "timed_out": False,
    }


def _purge_media_pycache() -> None:
    cache = REPO / "spe_runtime" / "media" / "__pycache__"
    if cache.is_dir():
        shutil.rmtree(cache)


def _score_mutant(mutant: dict[str, object]) -> dict[str, object]:
    """Run the green baseline against one in-place mutant, then restore."""
    backups: dict[Path, bytes] = {}
    texts: dict[Path, str] = {}
    mutant_id = str(mutant["id"])
    try:
        edits = mutant["edits"]
        if not isinstance(edits, list):
            raise RuntimeError("mutant edits must be a list")
        for edit in edits:
            if not isinstance(edit, dict):
                raise RuntimeError("mutant edit must be an object")
            path = REPO / str(edit["path"])
            if path not in backups:
                backups[path] = path.read_bytes()
            current = texts.get(path, backups[path].decode("utf-8"))
            old = str(edit["old"])
            if current.count(old) != 1:
                raise RuntimeError(f"{mutant_id} patch is not unique in {path}")
            texts[path] = current.replace(old, str(edit["new"]), 1)
        for path, text in texts.items():
            ast.parse(text, filename=str(path))
            path.write_text(text, encoding="utf-8")
        _purge_media_pycache()
        outcome = _run_pytest(list(QUALIFICATION_TESTS), timeout=MUTANT_TIMEOUT_S)
    except Exception as exc:
        return {
            "id": mutant_id,
            "fault": mutant["fault"],
            "verdict": "FAILED",
            "detail": str(exc),
        }
    finally:
        for path, data in backups.items():
            path.write_bytes(data)
        _purge_media_pycache()
    if outcome.get("timed_out"):
        verdict = "FAILED"
    elif outcome["exit_code"] == 0:
        verdict = "SURVIVED"
    else:
        verdict = "KILLED"
    return {
        "id": mutant_id,
        "fault": mutant["fault"],
        "verdict": verdict,
        "pytest_exit": outcome["exit_code"],
        "counts": outcome["counts"],
    }


def _descends_from_donor() -> bool:
    proc = subprocess.run(
        ["git", "merge-base", "--is-ancestor", DONOR_SHA, "HEAD"],
        cwd=REPO,
        check=False,
        capture_output=True,
        text=True,
    )
    return proc.returncode == 0


def main() -> int:
    mutants = _load_mutants()
    patch_results = [_apply_edits(mutant) for mutant in mutants]
    patches_ok = all(item["status"] == "APPLIES_IN_MEMORY" for item in patch_results)
    findings = _load_findings()
    pytest_result = _run_pytest(list(QUALIFICATION_TESTS))
    dirty = _donor_dirty()
    descends = _descends_from_donor()
    counts = pytest_result["counts"]
    baseline_green = (
        pytest_result["exit_code"] == 0
        and counts == {"failed": 0, "passed": counts["passed"]}
        and int(counts["passed"]) > 0
        and findings == []
        and not dirty
        and descends
        and patches_ok
    )
    score_rows: list[dict[str, object]] = []
    killed = 0
    survived = 0
    failed = 0
    if baseline_green:
        for mutant in mutants:
            row = _score_mutant(mutant)
            score_rows.append(row)
            verdict = row["verdict"]
            if verdict == "KILLED":
                killed += 1
            elif verdict == "SURVIVED":
                survived += 1
            else:
                failed += 1
        leaked = _donor_dirty()
        if leaked:
            failed += len(leaked)
            dirty = leaked
    mutation_pass = baseline_green and killed == 20 and survived == 0 and failed == 0
    if mutation_pass:
        final = "MEDIA_R1_REPAIR_PASS"
        mutation_score = "20/20"
        reason = "baseline failed=0 and MR1-01 through MR1-20 were killed"
        hold_reason = None
        exit_code = 0
    else:
        final = "HOLD"
        mutation_score = "WITHHELD" if not baseline_green else f"{killed} killed, {survived} survived, {failed} failed"
        if not descends:
            reason = "HEAD does not descend from the media donor"
        elif not patches_ok:
            reason = "a mutant patch is not unique; scoring is withheld"
        elif not baseline_green:
            reason = (
                "baseline qualification is red or the donor tree changed; "
                "a kill/survive count would be UNKNOWN and UNKNOWN is not a pass"
            )
        else:
            reason = (
                f"mutation score is {killed} killed, {survived} survived, {failed} failed; "
                "required 20 killed, 0 survived, 0 failed"
            )
        hold_reason = reason
        exit_code = 2 if patches_ok else 3
    proof = {
        "lane": "C2",
        "donor_sha": DONOR_SHA,
        "head": _git("rev-parse", "HEAD"),
        "branch": _git("branch", "--show-current"),
        "descends_from_donor": descends,
        "final": final,
        "hold_reason": hold_reason,
        "mutation_score": mutation_score,
        "mutation_reason": reason,
        "killed": killed if baseline_green else None,
        "survived": survived if baseline_green else None,
        "failed": failed if baseline_green else None,
        "mutants_defined": len(mutants),
        "mutant_ids": [str(mutant["id"]) for mutant in mutants],
        "score_rows": score_rows,
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
    print(
        f"patches_ok={patches_ok} findings={len(findings)} "
        f"pytest_exit={pytest_result['exit_code']} counts={counts} "
        f"killed={killed} survived={survived} failed={failed}"
    )
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
