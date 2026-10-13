"""Bro replay 3 (2026-10-13 @ bb8a0e15): kill BRO5 (duplicate item/digest replay check), BRO6 (p_val <= alpha_adj)
and BRO8 (protocol min_heldout_families floor 20) in LearningValidator.verify_model_transfer_receipt.

Each attack is a FULLY RE-SEALED report (all digests, the oracle attestation and the validator receipt are recomputed
with the legitimate keys), so the only thing that can reject it is the specific semantic check under test."""
import copy
import hashlib
from dataclasses import asdict

from spe_runtime.research.lvt import LearningTransferProtocol
from spe_runtime.research.lvt.learning_validator import create_oracle_attestation
from spe_runtime.research.lvt.paired_gate_v2 import VERSION, exact_sign_p

from tests.research.lvt.test_lvt2_r5_authenticated_transfer import (
    _make_r5_qualified_fixture,
    _make_valid_transfer_dataset,
)

TARGET = "claude-3-7-sonnet"


def _h(obj):
    from spe_runtime.research.lvt import learning_validator as lv
    return hashlib.sha256(lv.rfc8785_canonicalize(obj)).hexdigest()


def _report(evaluator_fn=None):
    tx, validator, osk, opk = _make_r5_qualified_fixture()
    rep = LearningTransferProtocol.evaluate_cross_model_transfer(
        tx=tx, target_model_id=TARGET,
        evaluator_fn=evaluator_fn or (lambda p, item: 0.92 if "refined" in p else 0.20),
        test_dataset=_make_valid_transfer_dataset(24), base_prompt="base", refined_prompt="refined",
        validator=validator, oracle_signing_key=osk, target_model_digest="e" * 64,
    )
    return tx, validator, osk, opk, copy.deepcopy(rep)


def _reseal(tx, validator, osk, opk, rep, *, transfers_successfully=None):
    obs = rep["paired_observations"]
    rep["item_manifest"] = [{k: o[k] for k in ("item_id", "family_id", "content_sha256")} for o in obs]
    rep["dataset_digest"] = _h(rep["item_manifest"])
    rep["observations_digest"] = _h(obs)
    rep["family_manifest"] = sorted({o["family_id"] for o in obs})
    rep["protocol_digest"] = _h(rep["transfer_protocol"])
    rep["evidence_hash"] = _h({
        "version": VERSION, "tx_id": tx.tx_id, "parent_artifact_hash": tx.artifact_hash, "target_model_id": TARGET,
        "target_model_digest": rep["target_model_digest"], "protocol": rep["transfer_protocol"],
        "protocol_digest": rep["protocol_digest"], "dataset_digest": rep["dataset_digest"],
        "family_manifest": rep["family_manifest"], "observations": obs})
    if transfers_successfully is not None:
        rep["transfers_successfully"] = transfers_successfully
        rep["statistical_verdict"]["transfers_successfully"] = transfers_successfully
    att = create_oracle_attestation(osk, opk, rep["evaluator_id"], rep["evidence_hash"])
    rep["oracle_attestation"] = asdict(att)
    rep["oracle_public_key"] = att.oracle_public_key
    rep["transfer_receipt_hash"], rep["transfer_receipt_signature"] = validator.sign_model_transfer_receipt(tx, rep)
    return rep


def test_reseal_control_is_accepted():
    tx, v, osk, opk, rep = _report()
    ok, xfer, why = v.verify_model_transfer_receipt(tx, TARGET, _reseal(tx, v, osk, opk, rep))
    assert ok and xfer, why  # the harness itself does not break authentic reports


# ---- BRO5 ----
def test_resealed_duplicate_item_id_is_rejected():
    tx, v, osk, opk, rep = _report()
    rep["paired_observations"][1]["item_id"] = rep["paired_observations"][0]["item_id"]
    ok, _, why = v.verify_model_transfer_receipt(tx, TARGET, _reseal(tx, v, osk, opk, rep))
    assert ok is False and "Duplicate" in why, why


def test_resealed_duplicate_content_sha256_is_rejected():
    tx, v, osk, opk, rep = _report()
    rep["paired_observations"][1]["content_sha256"] = rep["paired_observations"][0]["content_sha256"]
    ok, _, why = v.verify_model_transfer_receipt(tx, TARGET, _reseal(tx, v, osk, opk, rep))
    assert ok is False and "Duplicate" in why, why


# ---- BRO6 ----
def _big_effect_not_significant(p, item):
    i = int(item["item_id"].rsplit("-", 1)[1])
    if i % 2 == 0:  # 12 families: large win
        return 0.95 if "refined" in p else 0.05
    return 0.40 if "refined" in p else 0.45  # 12 families: small loss


def test_large_effect_without_sign_test_significance_is_not_a_transfer():
    tx, v, osk, opk, rep = _report(_big_effect_not_significant)
    sv = rep["statistical_verdict"]
    assert sv["family_macro_delta"] >= rep["transfer_protocol"]["primary_effect_floor"]  # effect floor passes
    assert sv["exact_sign_p_value"] == exact_sign_p(12, 12) > sv["adjusted_alpha"]
    assert rep["transfers_successfully"] is False
    ok, xfer, why = v.verify_model_transfer_receipt(tx, TARGET, rep)
    assert ok is True and xfer is False, why  # authentic but NOT a verified transfer


def test_resealed_success_claim_with_p_above_alpha_adj_is_rejected():
    tx, v, osk, opk, rep = _report(_big_effect_not_significant)
    ok, _, why = v.verify_model_transfer_receipt(tx, TARGET, _reseal(tx, v, osk, opk, rep, transfers_successfully=True))
    assert ok is False and "transfers_successfully" in why, why


# ---- BRO8: the effective protocol floor is exactly 20 ----
def _with_floor(n):
    tx, v, osk, opk, rep = _report()
    rep["transfer_protocol"]["min_heldout_families"] = n
    return v.verify_model_transfer_receipt(tx, TARGET, _reseal(tx, v, osk, opk, rep))


def test_protocol_min_heldout_families_floor_is_20():
    for n in (0, 2, 10, 19):  # 24 real families: only the protocol-floor check can reject these
        ok, _, why = _with_floor(n)
        assert ok is False and "minimum independent family" in why, (n, why)
    ok, xfer, why = _with_floor(20)
    assert ok and xfer, why
