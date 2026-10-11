"""
SPE Ω — LVT-2 R5 Adversarial Regression Suite:
Authenticated Cross-Model Transfer Evidence & Export Integrity.

Challenges:
1. Absent validator in evaluate_cross_model_transfer / synthesize_spe_learning_artifact
2. Untrusted signing key (unconfigured validator, unenrolled oracle key, wrong validator key)
3. Forged transfer metadata in tx.metadata["cross_model_transfers"]
4. Tampered evaluation result (mutating transfers_successfully, transfer_delta, or observation scores)
5. Mismatched model identity (protocol generator_id != target_model_id, or cross-key report copy)
6. Missing family-level provenance (missing item_id, family_id, or 64-char hex content_sha256)
7. One-item mock qualification and insufficient independent families (< 20 families)
8. Revoked evidence (revoked model transfer report or revoked parent transaction)
9. Replay against a changed protocol (parent protocol changed or transfer protocol mutated)
10. Unauthorized .spe export vs. full authenticated multi-family cross-model transfer export
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
    TransactionRevokedError,
    run_study,
)
from spe_runtime.research.lvt.learning_validator import create_oracle_attestation


def _make_r5_qualified_fixture():
    oracle_sk, oracle_pk = generate_keypair()
    validator = LearningValidator(trusted_oracles={"oracle-r5-01": oracle_pk.hex()})
    train = [
        Observation(f"tr-{i}", f"tr-fam-{i}", f"a{i:063x}", 0.15, 0.90, 0.15)
        for i in range(24)
    ]
    heldout = [
        Observation(f"ho-{i}", f"ho-fam-{i}", f"b{i:063x}", 0.15, 0.90)
        for i in range(24)
    ]
    proto = StudyProtocol(
        study_id="STUDY-R5-BASE",
        evaluator_id="oracle-r5-01",
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
        claim_id="CLM-R5-001",
        domain="formal_verification",
        description="Authenticated cross-model transfer",
        generator_id="gpt-4o",
        base_prompt_ref="base_v1",
        candidate_prompt_ref="refined_v2",
        budget_nanos=5000,
    )
    exp_proto = ExperimentProtocol(protocol_id="PROTO-R5-001")
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
        tx_id="TX-R5-001",
        claim=claim,
        protocol=exp_proto,
        results=results,
        evaluator_id="oracle-r5-01",
        evaluator_type=EvaluatorType.INDEPENDENT_STATIC_ORACLE,
        lvt2_study_result=study_res,
        oracle_attestation=create_oracle_attestation(
            signing_key=oracle_sk,
            public_key=oracle_pk,
            oracle_id="oracle-r5-01",
            evidence_hash=study_res.evidence_hash,
        ),
    )
    committed = validator.validate_and_commit(tx)
    assert committed.status == QualificationStatus.QUALIFIED
    return committed, validator, oracle_sk, oracle_pk


def _make_valid_transfer_dataset(n: int = 24):
    return [
        {
            "item_id": f"xfer-item-{i}",
            "family_id": f"xfer-fam-{i}",
            "content_sha256": f"c{i:063x}",
            "q": f"problem-{i}",
        }
        for i in range(n)
    ]


def test_r5_01_absent_validator_rejected():
    """PRIORITY 1 & 3: Absent validator (validator=None) must be rejected."""
    tx, _, _, _ = _make_r5_qualified_fixture()
    dataset = _make_valid_transfer_dataset(24)

    with pytest.raises(ValueError, match="(?i)(validator|trusted|owner-authorized)"):
        LearningTransferProtocol.evaluate_cross_model_transfer(
            tx=tx,
            target_model_id="claude-3-7-sonnet",
            evaluator_fn=lambda p, item: 0.90 if "refined" in p else 0.20,
            test_dataset=dataset,
            base_prompt="base",
            refined_prompt="refined",
            validator=None,
        )

    with pytest.raises(ValueError, match="(?i)(validator|trusted|owner-authorized)"):
        LearningTransferProtocol.synthesize_spe_learning_artifact(
            tx=tx,
            refined_prompt_content="refined prompt",
            validator=None,
        )


def test_r5_02_untrusted_signing_key_rejected():
    """PRIORITY 1 & 3: Untrusted oracle signing key or wrong validator key must be rejected."""
    tx, validator, _, _ = _make_r5_qualified_fixture()
    dataset = _make_valid_transfer_dataset(24)
    attacker_sk, attacker_pk = generate_keypair()

    # 1. Validator without trusted oracle registry
    unconfigured_validator = LearningValidator()
    with pytest.raises(ValueError, match="(?i)(untrusted|invalid receipt|oracle|validator)"):
        LearningTransferProtocol.evaluate_cross_model_transfer(
            tx=tx,
            target_model_id="claude-3-7-sonnet",
            evaluator_fn=lambda p, item: 0.90 if "refined" in p else 0.20,
            test_dataset=dataset,
            base_prompt="base",
            refined_prompt="refined",
            validator=unconfigured_validator,
            oracle_signing_key=attacker_sk,
        )

    # 2. Correct validator for tx, but attacker's unenrolled oracle_signing_key
    with pytest.raises(ValueError, match="(?i)(untrusted|oracle|attestation|signature)"):
        LearningTransferProtocol.evaluate_cross_model_transfer(
            tx=tx,
            target_model_id="claude-3-7-sonnet",
            evaluator_fn=lambda p, item: 0.90 if "refined" in p else 0.20,
            test_dataset=dataset,
            base_prompt="base",
            refined_prompt="refined",
            validator=validator,
            oracle_signing_key=attacker_sk,
        )

    # 3. Missing both oracle_attestation and oracle_signing_key
    with pytest.raises(ValueError, match="(?i)(oracle|attestation|signing_key)"):
        LearningTransferProtocol.evaluate_cross_model_transfer(
            tx=tx,
            target_model_id="claude-3-7-sonnet",
            evaluator_fn=lambda p, item: 0.90 if "refined" in p else 0.20,
            test_dataset=dataset,
            base_prompt="base",
            refined_prompt="refined",
            validator=validator,
        )


def test_r5_03_forged_transfer_metadata_rejected():
    """PRIORITY 2 & 3: Forged unsigned transfer metadata in tx.metadata['cross_model_transfers'] must be rejected."""
    tx, validator, _, _ = _make_r5_qualified_fixture()

    # Directly inject mutable cross_model_transfers dict claiming success
    tx.metadata["cross_model_transfers"] = {
        "claude-3-7-sonnet": {
            "tx_id": tx.tx_id,
            "target_model_id": "claude-3-7-sonnet",
            "transfers_successfully": True,
            "transfer_delta": 0.45,
        }
    }

    # Must fail when requesting claude-3-7-sonnet in supported_models
    with pytest.raises(ValueError, match="(?i)(forged|unauthenticated|invalid|transfer|receipt)"):
        LearningTransferProtocol.synthesize_spe_learning_artifact(
            tx=tx,
            refined_prompt_content="refined prompt",
            supported_models=["gpt-4o", "claude-3-7-sonnet"],
            validator=validator,
        )

    # Must ALSO fail when supported_models is None (no silent promotion or ignoring of forged metadata)
    with pytest.raises(ValueError, match="(?i)(forged|unauthenticated|invalid|transfer|receipt)"):
        LearningTransferProtocol.synthesize_spe_learning_artifact(
            tx=tx,
            refined_prompt_content="refined prompt",
            validator=validator,
        )


def test_r5_04_tampered_evaluation_result_rejected():
    """PRIORITY 2 & 3: Tampering with a signed transfer report's verdict or scores must be rejected."""
    tx, validator, oracle_sk, _ = _make_r5_qualified_fixture()
    dataset = _make_valid_transfer_dataset(24)

    # Run a legitimate transfer evaluation that FAILS (refined < base)
    report = LearningTransferProtocol.evaluate_cross_model_transfer(
        tx=tx,
        target_model_id="llama-3-3-70b",
        evaluator_fn=lambda p, item: 0.30 if "refined" in p else 0.80,
        test_dataset=dataset,
        base_prompt="base",
        refined_prompt="refined",
        validator=validator,
        oracle_signing_key=oracle_sk,
    )
    assert report["transfers_successfully"] is False

    # Tamper 1: flip transfers_successfully to True
    tampered_tx = copy.deepcopy(tx)
    tampered_tx.metadata["cross_model_transfers"]["llama-3-3-70b"]["transfers_successfully"] = True
    with pytest.raises(ValueError, match="(?i)(tampered|invalid|signature|verdict|transfer)"):
        LearningTransferProtocol.synthesize_spe_learning_artifact(
            tx=tampered_tx,
            refined_prompt_content="refined prompt",
            supported_models=["gpt-4o", "llama-3-3-70b"],
            validator=validator,
        )

    # Tamper 2: mutate a positive transfer report's transfer_delta
    tx2, validator2, oracle_sk2, _ = _make_r5_qualified_fixture()
    pos_report = LearningTransferProtocol.evaluate_cross_model_transfer(
        tx=tx2,
        target_model_id="claude-3-7-sonnet",
        evaluator_fn=lambda p, item: 0.92 if "refined" in p else 0.20,
        test_dataset=dataset,
        base_prompt="base",
        refined_prompt="refined",
        validator=validator2,
        oracle_signing_key=oracle_sk2,
    )
    assert pos_report["transfers_successfully"] is True
    tx2.metadata["cross_model_transfers"]["claude-3-7-sonnet"]["transfer_delta"] = 0.99
    with pytest.raises(ValueError, match="(?i)(tampered|invalid|signature|delta|transfer)"):
        LearningTransferProtocol.synthesize_spe_learning_artifact(
            tx=tx2,
            refined_prompt_content="refined prompt",
            supported_models=["gpt-4o", "claude-3-7-sonnet"],
            validator=validator2,
        )


def test_r5_05_mismatched_model_identity_rejected():
    """PRIORITY 2 & 3: Mismatched model identity in protocol or metadata key must be rejected."""
    tx, validator, oracle_sk, _ = _make_r5_qualified_fixture()
    dataset = _make_valid_transfer_dataset(24)

    # 1. Protocol generator_id != target_model_id
    bad_proto = StudyProtocol(
        study_id="XFER-MISMATCH",
        evaluator_id="oracle-r5-01",
        generator_id="other-model-id",
        evaluator_kind="independent_static_oracle",
        oracle_digest="1" * 64,
        model_digest="3" * 64,
        alpha=0.05,
        primary_effect_floor=0.05,
        min_heldout_families=20,
        family_level_significance=True,
        multiplicity=1,
    )
    with pytest.raises(ValueError, match="(?i)(mismatched.*model|generator_id)"):
        LearningTransferProtocol.evaluate_cross_model_transfer(
            tx=tx,
            target_model_id="claude-3-7-sonnet",
            evaluator_fn=lambda p, item: 0.90 if "refined" in p else 0.20,
            test_dataset=dataset,
            base_prompt="base",
            refined_prompt="refined",
            validator=validator,
            transfer_protocol=bad_proto,
            oracle_signing_key=oracle_sk,
        )

    # 2. Valid report for claude-3-7-sonnet copied under key "deepseek-r1"
    report = LearningTransferProtocol.evaluate_cross_model_transfer(
        tx=tx,
        target_model_id="claude-3-7-sonnet",
        evaluator_fn=lambda p, item: 0.90 if "refined" in p else 0.20,
        test_dataset=dataset,
        base_prompt="base",
        refined_prompt="refined",
        validator=validator,
        oracle_signing_key=oracle_sk,
    )
    tx.metadata["cross_model_transfers"]["deepseek-r1"] = copy.deepcopy(report)
    with pytest.raises(ValueError, match="(?i)(mismatched.*model|identity)"):
        LearningTransferProtocol.synthesize_spe_learning_artifact(
            tx=tx,
            refined_prompt_content="refined prompt",
            supported_models=["gpt-4o", "deepseek-r1"],
            validator=validator,
        )


def test_r5_06_missing_family_level_provenance_rejected():
    """PRIORITY 2 & 3: Missing item_id, family_id, or 64-char hex content_sha256 must be rejected."""
    tx, validator, oracle_sk, _ = _make_r5_qualified_fixture()

    # Missing family_id and content_sha256
    bad_dataset_1 = [{"item_id": f"item-{i}", "q": "1+1"} for i in range(24)]
    with pytest.raises(ValueError, match="(?i)(provenance|family_id|content_sha256)"):
        LearningTransferProtocol.evaluate_cross_model_transfer(
            tx=tx,
            target_model_id="claude-3-7-sonnet",
            evaluator_fn=lambda p, item: 0.90 if "refined" in p else 0.20,
            test_dataset=bad_dataset_1,
            base_prompt="base",
            refined_prompt="refined",
            validator=validator,
            oracle_signing_key=oracle_sk,
        )

    # Invalid non-hex content_sha256
    bad_dataset_2 = [
        {"item_id": f"item-{i}", "family_id": f"fam-{i}", "content_sha256": "not-a-sha256"}
        for i in range(24)
    ]
    with pytest.raises(ValueError, match="(?i)(provenance|content_sha256|digest)"):
        LearningTransferProtocol.evaluate_cross_model_transfer(
            tx=tx,
            target_model_id="claude-3-7-sonnet",
            evaluator_fn=lambda p, item: 0.90 if "refined" in p else 0.20,
            test_dataset=bad_dataset_2,
            base_prompt="base",
            refined_prompt="refined",
            validator=validator,
            oracle_signing_key=oracle_sk,
        )


def test_r5_07_one_item_mock_qualification_rejected():
    """PRIORITY 2 & 3: One-item mock dataset or < 20 independent families must be rejected."""
    tx, validator, oracle_sk, _ = _make_r5_qualified_fixture()

    # 1-item dataset with valid fields
    one_item_dataset = [
        {"item_id": "item-0", "family_id": "fam-0", "content_sha256": "c" * 64}
    ]
    with pytest.raises(ValueError, match="(?i)(one-item|insufficient.*families|mock)"):
        LearningTransferProtocol.evaluate_cross_model_transfer(
            tx=tx,
            target_model_id="claude-3-7-sonnet",
            evaluator_fn=lambda p, item: 0.95 if "refined" in p else 0.20,
            test_dataset=one_item_dataset,
            base_prompt="base",
            refined_prompt="refined",
            validator=validator,
            oracle_signing_key=oracle_sk,
        )

    # 24 items but only 4 unique task families (pseudoreplication)
    pseudoreplicated_dataset = [
        {
            "item_id": f"item-{i}",
            "family_id": f"shared-fam-{i % 4}",
            "content_sha256": f"d{i:063x}",
        }
        for i in range(24)
    ]
    with pytest.raises(ValueError, match="(?i)(insufficient.*families|independent)"):
        LearningTransferProtocol.evaluate_cross_model_transfer(
            tx=tx,
            target_model_id="claude-3-7-sonnet",
            evaluator_fn=lambda p, item: 0.95 if "refined" in p else 0.20,
            test_dataset=pseudoreplicated_dataset,
            base_prompt="base",
            refined_prompt="refined",
            validator=validator,
            oracle_signing_key=oracle_sk,
        )


def test_r5_08_revoked_evidence_rejected():
    """PRIORITY 2 & 3: Revoked model transfer evidence or revoked transaction must be rejected."""
    tx, validator, oracle_sk, _ = _make_r5_qualified_fixture()
    dataset = _make_valid_transfer_dataset(24)

    report = LearningTransferProtocol.evaluate_cross_model_transfer(
        tx=tx,
        target_model_id="claude-3-7-sonnet",
        evaluator_fn=lambda p, item: 0.92 if "refined" in p else 0.20,
        test_dataset=dataset,
        base_prompt="base",
        refined_prompt="refined",
        validator=validator,
        oracle_signing_key=oracle_sk,
    )
    assert report["transfers_successfully"] is True
    assert report["revoked"] is False

    # Revoke the specific model transfer
    LearningTransferProtocol.revoke_model_transfer(
        tx=tx,
        target_model_id="claude-3-7-sonnet",
        reason=RevocationReason.DISTRIBUTION_DRIFT_EXCEEDED,
        details="Target model regressed on held-out monitor",
    )
    assert tx.metadata["cross_model_transfers"]["claude-3-7-sonnet"]["revoked"] is True

    with pytest.raises(ValueError, match="(?i)(revoked)"):
        LearningTransferProtocol.synthesize_spe_learning_artifact(
            tx=tx,
            refined_prompt_content="refined prompt",
            supported_models=["gpt-4o", "claude-3-7-sonnet"],
            validator=validator,
        )


def test_r5_09_replay_against_changed_protocol_rejected():
    """PRIORITY 2 & 3: Replay against a changed parent protocol or transfer protocol must be rejected."""
    tx, validator, oracle_sk, _ = _make_r5_qualified_fixture()
    dataset = _make_valid_transfer_dataset(24)

    LearningTransferProtocol.evaluate_cross_model_transfer(
        tx=tx,
        target_model_id="claude-3-7-sonnet",
        evaluator_fn=lambda p, item: 0.92 if "refined" in p else 0.20,
        test_dataset=dataset,
        base_prompt="base",
        refined_prompt="refined",
        validator=validator,
        oracle_signing_key=oracle_sk,
    )

    # 1. Change transfer_protocol inside the transfer report after signing
    tx_mut_proto = copy.deepcopy(tx)
    tx_mut_proto.metadata["cross_model_transfers"]["claude-3-7-sonnet"]["transfer_protocol"]["primary_effect_floor"] = 0.01
    with pytest.raises(ValueError, match="(?i)(protocol|digest|signature|invalid)"):
        LearningTransferProtocol.synthesize_spe_learning_artifact(
            tx=tx_mut_proto,
            refined_prompt_content="refined prompt",
            supported_models=["gpt-4o", "claude-3-7-sonnet"],
            validator=validator,
        )

    # 2. Change parent tx.protocol before evaluate_cross_model_transfer
    tx_changed_parent = copy.deepcopy(tx)
    tx_changed_parent.protocol = ExperimentProtocol(protocol_id="PROTO-CHANGED-999")
    with pytest.raises(ValueError, match="(?i)(protocol|invalid receipt|replay)"):
        LearningTransferProtocol.evaluate_cross_model_transfer(
            tx=tx_changed_parent,
            target_model_id="gemini-2.0-flash-thinking",
            evaluator_fn=lambda p, item: 0.92 if "refined" in p else 0.20,
            test_dataset=dataset,
            base_prompt="base",
            refined_prompt="refined",
            validator=validator,
            oracle_signing_key=oracle_sk,
        )


def test_r5_10_unauthorized_export_and_authenticated_positive_export():
    """PRIORITY 2 & 3: Authenticated transfer binds all required evidence fields and exports cleanly."""
    tx, validator, oracle_sk, oracle_pk = _make_r5_qualified_fixture()
    dataset = _make_valid_transfer_dataset(24)

    report = LearningTransferProtocol.evaluate_cross_model_transfer(
        tx=tx,
        target_model_id="claude-3-7-sonnet",
        evaluator_fn=lambda p, item: 0.92 if "refined" in p else 0.20,
        test_dataset=dataset,
        base_prompt="base",
        refined_prompt="refined",
        validator=validator,
        target_model_digest="f" * 64,
        oracle_signing_key=oracle_sk,
    )

    # Verify all required R5 bound fields on the transfer report
    assert report["target_model_id"] == "claude-3-7-sonnet"
    assert report["target_model_digest"] == "f" * 64
    assert len(report["protocol_digest"]) == 64
    assert len(report["dataset_digest"]) == 64
    assert len(report["observations_digest"]) == 64
    assert len(report["evidence_hash"]) == 64
    assert len(report["transfer_receipt_hash"]) == 64
    assert len(report["transfer_receipt_signature"]) == 128
    assert report["evaluator_id"] == "oracle-r5-01"
    assert report["oracle_public_key"] == oracle_pk.hex()
    assert len(report["family_manifest"]) == 24
    assert report["revoked"] is False
    assert report["statistical_verdict"]["transfers_successfully"] is True
    assert report["statistical_verdict"]["n_families"] == 24

    # Unauthorized model still blocked
    with pytest.raises(ValueError, match="(?i)(unverified.*model)"):
        LearningTransferProtocol.synthesize_spe_learning_artifact(
            tx=tx,
            refined_prompt_content="refined prompt",
            supported_models=["gpt-4o", "claude-3-7-sonnet", "untested-model"],
            validator=validator,
        )

    # Authorized export succeeds and embeds verified_model_transfers
    artifact_json = LearningTransferProtocol.synthesize_spe_learning_artifact(
        tx=tx,
        refined_prompt_content="refined prompt",
        supported_models=["gpt-4o", "claude-3-7-sonnet"],
        validator=validator,
    )
    doc = json.loads(artifact_json)
    assert set(doc["verified_models"]) == {"gpt-4o", "claude-3-7-sonnet"}
    assert "claude-3-7-sonnet" in doc["verified_model_transfers"]
    assert doc["verified_model_transfers"]["claude-3-7-sonnet"]["transfer_receipt_hash"] == report["transfer_receipt_hash"]
