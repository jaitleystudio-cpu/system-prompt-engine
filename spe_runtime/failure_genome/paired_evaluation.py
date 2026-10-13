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
    DeterministicOracle,
    SchemaConformanceOracle,
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


def _canonical_sha(value: object) -> str:
    return hashlib.sha256(json.dumps(
        value, sort_keys=True, ensure_ascii=False,
        separators=(",", ":"), allow_nan=False,
    ).encode("utf-8")).hexdigest()


def _oracle_manifest(oracle) -> dict[str, object]:
    """Freeze the *actual* oracle test, not merely its mutable identifier.

    Arbitrary Python predicates, runtime LLM judges, and subclass overrides
    are not independently reproducible from the previous R3 receipt. They
    remain unavailable for this strict held-out evidence route.
    """
    if type(oracle) is DeterministicOracle:
        return {
            "type": "EXACT_STRING_MATCH",
            "oracle_id": oracle.oracle_id,
            "expected_sha256": hashlib.sha256(oracle.exact_target.encode("utf-8")).hexdigest(),
        }
    if type(oracle) is SchemaConformanceOracle:
        return {
            "type": "JSON_SCHEMA_VALIDATION",
            "oracle_id": oracle.oracle_id,
            "schema_sha256": _canonical_sha(oracle.schema),
        }
    if type(oracle) is HybridCompositeOracle:
        if not oracle.components:
            raise ValueError("ORACLE_FINGERPRINT_UNSUPPORTED")
        import math
        if (
            not isinstance(oracle.pass_threshold, (int, float))
            or not math.isfinite(oracle.pass_threshold)
            or not 0 <= oracle.pass_threshold <= 1
        ):
            raise ValueError("ORACLE_FINGERPRINT_UNSUPPORTED")
        components: list[dict[str, object]] = []
        for sub, weight in oracle.components:
            if not isinstance(weight, (int, float)) or not math.isfinite(weight) or weight <= 0:
                raise ValueError("ORACLE_FINGERPRINT_UNSUPPORTED")
            components.append({"oracle": _oracle_manifest(sub), "weight": weight})
        return {
            "type": "HYBRID_WEIGHTED_COMPOSITE",
            "oracle_id": oracle.oracle_id,
            "pass_threshold": oracle.pass_threshold,
            "components": components,
        }
    raise ValueError("ORACLE_FINGERPRINT_UNSUPPORTED")


def _oracle_is_objective(oracle) -> bool:
    try:
        _oracle_manifest(oracle)
        return True
    except (ValueError, TypeError, AttributeError, OverflowError):
        return False


def frozen_suite_digest(suite: BenchmarkSuite) -> str:
    """SHA256 over all frozen tasks, split assignments, inputs AND oracle rules.

    A renamed oracle target or swapped held-out task must change the digest,
    even when suite ID and task IDs are unchanged. Opaque predicates fail
    closed until separately reviewed and version-locked by a trusted owner.
    """
    if not isinstance(suite, BenchmarkSuite) or not suite.tasks:
        raise ValueError("SUITE_MISSING_OR_UNBOUNDED")
    if len(suite.tasks) > 2000:
        raise ValueError("SUITE_MISSING_OR_UNBOUNDED")
    if len(set(t.task_id for t in suite.tasks)) != len(suite.tasks):
        raise ValueError("DUPLICATE_TASK_IDS")
    ordered = sorted(suite.tasks, key=lambda t: t.task_id)
    parts = []
    for t in ordered:
        if not isinstance(t.task_id, str) or not t.task_id:
            raise ValueError("INVALID_TASK_ID")
        if not isinstance(t.prompt_input, str) or not t.prompt_input.strip():
            raise ValueError("EMPTY_TASK_INPUT")
        metadata_digest = _canonical_sha(t.metadata)
        parts.append({
            "task_id": t.task_id,
            "domain": t.domain.value,
            "split": t.split.value,
            "input_sha256": hashlib.sha256(t.prompt_input.encode("utf-8")).hexdigest(),
            "oracle": _oracle_manifest(t.oracle),
            "metadata_digest": metadata_digest,
        })
    return _canonical_sha({"version": "spe.bench.frozen_manifest.v2", "suite_id": suite.suite_id, "tasks": parts})



def _run_identical(a: ModelRunIdentity, b: ModelRunIdentity) -> bool:
    return (
        a == b
        and isinstance(a.provider, str) and bool(a.provider.strip())
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
        suite_digest=frozen_suite_digest(suite),
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
