"""R3 SPE-Bench paired repair gate tests — local supplied outputs, no provider API."""
from dataclasses import replace
import hashlib

import pytest

from spe_runtime.bench.models import (
    BenchmarkSuite, BenchmarkTask, BenchmarkDomain, DatasetSplit,
    DeterministicOracle, ReferenceAnswerOracle, LlmJudgeOracle,
)
from spe_runtime.failure_genome.paired_evaluation import (
    ModelRunIdentity, CapturedOutput, evaluate_captured_paired_outputs,
)


IDENTITY = ModelRunIdentity(
    provider="offline-test", model_id="model-a", model_revision="2026-10-pinned",
    configuration_digest=hashlib.sha256(b"temperature=0,tool=none,seed=42").hexdigest(),
)


def task(n, split=DatasetSplit.HELD_OUT, target="RIGHT"):
    return BenchmarkTask(
        task_id=f"task{n}", domain=BenchmarkDomain.CODING, split=split,
        prompt_input=f"Case {n}: return the correct result",
        oracle=DeterministicOracle(f"oracle-{n}", target),
    )


def fixture(tasks=None, b=None, a=None, trials=1):
    suite = BenchmarkSuite("frozen-bench-v1", tasks or [task(1), task(2), task(3)])
    base = {}
    cand = {}
    for t in suite.filter_split(DatasetSplit.HELD_OUT).tasks:
        for n in range(1, trials + 1):
            key = (t.task_id, n)
            base[key] = CapturedOutput(t.task_id, b.get(t.task_id, "WRONG") if b else "WRONG", IDENTITY, n)
            cand[key] = CapturedOutput(t.task_id, a.get(t.task_id, "RIGHT") if a else "RIGHT", IDENTITY, n)
    return dict(suite=suite, baseline=base, candidate=cand,
                expected_identity=IDENTITY, trials_per_task=trials)


def test_paired_improvement_is_candidate_not_real_world_verified():
    res = evaluate_captured_paired_outputs(**fixture())
    assert res.tasks == 3
    assert res.baseline_successes == 0
    assert res.candidate_successes == 3
    assert res.paired_success_delta == 1.0
    assert res.result == "CANDIDATE_FOR_INDEPENDENT_REVIEW"
    assert res.evidence_class == "SUPPLIED_OUTPUTS_UNVERIFIED"
    assert not res.remote_model_replay_proven
    assert not res.repair_validated_for_publication
    assert not res.publication_authorized
    assert res.p95_latency_ms is None
    assert "SUPPLIED_OUTPUTS_NOT_AUTHENTICATED" in res.reason_codes


def test_regression_blocks_even_if_overall_score_improved():
    fields = fixture(
        b={"task1": "WRONG", "task2": "RIGHT", "task3": "WRONG"},
        a={"task1": "RIGHT", "task2": "WRONG", "task3": "RIGHT"},
    )
    res = evaluate_captured_paired_outputs(**fields)
    assert res.paired_success_delta > 0
    assert res.result == "HOLD"
    assert res.regression_task_ids == ("task2",)
    assert res.discordant_baseline_only == 1
    assert res.discordant_candidate_only == 2


def test_negative_no_gain_is_hold():
    fields = fixture(b={"task1": "RIGHT", "task2": "RIGHT", "task3": "RIGHT"})
    report = evaluate_captured_paired_outputs(**fields)
    assert report.result == "HOLD"
    assert "NO_POSITIVE_PAIRED_GAIN" in report.reason_codes


def test_same_frozen_split_and_multiple_trials():
    res = evaluate_captured_paired_outputs(**fixture(trials=3))
    assert res.trials_per_task == 3
    assert res.candidate_successes == 9


@pytest.mark.parametrize("mutation", [
    lambda x: x.pop(("task1", 1)),
    lambda x: x.update({("unpaired", 1): CapturedOutput("unpaired", "RIGHT", IDENTITY)}),
    lambda x: x.__setitem__(("task1", 1), CapturedOutput("task1", "RIGHT", replace(IDENTITY, model_revision="latest"))),
    lambda x: x.__setitem__(("task1", 1), CapturedOutput("task1", "RIGHT", IDENTITY, trial=2)),
    lambda x: x.__setitem__(("task1", 1), CapturedOutput("task1", 33, IDENTITY)),
])
def test_missing_extra_wrong_model_or_malformed_model_output_rejected(mutation):
    args = fixture()
    mutation(args["candidate"])
    with pytest.raises(ValueError):
        evaluate_captured_paired_outputs(**args)


def test_exact_held_out_leakage_rejected():
    hold = task(1)
    dev = task(2, DatasetSplit.DEV)
    dev.prompt_input = hold.prompt_input
    args = fixture(tasks=[hold, dev])
    with pytest.raises(ValueError, match="HELD_OUT_INPUT_LEAKAGE"):
        evaluate_captured_paired_outputs(**args)


def test_duplicate_task_id_rejected():
    args = fixture(tasks=[task(1), task(1)])
    with pytest.raises(ValueError, match="DUPLICATE_TASK_IDS"):
        evaluate_captured_paired_outputs(**args)


def test_held_out_only_and_frozen_budget():
    args = fixture()
    with pytest.raises(ValueError, match="HELD_OUT_SPLIT_REQUIRED"):
        evaluate_captured_paired_outputs(**(args | {"split": DatasetSplit.DEV}))
    with pytest.raises(ValueError, match="TRIAL_BUDGET"):
        evaluate_captured_paired_outputs(**(args | {"trials_per_task": 21}))
    with pytest.raises(ValueError, match="NO_HELD_OUT_TASKS"):
        evaluate_captured_paired_outputs(**fixture(tasks=[task(1, DatasetSplit.DEV)]))


@pytest.mark.parametrize("oracle", [
    ReferenceAnswerOracle("estimated", ["RIGHT"]),
    LlmJudgeOracle("simulated", "Answer accurately"),
])
def test_heuristic_or_simulated_model_judge_cannot_qualify(oracle):
    t = task(1)
    t.oracle = oracle
    with pytest.raises(ValueError, match="NONDETERMINISTIC_OR_UNQUALIFIED_ORACLE"):
        evaluate_captured_paired_outputs(**fixture(tasks=[t]))


def test_unbound_model_config_never_qualifies():
    args = fixture()
    with pytest.raises(ValueError, match="MODEL_REVISION_OR_CONFIGURATION_UNBOUND"):
        evaluate_captured_paired_outputs(**(args | {
            "expected_identity": replace(IDENTITY, configuration_digest="")
        }))


def test_split_cannot_pass_one_case_when_all_outputs_wrong():
    res = evaluate_captured_paired_outputs(**fixture(b={}, a={"task1": "WRONG", "task2": "WRONG", "task3": "WRONG"}))
    assert res.result == "HOLD"
    assert res.candidate_successes == 0
