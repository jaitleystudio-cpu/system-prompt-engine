#!/usr/bin/env python3
"""Time the real selector → effect plan → from_k3 → one reconstruction check.

This is not a marketed score. It reports the path that was actually executed.
"""

from __future__ import annotations

import json
import platform
import statistics
import time

from spe_runtime.k3.selector import select_prompt_techniques
from spe_runtime.quality.engine import evaluate_from_k3, reconstruct, subject_from_k3

PROTECTED = {
    "goal": "Ship the note",
    "hard_constraints": [{"constraint_id": "c1", "statement": "Do not invent facts", "strength": "HARD"}],
    "budget": None,
    "desired_output": "a short note",
    "facts": [{"fact_id": "f1", "statement": "The user asked for a note"}],
    "authority_state": {"level": 0, "status": "NONE", "grants": []},
    "provenance": [{"provenance_id": "p1", "source": "user"}],
}
CATEGORY = {"xcat_id": "CAT:C01"}
N = 100


def once() -> None:
    k3 = select_prompt_techniques(PROTECTED, CATEGORY, {})
    plan = k3.get("prompt_effect_plan") or {}
    compiled = plan.get("compiled_prompt") if isinstance(plan.get("compiled_prompt"), str) else ""
    subject = subject_from_k3(k3, compiled)
    evaluate_from_k3(
        {
            "compiled_prompt": compiled,
            "k3_output": k3,
            "mode": "VALIDATE_ONLY",
            "op": "from_k3",
            "spe_api": "quality",
        }
    )
    reconstruct(subject)


def main() -> None:
    samples = []
    for _ in range(N):
        start = time.perf_counter()
        once()
        samples.append((time.perf_counter() - start) * 1000)
    samples.sort()
    report = {
        "path": "ProtectedIntent → Requirement Graph → XCAT → K3 → Effect Plan → render → from_k3 VALIDATE_ONLY → one reconstruction check",
        "n": N,
        "median_ms": statistics.median(samples),
        "p95_ms": samples[min(len(samples) - 1, int(0.95 * (len(samples) - 1)))],
        "max_ms": max(samples),
        "machine": platform.platform(),
        "python": platform.python_version(),
    }
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
