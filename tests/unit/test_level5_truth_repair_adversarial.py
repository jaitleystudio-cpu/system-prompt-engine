"""Adversarial Regression Tests for Level 5 Discovery Truth Repair.

Verifies the 8 mandatory criteria from the SPE Ω Implementation Directive:
  1. Valid procedure succeeds.
  2. Invalid syntax is rejected.
  3. Runtime exception is rejected.
  4. Timeout is rejected.
  5. Incorrect result is rejected.
  6. Unauthorized action is rejected.
  7. Missing evidence prevents graduation.
  8. Failed experiments cannot produce DEPLOYMENT_ELIGIBLE status.
"""

from __future__ import annotations

import json
import pytest

from spe_runtime.capabilities.capsule import AdmissionState
from spe_runtime.capabilities.sandbox import CapabilitySandbox
from spe_runtime.discovery.dialectical_arena import (
    AdversarialFalsifier,
    DialecticalArena,
    HypothesisProposer,
)
from spe_runtime.discovery.models import (
    BoundaryKind,
    DiscoveryHypothesis,
    FalsificationWorld,
    HypothesisStatus,
)
from spe_runtime.discovery.open_ended_engine import OpenEndedDiscoveryEngine


def test_1_valid_procedure_succeeds():
    """1. Valid procedure succeeds in sandbox and survives duel."""
    arena = DialecticalArena()
    proposer = HypothesisProposer()
    falsifier = AdversarialFalsifier()

    hypo = proposer.propose("FINANCIAL_RISK")
    worlds = falsifier.synthesize_counter_worlds(hypo)

    receipt = arena.duel(hypo, worlds)
    assert not receipt.falsified
    assert receipt.survived_worlds == len(worlds)
    assert receipt.wald_sprt_lcb95 > 0.0
    assert hypo.status == HypothesisStatus.SURVIVED


def test_2_invalid_syntax_is_rejected():
    """2. Invalid syntax in synthesized procedure is rejected by sandbox and duel fails."""
    arena = DialecticalArena()
    hypo = DiscoveryHypothesis(
        hypothesis_id="hypo_invalid_syntax",
        domain="FINANCIAL_RISK",
        conjecture="Broken syntax procedure",
        synthesized_procedure="def run(payload: invalid syntax here!!",
        input_schema={"type": "object"},
        output_schema={"type": "object"},
        invariants=["syntax_check"],
    )
    world = FalsificationWorld(
        world_id="fw_1",
        boundary_kind=BoundaryKind.MALFORMED_INPUT,
        fixture_input={"amount_cents": 100},
        expected_safety_property="must_execute",
    )
    receipt = arena.duel(hypo, [world])
    assert receipt.falsified is True
    assert receipt.survived_worlds == 0
    assert hypo.status == HypothesisStatus.FALSIFIED


def test_3_runtime_exception_is_rejected():
    """3. Runtime exception (crashing procedure) is caught and rejected."""
    arena = DialecticalArena()
    crashing_code = """
def run(payload):
    x = 1 / 0
    return {"result": x}
"""
    hypo = DiscoveryHypothesis(
        hypothesis_id="hypo_crashing",
        domain="FINANCIAL_RISK",
        conjecture="Crashing division by zero procedure",
        synthesized_procedure=crashing_code,
        input_schema={"type": "object"},
        output_schema={"type": "object"},
        invariants=["crash_free"],
    )
    world = FalsificationWorld(
        world_id="fw_crash",
        boundary_kind=BoundaryKind.MALFORMED_INPUT,
        fixture_input={"amount_cents": 100},
        expected_safety_property="must_execute",
    )
    receipt = arena.duel(hypo, [world])
    assert receipt.falsified is True
    assert receipt.survived_worlds == 0
    assert hypo.status == HypothesisStatus.FALSIFIED


def test_4_timeout_is_rejected():
    """4. Procedure that times out exceeding execution budget is rejected."""
    arena = DialecticalArena()
    infinite_loop_code = """
import time
def run(payload):
    # Busy sleep longer than max duration
    t0 = time.time()
    while time.time() - t0 < 0.2:
        pass
    return {"done": True}
"""
    hypo = DiscoveryHypothesis(
        hypothesis_id="hypo_timeout",
        domain="FINANCIAL_RISK",
        conjecture="Timeout procedure",
        synthesized_procedure=infinite_loop_code,
        input_schema={"type": "object"},
        output_schema={"type": "object"},
        invariants=["bounded_latency"],
    )
    world = FalsificationWorld(
        world_id="fw_timeout",
        boundary_kind=BoundaryKind.MALFORMED_INPUT,
        fixture_input={"amount_cents": 100},
        expected_safety_property="must_execute",
    )
    receipt = arena.duel(hypo, [world])
    assert receipt.falsified is True
    assert hypo.status == HypothesisStatus.FALSIFIED


def test_5_incorrect_result_is_rejected():
    """5. Procedure producing incorrect output (e.g. failing to mask PII) is rejected."""
    arena = DialecticalArena()
    leaky_pii_procedure = {
        "op": "echo_unmasked",  # Fails to mask
    }
    hypo = DiscoveryHypothesis(
        hypothesis_id="hypo_leaky_pii",
        domain="PRIVACY_SHIELD",
        conjecture="Defective PII procedure that leaks SSN",
        synthesized_procedure=leaky_pii_procedure,
        input_schema={"type": "object"},
        output_schema={"type": "object"},
        invariants=["zero_pii_leakage"],
    )
    world = FalsificationWorld(
        world_id="fw_leak",
        boundary_kind=BoundaryKind.MALFORMED_INPUT,
        fixture_input={"text": "User SSN is 000-00-0000 and email is admin@corp.com"},
        expected_safety_property="must_mask_all_pii_despite_null_bytes",
    )
    receipt = arena.duel(hypo, [world])
    assert receipt.falsified is True
    assert hypo.status == HypothesisStatus.FALSIFIED


def test_6_unauthorized_action_is_rejected():
    """6. Unauthorized action (e.g. attempting to import os) is rejected by AST security inspector."""
    arena = DialecticalArena()
    malicious_code = """
import os
def run(payload):
    return {"evil": os.listdir(".")}
"""
    hypo = DiscoveryHypothesis(
        hypothesis_id="hypo_malicious_exploit",
        domain="FINANCIAL_RISK",
        conjecture="Malicious sandbox escape procedure",
        synthesized_procedure=malicious_code,
        input_schema={"type": "object"},
        output_schema={"type": "object"},
        invariants=["zero_exploit"],
    )
    world = FalsificationWorld(
        world_id="fw_security",
        boundary_kind=BoundaryKind.MALFORMED_INPUT,
        fixture_input={"amount_cents": 100},
        expected_safety_property="must_execute",
    )
    receipt = arena.duel(hypo, [world])
    assert receipt.falsified is True
    assert hypo.status == HypothesisStatus.FALSIFIED


def test_7_missing_evidence_prevents_graduation():
    """7. Missing evidence (counter-worlds failed or zero trials) prevents graduation."""
    engine = OpenEndedDiscoveryEngine()
    hypo = DiscoveryHypothesis(
        hypothesis_id="hypo_no_evidence",
        domain="RATE_LIMITER",
        conjecture="Unproven rate limiter",
        synthesized_procedure={"op": "token_bucket_lease", "capacity": 10},
        input_schema={"type": "object"},
        output_schema={"type": "object"},
        invariants=["rate_limit"],
    )
    # Create failing duel receipt
    failing_receipt = arena_receipt = DialecticalArena().duel(hypo, [
        FalsificationWorld(
            world_id="fw_burst",
            boundary_kind=BoundaryKind.BUDGET_STARVATION,
            fixture_input={"requested_tokens": 500},
            expected_safety_property="must_throttle_over_capacity",
        )
    ])
    # Manually flag as falsified / missing evidence
    failing_receipt.falsified = True
    failing_receipt.wald_sprt_lcb95 = 0.0

    capsule = engine._compile_to_capsule(hypo, failing_receipt, "ax_fake")
    assert capsule.admission_state != AdmissionState.DEPLOYMENT_ELIGIBLE
    assert capsule.admission_state == AdmissionState.REJECTED
    assert len(capsule.witnesses) == 0


def test_8_failed_experiments_cannot_produce_deployment_eligible():
    """8. Failed experiments cannot produce DEPLOYMENT_ELIGIBLE status."""
    engine = OpenEndedDiscoveryEngine()
    hypo = DiscoveryHypothesis(
        hypothesis_id="hypo_failing_experiment",
        domain="FINANCIAL_RISK",
        conjecture="Broken financial clamp",
        synthesized_procedure={"op": "conditional_clamp", "max_threshold": 50000},
        input_schema={"type": "object"},
        output_schema={"type": "object"},
        invariants=["clamp"],
    )
    falsifying_world = FalsificationWorld(
        world_id="fw_unauth",
        boundary_kind=BoundaryKind.AUTHORITY_REVOKED,
        fixture_input={"amount_cents": 9999999},  # Unauthorized huge spend
        expected_safety_property="must_reject_unauthorized_amount",
    )
    receipt = DialecticalArena().duel(hypo, [falsifying_world])
    # If the experiment failed, verify it cannot produce DEPLOYMENT_ELIGIBLE
    receipt.falsified = True
    receipt.wald_sprt_lcb95 = 0.0

    capsule = engine._compile_to_capsule(hypo, receipt, "ax_failed")
    assert capsule.admission_state == AdmissionState.REJECTED
    assert capsule.admission_state != AdmissionState.DEPLOYMENT_ELIGIBLE
