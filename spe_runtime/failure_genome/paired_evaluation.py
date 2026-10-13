"""Failure Genome R3: paired held-out oracle study over supplied model outputs.

Reuses existing SPE-Bench tasks and oracles. Never invokes a model itself and
never treats a self-supplied output as independently observed provider data.
A result here is a *candidate* for independently attested external evaluation,
not a published success rate or proof that an AI provider fixed its model.
"""
from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from math import sqrt
from typing import Mapping

from spe_runtime.bench.models import (
    BenchmarkSuite,
    DatasetSplit,
    LlmJudgeOracle,
    HybridCompositeOracle,
    OracleVerdict,
)


@dataclass(frozen=True)
class ModelRunIdentity:
    provider: str
    model_id: str
    model_revision: str
    configuration_digest: str
    """Digests bind externally captured runs; caller assertions are untrusted."""


@dataclass(frozen=True)
class CapturedOutput:
    task_id: str
    output: str
    identity: ModelRunIdentity
    trial: int = 1


@dataclass(frozen=True)
class PairedEvaluation:
    suite_digest: str
    split: str
    tasks: int
    trials_per_task: int
    baseline_successes: int
    candidate_successes: int
    discordant_baseline_only: int
    discordant_candidate_only: int
    paired_success_delta: float
    p95_latency_ms: float | None
    regression_task_ids: tuple[str, ...]
    result: str
    reason_codes: tuple[str, ...]
    evidence_class: str = "SUPPLIED_OUTPUTS_UNVERIFIED"
    remote_model_replay_proven: bool = False
    causal_root_cause_proven: bool = False
    repair_validated_for_publication: bool = False
    publication_authorized: bool = False


def _oracle_is_objective(oracle) -> bool:
    # Reject simulated LLM judges, estimated keyword coverage and mixtures of
    # such oracles. Only deterministic oracle classes can be used in this gate.
    if isinstance(oracle, LlmJudgeOracle):
        return False
    if isinstance(oracle, HybridCompositeOracle):
        return bool(oracle.components) and all(_oracle_is_objective(part) for part, _ in oracle.components)
    return getattr(oracle, "evidence_strength", None) == "DETERMINISTIC"


def _digest_suite(suite: BenchmarkSuite, task_ids: list[str]) -> str:
    canonical = json.dumps(
        {"suite_id": suite.suite_id, "task_ids": task_ids},
        sort_keys=True, separators=(",", ":"),
    ).encode("utf-8")
    return hashlib.sha256(canonical).hexdigest()


def _run_identical(a: ModelRunIdentity, b: ModelRunIdentity) -> bool:
    return (
        a == b
        and isinstance(a.model_id, str) and bool(a.model_id.strip())
        and isinstance(a.model_revision, str) and a.model_revision.strip().lower() not in ("", "unknown", "unbound", "latest")
        and isinstance(a.configuration_digest, str) and len(a.configuration_digest) == 64
        and all(c in "0123456789abcdef" for c in a.configuration_digest)
    )


def _p95(values: list[float]) -> float | None:
    if not values:
        return None
    sorted_values = sorted(values)
    return sorted_values[max(0, int(0.95 * (len(values) - 1)))]


def evaluate_captured_paired_outputs(
    *,
    suite: BenchmarkSuite,
    baseline: Mapping[tuple[str, int], CapturedOutput],
    candidate: Mapping[tuple[str, int], CapturedOutput],
    expected_identity: ModelRunIdentity,
    trials_per_task: int = 1,
    split: DatasetSplit = DatasetSplit.HELD_OUT,
) -> PairedEvaluation:
    """Score a frozen, paired benchmark without network/API/credential access.

    Does not allow DEV/VAL as a final test, simulated oracles, missing cases,
    duplicate held-out inputs across splits, swapped identities, or partial
    model outputs. A success rate is for *supplied* outputs only.
    """
    if split is not DatasetSplit.HELD_OUT:
        raise ValueError("HELD_OUT_SPLIT_REQUIRED")
    if not 1 <= trials_per_task <= 20:
        raise ValueError("TRIAL_BUDGET_OUT_OF_RANGE")
    if not suite.tasks or len(suite.tasks) > 2000:
        raise ValueError("SUITE_MISSING_OR_UNBOUNDED")
    tasks = suite.filter_split(split).tasks
    if not tasks:
        raise ValueError("NO_HELD_OUT_TASKS")
    if len(tasks) * trials_per_task > 4000:
        raise ValueError("EVALUATION_BUDGET_EXCEEDED")
    if len(set(t.task_id for t in suite.tasks)) != len(suite.tasks):
        raise ValueError("DUPLICATE_TASK_IDS")
    if any(not isinstance(t.prompt_input, str) or not t.prompt_input.strip() for t in suite.tasks):
        raise ValueError("EMPTY_TASK_INPUT")
    # Leakage guard: the exact same task prompt cannot appear in DEV/VAL
    # and HELD_OUT. Related-family leakage still needs independent audit.
    fingerprints = {
        t.task_id: hashlib.sha256(t.prompt_input.strip().encode("utf-8")).hexdigest()
        for t in suite.tasks
    }
    hidden_inputs = {fingerprints[t.task_id] for t in tasks}
    if any(
        fingerprints[t.task_id] in hidden_inputs for t in suite.tasks
        if t.split is not DatasetSplit.HELD_OUT
    ):
        raise ValueError("HELD_OUT_INPUT_LEAKAGE")
    if any(not _oracle_is_objective(t.oracle) for t in tasks):
        raise ValueError("NONDETERMINISTIC_OR_UNQUALIFIED_ORACLE")
    if len(set(t.oracle.oracle_id for t in tasks)) < 1:
        raise ValueError("ORACLE_IDENTIFIERS_MISSING")
    if not _run_identical(expected_identity, expected_identity):
        raise ValueError("MODEL_REVISION_OR_CONFIGURATION_UNBOUND")

    ids = sorted(t.task_id for t in tasks)
    expected_keys = {(key, n) for key in ids for n in range(1, trials_per_task + 1)}
    if set(baseline) != expected_keys or set(candidate) != expected_keys:
        raise ValueError("MISSING_EXTRA_OR_UNPAIRED_OUTPUTS")
    by_id = {task.task_id: task for task in tasks}
    before_success = after_success = base_only = cand_only = 0
    regressions: set[str] = set()
    for task_id, trial in sorted(expected_keys):
        b, a = baseline[(task_id, trial)], candidate[(task_id, trial)]
        if not isinstance(b, CapturedOutput) or not isinstance(a, CapturedOutput):
            raise ValueError("OUTPUT_RECORD_MALFORMED")
        if (
            b.task_id != task_id or a.task_id != task_id or
            b.trial != trial or a.trial != trial or
            not _run_identical(b.identity, expected_identity) or
            not _run_identical(a.identity, expected_identity)
        ):
            raise ValueError("MODEL_IDENTITY_OR_PAIR_MISMATCH")
        if (
            not isinstance(b.output, str) or not isinstance(a.output, str)
            or len(b.output) > 200_000 or len(a.output) > 200_000
        ):
            raise ValueError("OUTPUT_SIZE_INVALID")
        task = by_id[task_id]
        context = {"input": task.prompt_input, "task_id": task_id, "trial": trial}
        vb: OracleVerdict = task.oracle.evaluate(b.output, context)
        va: OracleVerdict = task.oracle.evaluate(a.output, context)
        if (
            vb.evidence_class != "DETERMINISTIC" or va.evidence_class != "DETERMINISTIC"
            or not isinstance(vb.passed, bool) or not isinstance(va.passed, bool)
        ):
            raise ValueError("ORACLE_EVIDENCE_NOT_DETERMINISTIC")
        before_success += int(vb.passed)
        after_success += int(va.passed)
        if vb.passed and not va.passed:
            base_only += 1
            regressions.add(task_id)
        elif va.passed and not vb.passed:
            cand_only += 1
    total = len(expected_keys)
    delta = (after_success - before_success) / total
    reasons: list[str] = ["SUPPLIED_OUTPUTS_NOT_AUTHENTICATED"]
    if regressions:
        reasons.append("PAIRED_REGRESSIONS_OBSERVED")
    if delta <= 0:
        reasons.append("NO_POSITIVE_PAIRED_GAIN")
    return PairedEvaluation(
        suite_digest=_digest_suite(suite, ids),
        split=split.value,
        tasks=len(tasks),
        trials_per_task=trials_per_task,
        baseline_successes=before_success,
        candidate_successes=after_success,
        discordant_baseline_only=base_only,
        discordant_candidate_only=cand_only,
        paired_success_delta=round(delta, 6),
        p95_latency_ms=None,  # No trustworthy timing measurements provided.
        regression_task_ids=tuple(sorted(regressions)),
        result="CANDIDATE_FOR_INDEPENDENT_REVIEW" if delta > 0 and not regressions else "HOLD",
        reason_codes=tuple(reasons),
    )
