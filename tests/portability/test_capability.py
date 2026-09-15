"""Capability IDs + downgrade law — never fake success."""

from __future__ import annotations

from spe_runtime.portability.capability import (
    CAPABILITY_IDS,
    CapabilityId,
    CapabilityStatus,
    evaluate_capability,
)
from spe_runtime.portability.reasons import PortabilityReason


REQUIRED = [
    "CORE_CONTRACT",
    "XCAT_HANDOFF",
    "C02_RESEARCH",
    "C06_ANALYZE",
    "C01_DECIDE",
    "C03_COMMUNICATE",
    "C07_EXECUTION_INTENT",
    "AUTHORITY_VALIDATION",
    "PROVENANCE",
    "UNCERTAINTY",
    "PRIVACY_LABELS",
    "PROOF_RECEIPTS",
    "LOCAL_STORAGE",
    "LOCAL_EXECUTION",
    "NETWORK_OPTIONAL",
    "OFFLINE_MODE",
]


def test_all_capability_ids_present():
    assert CAPABILITY_IDS == frozenset(REQUIRED)
    assert {c.value for c in CapabilityId} == set(REQUIRED)


def test_missing_never_fakes_success():
    d = evaluate_capability("OFFLINE_MODE", available=frozenset())
    assert d.status == CapabilityStatus.MISSING
    assert d.reason == PortabilityReason.CAPABILITY_MISSING.value
    assert d.outcome != "SUCCESS"
    assert d.outcome in {"CAPABILITY_MISSING", "BLOCKED", "DEFER", "REFUSE"}


def test_blocked_never_fakes_success():
    d = evaluate_capability(
        "NETWORK_OPTIONAL",
        available=frozenset(REQUIRED),
        blocked=frozenset({"NETWORK_OPTIONAL"}),
    )
    assert d.status == CapabilityStatus.BLOCKED
    assert d.reason == PortabilityReason.CAPABILITY_BLOCKED.value
    assert d.outcome != "SUCCESS"


def test_defer_never_fakes_success():
    d = evaluate_capability(
        "PROOF_RECEIPTS",
        available=frozenset(REQUIRED),
        defer=frozenset({"PROOF_RECEIPTS"}),
    )
    assert d.status == CapabilityStatus.DEFER
    assert d.reason == PortabilityReason.CAPABILITY_DEFER.value
    assert d.outcome != "SUCCESS"


def test_available_ok():
    d = evaluate_capability("CORE_CONTRACT", available=frozenset(REQUIRED))
    assert d.status == CapabilityStatus.AVAILABLE
    assert d.outcome == "SUCCESS"
