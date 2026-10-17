"""Unit tests for Wald Sequential Causal Evaluator."""

import pytest

from spe_runtime.capabilities.capsule import (
    AdmissionState,
    CapabilityCapsule,
    CapabilityContracts,
    CapabilityGuards,
    CausalInterventions,
    ProcedureFormat,
    ProcedurePayload,
    RevocationRules,
    TransferMatrix,
)
from spe_runtime.capabilities.causal_evaluator import (
    TrialObservation,
    WaldCausalEvaluator,
)


def make_test_capsule() -> CapabilityCapsule:
    return CapabilityCapsule(
        capsule_id="capsule_eval_test",
        name="Evaluation Test Capsule",
        version="1.0.0",
        admission_state=AdmissionState.STRUCTURALLY_VALID,
        procedure=ProcedurePayload(
            format=ProcedureFormat.AST_JSON,
            entrypoint="transform",
            payload='{"target_key": "x"}',
        ),
        contracts=CapabilityContracts(
            input_schema={"type": "object"},
            output_schema={"type": "object"},
            deterministic=True,
        ),
        guards=CapabilityGuards(),
        witnesses=[],
        interventions=CausalInterventions(
            trial_count=0,
            active_success_rate=0.0,
            baseline_success_rate=0.0,
            placebo_success_rate=0.0,
            lcb_95_delta=0.0,
        ),
        transfer=TransferMatrix(),
        revocation_rules=RevocationRules(),
    )


def test_wald_early_rejection_halts_in_minimal_trials():
    evaluator = WaldCausalEvaluator(min_delta=0.15)
    capsule = make_test_capsule()

    # Stream of failures where baseline succeeded but active candidate failed
    defective_stream = [
        TrialObservation(task_id=f"t_{i}", active_success=False, baseline_success=True, placebo_success=False)
        for i in range(10)
    ]

    report = evaluator.qualify_and_update_capsule(capsule, defective_stream)
    assert report.accepted is False
    assert report.early_stopped is True
    # Breaches lower threshold immediately in <= 2 trials
    assert report.trials_evaluated <= 2
    assert capsule.admission_state == AdmissionState.REJECTED
    assert "Wald early-rejection threshold breached" in report.stopping_reason


def test_wald_placebo_failure_rejection():
    evaluator = WaldCausalEvaluator(min_delta=0.10)
    capsule = make_test_capsule()

    # Active succeeds, but placebo also succeeds just as often (random guessing works)
    placebo_stream = [
        TrialObservation(task_id=f"t_{i}", active_success=True, baseline_success=False, placebo_success=True)
        for i in range(10)
    ]

    report = evaluator.qualify_and_update_capsule(capsule, placebo_stream)
    assert report.accepted is False
    assert capsule.admission_state == AdmissionState.REJECTED
    assert "Failed placebo integrity test" in report.stopping_reason


def test_wald_acceptance_on_high_performing_candidate():
    evaluator = WaldCausalEvaluator(min_delta=0.15)
    capsule = make_test_capsule()

    # Active consistently succeeds while baseline and placebo fail
    high_perf_stream = [
        TrialObservation(task_id=f"t_{i}", active_success=True, baseline_success=False, placebo_success=False)
        for i in range(8)
    ]

    report = evaluator.qualify_and_update_capsule(capsule, high_perf_stream)
    assert report.accepted is True
    assert report.early_stopped is True
    assert report.trials_evaluated >= 5
    assert report.active_success_rate == 1.0
    assert report.baseline_success_rate == 0.0
    assert report.lcb_95_delta > 0.15
    assert capsule.admission_state == AdmissionState.BEHAVIORALLY_QUALIFIED
