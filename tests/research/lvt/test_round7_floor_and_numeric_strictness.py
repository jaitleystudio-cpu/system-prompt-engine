"""Bro round-6 falsification (2026-10-13 @ 3966d052), round-7 repair. Gate ids M52-M62.

* SERIOUS floor bypass: on the study path min_heldout_families=1 (or 5) with 6 families gave RESEARCH_SUPPORTED and
  validate_and_commit minted QUALIFIED. Now a hard floor of 20 held-out families applies in run_study,
  evaluate_conjuncts, validate_and_commit and the transfer path.
* Strict numerics: NaN/inf/-inf/str/None/bool/negatives are rejected cleanly (never an uncaught TypeError) for
  min_heldout_families, holdout_family_count, family_macro_delta, alpha_adjusted, train deltas and p_value.
* Receipt committed_timestamp must be a finite, strictly positive int/float (time.time() mints floats).
* BRO23 (cluster floor 20 -> 2) and BRO24 (family condition dropped from recomputed success) pinned by disabling the
  earlier layers, so each later floor is proven independently load-bearing.
Every control is asserted first."""
import copy
import dataclasses
import hashlib

import pytest

from spe_runtime.ci_gate.receipt import generate_keypair
from spe_runtime.research.lvt import (
    EvaluatorType, ExperimentProtocol, FourArmResults, LearningClaim, LearningValidityTransaction,
    LearningValidator, Observation, QualificationStatus, StudyProtocol, run_study,
)
from spe_runtime.research.lvt import learning_validator as lv
from spe_runtime.research.lvt.learning_validator import create_oracle_attestation

from tests.research.lvt.test_lvt2_r5_authenticated_transfer import _make_r5_qualified_fixture
from tests.research.lvt.test_transfer_receipt_mutant_killers import TARGET, _report, _reseal
from tests.research.lvt.test_verify_signature_mutant_killers import _signed_tx

BAD_VALUES = (float("nan"), float("inf"), float("-inf"), "0.5", "nan", None, True, False, -5)


def _study(n_fams, min_fams):
    proto = StudyProtocol(study_id=f"S-R7-{n_fams}-{min_fams}", evaluator_id="oracle-r7", generator_id="gpt-4o",
                          evaluator_kind="independent_static_oracle", oracle_digest="1" * 64, model_digest="2" * 64,
                          alpha=0.05, primary_effect_floor=0.05, min_heldout_families=min_fams,
                          family_level_significance=True, multiplicity=1)
    train = [Observation(f"tr-{i}", f"tr-fam-{i}", f"a{i:063x}", 0.15, 0.90, 0.15) for i in range(24)]
    held = [Observation(f"ho-{i}", f"ho-fam-{i}", f"b{i:063x}", 0.15, 0.90) for i in range(n_fams)]
    return run_study(proto, train, held)


def _uncommitted_tx(study):
    osk, opk = generate_keypair()
    v = LearningValidator(trusted_oracles={"oracle-r7": opk.hex()})
    claim = LearningClaim(claim_id="CLM-R7", domain="formal_verification", description="r7", generator_id="gpt-4o",
                          base_prompt_ref="b", candidate_prompt_ref="c", budget_nanos=5000)
    res = FourArmResults(arm_a_baseline_score=0.15, arm_b_authentic_score=0.90, arm_c_shuffled_control_score=0.15,
                         arm_d_generalization_score=0.90, delta_improvement=0.75, control_delta=0.75,
                         held_out_retention=0.75, is_statistically_significant=True, total_cost_nanos=5000)
    tx = LearningValidityTransaction(tx_id="TX-R7", claim=claim, protocol=ExperimentProtocol(protocol_id="P-R7"),
                                     results=res, evaluator_id="oracle-r7",
                                     evaluator_type=EvaluatorType.INDEPENDENT_STATIC_ORACLE,
                                     lvt2_study_result=study,
                                     oracle_attestation=create_oracle_attestation(
                                         signing_key=osk, public_key=opk, oracle_id="oracle-r7",
                                         evidence_hash=study.evidence_hash))
    return tx, v


def _all_true(*_a, **_k):
    return {k: True for k in ("ContractValid", "ExperimentAuthorized", "EvidenceAuthentic", "EvaluationIndependent",
                              "ImprovementSupported", "NoDisqualifyingRegression")}


# ---- control: 24 families, min 20 -> QUALIFIED ----
def test_control_24_families_still_qualifies():
    tx, v = _uncommitted_tx(_study(24, 20))
    assert v.validate_and_commit(tx).status == QualificationStatus.QUALIFIED


# ---- Bro's exact bypass, end to end (M52 run_study floor) ----
@pytest.mark.parametrize("min_fams", [1, 5, 6, 19])
def test_study_path_floor_bypass_closed(min_fams):
    s = _study(6, min_fams)
    assert s.p_value <= s.alpha_adjusted  # the statistics alone would "support" it
    assert s.status != "RESEARCH_SUPPORTED_NOT_EXTERNALLY_QUALIFIED"
    assert "INSUFFICIENT_INDEPENDENT_FAMILIES" in s.reasons
    tx, v = _uncommitted_tx(s)
    out = v.validate_and_commit(tx)
    assert out.status not in (QualificationStatus.QUALIFIED, QualificationStatus.RESEARCH_SUPPORTED), out.status


# ---- M53: explicit conjunct floor, with the numeric layer disabled ----
def test_conjunct_family_floor_is_independent(monkeypatch):
    tx, v, _, _ = _make_r5_qualified_fixture()
    monkeypatch.setattr(lv, "study_numeric_violations", lambda s: [])
    assert v.evaluate_conjuncts(tx)["ImprovementSupported"] is True  # control
    for n in (1, 6, 19):
        bad = copy.deepcopy(tx)
        bad.lvt2_study_result = dataclasses.replace(bad.lvt2_study_result, holdout_family_count=n)
        assert v.evaluate_conjuncts(bad)["ImprovementSupported"] is False, n


# ---- M54 / M56: validate_and_commit floor, with conjuncts forced True (forged SUPPORTED study, 6 families) ----
def test_validate_and_commit_floor_is_independent(monkeypatch):
    s = _study(24, 20)
    for n in (1, 6, 19):
        forged = dataclasses.replace(s, holdout_family_count=n)  # evidence hash unchanged -> attestation still valid
        tx, v = _uncommitted_tx(forged)
        monkeypatch.setattr(v, "evaluate_conjuncts", _all_true)
        out = v.validate_and_commit(tx)
        assert out.status == QualificationStatus.REJECTED and "hard floor" in (out.rejection_reason or ""), n
        assert out.canonical_receipt_signature == "" and out.committed_timestamp is None
    tx, v = _uncommitted_tx(s)
    monkeypatch.setattr(v, "evaluate_conjuncts", _all_true)
    assert v.validate_and_commit(tx).status == QualificationStatus.QUALIFIED  # control


# ---- M55 / M61: strict numerics in evaluate_conjuncts + validate_and_commit, never a TypeError ----
FIELDS = ("holdout_family_count", "family_macro_delta", "alpha_adjusted", "train_candidate_minus_base",
          "train_candidate_minus_shuffled", "p_value")


@pytest.mark.parametrize("field", FIELDS)
def test_study_numeric_fields_rejected_cleanly(field):
    tx, v, _, _ = _make_r5_qualified_fixture()
    for val in BAD_VALUES:
        bad = copy.deepcopy(tx)
        bad.lvt2_study_result = dataclasses.replace(bad.lvt2_study_result, **{field: val})
        c = v.evaluate_conjuncts(bad)  # must not raise
        assert c["ImprovementSupported"] is False, (field, val)
        fresh, v2 = _uncommitted_tx(dataclasses.replace(_study(24, 20), **{field: val}))
        out = v2.validate_and_commit(fresh)  # must not raise
        assert out.status not in (QualificationStatus.QUALIFIED, QualificationStatus.RESEARCH_SUPPORTED), (field, val)


def test_inf_and_bool_family_macro_delta_do_not_support_improvement():
    tx, v, _, _ = _make_r5_qualified_fixture()
    for val in (float("inf"), True, 5.0):
        bad = copy.deepcopy(tx)
        bad.lvt2_study_result = dataclasses.replace(bad.lvt2_study_result, family_macro_delta=val)
        assert v.evaluate_conjuncts(bad)["ImprovementSupported"] is False, val


# ---- M57 / M62: transfer-protocol strict numerics on the verify path (clean rejection, no TypeError) ----
@pytest.mark.parametrize("field,val", [("min_heldout_families", x) for x in
                                       (float("nan"), "nan", "20", None, True, -5, float("inf"), 20.0)]
                         + [("alpha", x) for x in (float("nan"), "0.05", None, True, float("inf"))]
                         + [("multiplicity", x) for x in ("1", None, True, 0, float("nan"))])
def test_transfer_protocol_numeric_fields_rejected_cleanly(field, val):
    tx, v, osk, opk, rep = _report()
    rep["transfer_protocol"][field] = val
    try:
        resealed = _reseal(tx, v, osk, opk, rep)
    except (ValueError, TypeError):
        return  # cannot even be canonicalised/sealed (e.g. NaN in RFC 8785): never reaches the verifier
    ok, xfer, why = v.verify_model_transfer_receipt(tx, TARGET, resealed)
    assert ok is False and xfer is False and "invalid numeric" in why, (field, val, why)


# ---- M58: receipt committed_timestamp must be finite and > 0 ----
def test_receipt_timestamp_strictness():
    v = LearningValidator()
    for good in (1_760_000_000, 1_760_000_000.5):
        tx = _signed_tx(v)
        tx.committed_timestamp = good
        canonical = lv.rfc8785_canonicalize(v._build_receipt_dict(tx))
        tx.artifact_hash = hashlib.sha256(canonical).hexdigest()
        tx.canonical_receipt_signature = lv.ed25519_sign(v._sk, v._pk, canonical).hex()
        assert v.verify_transaction_signature(tx) is True, good  # control
    for bad in (float("nan"), float("inf"), float("-inf"), -1, -1.0, "x", True):
        tx = _signed_tx(v)
        tx.committed_timestamp = bad
        try:
            canonical = lv.rfc8785_canonicalize(v._build_receipt_dict(tx))
        except (ValueError, TypeError):
            canonical = repr(v._build_receipt_dict(tx)).encode()  # sign raw bytes; the ts check must still bite
        tx.artifact_hash = hashlib.sha256(canonical).hexdigest()
        tx.canonical_receipt_signature = lv.ed25519_sign(v._sk, v._pk, canonical).hex()
        assert v.verify_transaction_signature(tx) is False, bad


# ---- BRO23 / M59: cluster floor independently load-bearing ----
def test_bro23_cluster_floor_independent(monkeypatch):
    monkeypatch.setattr(lv, "_transfer_protocol_numeric_violations", lambda proto: [])
    tx, v, osk, opk, rep = _report()
    fams = sorted({o["family_id"] for o in rep["paired_observations"]})
    rep["family_provenance"] = {f: f"cluster-{i}" for i, f in enumerate(fams)}
    ok, xfer, why = v.verify_model_transfer_receipt(tx, TARGET, _reseal(tx, v, osk, opk, rep))
    assert ok and xfer, why  # control: 24 distinct clusters
    rep["family_provenance"] = {f: f"cluster-{i % 10}" for i, f in enumerate(fams)}
    rep["transfer_protocol"]["min_heldout_families"] = float("nan")  # only the hard 20 in the cluster check remains
    ok, xfer, why = v.verify_model_transfer_receipt(tx, TARGET, _reseal(tx, v, osk, opk, rep))
    assert ok is False and "auditable distinction" in why, why


# ---- BRO24 / M60: family condition in the recomputed success independently load-bearing ----
def test_bro24_recomputed_success_family_condition_independent(monkeypatch):
    monkeypatch.setattr(lv, "_transfer_protocol_numeric_violations", lambda proto: [])
    monkeypatch.setattr(lv, "_report_family_floor_ok", lambda n, proto: True)
    tx, v, osk, opk, rep = _report()
    fams = sorted({o["family_id"] for o in rep["paired_observations"]})
    keep = set(fams[:10])
    rep["paired_observations"] = [o for o in rep["paired_observations"] if o["family_id"] in keep]
    rep["transfer_protocol"]["min_heldout_families"] = float("nan")  # precheck (NaN < 20 is False) disabled above
    ok, xfer, why = v.verify_model_transfer_receipt(
        tx, TARGET, _reseal(tx, v, osk, opk, rep, transfers_successfully=True))
    assert ok is False and "transfers_successfully does not match" in why, why


# ---- BRO21 / M51 re-pinned: with strict_timestamp disabled, the legacy falsy-timestamp check still bites ----
# (round 7's strict_timestamp masks M51 for the round-5 test; this proves the older layer is independently load-bearing)
def test_bro21_falsy_timestamp_check_independent(monkeypatch):
    monkeypatch.setattr(lv, "strict_timestamp", lambda ts: True)
    v = LearningValidator()
    for empty in (None, 0, 0.0):
        tx = _signed_tx(v)
        assert v.verify_transaction_signature(tx) is True  # control
        tx.committed_timestamp = empty
        canonical = lv.rfc8785_canonicalize(v._build_receipt_dict(tx))
        tx.artifact_hash = hashlib.sha256(canonical).hexdigest()
        tx.canonical_receipt_signature = lv.ed25519_sign(v._sk, v._pk, canonical).hex()
        assert v.verify_transaction_signature(tx) is False, empty
