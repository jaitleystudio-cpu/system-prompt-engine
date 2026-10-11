"""
SPE Ω — LVT-2 R5 Independent Adversarial Closure & Verification Suite.

Adversarial closure tests verifying the four P0 security findings:
Finding A: Model revision identity (synthetic model-name hash vs. verified model revision).
Finding B: Owner authority boundary for LearningValidator (root-of-trust anchoring).
Finding C: Revocation replay resistance / tombstone persistence (immutable receipt/evidence tombstones).
Finding D: Task family independence and dataset custody (clustering distinction and contamination controls).
"""

from __future__ import annotations

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
    run_study,
)
from spe_runtime.research.lvt.learning_validator import (
    create_oracle_attestation,
    create_owner_validator_attestation,
)


@pytest.fixture(autouse=True)
def _clean_owner_registries():
    LearningValidator.clear_owner_registries()
    yield
    LearningValidator.clear_owner_registries()


def _make_qualified_fixture():
    oracle_sk, oracle_pk = generate_keypair()
    validator = LearningValidator(trusted_oracles={"oracle-closure-01": oracle_pk.hex()})
    train = [
        Observation(f"tr-{i}", f"tr-fam-{i}", f"a{i:063x}", 0.15, 0.90, 0.15)
        for i in range(24)
    ]
    heldout = [
        Observation(f"ho-{i}", f"ho-fam-{i}", f"b{i:063x}", 0.15, 0.90)
        for i in range(24)
    ]
    proto = StudyProtocol(
        study_id="STUDY-CLOSURE-BASE",
        evaluator_id="oracle-closure-01",
        generator_id="gpt-4o",
        evaluator_kind="independent_static_oracle",
        oracle_digest="1" * 64,
        model_digest="2" * 64,
        alpha=0.05,
        primary_effect_floor=0.05,
        min_heldout_families=20,
        family_level_significance=True,
        multiplicity=2,
    )
    study_res = run_study(proto, train, heldout)
    claim = LearningClaim(
        claim_id="CLM-CLOSURE-001",
        domain="formal_verification",
        description="Adversarial closure verification",
        generator_id="gpt-4o",
        base_prompt_ref="base_v1",
        candidate_prompt_ref="refined_v2",
        budget_nanos=5000,
    )
    exp_proto = ExperimentProtocol(protocol_id="PROTO-CLOSURE-001")
    results = FourArmResults(
        arm_a_baseline_score=0.15,
        arm_b_authentic_score=0.90,
        arm_c_shuffled_control_score=0.15,
        arm_d_generalization_score=0.90,
        delta_improvement=0.75,
        control_delta=0.75,
        held_out_retention=0.75,
        is_statistically_significant=True,
        total_cost_nanos=5000,
    )
    tx = LearningValidityTransaction(
        tx_id="TX-CLOSURE-001",
        claim=claim,
        protocol=exp_proto,
        results=results,
        evaluator_id="oracle-closure-01",
        evaluator_type=EvaluatorType.INDEPENDENT_STATIC_ORACLE,
        lvt2_study_result=study_res,
        oracle_attestation=create_oracle_attestation(
            signing_key=oracle_sk,
            public_key=oracle_pk,
            oracle_id="oracle-closure-01",
            evidence_hash=study_res.evidence_hash,
        ),
    )
    committed = validator.validate_and_commit(tx)
    assert committed.status == QualificationStatus.QUALIFIED
    return committed, validator, oracle_sk, oracle_pk


def _make_transfer_dataset(n: int = 24):
    return [
        {
            "item_id": f"closure-item-{i}",
            "family_id": f"closure-fam-{i}",
            "content_sha256": f"c{i:063x}",
            "prompt": f"problem-{i}",
        }
        for i in range(n)
    ]


# =============================================================================
# FINDING A: MODEL REVISION IDENTITY
# =============================================================================

def test_finding_a_synthetic_model_digest_rejected_for_export():
    """
    Finding A: Prohibit synthetic model identifier digests from qualifying as verified model revisions
    in production .spe export unless explicitly flagged.
    """
    tx, validator, oracle_sk, _ = _make_qualified_fixture()
    dataset = _make_transfer_dataset(24)

    # 1. Evaluate transfer using an explicitly synthetic model identifier digest
    report = LearningTransferProtocol.evaluate_cross_model_transfer(
        tx=tx,
        target_model_id="claude-3-7-sonnet",
        evaluator_fn=lambda p, item: 0.92 if "refined" in p else 0.20,
        test_dataset=dataset,
        base_prompt="base",
        refined_prompt="refined",
        validator=validator,
        oracle_signing_key=oracle_sk,
        model_digest_type="SYNTHETIC_MODEL_IDENTIFIER",
    )
    assert report["transfers_successfully"] is True
    assert report["model_digest_type"] == "SYNTHETIC_MODEL_IDENTIFIER"

    # Default production export rejects synthetic model digest for supported_models
    with pytest.raises(ValueError, match="(?i)(unverified.*model|synthetic)"):
        LearningTransferProtocol.synthesize_spe_learning_artifact(
            tx=tx,
            refined_prompt_content="refined prompt content",
            supported_models=["gpt-4o", "claude-3-7-sonnet"],
            validator=validator,
            allow_synthetic_models=False,
        )

    # When allow_synthetic_models=True is explicitly passed, synthetic model is admitted
    artifact_str = LearningTransferProtocol.synthesize_spe_learning_artifact(
        tx=tx,
        refined_prompt_content="refined prompt content",
        supported_models=["gpt-4o", "claude-3-7-sonnet"],
        validator=validator,
        allow_synthetic_models=True,
    )
    artifact = json.loads(artifact_str)
    assert "claude-3-7-sonnet" in artifact["verified_models"]

    # 2. When evaluated with an explicit verified model revision digest, it exports cleanly without allow_synthetic_models
    verified_tx, verified_validator, verified_sk, _ = _make_qualified_fixture()
    verified_report = LearningTransferProtocol.evaluate_cross_model_transfer(
        tx=verified_tx,
        target_model_id="claude-3-7-sonnet",
        evaluator_fn=lambda p, item: 0.92 if "refined" in p else 0.20,
        test_dataset=dataset,
        base_prompt="base",
        refined_prompt="refined",
        validator=verified_validator,
        oracle_signing_key=verified_sk,
        target_model_digest="e" * 64,
        model_digest_type="VERIFIED_MODEL_REVISION",
    )
    assert verified_report["transfers_successfully"] is True
    assert verified_report["model_digest_type"] == "VERIFIED_MODEL_REVISION"

    clean_artifact_str = LearningTransferProtocol.synthesize_spe_learning_artifact(
        tx=verified_tx,
        refined_prompt_content="refined prompt content",
        supported_models=["gpt-4o", "claude-3-7-sonnet"],
        validator=verified_validator,
    )
    clean_artifact = json.loads(clean_artifact_str)
    assert "claude-3-7-sonnet" in clean_artifact["verified_models"]
    assert clean_artifact["verified_model_transfers"]["claude-3-7-sonnet"]["model_digest_type"] == "VERIFIED_MODEL_REVISION"


# =============================================================================
# FINDING B: OWNER AUTHORITY BOUNDARY FOR LEARNINGVALIDATOR
# =============================================================================

def test_finding_b_unauthorized_validator_rejected():
    """
    Finding B: LearningValidator must be anchored to an authoritative owner root key.
    Unauthorized validators cannot mint production QUALIFIED receipts or export .spe artifacts.
    """
    owner_sk, owner_pk = generate_keypair()
    oracle_sk, oracle_pk = generate_keypair()

    # Enforce owner authority requirement by registering owner root key
    LearningValidator.register_owner_root_key(owner_pk)

    # 1. Un-attested validator attempting to validate and commit
    unauth_validator = LearningValidator(trusted_oracles={"oracle-closure-01": oracle_pk.hex()})
    assert unauth_validator.is_owner_authorized is False

    train = [
        Observation(f"tr-{i}", f"tr-fam-{i}", f"a{i:063x}", 0.15, 0.90, 0.15)
        for i in range(24)
    ]
    heldout = [
        Observation(f"ho-{i}", f"ho-fam-{i}", f"b{i:063x}", 0.15, 0.90)
        for i in range(24)
    ]
    proto = StudyProtocol(
        study_id="STUDY-CLOSURE-B",
        evaluator_id="oracle-closure-01",
        generator_id="gpt-4o",
        evaluator_kind="independent_static_oracle",
        oracle_digest="1" * 64,
        model_digest="2" * 64,
        alpha=0.05,
        primary_effect_floor=0.05,
        min_heldout_families=20,
        family_level_significance=True,
        multiplicity=2,
    )
    study_res = run_study(proto, train, heldout)
    claim = LearningClaim("CLM-B", "formal_verification", "Authority test", "gpt-4o", "b1", "c1", 5000)
    tx = LearningValidityTransaction(
        tx_id="TX-CLOSURE-B",
        claim=claim,
        protocol=ExperimentProtocol("PROTO-B"),
        results=FourArmResults(0.15, 0.90, 0.15, 0.90, 0.75, 0.75, 0.75, True, 5000),
        evaluator_id="oracle-closure-01",
        evaluator_type=EvaluatorType.INDEPENDENT_STATIC_ORACLE,
        lvt2_study_result=study_res,
        oracle_attestation=create_oracle_attestation(
            signing_key=oracle_sk,
            public_key=oracle_pk,
            oracle_id="oracle-closure-01",
            evidence_hash=study_res.evidence_hash,
        ),
    )

    committed = unauth_validator.validate_and_commit(tx)
    assert committed.status == QualificationStatus.REJECTED
    assert "Unauthorized LearningValidator" in committed.rejection_reason

    # Attempting export with unauthorized validator must fail
    with pytest.raises(ValueError, match="(?i)(unauthorized.*validator|owner)"):
        LearningTransferProtocol.synthesize_spe_learning_artifact(
            tx=committed,
            refined_prompt_content="prompt",
            validator=unauth_validator,
        )

    # 2. Forged owner attestation rejected
    forged_att = {
        "owner_public_key": owner_pk.hex(),
        "validator_public_key": unauth_validator.public_key.hex(),
        "scope": "PRODUCTION_LEARNING_VALIDATION",
        "verdict": "APPROVED",
        "timestamp": 1234567890.0,
        "signature": "0" * 128,
    }
    forged_validator = LearningValidator(
        trusted_oracles={"oracle-closure-01": oracle_pk.hex()},
        owner_root_public_key=owner_pk,
        owner_attestation=forged_att,
    )
    assert forged_validator.is_owner_authorized is False

    # 3. Legitimate owner attestation succeeds
    val_sk, val_pk = generate_keypair()
    valid_att = create_owner_validator_attestation(
        owner_signing_key=owner_sk,
        owner_public_key=owner_pk,
        validator_public_key=val_pk,
    )
    auth_validator = LearningValidator(
        default_signing_key=val_sk,
        default_public_key=val_pk,
        trusted_oracles={"oracle-closure-01": oracle_pk.hex()},
        owner_root_public_key=owner_pk,
        owner_attestation=valid_att,
    )
    assert auth_validator.is_owner_authorized is True

    tx_valid = copy.deepcopy(tx)
    committed_auth = auth_validator.validate_and_commit(tx_valid)
    assert committed_auth.status == QualificationStatus.QUALIFIED


# =============================================================================
# FINDING C: REVOCATION REPLAY RESISTANCE / TOMBSTONE PERSISTENCE
# =============================================================================

def test_finding_c_revocation_tombstone_prevents_metadata_restore_replay():
    """
    Finding C: Durable revocation tombstones recorded in the validator prevent replay
    attacks where an adversary restores pre-revocation mutable transaction metadata.
    """
    tx, validator, oracle_sk, _ = _make_qualified_fixture()
    dataset = _make_transfer_dataset(24)

    report = LearningTransferProtocol.evaluate_cross_model_transfer(
        tx=tx,
        target_model_id="claude-3-7-sonnet",
        evaluator_fn=lambda p, item: 0.92 if "refined" in p else 0.20,
        test_dataset=dataset,
        base_prompt="base",
        refined_prompt="refined",
        validator=validator,
        target_model_digest="d" * 64,
        oracle_signing_key=oracle_sk,
    )
    assert report["transfers_successfully"] is True
    assert report["revoked"] is False

    receipt_hash = report["transfer_receipt_hash"]
    evidence_hash = report["evidence_hash"]

    # Attacker saves clean pre-revocation transfer metadata copy
    pre_revocation_report = copy.deepcopy(report)

    # Transfer is officially revoked
    LearningTransferProtocol.revoke_model_transfer(
        tx=tx,
        target_model_id="claude-3-7-sonnet",
        reason=RevocationReason.DISTRIBUTION_DRIFT_EXCEEDED,
        details="Model regressed on continuous monitoring held-out split",
        validator=validator,
    )
    assert tx.metadata["cross_model_transfers"]["claude-3-7-sonnet"]["revoked"] is True
    assert validator.is_tombstoned(receipt_hash=receipt_hash, evidence_hash=evidence_hash) is True

    # Attacker restores pre-revocation mutable transaction metadata and clears tombstones from tx
    tx.metadata["cross_model_transfers"]["claude-3-7-sonnet"] = copy.deepcopy(pre_revocation_report)
    tx.metadata["revocation_tombstones"] = []
    assert tx.metadata["cross_model_transfers"]["claude-3-7-sonnet"]["revoked"] is False

    # Attempt 1: synthesize_spe_learning_artifact must still reject because validator holds durable tombstone
    with pytest.raises(ValueError, match="(?i)(revoked|tombstone)"):
        LearningTransferProtocol.synthesize_spe_learning_artifact(
            tx=tx,
            refined_prompt_content="refined prompt",
            supported_models=["gpt-4o", "claude-3-7-sonnet"],
            validator=validator,
        )

    # Attempt 2: verify_model_transfer_receipt directly must also reject the restored report
    is_authentic, is_verified, reason = validator.verify_model_transfer_receipt(
        tx, "claude-3-7-sonnet", tx.metadata["cross_model_transfers"]["claude-3-7-sonnet"]
    )
    assert is_authentic is False
    assert is_verified is False
    assert "tombstone" in reason.lower() or "revoked" in reason.lower()


# =============================================================================
# FINDING D: TASK FAMILY INDEPENDENCE & DATASET CUSTODY
# =============================================================================

def test_finding_d_insufficient_task_clusters_rejected():
    """
    Finding D: Enforce auditable family clustering distinction. Datasets mapping nominal family IDs
    to fewer than 20 independent task clusters must be rejected.
    """
    tx, validator, oracle_sk, _ = _make_qualified_fixture()
    dataset = _make_transfer_dataset(24)

    # 1. Nominal 24 families mapping to only 5 underlying task clusters -> REJECTED
    collapsed_provenance = {
        f"closure-fam-{i}": {
            "source_cluster": f"shared-cluster-{i % 5}",
            "task_type": "reasoning",
        }
        for i in range(24)
    }

    with pytest.raises(ValueError, match="(?i)(clustering.*distinction|family.*clustering)"):
        LearningTransferProtocol.evaluate_cross_model_transfer(
            tx=tx,
            target_model_id="claude-3-7-sonnet",
            evaluator_fn=lambda p, item: 0.92 if "refined" in p else 0.20,
            test_dataset=dataset,
            base_prompt="base",
            refined_prompt="refined",
            validator=validator,
            oracle_signing_key=oracle_sk,
            family_provenance=collapsed_provenance,
        )

    # 2. Contamination control violation in independence assertions -> REJECTED
    distinct_provenance = {
        f"closure-fam-{i}": {
            "source_cluster": f"unique-cluster-{i}",
            "task_type": "reasoning",
        }
        for i in range(24)
    }
    with pytest.raises(ValueError, match="(?i)(contamination)"):
        LearningTransferProtocol.evaluate_cross_model_transfer(
            tx=tx,
            target_model_id="claude-3-7-sonnet",
            evaluator_fn=lambda p, item: 0.92 if "refined" in p else 0.20,
            test_dataset=dataset,
            base_prompt="base",
            refined_prompt="refined",
            validator=validator,
            oracle_signing_key=oracle_sk,
            family_provenance=distinct_provenance,
            independence_assertions={
                "contamination_controlled": False,
                "independent_task_families": True,
            },
        )

    # 3. Legitimate distinct family clustering (24 distinct clusters) and controlled contamination -> ACCEPTED
    valid_report = LearningTransferProtocol.evaluate_cross_model_transfer(
        tx=tx,
        target_model_id="claude-3-7-sonnet",
        evaluator_fn=lambda p, item: 0.92 if "refined" in p else 0.20,
        test_dataset=dataset,
        base_prompt="base",
        refined_prompt="refined",
        validator=validator,
        oracle_signing_key=oracle_sk,
        target_model_digest="d" * 64,
        family_provenance=distinct_provenance,
        independence_assertions={
            "contamination_controlled": True,
            "independent_task_families": True,
        },
    )
    assert valid_report["transfers_successfully"] is True
    assert "family_provenance" in valid_report
    assert "independence_assertions" in valid_report
