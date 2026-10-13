"""Bro round-3 falsification (2026-10-13 @ 3094f984): kill BRO9 (Bonferroni dropped in transfer verification),
BRO10 (study-path p_value <= alpha_adjusted deleted from evaluate_conjuncts) and BRO11 (sign test counts ties
as positive in transfer verification). Gate ids M41-M43."""
import copy
import dataclasses

from spe_runtime.research.lvt.paired_gate_v2 import exact_sign_p

from tests.research.lvt.test_lvt2_r5_authenticated_transfer import _make_r5_qualified_fixture
from tests.research.lvt.test_transfer_receipt_mutant_killers import TARGET, _report, _reseal


def _idx(item):
    return int(item["item_id"].rsplit("-", 1)[1])


# ---- BRO9 / M41: Bonferroni alpha/multiplicity must be applied ----
def _seventeen_wins(p, item):  # 17 positive families, 7 negative -> p = 0.0320 (in (0.025, 0.05])
    if _idx(item) < 17:
        return 0.90 if "refined" in p else 0.20
    return 0.20 if "refined" in p else 0.25


def test_bonferroni_multiplicity_2_turns_p_0032_into_non_transfer():
    tx, v, osk, opk, rep = _report(_seventeen_wins)
    p = rep["statistical_verdict"]["exact_sign_p_value"]
    assert p == exact_sign_p(17, 7) and 0.025 < p <= 0.05, p
    assert rep["transfers_successfully"] is True  # multiplicity 1: significant at alpha 0.05
    rep["transfer_protocol"]["multiplicity"] = 2   # alpha_adj = 0.025 -> must NOT be a transfer
    rep = _reseal(tx, v, osk, opk, rep, transfers_successfully=False)
    ok, xfer, why = v.verify_model_transfer_receipt(tx, TARGET, rep)
    assert ok is True and xfer is False, why


def test_bonferroni_resealed_success_claim_under_multiplicity_2_is_rejected():
    tx, v, osk, opk, rep = _report(_seventeen_wins)
    rep["transfer_protocol"]["multiplicity"] = 2
    rep = _reseal(tx, v, osk, opk, rep, transfers_successfully=True)
    ok, _, why = v.verify_model_transfer_receipt(tx, TARGET, rep)
    assert ok is False and "transfers_successfully" in why, why


# ---- BRO11 / M43: ties are neither positive nor negative ----
def _four_wins_twenty_ties(p, item):  # 4 positive, 0 negative, 20 exact ties -> p = 0.0625 > 0.05
    if _idx(item) < 4:
        return 0.95 if "refined" in p else 0.05
    return 0.50


def test_ties_are_not_counted_as_positive_families():
    tx, v, osk, opk, rep = _report(_four_wins_twenty_ties)
    sv = rep["statistical_verdict"]
    assert sv["family_macro_delta"] >= rep["transfer_protocol"]["primary_effect_floor"]
    assert sv["exact_sign_p_value"] == exact_sign_p(4, 0) == 0.0625
    assert rep["transfers_successfully"] is False
    ok, xfer, why = v.verify_model_transfer_receipt(tx, TARGET, rep)
    assert ok is True and xfer is False, why  # a tie-as-positive verifier would recompute True and reject


def test_ties_resealed_success_claim_is_rejected():
    tx, v, osk, opk, rep = _report(_four_wins_twenty_ties)
    ok, _, why = v.verify_model_transfer_receipt(tx, TARGET, _reseal(tx, v, osk, opk, rep, transfers_successfully=True))
    assert ok is False and "transfers_successfully" in why, why


# ---- BRO10 / M42: study path must require p_value <= alpha_adjusted ----
def test_study_conjunct_improvement_requires_p_le_alpha_adjusted():
    tx, validator, _, _ = _make_r5_qualified_fixture()
    assert validator.evaluate_conjuncts(tx)["ImprovementSupported"] is True  # control
    bad = copy.deepcopy(tx)
    s = bad.lvt2_study_result
    bad.lvt2_study_result = dataclasses.replace(s, p_value=s.alpha_adjusted * 1.5)
    assert bad.lvt2_study_result.p_value > bad.lvt2_study_result.alpha_adjusted
    assert validator.evaluate_conjuncts(bad)["ImprovementSupported"] is False
