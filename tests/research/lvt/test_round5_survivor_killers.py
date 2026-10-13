"""Bro round-5 falsification (2026-10-13 @ a93d50b6): kill BRO17 (owner attestation ts <= 0 check removed),
BRO19 (transfer-report family floor max(20, ...) lowered to max(2, ...)), BRO20 (study-path family_macro_delta >= 0
dropped from ImprovementSupported) and BRO21 (receipt committed_timestamp requirement dropped). Gate ids M48-M51.
Every attack is genuinely signed/re-sealed with the legitimate keys, so only the check under test can reject it."""
import copy
import dataclasses
import hashlib

import pytest

from spe_runtime.ci_gate.receipt import generate_keypair
from spe_runtime.research.lvt import learning_validator as lv
from spe_runtime.research.lvt.learning_validator import LearningValidator, create_owner_validator_attestation

from tests.research.lvt.test_lvt2_r5_authenticated_transfer import _make_r5_qualified_fixture
from tests.research.lvt.test_transfer_receipt_mutant_killers import TARGET, _report, _reseal
from tests.research.lvt.test_verify_signature_mutant_killers import _signed_tx


@pytest.fixture
def _isolated_registries(tmp_path):
    LearningValidator.clear_owner_registries()
    LearningValidator.set_tombstone_store_path(tmp_path / "tombstones.jsonl")
    yield
    LearningValidator.clear_owner_registries()


# ---- BRO17 / M48: a validly signed owner attestation with timestamp <= 0 is rejected ----
def test_owner_attestation_nonpositive_timestamp_is_rejected(_isolated_registries):
    owner_sk, owner_pk = generate_keypair()
    _, val_pk = generate_keypair()
    ok = create_owner_validator_attestation(owner_signing_key=owner_sk, owner_public_key=owner_pk,
                                            validator_public_key=val_pk, timestamp=1_760_000_000.0)
    assert LearningValidator._verify_owner_attestation_internal(ok, owner_pk.hex(), val_pk.hex()) is True  # control
    for ts in (0.0, -1.0, 0):
        att = create_owner_validator_attestation(owner_signing_key=owner_sk, owner_public_key=owner_pk,
                                                 validator_public_key=val_pk, timestamp=ts)
        assert LearningValidator._verify_owner_attestation_internal(att, owner_pk.hex(), val_pk.hex()) is False, ts


# ---- BRO19 / M49: the in-report family floor (max(20, min_heldout_families)) is load-bearing ----
# The protocol precheck `min_heldout_families < 20` does not reject NaN (NaN < 20 is False), so the hard floor 20
# at the family count is the only thing stopping a 10-family report with a NaN protocol minimum.
def test_transfer_report_family_floor_holds_when_protocol_minimum_is_nan(monkeypatch):
    # Round 7: the strict protocol numeric precheck now rejects NaN up front (see test_round7_*). It is disabled here
    # so this test keeps proving the in-report family floor is independently load-bearing (defence in depth).
    monkeypatch.setattr(lv, "_transfer_protocol_numeric_violations", lambda proto: [])
    tx, v, osk, opk, rep = _report()
    fams = sorted({o["family_id"] for o in rep["paired_observations"]})
    keep = set(fams[:10])
    rep["paired_observations"] = [o for o in rep["paired_observations"] if o["family_id"] in keep]
    rep["transfer_protocol"]["min_heldout_families"] = float("nan")
    ok, xfer, why = v.verify_model_transfer_receipt(tx, TARGET, _reseal(tx, v, osk, opk, rep))
    assert ok is False and xfer is False and "Insufficient independent held-out families" in why, why


# ---- BRO20 / M50: study-path ImprovementSupported requires family_macro_delta >= 0 ----
def test_study_negative_family_macro_delta_blocks_improvement():
    tx, v, _, _ = _make_r5_qualified_fixture()
    assert v.evaluate_conjuncts(tx)["ImprovementSupported"] is True  # control
    bad = copy.deepcopy(tx)
    bad.lvt2_study_result = dataclasses.replace(bad.lvt2_study_result, family_macro_delta=-0.01)
    assert v.evaluate_conjuncts(bad)["ImprovementSupported"] is False


# ---- BRO21 / M51: a receipt without committed_timestamp never verifies, even if correctly re-signed ----
def test_receipt_without_committed_timestamp_is_rejected_even_when_resigned():
    v = LearningValidator()
    for empty in (None, 0, 0.0):
        tx = _signed_tx(v)
        assert v.verify_transaction_signature(tx) is True  # control
        tx.committed_timestamp = empty
        canonical = lv.rfc8785_canonicalize(v._build_receipt_dict(tx))
        tx.artifact_hash = hashlib.sha256(canonical).hexdigest()
        tx.canonical_receipt_signature = lv.ed25519_sign(v._sk, v._pk, canonical).hex()
        assert v.verify_transaction_signature(tx) is False, empty
