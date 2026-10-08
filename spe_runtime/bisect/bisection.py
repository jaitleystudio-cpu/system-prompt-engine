"""Version DAG bisection engine to identify regression causes."""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Callable

from spe_runtime.instruction_record.models import InstructionVersion


class BisectCausalClass(str, Enum):
    PROVEN_CAUSE = "PROVEN_CAUSE"
    STRONG_CANDIDATE = "STRONG_CANDIDATE"
    CORRELATED_CHANGE = "CORRELATED_CHANGE"
    UNKNOWN = "UNKNOWN"


@dataclass
class BisectResult:
    first_bad_version_id: str
    last_good_version_id: str
    steps_evaluated: int
    causal_classification: BisectCausalClass
    changed_requirements: list[str]
    changed_constraints: list[str]
    changed_artifacts: list[str]
    summary: str


def bisect_version_lineage(
    versions: list[InstructionVersion],
    test_oracle_fn: Callable[[InstructionVersion], bool],
) -> BisectResult:
    """Performs binary search on an ordered lineage of versions to find the exact first regression commit.
    test_oracle_fn returns True if the version PASSES (good), False if it FAILS (bad).
    Assumes versions[0] is good and versions[-1] is bad.
    """
    if len(versions) < 2:
        raise ValueError("Need at least 2 versions to perform bisection.")

    if not test_oracle_fn(versions[0]):
        raise ValueError("Initial version in lineage is already failing.")
    if test_oracle_fn(versions[-1]):
        raise ValueError("Final version in lineage passes (no regression detected).")

    low = 0
    high = len(versions) - 1
    steps = 0

    while low + 1 < high:
        steps += 1
        mid = (low + high) // 2
        passes = test_oracle_fn(versions[mid])
        if passes:
            low = mid
        else:
            high = mid

    last_good = versions[low]
    first_bad = versions[high]

    # Analyze semantic delta between last_good and first_bad
    good_req_ids = {r.requirement_id for r in last_good.requirements}
    bad_req_ids = {r.requirement_id for r in first_bad.requirements}
    changed_reqs = list(bad_req_ids.symmetric_difference(good_req_ids))

    good_con_ids = {c.constraint_id for c in last_good.constraints}
    bad_con_ids = {c.constraint_id for c in first_bad.constraints}
    changed_cons = list(bad_con_ids.symmetric_difference(good_con_ids))

    changed_artifacts = [
        f"Artifact count: {len(last_good.artifacts)} -> {len(first_bad.artifacts)}"
    ]

    # Classify causality
    if changed_cons or not (last_good.intent_snapshot.intent_hash == first_bad.intent_snapshot.intent_hash):
        causality = BisectCausalClass.PROVEN_CAUSE
        summary = "ProtectedIntent or hard constraints mutated between versions."
    elif changed_reqs:
        causality = BisectCausalClass.STRONG_CANDIDATE
        summary = "Requirements added or removed at this revision."
    elif len(last_good.artifacts) != len(first_bad.artifacts):
        causality = BisectCausalClass.CORRELATED_CHANGE
        summary = "Artifact definitions or target providers changed."
    else:
        causality = BisectCausalClass.UNKNOWN
        summary = "No obvious semantic changes; regression may stem from provider/model drift."

    return BisectResult(
        first_bad_version_id=first_bad.version_id,
        last_good_version_id=last_good.version_id,
        steps_evaluated=steps + 2,
        causal_classification=causality,
        changed_requirements=changed_reqs,
        changed_constraints=changed_cons,
        changed_artifacts=changed_artifacts,
        summary=summary,
    )
