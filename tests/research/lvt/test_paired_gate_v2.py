"""LVT-2 repository regression tests: paired family-level research, never production admission."""
from dataclasses import replace
import pytest

from spe_runtime.research.lvt.paired_gate_v2 import (
    Observation, StudyProtocol, StudyInvalid, exact_sign_p, run_study, replay_study,
)


def protocol(**changes):
    p = StudyProtocol(
        study_id="LVT2-RESEARCH-ONLY", evaluator_id="oracle-b",
        generator_id="generator-a", evaluator_kind="independent_static_oracle",
        oracle_digest="a" * 64, model_digest="b" * 64,
        alpha=0.05, primary_effect_floor=0.05,
        min_heldout_families=20, family_level_significance=True,
        multiplicity=2,
    )
    return replace(p, **changes)


def dataset(n=24, heldout_baseline=.20, heldout_candidate=.90):
    train = [
        Observation(f"t-{i}", f"train-family-{i}", f"{i+1:064x}", .2, .9, .1)
        for i in range(n)
    ]
    heldout = [
        Observation(f"h-{i}", f"heldout-family-{i}", f"{i+n+1:064x}",
                    heldout_baseline, heldout_candidate)
        for i in range(n)
    ]
    return train, heldout


def test_research_support_cannot_create_production_qualification():
    train, heldout = dataset()
    result = run_study(protocol(), train, heldout)
    assert result.status == "RESEARCH_SUPPORTED_NOT_EXTERNALLY_QUALIFIED"
    assert result.production_qualified is False
    assert result.family_macro_delta == pytest.approx(.7)
    assert result.holdout_candidate_minus_base == pytest.approx(.7)
    assert result.p_value <= .025
    assert len(result.evidence_hash) == 64


def test_paired_heldout_regression_is_rejected():
    train, heldout = dataset(heldout_baseline=.95, heldout_candidate=.75)
    result = run_study(protocol(), train, heldout)
    assert result.status == "REJECTED"
    assert result.family_macro_delta == pytest.approx(-.20)


def test_one_item_never_proves_significance():
    train, heldout = dataset(1)
    result = run_study(protocol(), train, heldout)
    assert result.status == "INCONCLUSIVE"
    assert result.p_value == pytest.approx(.5)


def test_overlap_id_is_rejected():
    train, heldout = dataset()
    heldout[0] = replace(heldout[0], item_id=train[0].item_id)
    with pytest.raises(StudyInvalid, match="item_id overlap"):
        run_study(protocol(), train, heldout)


def test_overlap_family_is_rejected():
    train, heldout = dataset()
    heldout[0] = replace(heldout[0], family_id=train[0].family_id)
    with pytest.raises(StudyInvalid, match="family overlap"):
        run_study(protocol(), train, heldout)


def test_overlap_content_digest_is_rejected():
    train, heldout = dataset()
    heldout[0] = replace(heldout[0], content_sha256=train[0].content_sha256)
    with pytest.raises(StudyInvalid, match="content overlap"):
        run_study(protocol(), train, heldout)


def test_self_certification_identity_is_rejected():
    train, heldout = dataset()
    with pytest.raises(StudyInvalid, match="self-certification"):
        run_study(protocol(evaluator_id="generator-a"), train, heldout)


@pytest.mark.parametrize("bad", [float("nan"), float("inf"), True, -0.1, 1.1])
def test_nonfinite_or_out_of_bounds_scores_are_rejected(bad):
    train, heldout = dataset()
    heldout[0] = replace(heldout[0], candidate_score=bad)
    with pytest.raises(StudyInvalid, match="invalid score"):
        run_study(protocol(), train, heldout)


def test_repeated_family_does_not_inflate_independence():
    train, heldout = dataset()
    heldout = [replace(o, family_id="same-family") for o in heldout]
    result = run_study(protocol(), train, heldout)
    assert result.status == "INCONCLUSIVE"
    assert result.holdout_family_count == 1


def test_study_replay_hash_detects_changed_observations():
    train, heldout = dataset()
    original = run_study(protocol(), train, heldout)
    assert replay_study(original, protocol(), train, heldout)
    modified = list(heldout)
    modified[0] = replace(modified[0], candidate_score=.4)
    assert not replay_study(original, protocol(), train, modified)


def test_exact_sign_tail_is_correct_without_scipy():
    assert exact_sign_p(6, 0) == pytest.approx(1.0 / 64)
    assert exact_sign_p(0, 0) == 1.0
    assert exact_sign_p(5, 5) > .5


def test_negative_control_failed_train_is_rejected():
    train, heldout = dataset()
    train = [replace(o, candidate_score=.1, shuffled_score=.9) for o in train]
    assert run_study(protocol(), train, heldout).status == "REJECTED"
