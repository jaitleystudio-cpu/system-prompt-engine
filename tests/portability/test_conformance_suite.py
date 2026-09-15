"""Conformance fixtures: >=50 positive, >=50 negative with exact reasons."""

from __future__ import annotations

import json
from pathlib import Path

from spe_runtime.portability.capability import evaluate_capability, CapabilityStatus
from spe_runtime.portability.conformance import (
    detect_attack,
    run_conformance_suite,
    semantic_equivalent,
)
from spe_runtime.portability.reasons import PortabilityReason


def test_manifest_counts(conformance_dir: Path):
    manifest = json.loads((conformance_dir / "universal_manifest_v1.json").read_text())
    assert manifest["not_a_release"] is True
    assert manifest["abi_id"] == "spe.universal-abi.v1"
    assert manifest["positives"]["count"] >= 50
    assert manifest["negatives"]["count"] >= 50
    assert manifest["network_mode_required"] == "NONE"
    assert manifest["cost_law"]["owner_spend_inr"] == 0


def test_positive_fixture_count(conformance_dir: Path):
    lines = [
        ln
        for ln in (conformance_dir / "universal_core_v1.jsonl").read_text().splitlines()
        if ln.strip()
    ]
    assert len(lines) >= 50


def test_negative_fixture_count_and_reasons(conformance_dir: Path):
    rows = [
        json.loads(ln)
        for ln in (conformance_dir / "universal_negative_v1.jsonl")
        .read_text()
        .splitlines()
        if ln.strip()
    ]
    assert len(rows) >= 50
    for row in rows:
        assert row["expect_reason"]
        assert row["expect_reason"].startswith(("P_", "X", "C07_")) or row[
            "expect_reason"
        ].startswith("X")


def test_run_conformance_suite_green(conformance_dir: Path):
    result = run_conformance_suite(conformance_dir)
    assert result["positives_total"] >= 50
    assert result["negatives_total"] >= 50
    assert result["positives_passed"] == result["positives_total"]
    assert result["negatives_passed"] == result["negatives_total"]
    assert result["failed"] == []
    assert result["ok"] is True
    assert result["network_mode"] == "NONE"


def test_negatives_detect_exact_reasons(conformance_dir: Path):
    rows = [
        json.loads(ln)
        for ln in (conformance_dir / "universal_negative_v1.jsonl")
        .read_text()
        .splitlines()
        if ln.strip()
    ]
    checked = 0
    for row in rows:
        attack = row["attack"]
        if attack in {
            "PROVENANCE_REMOVED",
            "UNKNOWN_NULLIFIED",
            "HARD_TO_PREFERENCE",
            "DENIED_TO_GRANTED",
            "PRIVACY_ESCALATION",
            "TRUST_ESCALATION",
            "AUTHORITY_ESCALATION",
            "CONSTRAINT_WEAKENED",
            "UNCERTAINTY_ERASED",
        }:
            reason = detect_attack(row["before"], row["after"])
            assert reason == row["expect_reason"], (row["id"], reason, row["expect_reason"])
            assert semantic_equivalent(row["before"], row["after"]) is False
            checked += 1
        elif attack == "CAPABILITY_MISSING":
            d = evaluate_capability(
                row["capability"],
                available=frozenset(row["available_capabilities"]),
            )
            assert d.status == CapabilityStatus.MISSING
            assert d.reason == PortabilityReason.CAPABILITY_MISSING.value
            checked += 1
        elif attack == "CAPABILITY_BLOCKED":
            d = evaluate_capability(
                row["capability"],
                available=frozenset(["CORE_CONTRACT", row["capability"]]),
                blocked=frozenset(row["blocked_capabilities"]),
            )
            assert d.status == CapabilityStatus.BLOCKED
            checked += 1
        elif attack == "CAPABILITY_DEFER":
            d = evaluate_capability(
                "NETWORK_OPTIONAL",
                available=frozenset(["NETWORK_OPTIONAL"]),
                defer=frozenset(row["defer_capabilities"]),
            )
            assert d.status == CapabilityStatus.DEFER
            checked += 1
    assert checked >= 30
