#!/usr/bin/env python3
"""SPE-R9-E repair — mutation gate for runtime journey observation hooks.

Copies spe_runtime + the hook tests into a temp dir, applies one deliberate
defect at a time to spe_runtime/journey_observation.py (or a wiring file), and
requires tests/unit/test_r9e_journey_observation.py plus
tests/unit/test_r9e_authority_separation.py to FAIL. The authority mutants
restore runtime self-promotion of PRODUCT_MEDIA_V1. Production source
is never modified. Builder regression only — not qualification.

Usage: python tests/unit/r9e_journey_mutations.py
"""

from __future__ import annotations

import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
OBS = "spe_runtime/journey_observation.py"
MUTANTS: list[tuple[str, str, str, str]] = [
    ("accept-preseeded-as-fresh", OBS,
     'gate("PACK_ABSENT_BEFORE_PROVISION", CONTRADICTED, "PRESEEDED_REPORTED_AS_FRESH")\n        if any(',
     'pass\n        if any('),
    ("ignore-digest-mismatch", OBS,
     'if d.get("sha256") != pins.get("model_sha256") or d.get("digest_ok") is not True:',
     'if False:'),
    ("accept-failed-cli-build", OBS,
     'if d.get("result") != "OK":', 'if False:'),
    ("accept-false-local-neural", OBS,
     'if d.get("mode") == "LOCAL_NEURAL" and d.get("neural_session_ran") is not True:\n                gate("LOCAL_INFERENCE", CONTRADICTED, "FALSE_LOCAL_NEURAL")\n            if d.get("neural_session_ran") is not True:',
     'if False:\n                pass\n            if False:'),
    ("accept-nonzero-egress", OBS,
     'if not isinstance(count, int) or count != 0:', 'if False:'),
    ("accept-temp-media-remaining", OBS,
     'if (not isinstance(remaining, int) or remaining != 0) or d.get("upload_removed") is False:', 'if False:'),
    ("browser-journey-implied-by-runtime", OBS,
     'if not isinstance(browser_evidence, Mapping) or browser_evidence.get("executed") is not True:\n        gate("BROWSER_JOURNEY", MISSING, "BROWSER_JOURNEY_NOT_EXECUTED")\n    elif',
     'if False:\n        pass\n    elif not isinstance(browser_evidence, Mapping):\n        gate("BROWSER_JOURNEY", OBSERVED)\n    elif'),
    ("accept-stale-candidate", OBS,
     'gate("CANDIDATE_BINDING", CONTRADICTED, "STALE_CANDIDATE")', 'gate("CANDIDATE_BINDING", OBSERVED)'),
    ("allow-writer-self-promotion", OBS,
     'if stamp_value != spec["hold_value"]:\n        promo = True', 'if False:\n        promo = True'),
    ("writer-may-record-promotion-fields", OBS,
     'raise ValueError(f"WRITER_PROMOTION_FIELD_REFUSED:{key}")', 'pass'),
    ("assessment-emits-pass-when-complete", OBS,
     '"verdict": spec["hold_value"],', '"verdict": "PASS" if not blocking else spec["hold_value"],'),
    ("media-owner-skips-pack-state", "spe_runtime/media_product/local_backend.py",
     'JOURNEY_OBSERVER.record(\n            "PACK_STATE",', 'JOURNEY_OBSERVER.record(\n            "PROCESS_START",'),
    # Authority separation: the writer must never promote PRODUCT_MEDIA_V1.
    ("restore-gates-gap-none-pass", "spe_runtime/media_product/local_backend.py",
     '    verdict = "NOT_PASS"\n    runtime_journey =',
     '    verdict = "NOT_PASS"\n    if gap == "NONE":\n        verdict = "PASS"\n    runtime_journey ='),
    ("restore-commit-return-pass", "spe_runtime/media_product/local_backend.py",
     'return "NOT_PASS", INDEPENDENT_VERIFICATION_REQUIRED, False',
     'return "PASS", "NONE", True'),
    ("route-host-health-reports-pass", "spe_runtime/media_product/route_host.py",
     '"productMediaV1": gates["PRODUCT_MEDIA_V1"],',
     '"productMediaV1": "PASS" if gates["RUNTIME_JOURNEY"] == "COMPLETE" else gates["PRODUCT_MEDIA_V1"],'),
    ("route-host-logs-pass", "spe_runtime/media_product/route_host.py",
     'f"RUNTIME_JOURNEY COMPLETE PRODUCT_MEDIA_V1 {verdict} remainingGap={gap} writerPromoted=false",',
     'f"RUNTIME_JOURNEY COMPLETE PRODUCT_MEDIA_V1 PASS remainingGap={gap} writerPromoted=false",'),
]
TESTS = ["tests/unit/test_r9e_journey_observation.py", "tests/unit/test_r9e_authority_separation.py"]


def main() -> int:
    survived: list[str] = []
    for name, rel, needle, replacement in MUTANTS:
        tmp = Path(tempfile.mkdtemp(prefix="spe-r9e-mut-"))
        try:
            shutil.copytree(REPO / "spe_runtime", tmp / "spe_runtime", ignore=shutil.ignore_patterns("__pycache__"))
            (tmp / "tests" / "unit").mkdir(parents=True)
            for test in TESTS:
                shutil.copy2(REPO / test, tmp / "tests/unit/")
            (tmp / "apps/web/src/media").mkdir(parents=True)
            for ui in ("MediaRoute.tsx", "mount-contract.ts"):
                shutil.copy2(REPO / "apps/web/src/media" / ui, tmp / "apps/web/src/media/")
            (tmp / "media-pack").mkdir()
            shutil.copy2(REPO / "media-pack/PACK_MANIFEST.json", tmp / "media-pack/")
            target = tmp / rel
            source = target.read_text(encoding="utf-8")
            if source.count(needle) != 1:
                print(f"ANCHOR_MISSING: {name}")
                return 2
            target.write_text(source.replace(needle, replacement), encoding="utf-8")
            proc = subprocess.run(
                [sys.executable, "-m", "pytest", "-q", "-x", "-p", "no:cacheprovider", *TESTS],
                cwd=tmp, capture_output=True, text=True, env={"PYTHONPATH": str(tmp), "PATH": "/usr/bin:/bin"},
            )
            if proc.returncode == 0:
                survived.append(name)
                print(f"SURVIVED: {name}")
            elif "AssertionError" not in proc.stdout and "assert" not in proc.stdout and "DID NOT RAISE" not in proc.stdout:
                survived.append(name)
                print(f"DIED_FOR_WRONG_REASON: {name}\n{proc.stdout[-1500:]}")
            else:
                print(f"KILLED: {name}")
        finally:
            shutil.rmtree(tmp, ignore_errors=True)
    print(f"{len(MUTANTS) - len(survived)}/{len(MUTANTS)} R9-E journey-hook mutants killed")
    return 1 if survived else 0


if __name__ == "__main__":
    raise SystemExit(main())
