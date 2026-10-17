"""
Tests for SPE Ω PRO Compounding Research Capability Lifecycle (RGD-1)
"""

import pytest
from spe_runtime.research.rgd.compounding_lifecycle import (
    CompoundingCapabilityRegistry,
    compute_procedure_seal,
    verify_procedure_seal,
)


def test_compounding_lifecycle_registration_and_qualification():
    registry = CompoundingCapabilityRegistry()

    # Success case: passed LVT and CSC
    proc = registry.register_procedure(
        domain="CRYPTOGRAPHY",
        name="Zero-Knowledge Range Proof Mobile Benchmarking Protocol",
        assumptions=["Curve25519 optimized assembly on ARMv8-A", "RAM budget <= 32MB"],
        tested_tasks_count=3,
        lvt_transfer_passed=True,
        csc_boundary_passed=True,
        cost_savings_pct=42.0,
    )

    assert proc.is_valid is True
    assert proc.qualification_verdict == "QUALIFIED_REUSABLE_CAPABILITY"
    assert proc.cost_savings_pct == 42.0
    assert len(proc.sha256_seal) == 64
    assert verify_procedure_seal(proc) is True

    # Failure case: failed LVT transfer
    proc_fail = registry.register_procedure(
        domain="MATERIALS_SCIENCE",
        name="Unverified Cathode Sintering Recipe",
        assumptions=["Atmospheric furnace stability"],
        tested_tasks_count=1,
        lvt_transfer_passed=False,
        csc_boundary_passed=True,
        cost_savings_pct=10.0,
    )
    assert proc_fail.is_valid is False
    assert proc_fail.qualification_verdict == "REJECTED_UNQUALIFIED"
    assert verify_procedure_seal(proc_fail) is True


def test_assumption_invalidation_and_requalification():
    registry = CompoundingCapabilityRegistry()

    proc = registry.register_procedure(
        domain="AUDIO_ENGINEERING",
        name="Neural Codec Latency Profiling",
        assumptions=["ALSA buffer latency <= 5ms", "Sample rate == 48000Hz"],
        tested_tasks_count=5,
        lvt_transfer_passed=True,
        csc_boundary_passed=True,
        cost_savings_pct=50.0,
    )
    assert proc.is_valid is True
    initial_seal = proc.sha256_seal
    assert verify_procedure_seal(proc) is True

    # Invalidate assumption: ALSA buffer latency failed on new device
    ok, reason = registry.invalidate_assumption(proc.procedure_id, "ALSA buffer")
    assert ok is True
    assert "failed empirical verification" in reason
    assert proc.is_valid is False
    assert proc.qualification_verdict == "INVALIDATED_REQUIRES_REQUALIFICATION"
    assert proc.sha256_seal != initial_seal
    assert verify_procedure_seal(proc) is True

    # Tampering test
    proc.qualification_verdict = "QUALIFIED_REUSABLE_CAPABILITY"
    assert verify_procedure_seal(proc) is False
    proc.qualification_verdict = "INVALIDATED_REQUIRES_REQUALIFICATION"

    # Lookup should not return invalidated procedure as valid
    found = registry.find_valid_procedure_for_domain("AUDIO_ENGINEERING")
    proc_retrieved = registry.get_procedure(proc.procedure_id)
    assert proc_retrieved.is_valid is False

    # Requalification trial
    req_ok, req_msg = registry.requalify_procedure(
        proc.procedure_id,
        lvt_transfer_passed=True,
        csc_boundary_passed=True,
    )
    assert req_ok is True
    assert proc.is_valid is True
    assert proc.qualification_verdict == "QUALIFIED_REUSABLE_CAPABILITY"
    assert verify_procedure_seal(proc) is True


def test_registry_get_all_procedures():
    registry = CompoundingCapabilityRegistry()
    procs = registry.get_all_procedures()
    assert len(procs) >= 2
    domains = [p.domain for p in procs]
    assert "AUDIO_ENGINEERING" in domains
    assert "BIOTECHNOLOGY" in domains
