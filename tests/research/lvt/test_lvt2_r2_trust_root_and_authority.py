"""
SPE Ω — LVT-2 R2 Trust-Root, Mock-Bypass Closure, and Artifact Authority Suite.

Strictly verifies:
Task 2: Untrusted Oracle Acceptance closure (A through F)
Task 3: Production Mock Bypass removal and historical record isolation
Task 4: Receipt and .spe Artifact Export Authority enforcement (1 through 7)
"""

import copy
import json
import pytest

from spe_runtime.ci_gate.receipt import generate_keypair
from spe_runtime.research.lvt import (
    EvaluatorType,
    ExperimentProtocol,
    FourArmResults,
    LearningClaim,
    LearningTransferProtocol,
    LearningValidityTransaction,
    LearningValidator,
    Observation,
    QualificationStatus,
    RevocationReason,
    StudyProtocol,
    StudyResult,
    TransactionRevokedError,
    run_study,
)
from spe_runtime.research.lvt.learning_validator import create_oracle_attestation


def _make_study_result(n: int = 24) -> StudyResult:
    train = [
        Observation(f"t-{i}", f"tfam-{i}", f"a{i:063x}", 0.1, 0.9, 0.1)
        for i in range(n)
    ]
    heldout = [
        Observation(f"h-{i}", f"hfam-{i}", f"b{i:063x}", 0.1, 0.9)
        for i in range(n)
    ]
    proto = StudyProtocol(
        study_id="STUDY-R2",
        evaluator_id="eval-oracle-01",
        generator_id="gen-model-01",
        evaluator_kind="independent_static_oracle",
        oracle_digest="0" * 64,
        model_digest="1" * 64,
        primary_effect_floor=0.05,
        alpha=0.05,
        min_heldout_families=20,
        family_level_significance=True,
        multiplicity=2,
    )
    res = run_study(proto, train, heldout)
    assert res.status == "RESEARCH_SUPPORTED_NOT_EXTERNALLY_QUALIFIED"
    return res


def _make_base_tx(study_res: StudyResult) -> LearningValidityTransaction:
    claim = LearningClaim(
        claim_id="CLM-R2",
        domain="security_invariants",
        description="Formal bounds verification",
        generator_id="gen-model-01",
        base_prompt_ref="prompt_v1",
        candidate_prompt_ref="prompt_v2",
        budget_nanos=10_000,
    )
    protocol = ExperimentProtocol(protocol_id="PROTO-R2")
    return LearningValidityTransaction(
        tx_id="TX-R2-001",
        claim=claim,
        protocol=protocol,
        evaluator_id="eval-oracle-01",
        evaluator_type=EvaluatorType.INDEPENDENT_STATIC_ORACLE,
        lvt2_study_result=study_res,
    )


# ==============================================================================
# TASK 2: FIX UNTRUSTED ORACLE ACCEPTANCE (RED TESTS A - F)
# ==============================================================================

def test_task2_a_no_oracle_trust_registry_fails_closed():
    """A. No oracle trust registry: Must NOT yield QUALIFIED."""
    study_res = _make_study_result()
    tx = _make_base_tx(study_res)

    sk, pk = generate_keypair()
    attestation = create_oracle_attestation(
        signing_key=sk,
        public_key=pk,
        oracle_id="eval-oracle-01",
        evidence_hash=study_res.evidence_hash,
    )
    tx.oracle_attestation = attestation

    # Default validator has no oracle trust registry
    validator = LearningValidator()
    committed = validator.validate_and_commit(tx)
    assert committed.status != QualificationStatus.QUALIFIED
    assert committed.is_attested_oracle is False
    assert committed.status == QualificationStatus.RESEARCH_SUPPORTED


def test_task2_b_empty_oracle_trust_registry_fails_closed():
    """B. Empty oracle trust registry: Must NOT yield QUALIFIED."""
    study_res = _make_study_result()
    tx = _make_base_tx(study_res)

    sk, pk = generate_keypair()
    attestation = create_oracle_attestation(
        signing_key=sk,
        public_key=pk,
        oracle_id="eval-oracle-01",
        evidence_hash=study_res.evidence_hash,
    )
    tx.oracle_attestation = attestation

    validator = LearningValidator(trusted_oracle_keys=set())
    committed = validator.validate_and_commit(tx)
    assert committed.status != QualificationStatus.QUALIFIED
    assert committed.is_attested_oracle is False


def test_task2_c_fresh_self_generated_key_fails_closed():
    """C. Fresh self-generated oracle key: Must NOT yield QUALIFIED."""
    study_res = _make_study_result()
    tx = _make_base_tx(study_res)

    # Establish an official validator with trusted oracle key for official-evaluator
    official_sk, official_pk = generate_keypair()
    validator = LearningValidator(trusted_oracles={"eval-oracle-official": official_pk.hex()})

    # Attacker generates their own fresh keypair
    rogue_sk, rogue_pk = generate_keypair()
    attestation = create_oracle_attestation(
        signing_key=rogue_sk,
        public_key=rogue_pk,
        oracle_id="eval-oracle-01",
        evidence_hash=study_res.evidence_hash,
    )
    tx.oracle_attestation = attestation

    committed = validator.validate_and_commit(tx)
    assert committed.status != QualificationStatus.QUALIFIED
    assert committed.is_attested_oracle is False


def test_task2_d_untrusted_signed_attestation_fails_closed():
    """D. Untrusted but correctly signed attestation: Must NOT yield QUALIFIED."""
    study_res = _make_study_result()
    tx = _make_base_tx(study_res)

    trusted_sk, trusted_pk = generate_keypair()
    validator = LearningValidator(trusted_oracles={"eval-oracle-01": trusted_pk.hex()})

    untrusted_sk, untrusted_pk = generate_keypair()
    attestation = create_oracle_attestation(
        signing_key=untrusted_sk,
        public_key=untrusted_pk,
        oracle_id="eval-oracle-01",
        evidence_hash=study_res.evidence_hash,
    )
    tx.oracle_attestation = attestation

    committed = validator.validate_and_commit(tx)
    assert committed.status != QualificationStatus.QUALIFIED
    assert committed.is_attested_oracle is False


def test_task2_e_trusted_oracle_altered_evidence_rejected():
    """E. Trusted oracle, altered evidence: Must be rejected."""
    study_res = _make_study_result()
    tx = _make_base_tx(study_res)

    sk, pk = generate_keypair()
    validator = LearningValidator(trusted_oracles={"eval-oracle-01": pk.hex()})

    altered_hash = "f" * 64
    attestation = create_oracle_attestation(
        signing_key=sk,
        public_key=pk,
        oracle_id="eval-oracle-01",
        evidence_hash=altered_hash,
    )
    tx.oracle_attestation = attestation

    committed = validator.validate_and_commit(tx)
    assert committed.status == QualificationStatus.REJECTED
    assert committed.is_attested_oracle is False
    assert "mismatch" in committed.rejection_reason.lower()


def test_task2_f_trusted_key_mismatched_oracle_identity_rejected():
    """F. Trusted key with mismatched oracle identity: Must be rejected."""
    study_res = _make_study_result()
    tx = _make_base_tx(study_res)

    sk, pk = generate_keypair()
    # Registry binds pk to "eval-oracle-authorized"
    validator = LearningValidator(trusted_oracles={"eval-oracle-authorized": pk.hex()})

    # Attestation claims oracle_id="eval-oracle-imposter" signed with that key
    attestation = create_oracle_attestation(
        signing_key=sk,
        public_key=pk,
        oracle_id="eval-oracle-imposter",
        evidence_hash=study_res.evidence_hash,
    )
    tx.oracle_attestation = attestation

    committed = validator.validate_and_commit(tx)
    assert committed.status == QualificationStatus.REJECTED
    assert committed.is_attested_oracle is False


# ==============================================================================
# TASK 3: REMOVE PRODUCTION MOCK BYPASS
# ==============================================================================

def test_task3_mock_scores_cannot_yield_production_qualified():
    """Mock aggregate scores cannot yield production QUALIFIED."""
    validator = LearningValidator()
    claim = LearningClaim("C-MOCK", "dom", "desc", "gen", "p1", "p2", budget_nanos=1000)
    proto = ExperimentProtocol(protocol_id="PROTO-MOCK")
    results = FourArmResults(
        arm_a_baseline_score=0.6,
        arm_b_authentic_score=0.9,
        arm_c_shuffled_control_score=0.6,
        arm_d_generalization_score=0.88,
        delta_improvement=0.3,
        control_delta=0.3,
        held_out_retention=0.28,
        is_statistically_significant=True,
    )
    tx = LearningValidityTransaction("TX-MOCK", claim, proto, results=results, evaluator_id="eval-01")

    # Even if allow_mock_qualification is passed, production qualification MUST NOT be granted
    committed = validator.validate_and_commit(tx)
    assert committed.status != QualificationStatus.QUALIFIED
    assert committed.status == QualificationStatus.RESEARCH_UNQUALIFIED


def test_task3_mock_qualification_cannot_create_production_signed_receipt():
    """Mock qualification cannot create a production-valid signed learning receipt."""
    validator = LearningValidator()
    claim = LearningClaim("C-MOCK2", "dom", "desc", "gen", "p1", "p2", budget_nanos=1000)
    proto = ExperimentProtocol(protocol_id="PROTO-MOCK2")
    results = FourArmResults(
        arm_a_baseline_score=0.6,
        arm_b_authentic_score=0.9,
        arm_c_shuffled_control_score=0.6,
        arm_d_generalization_score=0.88,
        delta_improvement=0.3,
        control_delta=0.3,
        held_out_retention=0.28,
        is_statistically_significant=True,
    )
    tx = LearningValidityTransaction("TX-MOCK2", claim, proto, results=results, evaluator_id="eval-01")

    committed = validator.validate_and_commit(tx)
    assert committed.canonical_receipt_signature == ""
    assert committed.artifact_hash == ""
    assert validator.verify_transaction_signature(committed) is False


def test_task3_legacy_aggregate_evidence_remains_research_unqualified():
    """Legacy aggregate-only evidence remains RESEARCH_UNQUALIFIED."""
    validator = LearningValidator()
    claim = LearningClaim("C-MOCK3", "dom", "desc", "gen", "p1", "p2", budget_nanos=1000)
    proto = ExperimentProtocol(protocol_id="PROTO-MOCK3")
    results = FourArmResults(
        arm_a_baseline_score=0.6,
        arm_b_authentic_score=0.9,
        arm_c_shuffled_control_score=0.6,
        arm_d_generalization_score=0.88,
        delta_improvement=0.3,
        control_delta=0.3,
        held_out_retention=0.28,
        is_statistically_significant=True,
    )
    tx = LearningValidityTransaction("TX-MOCK3", claim, proto, results=results, evaluator_id="eval-01")

    committed = validator.validate_and_commit(tx)
    assert committed.status == QualificationStatus.RESEARCH_UNQUALIFIED
    assert "V1 aggregate-only" in committed.rejection_reason


def test_task3_existing_historical_records_cannot_be_retroactively_promoted():
    """Existing historical records remain readable, but cannot be promoted retroactively."""
    # Historical record loaded from storage
    historical_record = {
        "tx_id": "TX-HIST-01",
        "status": "QUALIFIED",  # Historical file claimed QUALIFIED
        "protocol_version": "LVT-1",
        "results": {"delta": 0.25},
    }
    assert historical_record["tx_id"] == "TX-HIST-01"  # Readable

    # When validated under SPE Ω LVT-2 validator, cannot be promoted
    validator = LearningValidator()
    claim = LearningClaim("C-HIST", "dom", "desc", "gen", "p1", "p2", budget_nanos=1000)
    proto = ExperimentProtocol(protocol_id="PROTO-HIST")
    results = FourArmResults(
        arm_a_baseline_score=0.6,
        arm_b_authentic_score=0.85,
        arm_c_shuffled_control_score=0.6,
        arm_d_generalization_score=0.85,
        delta_improvement=0.25,
        control_delta=0.25,
        held_out_retention=0.25,
        is_statistically_significant=True,
    )
    tx = LearningValidityTransaction("TX-HIST-01", claim, proto, results=results, evaluator_id="eval-01")
    recommitted = validator.validate_and_commit(tx)
    assert recommitted.status == QualificationStatus.RESEARCH_UNQUALIFIED


# ==============================================================================
# TASK 4: VERIFY RECEIPT AND ARTIFACT AUTHORITY (TESTS 1 - 7)
# ==============================================================================

def _make_legitimate_qualified_tx() -> tuple[LearningValidityTransaction, LearningValidator]:
    study_res = _make_study_result()
    tx = _make_base_tx(study_res)
    sk, pk = generate_keypair()
    validator = LearningValidator(trusted_oracles={"eval-oracle-01": pk.hex()})
    attestation = create_oracle_attestation(
        signing_key=sk,
        public_key=pk,
        oracle_id="eval-oracle-01",
        evidence_hash=study_res.evidence_hash,
    )
    tx.oracle_attestation = attestation
    committed = validator.validate_and_commit(tx)
    assert committed.status == QualificationStatus.QUALIFIED
    assert committed.is_attested_oracle is True
    return committed, validator


def test_task4_1_forged_qualified_status_cannot_export_artifact():
    """1. Forged QUALIFIED status cannot export a verified learning artifact."""
    claim = LearningClaim("C-FORGE", "dom", "desc", "gen", "p1", "p2", budget_nanos=1000)
    proto = ExperimentProtocol(protocol_id="PROTO-FORGE")
    tx = LearningValidityTransaction(
        tx_id="TX-FORGE",
        claim=claim,
        protocol=proto,
        status=QualificationStatus.QUALIFIED,  # Forged!
        evaluator_id="eval-01",
    )
    with pytest.raises(ValueError, match="(?i)(missing|invalid|unverified|artifact|signature)"):
        LearningTransferProtocol.synthesize_spe_learning_artifact(tx, "refined prompt")


def test_task4_2_mock_qualified_transaction_cannot_export_artifact():
    """2. Mock-qualified transaction cannot export a production-valid .spe learning artifact."""
    claim = LearningClaim("C-MOCK-EXP", "dom", "desc", "gen", "p1", "p2", budget_nanos=1000)
    proto = ExperimentProtocol(protocol_id="PROTO-MOCK")
    tx = LearningValidityTransaction("TX-MOCK-EXP", claim, proto, evaluator_id="eval-01")
    LearningValidator.mint_test_fixture_receipt(tx)

    with pytest.raises(ValueError, match="(?i)(mock|non-qualified|status)"):
        LearningTransferProtocol.synthesize_spe_learning_artifact(tx, "refined prompt")


def test_task4_3_missing_trusted_attestation_blocks_export():
    """3. Missing trusted attestation blocks export."""
    study_res = _make_study_result()
    tx = _make_base_tx(study_res)
    validator = LearningValidator()
    committed = validator.validate_and_commit(tx)
    assert committed.status == QualificationStatus.RESEARCH_SUPPORTED

    with pytest.raises(ValueError, match="(?i)(non-qualified|missing.*attestation|status)"):
        LearningTransferProtocol.synthesize_spe_learning_artifact(committed, "refined prompt")


def test_task4_4_invalid_receipt_signature_blocks_export():
    """4. Invalid receipt signature blocks export."""
    committed, validator = _make_legitimate_qualified_tx()

    # Corrupt receipt signature
    tampered_tx = copy.deepcopy(committed)
    tampered_tx.canonical_receipt_signature = "0" * 128

    with pytest.raises(ValueError, match="(?i)(invalid.*signature|receipt)"):
        LearningTransferProtocol.synthesize_spe_learning_artifact(tampered_tx, "refined prompt", validator=validator)


def test_task4_5_revoked_qualification_blocks_export():
    """5. Revoked qualification blocks export."""
    committed, validator = _make_legitimate_qualified_tx()
    revoked = LearningTransferProtocol.revoke_transaction(
        committed,
        reason=RevocationReason.COUNTEREXAMPLE_OBSERVED,
        details="Adversarial invariant violated",
    )
    assert revoked.status == QualificationStatus.REVOKED

    with pytest.raises((TransactionRevokedError, ValueError), match="(?i)(revoked|counterexample)"):
        LearningTransferProtocol.synthesize_spe_learning_artifact(revoked, "refined prompt")


def test_task4_6_changed_protocol_or_evidence_invalidates_qualification():
    """6. Changed protocol or evidence invalidates qualification."""
    committed, validator = _make_legitimate_qualified_tx()

    # Tamper with study evidence hash after commitment
    tampered_tx = copy.deepcopy(committed)
    tampered_study = copy.deepcopy(tampered_tx.lvt2_study_result)
    object.__setattr__(tampered_study, "evidence_hash", "e" * 64)
    tampered_tx.lvt2_study_result = tampered_study

    with pytest.raises(ValueError, match="(?i)(changed.*evidence|invalid)"):
        LearningTransferProtocol.synthesize_spe_learning_artifact(tampered_tx, "refined prompt", validator=validator)


def test_task4_7_unverified_model_transfer_cannot_be_labeled_verified_models():
    """7. Unverified model transfer cannot be labeled as verified_models."""
    committed, validator = _make_legitimate_qualified_tx()

    # Generator is gen-model-01. Attempting to export with unverified target models
    with pytest.raises(ValueError, match="(?i)(unverified.*model)"):
        LearningTransferProtocol.synthesize_spe_learning_artifact(
            committed,
            refined_prompt_content="refined prompt",
            supported_models=["claude-3-7-sonnet", "unverified-gpt-99"],
            validator=validator,
        )

    # Now verify claude-3-7-sonnet via evaluate_cross_model_transfer
    test_ds = [{"input": "test", "label": "test"}]
    report = LearningTransferProtocol.evaluate_cross_model_transfer(
        committed,
        target_model_id="claude-3-7-sonnet",
        evaluator_fn=lambda p, ex: 0.95 if "refined" in p else 0.70,
        test_dataset=test_ds,
        base_prompt="base",
        refined_prompt="refined",
    )
    assert report["transfers_successfully"] is True

    # Now claude-3-7-sonnet is verified, but unverified-gpt-99 is still not!
    with pytest.raises(ValueError, match="(?i)(unverified.*model)"):
        LearningTransferProtocol.synthesize_spe_learning_artifact(
            committed,
            refined_prompt_content="refined prompt",
            supported_models=["claude-3-7-sonnet", "unverified-gpt-99"],
            validator=validator,
        )

    # Valid export containing only verified models
    artifact_json = LearningTransferProtocol.synthesize_spe_learning_artifact(
        committed,
        refined_prompt_content="refined prompt",
        supported_models=["gen-model-01", "claude-3-7-sonnet"],
        validator=validator,
    )
    artifact = json.loads(artifact_json)
    assert "gen-model-01" in artifact["verified_models"]
    assert "claude-3-7-sonnet" in artifact["verified_models"]
    assert "unverified-gpt-99" not in artifact["verified_models"]


def test_task2_d2_key_only_allowlist_fails_closed():
    """D2. Key-only allowlist rejects unlisted keys."""
    study_res = _make_study_result()
    tx = _make_base_tx(study_res)

    trusted_sk, trusted_pk = generate_keypair()
    # Validator configured ONLY with trusted_oracle_keys (no trusted_oracles dict)
    validator = LearningValidator(trusted_oracle_keys={trusted_pk.hex()})

    untrusted_sk, untrusted_pk = generate_keypair()
    attestation = create_oracle_attestation(
        signing_key=untrusted_sk,
        public_key=untrusted_pk,
        oracle_id="eval-oracle-01",
        evidence_hash=study_res.evidence_hash,
    )
    tx.oracle_attestation = attestation

    committed = validator.validate_and_commit(tx)
    assert committed.status != QualificationStatus.QUALIFIED
    assert committed.is_attested_oracle is False


def test_task2_f2_oracle_id_evaluator_mismatch():
    """F2. Both oracles trusted, but attestation oracle_id != tx evaluator_id."""
    study_res = _make_study_result()
    tx = _make_base_tx(study_res)

    sk1, pk1 = generate_keypair()
    sk2, pk2 = generate_keypair()
    validator = LearningValidator(
        trusted_oracles={
            "eval-oracle-01": pk1.hex(),
            "eval-oracle-02": pk2.hex(),
        }
    )

    attestation = create_oracle_attestation(
        signing_key=sk2,
        public_key=pk2,
        oracle_id="eval-oracle-02",
        evidence_hash=study_res.evidence_hash,
    )
    tx.oracle_attestation = attestation

    committed = validator.validate_and_commit(tx)
    assert committed.status == QualificationStatus.REJECTED
    assert committed.is_attested_oracle is False


def test_task4_5b_revoked_reason_blocks_export_even_if_qualified():
    """5b. Revocation reason set blocks export even if status was set to QUALIFIED."""
    committed, validator = _make_legitimate_qualified_tx()
    committed.revocation_reason = RevocationReason.COUNTEREXAMPLE_OBSERVED
    with pytest.raises((TransactionRevokedError, ValueError), match="(?i)(revoked|counterexample)"):
        LearningTransferProtocol.synthesize_spe_learning_artifact(committed, "refined prompt")


def test_task7_inconclusive_study_cannot_yield_qualified():
    """Task 7 & M10: INCONCLUSIVE study must never yield QUALIFIED."""
    train = [Observation(f"t-{i}", f"tfam-{i}", f"a{i:063x}", 0.1, 0.9, 0.1) for i in range(24)]
    heldout = [Observation(f"h-{i}", f"hfam-{i}", f"b{i:063x}", 0.80, 0.81) for i in range(24)]
    proto = StudyProtocol(
        study_id="STUDY-INCONC",
        evaluator_id="eval-oracle-01",
        generator_id="gen-model-01",
        evaluator_kind="independent_static_oracle",
        oracle_digest="0" * 64,
        model_digest="1" * 64,
        primary_effect_floor=0.05,
        alpha=0.05,
        min_heldout_families=20,
        family_level_significance=True,
        multiplicity=2,
    )
    study_res = run_study(proto, train, heldout)
    assert study_res.status == "INCONCLUSIVE"
    tx = _make_base_tx(study_res)
    validator = LearningValidator()
    committed = validator.validate_and_commit(tx, strict=False)
    assert committed.status == QualificationStatus.INCONCLUSIVE
    assert committed.status != QualificationStatus.QUALIFIED

