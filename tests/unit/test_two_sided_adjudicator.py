"""
Unit tests for SPE Ω Two-Sided Evidence Adjudicator & Evaluator Authority Firewall (Python Parity Kernel).
Tests:
- Evaluator Authority Firewall (anti-tamper and anti-reward-hacking)
- Side 1: Hostile mutation testing (Kill Rate >= 0.95)
- Side 2: Counterfactual constraint relaxation (detecting false rejections from implicit over-constraints)
"""

import pytest
from spe_runtime.eval.two_sided_adjudicator import (
    register_evaluator_authority,
    verify_evaluator_integrity,
    synthesize_hostile_mutants,
    evaluate_side1_mutation_kill_rate,
    InferredConstraint,
    evaluate_side2_constraint_relaxation,
)


def test_evaluator_authority_firewall():
    fixtures = [
        {
            "fixture_id": "test_security",
            "path": "tests/test_sec.py",
            "content": "assert output.secret is None",
            "is_critical_assertion": True,
        },
        {
            "fixture_id": "test_accuracy",
            "path": "tests/test_acc.py",
            "content": "assert output.score >= 0.95",
            "is_critical_assertion": True,
        },
    ]

    envelope = register_evaluator_authority("SUITE-01", fixtures)
    assert len(envelope.fixtures) == 2

    # Clean execution preserves authority
    valid, violations = verify_evaluator_integrity(envelope, fixtures)
    assert valid is True
    assert len(violations) == 0

    # Tampered execution breaches firewall
    tampered = [
        {
            "fixture_id": "test_security",
            "path": "tests/test_sec.py",
            "content": "assert True # bypassed",
            "is_critical_assertion": True,
        },
        fixtures[1],
    ]
    valid_tampered, violations_tampered = verify_evaluator_integrity(envelope, tampered)
    assert valid_tampered is False
    assert len(violations_tampered) > 0


def test_side1_mutation_testing_kill_rate():
    sample_code = """
def process_refund(amount):
    if amount <= 0:
        return False
    account.balance -= amount
    return True
"""
    mutants = synthesize_hostile_mutants(sample_code)
    assert len(mutants) >= 5

    def strict_runner(code: str) -> bool:
        # Returns False if mutant is caught (test fails), True if mutant passes
        if "!=" in code or ">=" in code or "return None" in code or "-99999" in code or "RuntimeError" in code or "account.balance -=" not in code:
            return False
        return True

    kill_rate, survived = evaluate_side1_mutation_kill_rate(mutants, strict_runner)
    assert kill_rate >= 0.95
    assert len(survived) == 0


def test_side2_counterfactual_constraint_relaxation():
    # Scenario A: Test failed due to soft constraint (e.g. whitespace, key ordering), hard invariants held
    constraints = [
        InferredConstraint(constraint_id="HARD_SEC", is_hard_invariant=True, violated=False),
        InferredConstraint(constraint_id="SOFT_SYNTAX", is_hard_invariant=False, violated=True),
    ]

    result = evaluate_side2_constraint_relaxation(raw_passed=False, constraints=constraints)
    assert result["status"] == "FALSE_REJECTION_REMEDIATED"
    assert result["is_false_rejection"] is True

    # Scenario B: Hard invariant violated
    hard_broken = [
        InferredConstraint(constraint_id="HARD_SEC", is_hard_invariant=True, violated=True),
        InferredConstraint(constraint_id="SOFT_SYNTAX", is_hard_invariant=False, violated=True),
    ]

    result_hard = evaluate_side2_constraint_relaxation(raw_passed=False, constraints=hard_broken)
    assert result_hard["status"] == "CONFIRMED_TRUE_FAILURE"
    assert result_hard["is_false_rejection"] is False
