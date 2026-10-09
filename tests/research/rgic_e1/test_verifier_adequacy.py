"""
Unit and Adversarial Tests for Adversarial Evidence Qualification (AEQ)
Part of SPE Ω Research Quarantine (RGIC-E1 Extension).

Tests:
1. Semantic Mutation Operators (SMO-Auth, SMO-Binding, SMO-Inversion, SMO-A11y, SMO-Escrow).
2. Verifier Adequacy evaluation on a naive verifier (uncovering the "green dashboard" trap).
3. Elimination of "Lucky Passes" (AgentLens 2026, arXiv:2605.12925).
4. Wilson score interval mathematical bounds.
5. Non-Weakening Invariant Theorem (Delta R = emptyset).
6. $1,500 Independent Release Audit generation.
"""

import pytest
from spe_runtime.research.rgic_e1.types import Obligation, ObligationState
from spe_runtime.research.rgic_e1.verifier_adequacy import (
    AdversarialEvidenceQualifier,
    CandidateVerifier,
    SemanticMutantKind,
    SemanticMutant
)


@pytest.fixture
def aeq_engine():
    return AdversarialEvidenceQualifier(adequacy_threshold=0.90)


@pytest.fixture
def sample_obligation():
    return Obligation(
        id="ob-customer-address-update",
        requirement="Customer delivery address can only be updated if authenticated and authorized",
        acceptance_rule_ref="authenticated == True and not is_stale and amount_due >= 0",
        criticality=10,
        state=ObligationState.UNKNOWN
    )


@pytest.fixture
def valid_baseline_sample():
    return {
        "customer_id": "cust-9912",
        "authenticated": True,
        "auth_token": "valid_signed_jwt_token",
        "timestamp": 1791548000,
        "commit_sha": "a1b2c3d4e5f67890",
        "new_address": "221B Baker Street, London",
        "keyboard_navigable": True,
        "aria_labels": ["submit-button", "address-input"],
        "leakage_nanos": 0,
        "amount": 50
    }


def test_semantic_mutant_generation(aeq_engine, sample_obligation, valid_baseline_sample):
    """
    Verifies that all 5 Semantic Mutation Operators generate syntactically
    conforming, invariant-violating mutants.
    """
    mutants = aeq_engine.generate_semantic_mutants(sample_obligation, valid_baseline_sample)
    assert len(mutants) == 5

    kinds = {m.kind for m in mutants}
    assert SemanticMutantKind.AUTH_BYPASS in kinds
    assert SemanticMutantKind.STALE_BINDING in kinds
    assert SemanticMutantKind.PREDICATE_INVERSION in kinds
    assert SemanticMutantKind.SILENT_A11Y_DEGRADATION in kinds
    assert SemanticMutantKind.ESCROW_LEAKAGE in kinds

    for m in mutants:
        assert m.is_valid_syntax is True
        assert m.violates_invariant is True
        assert m.target_obligation_id == sample_obligation.id


def test_naive_verifier_inadequacy_detection(aeq_engine, sample_obligation, valid_baseline_sample):
    """
    Simulates the real-world competitor flaw:
    A verifier that only checks if 'new_address' is present and non-empty,
    completely ignoring authentication, timestamp binding, and accessibility.
    AEQ must catch this adequacy defect and flag the verifier as INADEQUATE.
    """
    # Naive verifier from competitor or basic LLM-eval
    def naive_check(payload):
        return bool(payload.get("new_address"))

    candidate = CandidateVerifier(
        id="verifier-naive-eval",
        name="Naive Address Field Verifier",
        verify=naive_check
    )

    mutants = aeq_engine.generate_semantic_mutants(sample_obligation, valid_baseline_sample)
    result = aeq_engine.evaluate_verifier_adequacy(
        verifier=candidate,
        obligation=sample_obligation,
        mutants=mutants,
        valid_samples=[valid_baseline_sample]
    )

    # All mutants had 'new_address' present, so naive check accepted ALL of them!
    # Detection rate should be 0.0 (caught 0 / 5 defects)
    assert result.defect_detection_rate == 0.0
    assert result.is_adequate is False
    assert result.status == "INADEQUATE"
    assert len(result.missed_mutant_ids) == 5


def test_rigorous_verifier_qualification(aeq_engine, sample_obligation, valid_baseline_sample):
    """
    Tests a comprehensive verifier that checks authentication, state binding,
    accessibility, and escrow balance. AEQ should certify it as QUALIFIED.
    """
    def rigorous_check(payload):
        # 1. Check auth
        if not payload.get("authenticated") or payload.get("auth_token") == "EXPIRED_OR_FORGED":
            return False
        # 2. Check stale binding
        if payload.get("timestamp", 0) <= 0 or payload.get("commit_sha") == "0000000000000000000000000000000000000000":
            return False
        # 3. Check predicate
        if payload.get("amount", 0) < 0 or payload.get("status") == "UNAUTHORIZED_UPDATE":
            return False
        # 4. Check a11y
        if not payload.get("keyboard_navigable", True):
            return False
        # 5. Check escrow
        if payload.get("leakage_nanos", 0) > 0:
            return False
        return True

    candidate = CandidateVerifier(
        id="verifier-rigorous-spe",
        name="Rigorous Multi-Invariant Verifier",
        verify=rigorous_check
    )

    mutants = aeq_engine.generate_semantic_mutants(sample_obligation, valid_baseline_sample)
    result = aeq_engine.evaluate_verifier_adequacy(
        verifier=candidate,
        obligation=sample_obligation,
        mutants=mutants,
        valid_samples=[valid_baseline_sample]
    )

    # Caught all 5 mutants!
    assert result.defect_detection_rate == 1.0
    assert result.is_adequate is True
    assert result.status == "QUALIFIED"
    assert len(result.missed_mutant_ids) == 0
    assert result.false_rejection_count == 0


def test_wilson_confidence_interval_math(aeq_engine):
    """
    Validates that Wilson score intervals properly bound uncertainty
    and avoid degenerate 0.0 or 1.0 intervals on small sample sizes.
    """
    # 5 out of 5 successes
    lower, upper = aeq_engine.compute_wilson_interval(5, 5)
    assert 0.50 < lower < 1.0  # Conservative lower bound
    assert upper == 1.0

    # 0 out of 5 successes
    lower, upper = aeq_engine.compute_wilson_interval(0, 5)
    assert lower == 0.0
    assert 0.0 < upper < 0.50


def test_non_weakening_repair_guarantees(aeq_engine, sample_obligation, valid_baseline_sample):
    """
    Tests the Non-Weakening Invariant Theorem:
    A proposed repair cannot alter requirement hash, cannot introduce false rejections,
    and cannot suffer detection regressions.
    """
    mutants = aeq_engine.generate_semantic_mutants(sample_obligation, valid_baseline_sample)

    def naive_check(payload):
        return bool(payload.get("new_address"))

    def sound_repair_check(payload):
        if not payload.get("authenticated") or payload.get("auth_token") == "EXPIRED_OR_FORGED":
            return False
        if payload.get("timestamp", 0) <= 0:
            return False
        if payload.get("amount", 0) < 0:
            return False
        if not payload.get("keyboard_navigable", True):
            return False
        if payload.get("leakage_nanos", 0) > 0:
            return False
        return True

    def faulty_repair_with_false_rejections(payload):
        # Incorrectly rejects valid addresses starting with 2
        if payload.get("new_address", "").startswith("2"):
            return False
        return sound_repair_check(payload)

    v_orig = CandidateVerifier("v-orig", "Original", naive_check)
    v_sound = CandidateVerifier("v-sound", "Sound Repair", sound_repair_check)
    v_faulty = CandidateVerifier("v-faulty", "Faulty Repair", faulty_repair_with_false_rejections)

    # Case 1: Sound repair passes
    res_sound = aeq_engine.check_non_weakening_repair(
        original_verifier=v_orig,
        repaired_verifier=v_sound,
        mutants=mutants,
        valid_samples=[valid_baseline_sample],
        req_hash_before="ed25519-frozen-req-hash-abc",
        req_hash_after="ed25519-frozen-req-hash-abc"
    )
    assert res_sound.is_non_weakening is True
    assert res_sound.preserves_all_valid_inputs is True
    assert res_sound.catches_all_required_mutants is True

    # Case 2: Attempting to move goalposts (hash mismatch) is rejected
    res_tamper = aeq_engine.check_non_weakening_repair(
        original_verifier=v_orig,
        repaired_verifier=v_sound,
        mutants=mutants,
        valid_samples=[valid_baseline_sample],
        req_hash_before="hash-original",
        req_hash_after="hash-modified-tampered"
    )
    assert res_tamper.is_non_weakening is False
    assert "Specification hash mismatch" in res_tamper.reason

    # Case 3: Repair that breaks valid inputs is rejected
    res_broken = aeq_engine.check_non_weakening_repair(
        original_verifier=v_orig,
        repaired_verifier=v_faulty,
        mutants=mutants,
        valid_samples=[valid_baseline_sample],
        req_hash_before="hash-ok",
        req_hash_after="hash-ok"
    )
    assert res_broken.is_non_weakening is False
    assert "Repair introduced false rejections" in res_broken.reason


def test_independent_release_audit_compilation(aeq_engine, sample_obligation, valid_baseline_sample):
    """
    Tests compilation of the $1,500 Independent Release Audit data bundle.
    """
    mutants = aeq_engine.generate_semantic_mutants(sample_obligation, valid_baseline_sample)

    def naive_check(payload):
        return bool(payload.get("new_address"))

    candidate = CandidateVerifier("v-naive", "Naive", naive_check)
    eval_res = aeq_engine.evaluate_verifier_adequacy(
        verifier=candidate,
        obligation=sample_obligation,
        mutants=mutants,
        valid_samples=[valid_baseline_sample]
    )

    audit = aeq_engine.compile_release_audit(
        audit_id="SPE-RELEASE-AUDIT-2026-00042",
        target_agent="AutonomousCustomerCareAgent-v2",
        evaluations=[eval_res]
    )

    assert audit["audit_id"] == "SPE-RELEASE-AUDIT-2026-00042"
    assert audit["verdict"] == "RELEASE_BLOCKED_INADEQUATE_EVALUATION"
    assert audit["inadequate_verifiers_count"] == 1
    assert audit["total_semantic_mutants_injected"] == 5
    assert audit["anti_lucky_pass_status"] == "ENFORCED"
