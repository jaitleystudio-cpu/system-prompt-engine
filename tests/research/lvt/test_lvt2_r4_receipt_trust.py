"""R4 RED: a signature is not authorization when the key arrives in the artifact.

These adversarial fixtures are synthetic. The qualification evidence and
keys here are deliberately attacker-controlled, not real human evaluation.
"""
import hashlib
import time
import pytest

from spe_runtime.ci_gate.receipt import ed25519_sign, generate_keypair, rfc8785_canonicalize
from spe_runtime.research.lvt import (
    ExperimentProtocol, LearningClaim, LearningTransferProtocol,
    LearningValidityTransaction, LearningValidator, Observation,
    QualificationStatus, StudyProtocol, run_study,
)
from spe_runtime.research.lvt.learning_validator import create_oracle_attestation


def _attacker_signed_qualification():
    # An attacker can construct a superficially passing study and self-sign both
    # the oracle attestation and the receipt. No trusted registry enrolls the key.
    train = [
        Observation(f"train-{i}", f"train-family-{i}", f"{i+1:064x}", .1, .9, .1)
        for i in range(24)
    ]
    heldout = [
        Observation(f"held-{i}", f"held-family-{i}", f"{i+101:064x}", .1, .9)
        for i in range(24)
    ]
    proto = StudyProtocol(
        study_id="R4-SYNTHETIC-UNTRUSTED",
        evaluator_id="claimed-oracle",
        generator_id="claimed-model",
        evaluator_kind="independent_static_oracle",
        oracle_digest="a" * 64, model_digest="b" * 64,
        alpha=.05, primary_effect_floor=.05,
        min_heldout_families=20, family_level_significance=True, multiplicity=2,
    )
    study = run_study(proto, train, heldout)
    assert study.status == "RESEARCH_SUPPORTED_NOT_EXTERNALLY_QUALIFIED"
    tx = LearningValidityTransaction(
        tx_id="R4-FORGED-001",
        claim=LearningClaim(
            claim_id="R4-FORGED-CLAIM", domain="security",
            description="attacker-controlled synthetic study",
            generator_id="claimed-model",
            base_prompt_ref="baseline",
            candidate_prompt_ref="candidate",
            budget_nanos=10_000,
        ),
        protocol=ExperimentProtocol(protocol_id="R4-PROTO"),
        evaluator_id="claimed-oracle",
        status=QualificationStatus.QUALIFIED,
        protocol_version="LVT-2",
        lvt2_study_result=study,
        is_attested_oracle=True,
    )
    attacker_sk, attacker_pk = generate_keypair()
    tx.oracle_attestation = create_oracle_attestation(
        attacker_sk, attacker_pk, "claimed-oracle", study.evidence_hash
    )
    tx.committed_timestamp = 1720000000.0
    tx.metadata["committed_protocol_id"] = tx.protocol.protocol_id
    tx.metadata["committed_evidence_hash"] = study.evidence_hash
    receipt_bytes = rfc8785_canonicalize(LearningValidator._build_receipt_dict(tx))
    tx.artifact_hash = hashlib.sha256(receipt_bytes).hexdigest()
    tx.canonical_receipt_signature = ed25519_sign(
        attacker_sk, attacker_pk, receipt_bytes
    ).hex()
    tx.metadata["public_key"] = attacker_pk.hex()
    return tx, attacker_pk


def test_r4_unconfigured_validator_rejects_attacker_key_from_metadata():
    tx, _ = _attacker_signed_qualification()
    assert LearningValidator().verify_transaction_signature(tx) is False


def test_r4_unconfigured_validator_rejects_caller_supplied_untrusted_key():
    tx, attacker_pk = _attacker_signed_qualification()
    assert LearningValidator().verify_transaction_signature(
        tx, public_key=attacker_pk
    ) is False


def test_r4_export_refuses_self_signed_receipt_without_trusted_validator():
    tx, _ = _attacker_signed_qualification()
    with pytest.raises(ValueError, match="(?i)(trust|receipt|validator|authority|verified)"):
        LearningTransferProtocol.synthesize_spe_learning_artifact(
            tx, refined_prompt_content="attacker supplied prompt"
        )


def test_r4_export_refuses_untrusted_receipt_with_unconfigured_validator():
    tx, _ = _attacker_signed_qualification()
    with pytest.raises(ValueError, match="(?i)(trust|receipt|validator|authority|verified)"):
        LearningTransferProtocol.synthesize_spe_learning_artifact(
            tx, refined_prompt_content="attacker supplied prompt",
            validator=LearningValidator(),
        )
