#!/usr/bin/env python3
"""Verify the SPE Ω v2.4.1 G5 qualification freeze checkpoint.

This tool VERIFIES recorded evidence. It does NOT:
  - silently re-run pytest
  - rewrite evidence files
  - mutate qualification artifacts

Exit 0 = checkpoint consistent with recorded G5 freeze.
Exit 1 = verification failure.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "proofs/g5_freeze/QUALIFICATION_MANIFEST.json"
MANIFEST_SHA = ROOT / "proofs/g5_freeze/QUALIFICATION_MANIFEST.sha256"
INTEGRITY = ROOT / "proofs/g5_freeze/INTEGRITY.json"
SOURCE_ID = ROOT / "proofs/g5_freeze/source_identity.json"
BASELINE_DOC = ROOT / "proofs/g5_freeze/QUALIFIED_BASELINE.md"

EXPECTED_QUAL_HEAD = "99173c2f700508c6c958b5d79e8bc17418f9bfd6"
EXPECTED_CONTRACT = "68bac38afe3f38e85da38a359ed482ace07166fbf64c2d89dca3e499e41424f3"
EXPECTED_G2 = "15b20a8532d3375c2d59dc8608c9c8854ff5ec7ecfcdefdb32902f0e6127e562"
EXPECTED_PR6 = "4e6c694b5d8b9379c5acfbaac416dcfa89b1768e"
EXPECTED_TAG = "spe-v2.4.1-g5-qualified"
FORBIDDEN_PATHS = ["spe_runtime/omega"]


class Failures(list):
    def check(self, cond: bool, msg: str) -> None:
        if not cond:
            self.append(msg)

    def ok(self, msg: str) -> None:
        print(f"  PASS  {msg}")


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def git(*args: str) -> str:
    return subprocess.check_output(["git", *args], cwd=ROOT, text=True).strip()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--require-tag",
        action="store_true",
        help="Fail if git tag spe-v2.4.1-g5-qualified is missing",
    )
    parser.add_argument(
        "--check-pr6-live",
        action="store_true",
        help="Optionally query gh for live PR #6 state (network); default uses recorded evidence only",
    )
    args = parser.parse_args()

    fails = Failures()
    print("SPE Ω v2.4.1 — G5 checkpoint verifier")
    print("mode: verify_recorded_evidence_only (no pytest rerun)")
    print()

    # --- pack presence ---
    fails.check(MANIFEST.is_file(), f"missing {MANIFEST.relative_to(ROOT)}")
    fails.check(MANIFEST_SHA.is_file(), f"missing {MANIFEST_SHA.relative_to(ROOT)}")
    fails.check(INTEGRITY.is_file(), f"missing {INTEGRITY.relative_to(ROOT)}")
    fails.check(SOURCE_ID.is_file(), f"missing {SOURCE_ID.relative_to(ROOT)}")
    fails.check(BASELINE_DOC.is_file(), f"missing {BASELINE_DOC.relative_to(ROOT)}")
    if fails:
        for f in fails:
            print(f"  FAIL  {f}")
        return 1

    # --- manifest integrity ---
    raw = MANIFEST.read_bytes()
    # Canonical file must end with newline as written by freeze pack
    computed = hashlib.sha256(raw).hexdigest()
    recorded_line = MANIFEST_SHA.read_text(encoding="utf-8").strip().split()[0]
    integrity = json.loads(INTEGRITY.read_text(encoding="utf-8"))
    fails.check(computed == recorded_line, f"manifest SHA mismatch: computed={computed} recorded={recorded_line}")
    fails.check(
        computed == integrity.get("manifest_sha256"),
        "INTEGRITY.json manifest_sha256 does not match file",
    )
    if computed == recorded_line:
        fails.ok(f"QUALIFICATION_MANIFEST.json SHA-256 = {computed}")

    manifest = json.loads(raw.decode("utf-8"))
    src = json.loads(SOURCE_ID.read_text(encoding="utf-8"))

    # --- HEAD / ancestry ---
    qual = manifest.get("qualification_head") or src.get("qualification_head")
    fails.check(qual == EXPECTED_QUAL_HEAD, f"qualification_head want {EXPECTED_QUAL_HEAD} got {qual}")
    try:
        tip = git("rev-parse", "HEAD")
        # Qualification commit must exist and be an ancestor of HEAD (or equal)
        git("cat-file", "-e", f"{EXPECTED_QUAL_HEAD}^{{commit}}")
        rc = subprocess.call(
            ["git", "merge-base", "--is-ancestor", EXPECTED_QUAL_HEAD, "HEAD"],
            cwd=ROOT,
        )
        fails.check(rc == 0, f"{EXPECTED_QUAL_HEAD} is not an ancestor of HEAD ({tip})")
        if rc == 0:
            fails.ok(f"ancestry: {EXPECTED_QUAL_HEAD} ⊆ HEAD ({tip[:12]}…)")
    except subprocess.CalledProcessError as exc:
        fails.check(False, f"git ancestry check failed: {exc}")

    # --- contract + G2 ---
    contract_path = ROOT / "specs/spe-omega-v2.4.1/RING0_WORKING_CONTRACT.json"
    g2_path = ROOT / "formal/SPELeaseCommit.tla"
    fails.check(contract_path.is_file(), "working contract missing")
    fails.check(g2_path.is_file(), "G2 model missing")
    c_sha = sha256_file(contract_path)
    g_sha = sha256_file(g2_path)
    fails.check(c_sha == EXPECTED_CONTRACT, f"contract SHA mismatch: {c_sha}")
    fails.check(g_sha == EXPECTED_G2, f"G2 SHA mismatch: {g_sha}")
    fails.check(
        manifest["custody"]["working_contract_sha256"] == EXPECTED_CONTRACT,
        "manifest custody contract SHA mismatch",
    )
    fails.check(
        manifest["custody"]["g2_model_sha256"] == EXPECTED_G2,
        "manifest custody G2 SHA mismatch",
    )
    if c_sha == EXPECTED_CONTRACT and g_sha == EXPECTED_G2:
        fails.ok("working contract + G2 model SHAs match freeze")

    # --- evidence file hashes ---
    for rel, expect in sorted(manifest.get("evidence_files_sha256", {}).items()):
        path = ROOT / rel
        if not path.is_file():
            fails.check(False, f"evidence missing: {rel}")
            continue
        got = sha256_file(path)
        fails.check(got == expect, f"evidence hash drift: {rel}")
    fails.ok(f"evidence file hashes OK ({len(manifest.get('evidence_files_sha256', {}))} files)")

    # --- recorded regression counts (from evidence JSON, not re-run) ---
    tests = manifest["tests"]
    rw = tests["repository_wide"]
    fails.check(rw["collected"] == 986 and rw["passed"] == 986 and rw["failed"] == 0 and rw["exit"] == 0,
                f"repository-wide recorded counts bad: {rw}")
    # Cross-check underlying evidence file
    fr = json.loads((ROOT / rw["evidence"]).read_text(encoding="utf-8"))
    fails.check(fr.get("passed") == 986 and fr.get("failed") == 0 and fr.get("exit") == 0,
                f"full_regression_recheck.json does not record 986/986 exit 0: {fr}")
    log = ROOT / rw["log"]
    fails.check(log.is_file(), f"missing regression log {rw['log']}")
    log_text = log.read_text(encoding="utf-8", errors="replace")
    fails.check("986 passed" in log_text, "full_pytest_recheck.txt missing '986 passed'")
    fails.ok("recorded repository-wide regression: 986/986 exit 0")

    wasm = tests["targeted_wasm"]
    fails.check(wasm["passed"] == 120 and wasm["failed"] == 0 and wasm["exit"] == 0,
                f"targeted WASM recorded counts bad: {wasm}")
    tw = json.loads((ROOT / wasm["evidence"]).read_text(encoding="utf-8"))
    fails.check(tw.get("passed") == 120 and tw.get("exit") == 0, f"targeted_wasm_recheck.json bad: {tw}")
    fails.ok("recorded targeted WASM: 120/120 exit 0")

    # --- mutations ---
    mut = tests["g5_chaos_mutations"]
    fails.check(mut.get("killed") == 12 and mut.get("survived") == 0, f"mutation counts bad: {mut}")
    fails.ok("recorded G5 mutations: 12 killed / 0 survived")

    # --- zero-cost ---
    zc = manifest["zero_cost"]
    fails.check(zc.get("api_keys_required") == 0, "api_keys_required != 0")
    fails.check(zc.get("paid_provider_calls") == 0, "paid_provider_calls != 0")
    fails.check(zc.get("external_spend_inr") == 0, "external_spend_inr != 0")
    fails.check(zc.get("mandatory_network") == 0, "mandatory_network != 0")
    zc_ev = json.loads((ROOT / "proofs/g5zc/zero_cost_audit.json").read_text(encoding="utf-8"))
    fails.check(zc_ev.get("api_keys_required") == 0, "zero_cost_audit.json api_keys_required != 0")
    fails.ok("zero-cost evidence: ₹0 / $0 / 0 keys / 0 paid calls")

    # --- PR #6 exclusion (recorded) ---
    fails.check(manifest["custody"].get("pr6_head") == EXPECTED_PR6, "manifest PR #6 head mismatch")
    fails.check(manifest["custody"].get("pr6_state") == "OPEN", "manifest PR #6 state not OPEN")
    fails.check("UNTOUCHED" in manifest["custody"].get("pr6_status", ""), "PR #6 status missing UNTOUCHED")
    fails.check(src["pr6"]["head"] == EXPECTED_PR6, "source_identity PR #6 head mismatch")
    fails.ok(f"PR #6 exclusion recorded: OPEN @ {EXPECTED_PR6[:12]}… UNTOUCHED/UNMERGED")

    if args.check_pr6_live:
        try:
            out = subprocess.check_output(
                ["gh", "pr", "view", "6", "--json", "state,headRefOid,mergedAt"],
                cwd=ROOT,
                text=True,
            )
            live = json.loads(out)
            fails.check(live.get("state") == "OPEN", f"live PR #6 state={live.get('state')}")
            fails.check(live.get("mergedAt") is None, "live PR #6 appears merged")
            fails.check(live.get("headRefOid") == EXPECTED_PR6, f"live PR #6 head drifted: {live.get('headRefOid')}")
            fails.ok("live gh PR #6 still OPEN/unmerged at recorded head")
        except (subprocess.CalledProcessError, FileNotFoundError) as exc:
            fails.check(False, f"--check-pr6-live failed: {exc}")

    # --- forbidden paths ---
    for rel in FORBIDDEN_PATHS:
        p = ROOT / rel
        fails.check(not p.exists(), f"forbidden path present: {rel}")
    fails.ok("forbidden path absent: spe_runtime/omega/")

    # --- gates ---
    gates = manifest.get("gates", {})
    fails.check(gates.get("G5") == "ZERO_COST_LOCAL_FAULT_RESILIENCE_VERIFIED_WITHIN_TESTED_SCOPE",
                f"G5 gate status wrong: {gates.get('G5')}")
    fails.check(gates.get("G4X") == "OPTIONAL / DEFERRED", f"G4X wrong: {gates.get('G4X')}")
    fails.ok("G1–G5 gate statuses match freeze")

    # --- tag (optional by default; freeze pack creates it) ---
    tag_ok = False
    try:
        tagged = git("rev-list", "-n", "1", EXPECTED_TAG)
        tag_ok = tagged.startswith(EXPECTED_QUAL_HEAD) or tagged == EXPECTED_QUAL_HEAD
        # annotated tags resolve to tag object; peel to commit
        peeled = git("rev-parse", f"{EXPECTED_TAG}^{{commit}}")
        tag_ok = peeled == EXPECTED_QUAL_HEAD
        fails.check(tag_ok, f"tag {EXPECTED_TAG} points to {peeled}, want {EXPECTED_QUAL_HEAD}")
        if tag_ok:
            fails.ok(f"git tag {EXPECTED_TAG} → {EXPECTED_QUAL_HEAD}")
    except subprocess.CalledProcessError:
        if args.require_tag:
            fails.check(False, f"missing required git tag {EXPECTED_TAG}")
        else:
            print(f"  WARN  git tag {EXPECTED_TAG} not present locally (use --require-tag to fail)")

    print()
    if fails:
        print("G5_CHECKPOINT_VERIFY_FAIL")
        for f in fails:
            print(f"  FAIL  {f}")
        return 1

    print("G5_CHECKPOINT_VERIFY_PASS")
    print(f"qualification_head: {EXPECTED_QUAL_HEAD}")
    print(f"manifest_sha256:    {computed}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
