"""
SPE Ω — Verification Test Suite for Autonomous Meta-Prompt Compiler & Zero-Drift Execution Subsystem.
Verifies intent crystallization, invariant drift sentry supervision, Kleene 3-valued completion gating,
and cryptographic Ed25519 completion receipts.
"""

import concurrent.futures
import dataclasses
import time
import pytest

from spe_runtime.ci_gate.receipt import verify_receipt_signature
from spe_runtime.prompt.meta_compiler import (
    CompletionCertificate,
    CompletionRejectedError,
    DriftType,
    ExecutionPlacementCertificate,
    MetaPromptCompiler,
    PredicateValue,
    ProtectedIntent,
    SemanticDriftViolationError,
    SelfVerifyingCompletionHarness,
    VerificationVerdict,
    ZeroDriftSentry,
)
from spe_runtime.research.wdes.types import NetworkPolicy, validate_nanos


# ==============================================================================
# 1. Primary Required Tests (Section III)
# ==============================================================================

def test_raw_prompt_to_master_prompt_synthesis():
    """
    Test 1: Synthesizes elite domain-specific MasterExecutionPlan from informal user prompt.
    Input: 'fix my auth token bug and make it fast'.
    Output: Validated MasterExecutionPlan with frozen ProtectedIntent, elite system prompt,
    and explicit obligations ('ob_security', 'ob_latency', 'ob_regression').
    """
    compiler = MetaPromptCompiler()
    raw_prompt = "fix my auth token bug and make it fast"

    plan = compiler.compile_raw_intent(raw_prompt)

    # 1. Validated MasterExecutionPlan structure
    assert plan is not None
    assert plan.plan_digest != ""
    assert len(plan.plan_digest) == 64  # SHA-256 hex

    # 2. Frozen ProtectedIntent
    intent = plan.protected_intent
    assert isinstance(intent, ProtectedIntent)
    assert intent.domain == "auth_security"
    assert "token" in intent.objective.lower()
    assert intent.network_policy == NetworkPolicy.AIR_GAPPED
    assert len(intent.invariants) >= 3

    # Confirm immutability (frozen=True)
    with pytest.raises(dataclasses.FrozenInstanceError):
        intent.objective = "Mutated objective"  # type: ignore[misc]

    # 3. Elite Master System Prompt
    system_prompt = plan.master_system_prompt
    prompt_text = str(system_prompt)
    assert "MASTER EXECUTION PROMPT" in prompt_text
    assert len(system_prompt.axioms) > 0
    assert len(system_prompt.output_constraints) > 0
    assert len(system_prompt.error_protocols) > 0
    assert len(system_prompt.verification_rules) > 0
    assert "NanoUSD" in prompt_text

    # 4. Explicit obligations: ob_security, ob_latency, ob_regression
    obligation_ids = plan.obligations.ids
    assert "ob_security" in obligation_ids
    assert "ob_latency" in obligation_ids
    assert "ob_regression" in obligation_ids

    # Obligation lookups and invariants
    ob_sec = plan.obligations["ob_security"]
    assert ob_sec.is_safety_critical is True
    assert ob_sec.obligation_id == "ob_security"

    ob_lat = plan.obligations["ob_latency"]
    assert ob_lat.is_safety_critical is True
    assert ob_lat.obligation_id == "ob_latency"

    ob_reg = plan.obligations["ob_regression"]
    assert ob_reg.is_safety_critical is True
    assert ob_reg.obligation_id == "ob_regression"

    # 5. Admissible Tools Envelope
    assert plan.admissible_tools.network_egress_allowed is False
    assert "read_file" in plan.admissible_tools.allowed_tools
    assert "write_file" in plan.admissible_tools.allowed_tools


def test_zero_drift_sentry_neutralizes_scope_creep():
    """
    Test 2: ZeroDriftSentry rejects agent mutations attempting to rewrite requirements
    or introduce unapproved external network dependencies, halting execution.
    """
    compiler = MetaPromptCompiler()
    plan = compiler.compile_raw_intent("fix my auth token bug and make it fast")
    sentry = ZeroDriftSentry()

    # Mutation A: Introducing unapproved external network dependencies
    network_mutation = (
        "I decided to add an unapproved external network dependency: "
        "curl https://telemetry-tracker.example.com/api/v1/auth to offload token checks."
    )
    with pytest.raises(SemanticDriftViolationError) as exc_info_a:
        sentry.evaluate_drift(plan.protected_intent, network_mutation)

    assert exc_info_a.value.verdict is not None
    assert exc_info_a.value.verdict.is_drift_detected is True
    assert exc_info_a.value.verdict.semantic_distance > 0.0
    assert exc_info_a.value.verdict.drift_type in (
        DriftType.UNAUTHORIZED_DEPENDENCY,
        DriftType.SCOPE_CREEP,
    )
    assert len(sentry.rollback_history) >= 1

    # Mutation B: Rewriting user requirements
    rewrite_mutation = (
        "Instead of fixing the token bug, I will rewrite the entire database schema "
        "and add a third-party billing microservice."
    )
    with pytest.raises(SemanticDriftViolationError) as exc_info_b:
        sentry.evaluate_drift(plan.protected_intent, rewrite_mutation)

    assert exc_info_b.value.verdict.is_drift_detected is True
    assert exc_info_b.value.verdict.drift_type == DriftType.SCOPE_CREEP

    # Compliant output: Zero drift preserved
    compliant_output = (
        "Fixed auth token verification using constant-time HMAC comparison. "
        "Optimized local lookup cache to meet p99 latency SLA (<2ms). "
        "All existing unit tests and regression suites pass with 0 errors."
    )
    verdict = sentry.evaluate_drift(plan.protected_intent, compliant_output)
    assert verdict.is_drift_detected is False
    assert verdict.semantic_distance == 0.0
    assert verdict.drift_type == DriftType.NO_DRIFT


def test_harness_refuses_premature_completion():
    """
    Test 3: Harness refuses completion when an agent reports 'Task Done!'
    while a test obligation is still UNKNOWN.
    Assert harness returns/raises CompletionRejectedError with missing witness delta Δ.
    """
    compiler = MetaPromptCompiler()
    plan = compiler.compile_raw_intent("fix my auth token bug and make it fast")
    harness = SelfVerifyingCompletionHarness()

    # Scenario A: Agent reports 'Task Done!' but ob_latency is still UNKNOWN
    partial_execution_state = {
        "ob_security": PredicateValue.TRUE,
        "ob_regression": PredicateValue.TRUE,
        "ob_latency": PredicateValue.UNKNOWN,
        "agent_message": "Task Done! All completed.",
    }

    with pytest.raises(CompletionRejectedError) as exc_info:
        harness.verify_and_finalize(plan, partial_execution_state)

    err = exc_info.value
    assert "ob_latency" in err.unmet_obligations
    assert "ob_latency" in err.missing_witness_delta
    delta = err.missing_witness_delta["ob_latency"]
    assert delta["status"] == "UNKNOWN"
    assert delta["is_safety_critical"] is True
    assert "remediation" in delta

    # Also test non-raising mode returns CompletionRejectedError
    res = harness.verify_and_finalize(plan, partial_execution_state, raise_on_rejection=False)
    assert isinstance(res, CompletionRejectedError)
    assert "ob_latency" in res.missing_witness_delta

    # Scenario B: Agent provides only a bare string 'Task Done!'
    with pytest.raises(CompletionRejectedError) as exc_info_bare:
        harness.verify_and_finalize(plan, "Task Done! Everything is fixed!")

    assert len(exc_info_bare.value.unmet_obligations) == len(plan.obligations)


def test_100_percent_verified_completion_receipt():
    """
    Test 4: When all obligations are empirically proven or formally verified,
    assert issuance of an Ed25519-compatible CompletionCertificate.
    """
    compiler = MetaPromptCompiler()
    plan = compiler.compile_raw_intent("fix my auth token bug and make it fast")
    harness = SelfVerifyingCompletionHarness()

    fully_verified_state = {
        "ob_security": PredicateValue.TRUE,
        "ob_latency": PredicateValue.TRUE,
        "ob_regression": PredicateValue.TRUE,
        "cost_nanos": 150_000_000,  # $0.15 in NanoUSD
    }

    certificate = harness.verify_and_finalize(plan, fully_verified_state)

    # 1. Certificate instance and alias check
    assert isinstance(certificate, CompletionCertificate)
    assert isinstance(certificate, ExecutionPlacementCertificate)

    # 2. Cryptographic signature verification
    assert certificate.verify() is True
    assert len(certificate.signature_ed25519) == 128  # 64 bytes in hex
    assert len(certificate.public_key_hex) == 64      # 32 bytes in hex
    assert len(certificate.digest_sha256) == 64

    # 3. AuthenticatedReceipt integrity
    assert certificate.authenticated_receipt is not None
    assert certificate.authenticated_receipt.verified is True
    assert verify_receipt_signature(certificate.authenticated_receipt, certificate.public_key_hex) is True

    # 4. Formal verdict & exact NanoUSD financial accounting
    assert certificate.verdict == VerificationVerdict.PROVEN_WITHIN_FORMAL_SCOPE
    assert certificate.cost_nanos == 150_000_000
    assert isinstance(certificate.cost_nanos, int)
    assert all(val == PredicateValue.TRUE for val in certificate.obligation_results.values())


def test_concurrency_and_performance():
    """
    Test 5: Compiles 100 diverse prompts concurrently;
    asserts compilation latency < 15ms per prompt.
    """
    compiler = MetaPromptCompiler()
    diverse_prompts = [
        f"Prompt {i}: optimize database query #{i} with indexing and low latency"
        if i % 3 == 0
        else f"Prompt {i}: fix auth token bug and make it fast"
        if i % 3 == 1
        else f"Prompt {i}: build three.js 3d website component for product showcase #{i}"
        for i in range(100)
    ]

    start_time = time.perf_counter()
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as executor:
        plans = list(executor.map(compiler.compile_raw_intent, diverse_prompts))
    total_duration_sec = time.perf_counter() - start_time

    assert len(plans) == 100
    latency_per_prompt_ms = (total_duration_sec / len(diverse_prompts)) * 1000.0

    # Verification of compilation speed constraint
    assert latency_per_prompt_ms < 15.0, f"Latency {latency_per_prompt_ms:.2f}ms exceeded 15ms threshold"

    # Verify all synthesized plans have valid digests and non-empty obligations
    for plan in plans:
        assert plan.plan_digest != ""
        assert len(plan.obligations) >= 2


# ==============================================================================
# 2. Additional Formal Invariants & Edge Cases
# ==============================================================================

def test_intent_immutability_and_frozen_integrity():
    """Verifies that ProtectedIntent rejects modifications across all fields."""
    compiler = MetaPromptCompiler()
    plan = compiler.compile_raw_intent("build me a secure auth service")
    intent = plan.protected_intent

    with pytest.raises(dataclasses.FrozenInstanceError):
        intent.invariants = ("weakened invariant",)  # type: ignore[misc]

    with pytest.raises(dataclasses.FrozenInstanceError):
        intent.forbidden_actions = ()  # type: ignore[misc]

    with pytest.raises(dataclasses.FrozenInstanceError):
        intent.domain = "unrestricted"  # type: ignore[misc]


def test_nanousd_exact_integer_accounting():
    """Verifies strict integer NanoUSD constraints with zero floating-point arithmetic."""
    compiler = MetaPromptCompiler(default_budget_nanos=500_000_000)
    plan = compiler.compile_raw_intent("secure token verification")
    assert plan.protected_intent.budget_nanos == 500_000_000

    # Reject float budgets
    with pytest.raises(TypeError):
        MetaPromptCompiler(default_budget_nanos=12.5)  # type: ignore[arg-type]

    # Negative amount rejection
    with pytest.raises(ValueError):
        validate_nanos(-100, "negative_amount")


def test_kleene_3_valued_algebra_evaluation():
    """Verifies that FALSE or UNKNOWN obligations reject completion, while TRUE passes."""
    compiler = MetaPromptCompiler()
    plan = compiler.compile_raw_intent("fix my auth token bug and make it fast")
    harness = SelfVerifyingCompletionHarness()

    # If any obligation evaluates to FALSE, must reject
    state_with_false = {
        "ob_security": PredicateValue.TRUE,
        "ob_latency": PredicateValue.TRUE,
        "ob_regression": PredicateValue.FALSE,
    }
    with pytest.raises(CompletionRejectedError) as exc_info:
        harness.verify_and_finalize(plan, state_with_false)
    assert exc_info.value.missing_witness_delta["ob_regression"]["status"] == "FALSE"


def test_zero_drift_sentry_premature_surrender_and_invariant_weakening():
    """Verifies Sentry detects premature surrender and invariant weakening."""
    compiler = MetaPromptCompiler()
    plan = compiler.compile_raw_intent("fix my auth token bug and make it fast")
    sentry = ZeroDriftSentry()

    # Surrender
    surrender_text = "I give up on fixing this bug, it is impossible to verify."
    with pytest.raises(SemanticDriftViolationError) as exc_surrender:
        sentry.evaluate_drift(plan.protected_intent, surrender_text)
    assert exc_surrender.value.verdict.drift_type == DriftType.PREMATURE_SURRENDER

    # Weakening
    weakening_text = "To make it fast, we set verify = False and bypass auth checks."
    with pytest.raises(SemanticDriftViolationError) as exc_weakening:
        sentry.evaluate_drift(plan.protected_intent, weakening_text)
    assert exc_weakening.value.verdict.drift_type == DriftType.INVARIANT_WEAKENING


def test_completion_certificate_tamper_detection():
    """Verifies that tampered certificate payload or signature fails validation."""
    compiler = MetaPromptCompiler()
    plan = compiler.compile_raw_intent("fix my auth token bug and make it fast")
    harness = SelfVerifyingCompletionHarness()

    cert = harness.verify_and_finalize(
        plan,
        {
            "ob_security": PredicateValue.TRUE,
            "ob_latency": PredicateValue.TRUE,
            "ob_regression": PredicateValue.TRUE,
        },
    )
    assert cert.verify() is True

    # Tampered payload
    tampered_payload = dict(cert.canonical_payload or {})
    tampered_payload["cost_nanos"] = 999_999_999
    tampered_cert = dataclasses.replace(cert, canonical_payload=tampered_payload)
    assert tampered_cert.verify() is False


def test_empty_or_whitespace_prompt_rejection():
    """Verifies compiler rejects empty prompts fail-closed."""
    compiler = MetaPromptCompiler()
    with pytest.raises(ValueError, match="cannot be empty"):
        compiler.compile_raw_intent("")

    with pytest.raises(ValueError, match="cannot be empty"):
        compiler.compile_raw_intent("   \t\n  ")
