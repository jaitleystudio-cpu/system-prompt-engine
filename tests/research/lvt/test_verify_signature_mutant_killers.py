"""Kill Bro's surviving mutants (independent replay 2026-10-13 @ 56c6ca14) in
LearningValidator.verify_transaction_signature:
  BRO1: the `tx.status == REVOKED -> False` check removed
  BRO2: the `not tx.artifact_hash -> False` check removed
"""
import hashlib
from spe_runtime.research.lvt import learning_validator as lv
from spe_runtime.research.lvt.learning_validator import LearningValidator
from spe_runtime.research.lvt.types import (
    ExperimentProtocol, FourArmResults, LearningClaim, LearningValidityTransaction, QualificationStatus,
)


def _signed_tx(validator, status=None):
    claim = LearningClaim("C-MK", "security", "mutant killer", "gen-01", "p1", "p2", budget_nanos=5000)
    res = FourArmResults(arm_a_baseline_score=0.6, arm_b_authentic_score=0.9, arm_c_shuffled_control_score=0.62,
                         arm_d_generalization_score=0.88, arm_d_baseline_score=0.6, delta_improvement=0.3,
                         control_delta=0.28, held_out_retention=0.28, is_statistically_significant=True,
                         total_cost_nanos=2000)
    tx = LearningValidityTransaction("TX-MK", claim, ExperimentProtocol(protocol_id="PROTO-MK"), results=res,
                                     evaluator_id="eval-01")
    tx = validator.validate_and_commit(tx)
    tx = LearningValidator.mint_test_fixture_receipt(tx, signing_key=validator._sk, public_key=validator._pk)
    if status is not None:
        # Re-bind and re-sign the receipt with the new status using the validator's own key, so hash and
        # signature are genuinely valid for a receipt that says `status`.
        tx.status = status
        canonical = lv.rfc8785_canonicalize(validator._build_receipt_dict(tx))
        tx.artifact_hash = hashlib.sha256(canonical).hexdigest()
        tx.canonical_receipt_signature = lv.ed25519_sign(validator._sk, validator._pk, canonical).hex()
    return tx


def test_control_signed_fixture_verifies():
    v = LearningValidator()
    assert v.verify_transaction_signature(_signed_tx(v)) is True


def test_validly_signed_but_revoked_receipt_is_rejected():
    # A receipt whose signed status is REVOKED must never verify, even though hash and signature are intact
    # and no tombstone exists. Only the explicit REVOKED check enforces this (kills BRO1).
    v = LearningValidator()
    tx = _signed_tx(v, QualificationStatus.REVOKED)
    assert tx.status == QualificationStatus.REVOKED and tx.canonical_receipt_signature
    assert v.verify_transaction_signature(tx) is False


def test_missing_artifact_hash_fails_closed_before_any_lookup(monkeypatch):
    # Without artifact_hash the verifier must fail closed immediately: no tombstone lookup, no receipt rebuild,
    # no signature work on an unbound receipt (kills BRO2; return value alone is equivalent because the later
    # sha256 comparison also fails, so this pins the fail-closed order).
    v = LearningValidator()
    tx = _signed_tx(v)
    tx.artifact_hash = ""
    def boom(*a, **k):
        raise AssertionError("verification proceeded past a missing artifact_hash")
    monkeypatch.setattr(v, "is_tombstoned", boom)
    monkeypatch.setattr(v, "_build_receipt_dict", boom)
    assert v.verify_transaction_signature(tx) is False
    tx.artifact_hash = None
    assert v.verify_transaction_signature(tx) is False
