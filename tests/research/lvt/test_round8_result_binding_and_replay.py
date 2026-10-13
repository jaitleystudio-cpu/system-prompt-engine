"""Bro round-7 falsification (2026-10-13 @ 52e58db2), round-8 repair. Gate ids M63-M71.

* SERIOUS tamper bypass: a real 6-family INCONCLUSIVE study relabelled SUPPORTED with holdout_family_count=24,
  keeping evidence_hash + oracle attestation, was minted QUALIFIED and its receipt verified. Now:
  - validate_and_commit REPLAYS the study from the attested raw evidence (content-addressed by evidence_hash, or
    tx.lvt2_raw_evidence) and rejects unless the recomputed StudyResult equals the submitted one field-for-field;
  - the signed receipt binds result_hash = sha256 of EVERY StudyResult field, so a post-commit edit breaks verify.
* Receipt timestamp window [1e9, 1e11]; a 10**400 int is rejected cleanly (no OverflowError).
* numpy-typed protocol minimums are rejected cleanly on the study and transfer paths.
Every control is asserted first."""
import dataclasses
import hashlib
import time
import types

import numpy as np
import pytest

from spe_runtime.research.lvt import QualificationStatus, StudyInvalid, StudyProtocol, run_study
from spe_runtime.research.lvt import learning_validator as lv
from spe_runtime.research.lvt import paired_gate_v2 as pg
from spe_runtime.research.lvt.learning_validator import LearningValidator

from tests.research.lvt.test_round7_floor_and_numeric_strictness import _study, _uncommitted_tx
from tests.research.lvt.test_verify_signature_mutant_killers import _signed_tx

MINTED = (QualificationStatus.QUALIFIED, QualificationStatus.RESEARCH_SUPPORTED)


def _assert_not_minted(out, why=""):
    assert out.status not in MINTED, (out.status, why)
    assert out.canonical_receipt_signature == "" and out.committed_timestamp is None, why


# ---- control ----
def test_control_genuine_24_family_study_qualifies_and_verifies():
    tx, v = _uncommitted_tx(_study(24, 20))
    out = v.validate_and_commit(tx)
    assert out.status == QualificationStatus.QUALIFIED
    assert v.verify_transaction_signature(out) is True


# ---- Bro's exact attack (M63) ----
def test_bro_relabelled_6_family_inconclusive_study_is_rejected():
    real = _study(6, 1)
    assert real.status == "INCONCLUSIVE" and real.holdout_family_count == 6
    forged = dataclasses.replace(real, status="RESEARCH_SUPPORTED_NOT_EXTERNALLY_QUALIFIED", reasons=(),
                                 holdout_family_count=24)
    assert forged.evidence_hash == real.evidence_hash  # attestation stays valid for it
    tx, v = _uncommitted_tx(forged)
    out = v.validate_and_commit(tx)
    _assert_not_minted(out)
    assert out.status == QualificationStatus.REJECTED and "replay failed" in out.rejection_reason
    assert "REPLAY_RESULT_MISMATCH" in out.rejection_reason


# ---- pre-commit tamper, one test per StudyResult field (M63 / M64) ----
def _tampered_values(s):
    return {
        "status": "RESEARCH_SUPPORTED_NOT_EXTERNALLY_QUALIFIED_X",
        "reasons": ("NOTE",),
        "p_value": s.p_value / 2,
        "alpha_adjusted": min(0.99, s.alpha_adjusted * 1.5),
        "holdout_candidate_minus_base": s.holdout_candidate_minus_base - 0.01,
        "family_macro_delta": s.family_macro_delta - 0.01,
        "holdout_base_mean": s.holdout_base_mean + 0.01,
        "holdout_candidate_mean": s.holdout_candidate_mean - 0.01,
        "train_candidate_minus_base": s.train_candidate_minus_base - 0.01,
        "train_candidate_minus_shuffled": s.train_candidate_minus_shuffled - 0.01,
        "train_family_count": s.train_family_count + 7,
        "holdout_family_count": s.holdout_family_count + 6,
        "production_qualified": True,
        "statistical_method": "ONE_SIDED_EXACT_FAMILY_SIGN_TEST_V2",
        "version": pg.VERSION + "-x",
        "model_digest_type": "SYNTHETIC_MODEL_IDENTIFIER",
    }


FIELDS = tuple(f.name for f in dataclasses.fields(pg.StudyResult) if f.name != "evidence_hash")


def test_every_result_field_is_covered():
    assert set(FIELDS) == set(_tampered_values(_study(24, 20)))


@pytest.mark.parametrize("field", FIELDS)
def test_pre_commit_tamper_of_each_field_is_rejected(field):
    s = _study(24, 20)
    forged = dataclasses.replace(s, **{field: _tampered_values(s)[field]})
    tx, v = _uncommitted_tx(forged)
    _assert_not_minted(v.validate_and_commit(tx), field)


# Fields whose edit still passes every conjunct and the floor: only the replay can stop them.
REPLAY_ONLY = ("p_value", "holdout_candidate_minus_base", "family_macro_delta", "holdout_base_mean",
               "train_candidate_minus_base", "train_candidate_minus_shuffled", "train_family_count",
               "holdout_family_count", "statistical_method", "version")


@pytest.mark.parametrize("field", REPLAY_ONLY)
def test_replay_is_the_layer_that_rejects(field):
    s = _study(24, 20)
    forged = dataclasses.replace(s, **{field: _tampered_values(s)[field]})
    tx, v = _uncommitted_tx(forged)
    assert all(v.evaluate_conjuncts(tx).values()), field  # the edit survives every earlier layer
    out = v.validate_and_commit(tx)
    _assert_not_minted(out, field)
    assert "REPLAY_RESULT_MISMATCH" in out.rejection_reason, (field, out.rejection_reason)


# ---- raw-evidence custody (M65 / M66) ----
def test_missing_raw_evidence_fails_closed_and_explicit_evidence_qualifies(monkeypatch):
    s = _study(24, 20)
    raw = pg.lookup_raw_evidence(s.evidence_hash)
    assert raw is not None
    monkeypatch.setattr(pg, "_RAW_EVIDENCE_STORE", {})  # e.g. another process
    tx, v = _uncommitted_tx(s)
    out = v.validate_and_commit(tx)
    _assert_not_minted(out)
    assert "RAW_EVIDENCE_MISSING" in out.rejection_reason
    tx, v = _uncommitted_tx(s)
    tx.lvt2_raw_evidence = raw
    assert v.validate_and_commit(tx).status == QualificationStatus.QUALIFIED  # control


def test_explicit_raw_evidence_for_other_data_is_rejected():
    s = _study(24, 20)
    other = _study(25, 20)
    tx, v = _uncommitted_tx(s)
    tx.lvt2_raw_evidence = pg.lookup_raw_evidence(other.evidence_hash)
    out = v.validate_and_commit(tx)
    _assert_not_minted(out)
    assert "EVIDENCE_HASH_MISMATCH" in out.rejection_reason


def test_poisoned_store_entry_is_rehashed_and_rejected(monkeypatch):
    s = _study(24, 20)
    other = _study(25, 20)
    store = dict(pg._RAW_EVIDENCE_STORE)
    store[s.evidence_hash] = pg.lookup_raw_evidence(other.evidence_hash)
    monkeypatch.setattr(pg, "_RAW_EVIDENCE_STORE", store)
    tx, v = _uncommitted_tx(s)
    out = v.validate_and_commit(tx)
    _assert_not_minted(out)
    assert "EVIDENCE_HASH_MISMATCH" in out.rejection_reason


def test_replay_violation_never_raises():
    s = _study(24, 20)
    for raw in ((1, 2, 3), ("x",), (None, None, None), object()):
        assert pg.replay_violation(s, raw) != ""
    assert pg.replay_violation(object(), None) == "RAW_EVIDENCE_MISSING"
    assert pg.replay_violation(s) == ""


# ---- post-commit tamper of each field breaks the signed receipt (M67) ----
@pytest.mark.parametrize("field", FIELDS)
def test_post_commit_tamper_of_each_field_breaks_verification(field):
    s = _study(24, 20)
    tx, v = _uncommitted_tx(s)
    out = v.validate_and_commit(tx)
    assert v.verify_transaction_signature(out) is True  # control
    out.lvt2_study_result = dataclasses.replace(s, **{field: _tampered_values(s)[field]})
    assert v.verify_transaction_signature(out) is False, field


def test_result_hash_covers_every_field():
    s = _study(24, 20)
    h = pg.study_result_hash(s)
    assert len(h) == 64
    for field, val in _tampered_values(s).items():
        assert pg.study_result_hash(dataclasses.replace(s, **{field: val})) != h, field
    assert pg.study_result_hash(object()) == ""
    assert pg.study_result_hash(dataclasses.replace(s, p_value=float("nan"))) == ""


# ---- receipt timestamp window (M68 / M69 / M70) ----
def _resign(v, tx, ts):
    tx.committed_timestamp = ts
    try:
        canonical = lv.rfc8785_canonicalize(v._build_receipt_dict(tx))
    except (ValueError, TypeError, OverflowError):
        canonical = repr(v._build_receipt_dict(tx)).encode()
    tx.artifact_hash = hashlib.sha256(canonical).hexdigest()
    tx.canonical_receipt_signature = lv.ed25519_sign(v._sk, v._pk, canonical).hex()
    return tx


def test_strict_timestamp_window_never_raises():
    for good in (1_000_000_000, 1e9, 1_760_000_000, time.time(), 1e11, 100_000_000_000):
        assert pg.strict_timestamp(good) is True, good
    for bad in (10 ** 400, -(10 ** 400), 1e-300, 1, 1.0, 999_999_999, 999_999_999.9, 1e11 + 1, 100_000_000_001,
                1e300, float("nan"), float("inf"), True, "1760000000", None, np.float64(1.76e9), np.int64(1_760_000_000)):
        assert pg.strict_timestamp(bad) is False, bad


def test_huge_and_tiny_receipt_timestamps_rejected_cleanly():
    v = LearningValidator()
    assert v.verify_transaction_signature(_resign(v, _signed_tx(v), 1_760_000_000)) is True  # control (int)
    for bad in (10 ** 400, 1e-300, 1, 999_999_999, 1e300):
        assert v.verify_transaction_signature(_resign(v, _signed_tx(v), bad)) is False, bad


# ---- numpy-typed protocol minimums (M71) ----
def _proto(**kw):
    base = dict(study_id="S-R8-NP", evaluator_id="oracle-r8", generator_id="gpt-4o",
                evaluator_kind="independent_static_oracle", oracle_digest="1" * 64, model_digest="2" * 64,
                alpha=0.05, primary_effect_floor=0.05, min_heldout_families=24,
                family_level_significance=True, multiplicity=1)
    base.update(kw)
    return StudyProtocol(**base)


@pytest.mark.parametrize("val", [np.int64(24), np.int32(24), np.uint8(24), np.float64(24.0), np.array(24),
                                 np.int64(1), np.bool_(True)])
def test_numpy_typed_study_protocol_minimum_rejected(val):
    raw = pg.lookup_raw_evidence(_study(24, 20).evidence_hash)
    _, train, held = raw
    run_study(_proto(), train, held)  # control: plain int works
    with pytest.raises(StudyInvalid, match="min_heldout_families"):
        run_study(_proto(min_heldout_families=val), train, held)


@pytest.mark.parametrize("val", [np.int64(24), np.int32(20), np.float64(20.0), np.array(20), np.bool_(True)])
def test_numpy_typed_transfer_protocol_minimum_rejected(val):
    ok = types.SimpleNamespace(min_heldout_families=24, alpha=0.05, multiplicity=1, primary_effect_floor=0.05)
    assert lv._transfer_protocol_numeric_violations(ok) == []  # control
    bad = types.SimpleNamespace(min_heldout_families=val, alpha=0.05, multiplicity=1, primary_effect_floor=0.05)
    assert lv._transfer_protocol_numeric_violations(bad) == ["min_heldout_families"]


@pytest.mark.parametrize("val", [np.int64(24), np.float64(24.0)])
def test_numpy_typed_study_family_count_rejected(val):
    s = dataclasses.replace(_study(24, 20), holdout_family_count=val)
    assert "holdout_family_count" in pg.study_numeric_violations(s)
