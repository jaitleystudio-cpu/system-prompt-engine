"""Existing SPE providers owner — R7 external trial authorization boundary.

No provider SDK, HTTP client, credential storage, or telemetry added here.
A separately authorized host may inject its already-approved provider runner.
This wrapper requires an owner-enrolled signed grant for the exact suite,
prompt digests, model revision, maximum request count and cost estimate.
Default invocation does not execute any external model. A caller-supplied
runner is not, by itself, proof that a real provider model was invoked.
"""
from __future__ import annotations

import hashlib
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Callable, Mapping

from spe_runtime.bench.models import BenchmarkSuite, DatasetSplit
from spe_runtime.ci_gate.receipt import AuthenticatedReceipt, verify_receipt_signature
from spe_runtime.failure_genome.paired_evaluation import (
    CapturedOutput, ModelRunIdentity, PairedEvaluation,
    evaluate_captured_paired_outputs, frozen_suite_digest,
)
from spe_runtime.providers.profiles import get_provider_profile

GRANT_SCHEMA = "spe.providers.paired_trial_grant.v1"
GRANT_SCOPE = "EXTERNAL_MODEL_TEST_RUN_NOT_PUBLICATION"
MAX_TEST_COST_MICRO_USD = 5_000_000  # $5 per run safety cap, not a prediction of actual bills.


@dataclass(frozen=True)
class TrialGrant:
    grant_id: str
    profile_id: str
    identity: ModelRunIdentity
    suite_digest: str
    baseline_prompt_sha256: str
    candidate_prompt_sha256: str
    expires_at: str
    maximum_requests: int
    maximum_estimated_cost_micro_usd: int
    conservatively_estimated_cost_per_call_micro_usd: int
    trials_per_task: int = 1
    public_test_inputs_approved: bool = False
    enabled: bool = False


@dataclass(frozen=True)
class TrialExecution:
    state: str
    reason_codes: tuple[str, ...]
    attempted_calls: int = 0
    estimated_cost_micro_usd: int = 0
    paired_evaluation: PairedEvaluation | None = None
    external_provider_execution_independently_proven: bool = False
    repair_validated_for_publication: bool = False
    publication_authorized: bool = False


ModelRunner = Callable[[str, str, ModelRunIdentity], str]


def _sha(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _time_utc(value: str) -> datetime | None:
    if not isinstance(value, str):
        return None
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    if dt.tzinfo is None or dt.utcoffset() is None:
        return None
    return dt.astimezone(timezone.utc)


def trial_grant_payload(grant: TrialGrant) -> dict[str, object]:
    """The exact immutable authorization request to be signed by the owner."""
    return {
        "schema": GRANT_SCHEMA,
        "scope": GRANT_SCOPE,
        "grant_id": grant.grant_id,
        "profile_id": grant.profile_id,
        "identity": {
            "provider": grant.identity.provider,
            "model_id": grant.identity.model_id,
            "model_revision": grant.identity.model_revision,
            "configuration_digest": grant.identity.configuration_digest,
        },
        "suite_digest": grant.suite_digest,
        "baseline_prompt_sha256": grant.baseline_prompt_sha256,
        "candidate_prompt_sha256": grant.candidate_prompt_sha256,
        "expires_at": grant.expires_at,
        "maximum_requests": grant.maximum_requests,
        "maximum_estimated_cost_micro_usd": grant.maximum_estimated_cost_micro_usd,
        "conservatively_estimated_cost_per_call_micro_usd": grant.conservatively_estimated_cost_per_call_micro_usd,
        "trials_per_task": grant.trials_per_task,
        "public_test_inputs_approved": grant.public_test_inputs_approved,
        "enabled": grant.enabled,
    }


def _safe_public_text(text: object) -> bool:
    """Conservative filter, not a replacement for independent data audit."""
    if not isinstance(text, str) or not text or len(text) > 20000 or "\x00" in text:
        return False
    from spe_runtime.failure_genome.store import sanitize_text
    if sanitize_text(text) != text:
        return False
    return True


def _check_grant(
    *,
    grant: TrialGrant,
    identity: ModelRunIdentity,
    suite: BenchmarkSuite,
    baseline_prompt: str,
    candidate_prompt: str,
    receipt: AuthenticatedReceipt | None,
    owner_keys: Mapping[str, str] | None,
    allow_paid_execution: bool,
    now: datetime,
) -> tuple[str, ...]:
    reasons: list[str] = []
    if not isinstance(grant, TrialGrant) or not grant.enabled or allow_paid_execution is not True:
        return ("EXTERNAL_TRIAL_NOT_AUTHORIZED",)
    if grant.profile_id != "EXTERNAL_OPTIONAL":
        reasons.append("PROFILE_NOT_EXTERNAL_OPTIONAL")
    else:
        profile = get_provider_profile(grant.profile_id)
        if profile.local_or_external != "external" or not profile.requires_network or not profile.requires_credentials:
            reasons.append("PROFILE_CAPABILITY_MISMATCH")
    if (
        grant.identity != identity or not isinstance(identity.provider, str) or not identity.provider.strip()
        or not isinstance(identity.model_id, str) or not identity.model_id.strip()
        or not isinstance(identity.model_revision, str)
        or identity.model_revision.lower() in ("", "unknown", "latest", "unbound")
        or not isinstance(identity.configuration_digest, str) or len(identity.configuration_digest) != 64
        or any(c not in "0123456789abcdef" for c in identity.configuration_digest)
    ):
        reasons.append("MODEL_REVISION_OR_CONFIGURATION_MISMATCH")
    try:
        frozen = frozen_suite_digest(suite)
    except (ValueError, TypeError, AttributeError, OverflowError):
        frozen = ""
        reasons.append("FROZEN_BENCHMARK_INVALID")
    if grant.suite_digest != frozen or not frozen:
        reasons.append("BENCHMARK_NOT_SIGNED_OR_CHANGED")
    if (
        not _safe_public_text(baseline_prompt) or not _safe_public_text(candidate_prompt)
        or grant.baseline_prompt_sha256 != _sha(baseline_prompt)
        or grant.candidate_prompt_sha256 != _sha(candidate_prompt)
    ):
        reasons.append("PROMPT_NOT_APPROVED_OR_CHANGED")
    if not grant.public_test_inputs_approved or any(
        t.metadata.get("public_test_case") is not True or not _safe_public_text(t.prompt_input)
        for t in suite.tasks
    ):
        reasons.append("TEST_INPUTS_NOT_PUBLICLY_APPROVED")
    if type(grant.trials_per_task) is not int or not 1 <= grant.trials_per_task <= 20:
        reasons.append("INVALID_TRIAL_COUNT")
    held_out = suite.filter_split(DatasetSplit.HELD_OUT).tasks
    requests = 2 * len(held_out) * grant.trials_per_task if type(grant.trials_per_task) is int else -1
    if (
        not held_out or type(grant.maximum_requests) is not int or not 1 <= grant.maximum_requests <= 100
        or requests > grant.maximum_requests
    ):
        reasons.append("REQUEST_BUDGET_OUT_OF_RANGE")
    if (
        type(grant.maximum_estimated_cost_micro_usd) is not int
        or type(grant.conservatively_estimated_cost_per_call_micro_usd) is not int
        or not 0 < grant.conservatively_estimated_cost_per_call_micro_usd <= 1_000_000
        or not 0 < grant.maximum_estimated_cost_micro_usd <= MAX_TEST_COST_MICRO_USD
        or requests * grant.conservatively_estimated_cost_per_call_micro_usd > grant.maximum_estimated_cost_micro_usd
    ):
        reasons.append("ESTIMATED_COST_BUDGET_INSUFFICIENT")
    expiry = _time_utc(grant.expires_at)
    if expiry is None or expiry <= now or expiry - now > __import__("datetime").timedelta(days=7):
        reasons.append("GRANT_EXPIRED_OR_OVERLONG")
    if not isinstance(grant.grant_id, str) or len(grant.grant_id) < 12:
        reasons.append("GRANT_ID_INVALID")
    if not isinstance(receipt, AuthenticatedReceipt):
        reasons.append("OWNER_SIGNED_GRANT_MISSING")
    elif not isinstance(owner_keys, Mapping) or not owner_keys:
        reasons.append("OWNER_TRUST_ROOT_MISSING")
    else:
        key_hex = owner_keys.get(receipt.signer_key_id)
        if not isinstance(key_hex, str) or len(key_hex) != 64:
            reasons.append("GRANT_SIGNER_NOT_ENROLLED")
        elif receipt.spec_version != "0.1.0" or receipt.canonical_payload != trial_grant_payload(grant):
            reasons.append("GRANT_PAYLOAD_CHANGED")
        elif not verify_receipt_signature(receipt, key_hex):
            reasons.append("GRANT_SIGNATURE_INVALID")
    return tuple(sorted(set(reasons)))


def run_authorized_paired_trial(
    *,
    grant: TrialGrant,
    suite: BenchmarkSuite,
    identity: ModelRunIdentity,
    baseline_prompt: str,
    candidate_prompt: str,
    owner_receipt: AuthenticatedReceipt | None = None,
    owner_keys: Mapping[str, str] | None = None,
    provider_runner: ModelRunner | None = None,
    allow_paid_execution: bool = False,
) -> TrialExecution:
    """Execute at most one authorized paired test; no provider SDK embedded.

    Call-count and per-call estimated costs are bounded before any runner
    invocation. External provider billing is variable and therefore still
    requires separate host-side metering/caps and owner review.
    """
    now = datetime.now(timezone.utc)
    reasons = _check_grant(
        grant=grant, identity=identity, suite=suite,
        baseline_prompt=baseline_prompt, candidate_prompt=candidate_prompt,
        receipt=owner_receipt, owner_keys=owner_keys,
        allow_paid_execution=allow_paid_execution, now=now,
    )
    if reasons:
        return TrialExecution("HOLD", reasons)
    if provider_runner is None or not callable(provider_runner):
        return TrialExecution("HOLD", ("PROVIDER_HOST_RUNNER_UNAVAILABLE",))
    baseline: dict[tuple[str, int], CapturedOutput] = {}
    candidate: dict[tuple[str, int], CapturedOutput] = {}
    calls = 0
    # No raw prompts/outputs are recorded in result or errors, and the host
    # must independently ensure logging and provider-side data minimization.
    for t in sorted(suite.filter_split(DatasetSplit.HELD_OUT).tasks, key=lambda task: task.task_id):
        for trial in range(1, grant.trials_per_task + 1):
            for label, prompt in (
                (("baseline", baseline_prompt), ("candidate", candidate_prompt))
                if trial % 2 else (("candidate", candidate_prompt), ("baseline", baseline_prompt))
            ):
                if calls >= grant.maximum_requests:
                    return TrialExecution(
                        "HOLD", ("REQUEST_BUDGET_EXCEEDED",), calls,
                        calls * grant.conservatively_estimated_cost_per_call_micro_usd,
                    )
                # Count attempted calls: a provider may bill for failed requests.
                calls += 1
                try:
                    output = provider_runner(prompt, t.prompt_input, identity)
                except Exception:
                    return TrialExecution(
                        "HOLD", ("PROVIDER_RUNNER_FAILED",), calls,
                        calls * grant.conservatively_estimated_cost_per_call_micro_usd,
                    )
                if not isinstance(output, str) or len(output) > 200_000:
                    return TrialExecution(
                        "HOLD", ("PROVIDER_OUTPUT_MALFORMED",), calls,
                        calls * grant.conservatively_estimated_cost_per_call_micro_usd,
                    )
                item = CapturedOutput(t.task_id, output, identity, trial)
                (baseline if label == "baseline" else candidate)[(t.task_id, trial)] = item
    try:
        result = evaluate_captured_paired_outputs(
            suite=suite, baseline=baseline, candidate=candidate,
            expected_identity=identity, trials_per_task=grant.trials_per_task,
            split=DatasetSplit.HELD_OUT,
        )
    except Exception:
        return TrialExecution(
            "HOLD", ("EVALUATION_REJECTED",), calls,
            calls * grant.conservatively_estimated_cost_per_call_micro_usd,
        )
    return TrialExecution(
        "REVIEW_REQUIRED" if result.result == "CANDIDATE_FOR_INDEPENDENT_REVIEW" else "HOLD",
        ("EXECUTION_CAPTURED_BUT_NOT_INDEPENDENTLY_ATTESTED",),
        calls, calls * grant.conservatively_estimated_cost_per_call_micro_usd,
        result,
    )
