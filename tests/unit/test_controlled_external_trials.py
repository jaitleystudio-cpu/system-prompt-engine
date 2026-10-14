"""R7 external trial host authority — all tests use local fake runners, no network."""
from __future__ import annotations

import hashlib
from dataclasses import replace
from datetime import datetime, timedelta, timezone

import pytest

from spe_runtime.bench.models import (
    BenchmarkDomain, BenchmarkSuite, BenchmarkTask,
    DatasetSplit, DeterministicOracle, ProgrammaticConstraintOracle,
)
from spe_runtime.ci_gate.receipt import generate_authenticated_receipt, generate_keypair
from spe_runtime.failure_genome.paired_evaluation import (
    ModelRunIdentity, frozen_suite_digest, evaluate_captured_paired_outputs,
    CapturedOutput,
)
from spe_runtime.providers.controlled_trials import (
    TrialGrant, run_authorized_paired_trial, trial_grant_payload,
)


BASE = "Return an answer with a known baseline prompt."
CAND = "Return an answer with the corrected candidate prompt."
IDENTITY = ModelRunIdentity(
    provider="test-provider", model_id="model-rev-1",
    model_revision="release-2026-10-14",
    configuration_digest=hashlib.sha256(b"temperature0 toolsnone seed42").hexdigest(),
)


def suite():
    return BenchmarkSuite("frozen-suite-r7", [
        BenchmarkTask("one", BenchmarkDomain.CODING, DatasetSplit.HELD_OUT,
                      "Public task: answer one", DeterministicOracle("exact1", "RIGHT"),
                      metadata={"public_test_case": True}),
        BenchmarkTask("two", BenchmarkDomain.CODING, DatasetSplit.HELD_OUT,
                      "Public task: answer two", DeterministicOracle("exact2", "RIGHT"),
                      metadata={"public_test_case": True}),
        BenchmarkTask("dev", BenchmarkDomain.CODING, DatasetSplit.DEV,
                      "Public calibration input", DeterministicOracle("dev1", "RIGHT"),
                      metadata={"public_test_case": True}),
    ])


def signed_grant(*, study=None, grant_change=None, prompt_a=BASE, prompt_b=CAND):
    study = study or suite()
    grant = TrialGrant(
        grant_id="owner-approved-2026-10-14-001",
        profile_id="EXTERNAL_OPTIONAL",
        identity=IDENTITY,
        suite_digest=frozen_suite_digest(study),
        baseline_prompt_sha256=hashlib.sha256(prompt_a.encode()).hexdigest(),
        candidate_prompt_sha256=hashlib.sha256(prompt_b.encode()).hexdigest(),
        expires_at=(datetime.now(timezone.utc) + timedelta(hours=12)).isoformat(),
        maximum_requests=4,
        maximum_estimated_cost_micro_usd=4000,
        conservatively_estimated_cost_per_call_micro_usd=1000,
        trials_per_task=1,
        public_test_inputs_approved=True,
        enabled=True,
    )
    if grant_change:
        grant = replace(grant, **grant_change)
    sk, pk = generate_keypair()
    receipt = generate_authenticated_receipt(
        trial_grant_payload(grant), signing_key=sk,
        public_key=pk, key_id="owner-test-enrolled",
    )
    return dict(
        grant=grant, suite=study, identity=IDENTITY,
        baseline_prompt=prompt_a, candidate_prompt=prompt_b,
        owner_receipt=receipt, owner_keys={receipt.signer_key_id: pk.hex()},
    )


def run(args, *, allow=False, runner=None):
    return run_authorized_paired_trial(
        **args, allow_paid_execution=allow, provider_runner=runner,
    )


def test_denied_by_default_even_with_signed_grant_and_runner():
    args = signed_grant()
    called = []
    res = run(args, runner=lambda *a: called.append(a) or "RIGHT")
    assert res.state == "HOLD"
    assert "EXTERNAL_TRIAL_NOT_AUTHORIZED" in res.reason_codes
    assert res.attempted_calls == 0
    assert called == []


def test_signed_request_cannot_enroll_its_own_untrusted_signer():
    args = signed_grant()
    args["owner_keys"] = None
    res = run(args, allow=True, runner=lambda *_: "RIGHT")
    assert res.state == "HOLD"
    assert res.attempted_calls == 0
    assert "OWNER_TRUST_ROOT_MISSING" in res.reason_codes


def test_matching_owner_signature_and_public_test_data_still_only_review_ready():
    args = signed_grant()
    calls = []

    def fake(prompt, task_input, identity):
        calls.append((prompt, task_input, identity))
        return "RIGHT" if prompt == CAND else "WRONG"

    res = run(args, allow=True, runner=fake)
    assert res.state == "REVIEW_REQUIRED"
    assert res.attempted_calls == 4
    assert res.estimated_cost_micro_usd == 4000
    assert res.paired_evaluation.paired_success_delta == 1.0
    assert res.paired_evaluation.suite_digest == args["grant"].suite_digest
    assert not res.external_provider_execution_independently_proven
    assert not res.repair_validated_for_publication
    assert not res.publication_authorized
    assert len(calls) == 4


def test_missing_host_runner_never_spends():
    res = run(signed_grant(), allow=True)
    assert res.state == "HOLD"
    assert res.attempted_calls == 0
    assert "PROVIDER_HOST_RUNNER_UNAVAILABLE" in res.reason_codes


@pytest.mark.parametrize("mutation,reason", [
    ({"enabled": False}, "EXTERNAL_TRIAL_NOT_AUTHORIZED"),
    ({"profile_id": "LOCAL_WASM"}, "PROFILE_NOT_EXTERNAL_OPTIONAL"),
    ({"maximum_requests": 3}, "REQUEST_BUDGET_OUT_OF_RANGE"),
    ({"maximum_estimated_cost_micro_usd": 3999}, "ESTIMATED_COST_BUDGET_INSUFFICIENT"),
    ({"maximum_estimated_cost_micro_usd": 10_000_000}, "ESTIMATED_COST_BUDGET_INSUFFICIENT"),
    ({"public_test_inputs_approved": False}, "TEST_INPUTS_NOT_PUBLICLY_APPROVED"),
    ({"baseline_prompt_sha256": "0" * 64}, "PROMPT_NOT_APPROVED_OR_CHANGED"),
    ({"suite_digest": "0" * 64}, "BENCHMARK_NOT_SIGNED_OR_CHANGED"),
    ({"expires_at": "2000-01-01T00:00:00Z"}, "GRANT_EXPIRED_OR_OVERLONG"),
])
def test_signed_but_unsafe_grant_never_triggers_runner(mutation, reason):
    args = signed_grant(grant_change=mutation)
    calls = []
    res = run(args, allow=True, runner=lambda *_: calls.append(1) or "RIGHT")
    assert res.state == "HOLD"
    assert reason in res.reason_codes
    assert calls == []


def test_invalid_signature_and_forged_owner_key_are_rejected():
    args = signed_grant()
    args["owner_receipt"] = replace(args["owner_receipt"], signature_ed25519="0" * 128, verified=True)
    r = run(args, allow=True, runner=lambda *_: "RIGHT")
    assert r.state == "HOLD"
    assert "GRANT_SIGNATURE_INVALID" in r.reason_codes


def test_grant_and_suite_mutation_cannot_reuse_receipt():
    args = signed_grant()
    args["suite"].tasks[0].prompt_input = "Different public task"
    r = run(args, allow=True, runner=lambda *_: "RIGHT")
    assert r.state == "HOLD"
    assert "BENCHMARK_NOT_SIGNED_OR_CHANGED" in r.reason_codes


def test_changed_heldout_expected_answers_change_frozen_digest():
    study = suite()
    before = frozen_suite_digest(study)
    study.tasks[0].oracle.exact_target = "TOTALLY_DIFFERENT"
    after = frozen_suite_digest(study)
    assert before != after
    study.tasks[1].split = DatasetSplit.DEV
    assert after != frozen_suite_digest(study)


def test_opaque_python_predicate_cannot_be_frozen_as_proof():
    study = suite()
    study.tasks[0].oracle = ProgrammaticConstraintOracle("predicate", lambda v: "RIGHT" in v, "str predicate")
    with pytest.raises(ValueError, match="ORACLE_FINGERPRINT_UNSUPPORTED"):
        frozen_suite_digest(study)


def test_private_email_or_api_key_prompts_never_enter_external_runner():
    for prompt in ("Include alice@example.org", "Use sk-ABCDEFGHIJKLMNOPQRSTUVWXYZ123456"):
        args = signed_grant(prompt_a=prompt)
        hits = []
        res = run(args, allow=True, runner=lambda *_: hits.append(1) or "RIGHT")
        assert res.state == "HOLD"
        assert "PROMPT_NOT_APPROVED_OR_CHANGED" in res.reason_codes
        assert not hits


def test_private_or_unsigned_test_inputs_never_execute():
    study = suite()
    study.tasks[0].metadata["public_test_case"] = False
    args = signed_grant(study=study)
    r = run(args, allow=True, runner=lambda *_: "RIGHT")
    assert r.state == "HOLD"
    assert "TEST_INPUTS_NOT_PUBLICLY_APPROVED" in r.reason_codes


def test_provider_error_does_not_expose_secret_to_report():
    args = signed_grant()
    def raise_secret(*_):
        raise RuntimeError("User private key: sk-ABCDEFGHIJKLMNOPQRSTUVWXYZ123456")
    r = run(args, allow=True, runner=raise_secret)
    assert r.state == "HOLD"
    assert r.attempted_calls == 1
    assert r.estimated_cost_micro_usd == 1000
    assert "sk-ABCDEFGHIJKLMNOPQRSTUVWXYZ123456" not in str(r)


def test_regressed_candidate_is_hold_even_if_some_cases_improved():
    args = signed_grant()
    def fake(prompt, task_input, *_):
        if prompt == BASE:
            return "RIGHT" if task_input.endswith("two") else "WRONG"
        return "RIGHT" if task_input.endswith("one") else "WRONG"
    r = run(args, allow=True, runner=fake)
    assert r.state == "HOLD"
    assert r.paired_evaluation.regression_task_ids == ("two",)
    assert not r.repair_validated_for_publication
