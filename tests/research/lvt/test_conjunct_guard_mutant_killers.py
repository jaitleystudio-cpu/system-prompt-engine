"""Bro round-4 falsification (2026-10-13 @ de9bb1c9): kill BRO12 (study-path shuffled-control > 0 removed),
BRO13 (EFFECT_FLOOR_UNMET ignored), BRO14 (evaluator_id != generator_id removed) and BRO16 (held-out
is_statistically_significant dropped on the four-arm path). Gate ids M44-M47. Each test flips exactly ONE input
away from a fully qualified fixture and asserts the specific conjunct goes False (control asserted True first)."""
import copy
import dataclasses

from tests.research.lvt.test_lvt2_r5_authenticated_transfer import _make_r5_qualified_fixture


def _fixture():
    tx, validator, _, _ = _make_r5_qualified_fixture()
    c = validator.evaluate_conjuncts(tx)
    assert all(c.values()), c  # control: every conjunct True
    return tx, validator


def _study(tx, **kw):
    bad = copy.deepcopy(tx)
    bad.lvt2_study_result = dataclasses.replace(bad.lvt2_study_result, **kw)
    return bad


# ---- BRO12 / M44 ----
def test_study_shuffled_control_must_be_strictly_positive():
    tx, v = _fixture()
    for val in (0.0, -0.05):
        bad = _study(tx, train_candidate_minus_shuffled=val)
        assert v.evaluate_conjuncts(bad)["ImprovementSupported"] is False, val


# ---- BRO13 / M45 ----
def test_study_effect_floor_unmet_blocks_improvement():
    tx, v = _fixture()
    s = tx.lvt2_study_result
    assert "EFFECT_FLOOR_UNMET" not in s.reasons
    bad = _study(tx, reasons=tuple(s.reasons) + ("EFFECT_FLOOR_UNMET",))
    c = v.evaluate_conjuncts(bad)
    assert c["ImprovementSupported"] is False and c["NoDisqualifyingRegression"] is True, c  # only the floor reason


# ---- BRO14 / M46 ----
def test_evaluator_equal_to_generator_is_not_independent():
    tx, v = _fixture()
    bad = copy.deepcopy(tx)
    bad.evaluator_id = bad.claim.generator_id
    assert bad.evaluator_type.name != "GENERATING_MODEL_SELF" and bad.evaluator_id
    assert v.evaluate_conjuncts(bad)["EvaluationIndependent"] is False
    four_arm = copy.deepcopy(bad)
    four_arm.lvt2_study_result = None
    assert v.evaluate_conjuncts(four_arm)["EvaluationIndependent"] is False


# ---- BRO16 / M47 ----
def test_four_arm_heldout_requires_statistical_significance():
    tx, v = _fixture()
    four_arm = copy.deepcopy(tx)
    four_arm.lvt2_study_result = None
    assert v.evaluate_conjuncts(four_arm)["NoDisqualifyingRegression"] is True  # control on the four-arm path
    bad = copy.deepcopy(four_arm)
    bad.results = dataclasses.replace(bad.results, is_statistically_significant=False)
    assert v.evaluate_conjuncts(bad)["NoDisqualifyingRegression"] is False
