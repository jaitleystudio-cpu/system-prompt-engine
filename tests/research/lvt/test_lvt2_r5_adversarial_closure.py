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
import hashlib
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
    default_p = LearningValidator._get_tombstone_path()
    if default_p.is_file():
        try:
            default_p.unlink()
        except OSError:
            pass
    yield
    LearningValidator.clear_owner_registries()
    if default_p.is_file():
        try:
            default_p.unlink()
        except OSError:
            pass


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

    # 2. When evaluated without target_model_digest or model_digest_type, it automatically defaults to SYNTHETIC_MODEL_IDENTIFIER
    tx_auto, validator_auto, auto_sk, _ = _make_qualified_fixture()
    auto_report = LearningTransferProtocol.evaluate_cross_model_transfer(
        tx=tx_auto,
        target_model_id="claude-3-7-sonnet",
        evaluator_fn=lambda p, item: 0.92 if "refined" in p else 0.20,
        test_dataset=dataset,
        base_prompt="base",
        refined_prompt="refined",
        validator=validator_auto,
        oracle_signing_key=auto_sk,
    )
    assert auto_report["model_digest_type"] == "SYNTHETIC_MODEL_IDENTIFIER"
    with pytest.raises(ValueError, match="(?i)(unverified.*model|synthetic)"):
        LearningTransferProtocol.synthesize_spe_learning_artifact(
            tx=tx_auto,
            refined_prompt_content="refined prompt content",
            supported_models=["gpt-4o", "claude-3-7-sonnet"],
            validator=validator_auto,
        )

    # 3. When evaluated with an explicit verified model revision digest, it exports cleanly without allow_synthetic_models
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

def test_finding_c_revocation_tombstone_prevents_metadata_restore_replay(tmp_path):
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

    # Attempt 3: Cross-validator instance must observe tombstone recorded by another validator
    other_validator = LearningValidator(
        trusted_oracles={"oracle-closure-01": validator._trusted_oracles["oracle-closure-01"]},
        default_signing_key=validator._sk,
        default_public_key=validator._pk,
    )
    assert other_validator.is_tombstoned(receipt_hash=receipt_hash, evidence_hash=evidence_hash) is True

    # Attempt 4: Durable disk store persistence across simulated process restart (cleared in-memory state)
    tombstone_file = tmp_path / "revocation_tombstones.jsonl"
    LearningValidator.set_tombstone_store_path(tombstone_file)

    # Record a new tombstone to disk
    LearningValidator._record_global_tombstone(
        receipt_hash="0123" * 16,
        evidence_hash="4567" * 16,
        tx_id="tx-disk-test",
        target_model_id="deepseek-r1",
        reason=RevocationReason.DISTRIBUTION_DRIFT_EXCEEDED.value,
        details="Disk persistence test",
    )
    assert tombstone_file.exists()

    # Simulate fresh process: clear in-memory registries completely
    LearningValidator.clear_owner_registries()
    assert LearningValidator._GLOBAL_TOMBSTONES == set()

    # Configure disk path in the fresh process and verify detection
    LearningValidator.set_tombstone_store_path(tombstone_file)
    fresh_validator = LearningValidator()
    assert fresh_validator.is_tombstoned(receipt_hash="0123" * 16) is True
    assert fresh_validator.is_tombstoned(evidence_hash="4567" * 16) is True


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

    # 3. Collapsed clustering embedded in dataset items even when family_provenance argument is omitted -> REJECTED
    collapsed_item_dataset = [
        {
            "item_id": f"closure-item-{i}",
            "family_id": f"closure-fam-{i}",
            "source_cluster": f"shared-cluster-{i % 3}",
            "content_sha256": f"c{i:063x}",
            "prompt": f"problem-{i}",
        }
        for i in range(24)
    ]
    with pytest.raises(ValueError, match="(?i)(clustering.*distinction|dataset items map to only)"):
        LearningTransferProtocol.evaluate_cross_model_transfer(
            tx=tx,
            target_model_id="claude-3-7-sonnet",
            evaluator_fn=lambda p, item: 0.92 if "refined" in p else 0.20,
            test_dataset=collapsed_item_dataset,
            base_prompt="base",
            refined_prompt="refined",
            validator=validator,
            oracle_signing_key=oracle_sk,
        )

    # 4. Legitimate distinct family clustering (24 distinct clusters) and controlled contamination -> ACCEPTED
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


# =============================================================================
# ROUND 2 ADVERSARIAL GAP CLOSURE TESTS
# =============================================================================

def test_finding_a_synthetic_digest_misclassified_as_verified_revision_rejected():
    """
    Finding A (Adversarial): Synthetic model identifier digest cannot be mislabeled as
    VERIFIED_MODEL_REVISION by caller-supplied label.
    """
    tx, validator, oracle_sk, _ = _make_qualified_fixture()
    dataset = _make_transfer_dataset(24)
    synthetic_digest = hashlib.sha256(b"spe-model-v1:claude-3-7-sonnet").hexdigest()

    # Attempt 1: Caller supplies explicit synthetic hash but labels it VERIFIED_MODEL_REVISION
    with pytest.raises(ValueError, match="(?i)(synthetic.*cannot.*verified|mislabeled|synthetic.*model.*identifier)"):
        LearningTransferProtocol.evaluate_cross_model_transfer(
            tx=tx,
            target_model_id="claude-3-7-sonnet",
            evaluator_fn=lambda p, item: 0.92 if "refined" in p else 0.20,
            test_dataset=dataset,
            base_prompt="base",
            refined_prompt="refined",
            validator=validator,
            oracle_signing_key=oracle_sk,
            target_model_digest=synthetic_digest,
            model_digest_type="VERIFIED_MODEL_REVISION",
        )

    # Attempt 2: Caller omits target_model_digest (defaulting to synthetic) but requests VERIFIED_MODEL_REVISION
    with pytest.raises(ValueError, match="(?i)(synthetic.*cannot.*verified|mislabeled|synthetic.*model.*identifier)"):
        LearningTransferProtocol.evaluate_cross_model_transfer(
            tx=tx,
            target_model_id="claude-3-7-sonnet",
            evaluator_fn=lambda p, item: 0.92 if "refined" in p else 0.20,
            test_dataset=dataset,
            base_prompt="base",
            refined_prompt="refined",
            validator=validator,
            oracle_signing_key=oracle_sk,
            model_digest_type="VERIFIED_MODEL_REVISION",
        )

    # Attempt 3: Caller forges report metadata claiming VERIFIED_MODEL_REVISION with synthetic digest
    # directly against verify_model_transfer_receipt
    forged_report = {
        "tx_id": tx.tx_id,
        "target_model_id": "claude-3-7-sonnet",
        "target_model_digest": synthetic_digest,
        "model_digest_type": "VERIFIED_MODEL_REVISION",
    }
    is_authentic, is_verified, reason = validator.verify_model_transfer_receipt(
        tx, "claude-3-7-sonnet", forged_report
    )
    assert is_authentic is False
    assert is_verified is False


def test_finding_b_self_asserted_authority_and_unauthorized_root_rejected():
    """
    Finding B (Adversarial): Caller cannot self-assert owner authorization via constructor flag,
    and unauthorized owner roots cannot confer authority to LearningValidator.
    """
    authoritative_owner_sk, authoritative_owner_pk = generate_keypair()
    unauthorized_sk, unauthorized_pk = generate_keypair()
    oracle_sk, oracle_pk = generate_keypair()

    LearningValidator.register_owner_root_key(authoritative_owner_pk)

    # 1. Caller attempts to self-assert owner authorization using caller-controlled flag
    with pytest.raises(ValueError, match="(?i)(caller.*self-assert|is_owner_authorized.*forbidden|forbidden|unauthorized)"):
        LearningValidator(
            trusted_oracles={"oracle-closure-01": oracle_pk.hex()},
            is_owner_authorized=True,
        )

    # 2. Caller supplies an unauthorized root key and attestation signed by unauthorized root
    val_sk, val_pk = generate_keypair()
    unauth_attestation = create_owner_validator_attestation(
        owner_signing_key=unauthorized_sk,
        owner_public_key=unauthorized_pk,
        validator_public_key=val_pk,
    )
    unauth_val = LearningValidator(
        default_signing_key=val_sk,
        default_public_key=val_pk,
        trusted_oracles={"oracle-closure-01": oracle_pk.hex()},
        owner_root_public_key=unauthorized_pk,
        owner_attestation=unauth_attestation,
    )
    # Must NOT confer owner authority
    assert unauth_val.is_owner_authorized is False

    # 3. Caller attempts unauthenticated validator enrollment into registry without valid owner attestation
    with pytest.raises(ValueError, match="(?i)(unauthenticated.*validator|owner attestation required|unauthorized)"):
        LearningValidator.register_authorized_validator(val_pk)


def test_finding_c_revocation_persists_across_process_restart_and_backup_restore(tmp_path):
    """
    Finding C (Adversarial): Revocation tombstones persist durably and resist replay attacks
    where an adversary restores pre-revocation signed metadata across a simulated process restart.
    """
    tombstone_file = tmp_path / "durable_tombstones.jsonl"
    LearningValidator.set_tombstone_store_path(tombstone_file)

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

    receipt_hash = report["transfer_receipt_hash"]
    evidence_hash = report["evidence_hash"]
    pre_revocation_backup = copy.deepcopy(report)

    # Revoke the transfer
    LearningTransferProtocol.revoke_model_transfer(
        tx=tx,
        target_model_id="claude-3-7-sonnet",
        reason=RevocationReason.DISTRIBUTION_DRIFT_EXCEEDED,
        details="Post-deployment performance collapse",
        validator=validator,
    )
    assert tombstone_file.exists()

    # Adversary restores transaction metadata to pre-revocation backup and wipes tombstones from tx
    tx.metadata["cross_model_transfers"]["claude-3-7-sonnet"] = copy.deepcopy(pre_revocation_backup)
    tx.metadata["revocation_tombstones"] = []

    # SIMULATE COMPLETE PROCESS RESTART
    # All in-memory state is wiped
    LearningValidator.clear_owner_registries()
    assert len(LearningValidator._GLOBAL_TOMBSTONES) == 0

    # Fresh process boots with the persistent tombstone store path configured
    LearningValidator.set_tombstone_store_path(tombstone_file)
    fresh_validator = LearningValidator(
        trusted_oracles={"oracle-closure-01": validator._trusted_oracles["oracle-closure-01"]},
        default_signing_key=validator._sk,
        default_public_key=validator._pk,
    )

    # 1. Fresh validator must detect tombstone from durable store
    assert fresh_validator.is_tombstoned(receipt_hash=receipt_hash, evidence_hash=evidence_hash) is True

    # 2. Fresh validator must reject restored pre-revocation receipt
    is_authentic, is_verified, reason = fresh_validator.verify_model_transfer_receipt(
        tx, "claude-3-7-sonnet", tx.metadata["cross_model_transfers"]["claude-3-7-sonnet"]
    )
    assert is_authentic is False
    assert is_verified is False
    assert "tombstone" in reason.lower() or "revoked" in reason.lower()

    # 3. Artifact export using fresh validator must fail
    with pytest.raises(ValueError, match="(?i)(revoked|tombstone)"):
        LearningTransferProtocol.synthesize_spe_learning_artifact(
            tx=tx,
            refined_prompt_content="refined prompt",
            supported_models=["gpt-4o", "claude-3-7-sonnet"],
            validator=fresh_validator,
        )

    # 4. Process restart / registry reset with default persistent store (no manual path configured)
    LearningValidator.set_tombstone_store_path(None)
    tx2, val2, oracle_sk2, _ = _make_qualified_fixture()
    report2 = LearningTransferProtocol.evaluate_cross_model_transfer(
        tx=tx2,
        target_model_id="claude-3-7-sonnet",
        evaluator_fn=lambda p, item: 0.92 if "refined" in p else 0.20,
        test_dataset=dataset,
        base_prompt="base",
        refined_prompt="refined",
        validator=val2,
        target_model_digest="d" * 64,
        oracle_signing_key=oracle_sk2,
    )
    pre_rev2 = copy.deepcopy(report2)
    LearningTransferProtocol.revoke_model_transfer(
        tx=tx2,
        target_model_id="claude-3-7-sonnet",
        reason=RevocationReason.DISTRIBUTION_DRIFT_EXCEEDED,
        details="Default persistent storage test",
        validator=val2,
    )
    # Simulate process restart without manual path setting
    LearningValidator.clear_owner_registries()
    tx2.metadata["cross_model_transfers"]["claude-3-7-sonnet"] = copy.deepcopy(pre_rev2)
    tx2.metadata["revocation_tombstones"] = []
    val2_fresh = LearningValidator(
        trusted_oracles={"oracle-closure-01": val2._trusted_oracles["oracle-closure-01"]},
        default_signing_key=val2._sk,
        default_public_key=val2._pk,
    )
    assert val2_fresh.is_tombstoned(receipt_hash=pre_rev2["transfer_receipt_hash"]) is True
    is_auth2, is_ver2, reason2 = val2_fresh.verify_model_transfer_receipt(
        tx2, "claude-3-7-sonnet", tx2.metadata["cross_model_transfers"]["claude-3-7-sonnet"]
    )
    assert is_auth2 is False
    assert is_ver2 is False
    assert "tombstone" in reason2.lower() or "revoked" in reason2.lower()



def test_finding_d_missing_provenance_and_unsupported_independence_rejected():
    """
    Finding D (Adversarial): Production qualification rejects missing task-family provenance
    and unsupported declarations of independence.
    """
    tx, validator, oracle_sk, _ = _make_qualified_fixture()
    dataset = _make_transfer_dataset(24)

    # 1. Missing family provenance when require_family_provenance=True -> REJECTED
    with pytest.raises(ValueError, match="(?i)(missing.*family provenance|family.*custody)"):
        LearningTransferProtocol.evaluate_cross_model_transfer(
            tx=tx,
            target_model_id="claude-3-7-sonnet",
            evaluator_fn=lambda p, item: 0.92 if "refined" in p else 0.20,
            test_dataset=dataset,
            base_prompt="base",
            refined_prompt="refined",
            validator=validator,
            oracle_signing_key=oracle_sk,
            require_family_provenance=True,
            family_provenance=None,
        )

    distinct_provenance = {
        f"closure-fam-{i}": {
            "source_cluster": f"unique-cluster-{i}",
            "task_type": "reasoning",
        }
        for i in range(24)
    }

    # 2a. Empty independence assertions dict -> REJECTED
    with pytest.raises(ValueError, match="(?i)(independence.*assertions|unsupported|contamination)"):
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
            independence_assertions={},
        )

    # 2b. Missing contamination_controlled assertion -> REJECTED
    with pytest.raises(ValueError, match="(?i)(independence.*assertions|unsupported|contamination)"):
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
            independence_assertions={"independent_task_families": True},
        )

    # 2c. Non-boolean / unverified contamination assertion -> REJECTED
    with pytest.raises(ValueError, match="(?i)(independence.*assertions|unsupported|contamination)"):
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
                "contamination_controlled": "unverified",
                "independent_task_families": True,
            },
        )

