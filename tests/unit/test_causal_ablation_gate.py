"""R9 controlled counterfactual studies do not prove provider-internal causation."""
from dataclasses import replace

import pytest

from spe_runtime.failure_genome.paired_evaluation import PairedEvaluation
from spe_runtime.diagnosability.ablation_gate import (
    AblationStudy, assess_controlled_ablation,
)

SHA = "a" * 64


def paired(*, before=5, after=13, gain=8, lost=0, regression_ids=(), suite_sha=SHA,
           evidence_class="SUPPLIED_OUTPUTS_UNVERIFIED", n=20):
    return PairedEvaluation(
        suite_digest=suite_sha, split="HELD_OUT", tasks=n, trials_per_task=1,
        baseline_successes=before, candidate_successes=after,
        discordant_baseline_only=lost, discordant_candidate_only=gain,
        paired_success_delta=round((after-before)/n, 6),
        p95_latency_ms=None, regression_task_ids=regression_ids,
        result="CANDIDATE_FOR_INDEPENDENT_REVIEW", reason_codes=(),
        evidence_class=evidence_class,
    )


def study(*, primary=None, sham=None, hypotheses=None, minimum=0.10):
    return AblationStudy(
        hypothesis_id="MISSING_HARD_CONSTRAINT",
        competing_hypotheses=hypotheses or ("MODEL_REVISION_DRIFT", "TOOL_SCHEMA_FAILURE"),
        primary=primary or paired(),
        sham_control=sham or paired(before=5, after=5, gain=0),
        prespecified_minimum_delta=minimum,
    )


def test_contrast_with_sham_is_only_a_structural_signal():
    result = assess_controlled_ablation(study())
    assert result.state == "STRUCTURAL_ABLATION_SIGNAL_ONLY"
    assert result.experiment_structure_valid
    assert result.primary_delta == 0.4
    assert result.sham_delta == 0
    assert result.evidence_graph["nodes"]["ablation_outcome"]["payload"]["scope"] == "SUPPLIED_OUTPUTS_ONLY"
    assert not result.independent_real_model_proven
    assert not result.proprietary_provider_internal_cause_proven
    assert not result.prompt_repair_validated_for_publication
    assert not result.publication_authorized


def test_sham_effect_detects_confounding():
    altered = paired(before=5, after=9, gain=4)
    r = assess_controlled_ablation(study(sham=altered))
    assert r.state == "HOLD"
    assert "SHAM_CONTROL_CHANGED_TOO_MUCH" in r.reason_codes


def test_intervention_regression_vetoes_positive_aggregate_delta():
    r = assess_controlled_ablation(study(primary=paired(
        before=10, after=13, gain=5, lost=2, regression_ids=("r4",),
    )))
    assert r.state == "HOLD"
    assert "PRIMARY_CAUSED_REGRESSIONS" in r.reason_codes


def test_negative_or_subthreshold_intervention_fails():
    p = paired(before=10, after=11, gain=1)
    r = assess_controlled_ablation(study(primary=p))
    assert r.state == "HOLD"
    assert "PRIMARY_GAIN_BELOW_THRESHOLD" in r.reason_codes


def test_mismatched_frozen_cases_or_trial_counts_are_hold():
    r = assess_controlled_ablation(study(sham=paired(
        before=5, after=5, gain=0, suite_sha="b" * 64,
    )))
    assert r.state == "HOLD"
    assert "CONTROL_COMPARISON_MISMATCH" in r.reason_codes


@pytest.mark.parametrize("mutant", [
    paired(before=5, after=13, gain=7),
    paired(before=5, after=13, gain=8, n=19),
    paired(before=5, after=13, gain=8, suite_sha="garbage"),
    paired(before=5, after=13, gain=8, evidence_class="SIMULATED"),
    replace(paired(), paired_success_delta=0.99),
    replace(paired(), remote_model_replay_proven=True),
    replace(paired(), publication_authorized=True),
])
def test_forged_or_internally_inconsistent_success_reports_are_hold(mutant):
    r = assess_controlled_ablation(study(primary=mutant))
    assert r.state == "HOLD"
    assert "PAIRED_EVALUATION_INCONSISTENT" in r.reason_codes
    assert not r.proprietary_provider_internal_cause_proven


@pytest.mark.parametrize("hypotheses", [
    ("MODEL_REVISION_DRIFT",),
    ("MISSING_HARD_CONSTRAINT", "TOOL_FAILURE"),
    ("MODEL_REVISION_DRIFT", "not valid"),
])
def test_alternatives_must_be_distinct_prespecified_and_not_self(hypotheses):
    r = assess_controlled_ablation(study(hypotheses=hypotheses))
    assert r.state == "HOLD"
    assert "ALTERNATIVE_HYPOTHESES_NOT_PRESPECIFIED" in r.reason_codes


def test_threshold_cannot_be_chosen_after_observing_result():
    r = assess_controlled_ablation(study(minimum=0.001))
    assert r.state == "HOLD"
    assert "PRE_REGISTERED_THRESHOLDS_INVALID" in r.reason_codes


def test_does_not_claim_internal_model_mechanism_even_with_perfect_scores():
    r = assess_controlled_ablation(study(primary=paired(
        before=0, after=20, gain=20,
    )))
    assert r.state == "STRUCTURAL_ABLATION_SIGNAL_ONLY"
    assert not r.proprietary_provider_internal_cause_proven
    assert not r.publication_authorized
