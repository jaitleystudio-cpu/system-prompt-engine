"""LVT-2 R3 security regression: trust roots, receipt and export authority.

These are intentionally constructed negative tests. A forged QUALIFIED enum and a
signature by a key supplied by an attacker are NOT proof of learning validity.
"""
import hashlib
import time
import pytest

from spe_runtime.ci_gate.receipt import (
    generate_keypair, ed25519_sign, rfc8785_canonicalize,
)
from spe_runtime.research.lvt import (
    ExperimentProtocol, LearningClaim, LearningTransferProtocol,
    LearningValidityTransaction, LearningValidator, QualificationStatus,
)


def _claim():
    return LearningClaim(
        claim_id="LVT-R3-CLAIM", domain="prompt",
        description="untrusted signed evidence",
        generator_id="generator-a", base_prompt_ref="old",
        candidate_prompt_ref="new", budget_nanos=1000,
    )


def _forged_qualified_tx():
    return LearningValidityTransaction(
        tx_id="LVT-R3-UNTRUSTED", claim=_claim(),
        protocol=ExperimentProtocol(protocol_id="LVT-R3-PROTO"),
        evaluator_id="externally-claimed-evaluator",
        status=QualificationStatus.QUALIFIED,
    )


def _attacker_signed_tx():
    tx = _forged_qualified_tx()
    tx.committed_timestamp = 1730000000.0
    payload = {
        "tx_id": tx.tx_id,
        "claim_id": tx.claim.claim_id,
        "domain": tx.claim.domain,
        "generator_id": tx.claim.generator_id,
        "evaluator_id": tx.evaluator_id,
        "evaluator_type": tx.evaluator_type.value,
        "status": tx.status.value,
        "results": {"arm_a": 0.0, "arm_b": 0.0, "arm_c": 0.0,
                    "arm_d": 0.0, "delta": 0.0},
        "timestamp": tx.committed_timestamp,
    }
    canonical = rfc8785_canonicalize(payload)
    attacker_sk, attacker_pk = generate_keypair()
    tx.artifact_hash = hashlib.sha256(canonical).hexdigest()
    tx.canonical_receipt_signature = ed25519_sign(
        attacker_sk, attacker_pk, canonical
    ).hex()
    tx.metadata["public_key"] = attacker_pk.hex()
    return tx, attacker_pk


def test_untrusted_public_key_in_tx_metadata_does_not_verify_owner_receipt():
    tx, _ = _attacker_signed_tx()
    # Old implementation trusts tx.metadata['public_key'] supplied by attacker.
    assert LearningValidator().verify_transaction_signature(tx) is False


def test_explicit_untrusted_key_does_not_become_owner_authority():
    tx, attacker_pk = _attacker_signed_tx()
    # Passing a public key is not an authorization to use it as a trust root.
    assert LearningValidator().verify_transaction_signature(
        tx, public_key=attacker_pk
    ) is False


def test_forged_qualified_status_cannot_export_learning_artifact():
    tx = _forged_qualified_tx()
    with pytest.raises(ValueError, match="(verified|trusted|receipt|qualified)"):
        LearningTransferProtocol.synthesize_spe_learning_artifact(
            tx, refined_prompt_content="forged prompt",
        )


def test_forged_qualified_status_cannot_claim_cross_model_transfer():
    tx = _forged_qualified_tx()
    with pytest.raises(ValueError, match="(verified|trusted|receipt|qualified)"):
        LearningTransferProtocol.evaluate_cross_model_transfer(
            tx=tx, target_model_id="model-z",
            evaluator_fn=lambda prompt, item: 1.0,
            test_dataset=[{"id": "fake"}],
            base_prompt="old", refined_prompt="new",
        )


def test_attacker_signed_receipt_cannot_export_verified_models():
    tx, _ = _attacker_signed_tx()
    with pytest.raises(ValueError, match="(verified|trusted|receipt|qualified)"):
        LearningTransferProtocol.synthesize_spe_learning_artifact(
            tx, refined_prompt_content="forged prompt",
            supported_models=("model-never-tested",),
        )
