#!/usr/bin/env python3
"""Verify SPE Ω v2.4.1 G9-FREEZE + G6-H handoff pack.

Evidence-only. Does not run pytest, does not write ratings,
does not mint World #1 / independent replication / human preference.
"""

from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PACK = ROOT / "proofs/g9_freeze"
MANIFEST = PACK / "QUALIFICATION_MANIFEST.json"
MANIFEST_SHA = PACK / "QUALIFICATION_MANIFEST.sha256"
INTEGRITY = PACK / "INTEGRITY.json"
FREEZE_DOC = PACK / "FREEZE.md"
PROTOCOL = PACK / "G6H_PROTOCOL.md"
HUMAN = ROOT / "proofs/g6zc/human_results.json"

EXPECTED_CONTRACT = "68bac38afe3f38e85da38a359ed482ace07166fbf64c2d89dca3e499e41424f3"
EXPECTED_G2 = "15b20a8532d3375c2d59dc8608c9c8854ff5ec7ecfcdefdb32902f0e6127e562"
FORBIDDEN = {
    "WORLD_1",
    "WORLD_1_PROVEN",
    "INDEPENDENTLY_REPLICATED",
    "REAL_USER_PRODUCT_VALUE_VERIFIED_WITHIN_TESTED_SCOPE",
    "G9_PASS_IMPLIES_WORLD_1",
    "1041_TESTS_IMPLIES_WORLD_1",
    "HERMETIC_REPLAY_EQUALS_INDEPENDENT_REPLICATION",
    "FABRICATED_HUMAN_RATINGS",
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
    fails = Failures()
    print("SPE Ω v2.4.1 — G9-FREEZE / G6-H handoff verifier")
    print("mode: evidence_only (no ratings write / no pytest rerun)")
    print()

    for p in (MANIFEST, MANIFEST_SHA, INTEGRITY, FREEZE_DOC, PROTOCOL, HUMAN):
        fails.check(p.is_file(), f"missing {p.relative_to(ROOT)}")
    if fails:
        for f in fails:
            print(f"  FAIL  {f}")
        return 1
    fails.ok("pack + human_results stub present")

    got = sha256_file(MANIFEST)
    exp = MANIFEST_SHA.read_text(encoding="utf-8").strip()
    fails.check(got == exp, f"manifest sha mismatch")
    if got == exp:
        fails.ok("manifest sha matches")

    man = json.loads(MANIFEST.read_text(encoding="utf-8"))
    integ = json.loads(INTEGRITY.read_text(encoding="utf-8"))
    human = json.loads(HUMAN.read_text(encoding="utf-8"))

    fails.check(integ.get("world_1") == "NOT_PROVEN", "world_1 must be NOT_PROVEN")
    fails.check(
        integ.get("independently_replicated") == "NOT_PROVEN",
        "independently_replicated must be NOT_PROVEN",
    )
    fails.check(integ.get("g6_human_value") == "PENDING", "g6_human_value must be PENDING")
    fails.check(integ.get("do_not_fabricate_ratings") is True, "do_not_fabricate_ratings")
    fails.check(human.get("do_not_fabricate") is True, "human_results.do_not_fabricate")
    fails.check(human.get("status") == "NO_RATINGS_YET", "human_results must remain NO_RATINGS_YET")
    fails.check(human.get("paired_evaluations", 0) == 0, "no fabricated paired_evaluations")
    fails.ok("G6 human stubs unfabricated")

    fails.check(
        man["custody"]["working_contract_sha256"] == EXPECTED_CONTRACT,
        "contract drift",
    )
    fails.check(man["custody"]["g2_model_sha256"] == EXPECTED_G2, "g2 drift")

    forbidden = set(man.get("exact_forbidden_claims", []))
    for c in FORBIDDEN:
        fails.check(c in forbidden, f"missing forbidden claim {c}")
    fails.ok("forbidden claims retained")

    earned = set(man.get("exact_earned_claims", []))
    fails.check(not (earned & FORBIDDEN), f"earned∩forbidden={earned & FORBIDDEN}")

    gates = man.get("gates", {})
    fails.check(gates.get("G6") == "HUMAN_VALUE_EVIDENCE_PENDING", "G6 must stay PENDING")
    fails.check(gates.get("WORLD_1") == "NOT_PROVEN", "WORLD_1 gate")
    fails.check(gates.get("INDEPENDENT_REPLICATION") == "NOT_PROVEN", "indep gate")
    fails.check(
        gates.get("G9") == "ZERO_COST_STACK_CUSTODY_PACKAGED_WITHIN_TESTED_SCOPE",
        "G9 claim",
    )
    fails.ok("founder freeze table intact")

    for rel, expected in man.get("evidence_files_sha256", {}).items():
        path = ROOT / rel
        fails.check(path.is_file(), f"missing {rel}")
        if path.is_file():
            fails.check(sha256_file(path) == expected, f"hash drift {rel}")
    fails.ok(f"evidence hashes ({len(man.get('evidence_files_sha256', {}))})")

    fails.check(not (ROOT / "spe_runtime/omega").exists(), "omega present")
    stop = man.get("stop", {})
    fails.check(stop.get("no_more_self_certifying_engineering_missions") is True, "stop flag")
    fails.check(man.get("g6h_handoff", {}).get("do_not_fabricate_ratings") is True, "g6h flag")
    fails.ok("STOP + G6-H handoff flags")

    # corrections present
    corr = "\n".join(man.get("enforced_corrections", []))
    fails.check("G9 PASS does not imply World #1" in corr, "missing G9≠W1 correction")
    fails.check("1041/1041" in corr, "missing 1041 correction")
    fails.check("≠ independent replication" in corr or "!= independent" in corr.lower() or "≠ independent" in corr, "missing hermetic≠indep")
    fails.ok("enforced corrections present")

    if fails:
        print()
        print("VERDICT: FAIL")
        for f in fails:
            print(f"  FAIL  {f}")
        return 1

    print()
    print("VERDICT: PASS")
    print("freeze: G9_FREEZE_G6H_HANDOFF_RECORDED")
    print("G6 human value: PENDING")
    print("World #1: NOT_PROVEN")
    print("next: external G6-H blinded humans")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
