"""
Unit & Adversarial Tests for Intelligence IV: Mathematical & Experimental Verification
"""

import pytest
from spe_runtime.research.agi_brain.types import (
    InventionCandidate,
    InventionStrategy,
    VerificationStatus,
)
from spe_runtime.research.agi_brain.experimental_verification import ExperimentalVerificationEngine

@pytest.fixture
def sample_candidate():
    return InventionCandidate(
        candidate_id="cand-math-01",
        strategy=InventionStrategy.FIRST_PRINCIPLES,
        hypothesis_statement="Every prime greater than 2 is of form 4k+1 or 4k+3.",
        mechanism="Modular arithmetic reduction modulo 4.",
        feasibility_score=1.0,
        novelty_score=0.5,
        testability_score=1.0,
        prior_art_overlap=0.9,
    )

def test_lean_formal_verification_success(sample_candidate):
    engine = ExperimentalVerificationEngine()
    valid_lean_proof = (
        "theorem prime_mod_four (p : Nat) (hp : Nat.Prime p) (h2 : p > 2) : "
        "p % 4 = 1 ∨ p % 4 = 3 := by omega"
    )

    result = engine.verify_candidate(sample_candidate, lean_proof_script=valid_lean_proof)
    assert result.status == VerificationStatus.VERIFIED
    assert result.formal_proof_verified is True
    assert len(result.receipt_hash) == 64

def test_lean_formal_verification_rejects_sorry(sample_candidate):
    engine = ExperimentalVerificationEngine()
    invalid_lean_proof = (
        "theorem goldbach_conjecture (n : Nat) : Even n → n > 2 → ... := by sorry"
    )

    result = engine.verify_candidate(sample_candidate, lean_proof_script=invalid_lean_proof)
    assert result.status == VerificationStatus.REJECTED
    assert result.formal_proof_verified is False
    assert any("sorry" in r for r in result.reasons)

def test_conservation_of_truth_emits_unknown_when_unproven(sample_candidate):
    engine = ExperimentalVerificationEngine()
    # No Lean proof, no property tests provided
    result = engine.verify_candidate(sample_candidate)
    assert result.status == VerificationStatus.UNKNOWN
    assert any("Insufficient" in r for r in result.reasons)

def test_property_based_testing_rejects_failures(sample_candidate):
    engine = ExperimentalVerificationEngine()
    # 9 passed, 1 failed
    results = [True] * 9 + [False]
    res = engine.verify_candidate(sample_candidate, property_test_results=results)
    assert res.status == VerificationStatus.REJECTED
    assert res.property_tests_passed == 9
    assert res.property_tests_total == 10
