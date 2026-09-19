#!/usr/bin/env python3
"""Verify the SPE Ω v2.4.1 G9 release-custody pack.

Verifies recorded evidence hashes. Does NOT silently re-run pytest,
rewrite evidence, or mint World #1 / INDEPENDENTLY_REPLICATED claims.

Exit 0 = custody pack consistent.
Exit 1 = verification failure.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "proofs/g9zc/QUALIFICATION_MANIFEST.json"
MANIFEST_SHA = ROOT / "proofs/g9zc/QUALIFICATION_MANIFEST.sha256"
INTEGRITY = ROOT / "proofs/g9zc/INTEGRITY.json"
SOURCE_ID = ROOT / "proofs/g9zc/source_identity.json"
BASELINE_DOC = ROOT / "proofs/g9zc/RELEASE_BOUNDARY.md"

EXPECTED_CONTRACT = "68bac38afe3f38e85da38a359ed482ace07166fbf64c2d89dca3e499e41424f3"
EXPECTED_G2 = "15b20a8532d3375c2d59dc8608c9c8854ff5ec7ecfcdefdb32902f0e6127e562"
EXPECTED_PR6 = "4e6c694b5d8b9379c5acfbaac416dcfa89b1768e"
FORBIDDEN_PATHS = ["spe_runtime/omega"]
FORBIDDEN_CLAIMS = {
    "WORLD_1",
    "WORLD_1_PROVEN",
    "INDEPENDENTLY_REPLICATED",
    "PRODUCTION_READY",
}


class Failures(list):
    def check(self, cond: bool, msg: str) -> None:
        if not cond:
            self.append(msg)

    def ok(self, msg: str) -> None:
        print(f"  PASS  {msg}")


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.parse_args()

    fails = Failures()
    print("SPE Ω v2.4.1 — G9 release-custody verifier")
    print("mode: verify_recorded_evidence_only (no pytest rerun)")
    print()

    for p in (MANIFEST, MANIFEST_SHA, INTEGRITY, SOURCE_ID, BASELINE_DOC):
        fails.check(p.is_file(), f"missing {p.relative_to(ROOT)}")
    if fails:
        for f in fails:
            print(f"  FAIL  {f}")
        return 1
    fails.ok("pack files present")

    got_man = sha256_file(MANIFEST)
    exp_man = MANIFEST_SHA.read_text(encoding="utf-8").strip()
    fails.check(got_man == exp_man, f"manifest sha mismatch {got_man} != {exp_man}")
    if got_man == exp_man:
        fails.ok("QUALIFICATION_MANIFEST.sha256 matches")

    man = json.loads(MANIFEST.read_text(encoding="utf-8"))
    integ = json.loads(INTEGRITY.read_text(encoding="utf-8"))

    fails.check(
        man["custody"]["working_contract_sha256"] == EXPECTED_CONTRACT,
        "contract sha drift in manifest",
    )
    fails.check(
        man["custody"]["g2_model_sha256"] == EXPECTED_G2,
        "g2 sha drift in manifest",
    )
    fails.check(
        man["custody"]["pr6_head"].startswith(EXPECTED_PR6[:7]),
        "pr6 tip drift",
    )
    fails.check(integ.get("world_1") == "NOT_PROVEN", "integrity must declare World #1 NOT_PROVEN")
    fails.check(
        integ.get("manifest_sha256") == exp_man,
        "INTEGRITY.manifest_sha256 mismatch",
    )

    # evidence file hashes
    for rel, expected in man.get("evidence_files_sha256", {}).items():
        path = ROOT / rel
        fails.check(path.is_file(), f"missing evidence {rel}")
        if path.is_file():
            got = sha256_file(path)
            fails.check(got == expected, f"hash drift {rel}")
    fails.ok(f"evidence hashes checked ({len(man.get('evidence_files_sha256', {}))})")

    # forbidden claims must remain listed as forbidden
    forbidden = set(man.get("exact_forbidden_claims", []))
    for c in FORBIDDEN_CLAIMS:
        fails.check(c in forbidden, f"forbidden claim missing from pack: {c}")
    fails.ok("forbidden claims retained (incl. WORLD_1)")

    # earned must not include forbidden
    earned = set(man.get("exact_earned_claims", []))
    overlap = earned & FORBIDDEN_CLAIMS
    fails.check(not overlap, f"earned overlaps forbidden: {overlap}")

    # omega must not exist
    for fp in FORBIDDEN_PATHS:
        fails.check(not (ROOT / fp).exists(), f"forbidden path present: {fp}")
    fails.ok("no spe_runtime/omega/")

    # gate ladder present
    gates = man.get("gates", {})
    for g in ("G1", "G5", "G7", "G8", "G9"):
        fails.check(g in gates, f"missing gate {g}")
    fails.ok("gate ladder G1–G9 present")

    if fails:
        print()
        print("VERDICT: FAIL")
        for f in fails:
            print(f"  FAIL  {f}")
        return 1

    print()
    print("VERDICT: PASS")
    print("claim: ZERO_COST_STACK_CUSTODY_PACKAGED_WITHIN_TESTED_SCOPE")
    print("World #1: NOT_PROVEN")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
