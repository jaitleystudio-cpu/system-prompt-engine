"""Tests for Prompt & Agent Bisect Engine (M10)."""

from spe_runtime.bisect.bisection import BisectCausalClass, bisect_version_lineage
from spe_runtime.instruction_record.models import (
    ConstraintIdentity,
    InstructionVersion,
    ProtectedIntentSnapshot,
    RequirementIdentity,
)


def test_bisect_finds_first_regression():
    def make_v(num: int, has_bad_constraint: bool) -> InstructionVersion:
        intent = ProtectedIntentSnapshot(
            goal=f"Goal v{num}",
            non_negotiables=("No leaks",) if not has_bad_constraint else ("Allow raw dump",),
            authority_scope="AUDIT",
            invariants=(),
        )
        cons = (ConstraintIdentity(f"CON-{num}", "RULE", "allow_all" if has_bad_constraint else "strict", "HARD"),)
        return InstructionVersion(
            version_id=f"v{num}",
            instruction_id="inst-1",
            version_number=num,
            human_objective=f"Objective {num}",
            intent_snapshot=intent,
            requirements=(RequirementIdentity(f"REQ-{num}", "CAT", "desc", True),),
            constraints=cons,
            artifacts=(),
            parent_version_id=f"v{num-1}" if num > 1 else None,
            author="dev",
            created_at=f"2026-10-0{num}T00:00:00Z",
        )

    # Lineage of 6 versions: v1-v3 are good, v4 introduces the regression
    history = [
        make_v(1, False),
        make_v(2, False),
        make_v(3, False),
        make_v(4, True),
        make_v(5, True),
        make_v(6, True),
    ]

    def oracle(v: InstructionVersion) -> bool:
        # Fails if "Allow raw dump" in non_negotiables
        return "Allow raw dump" not in v.intent_snapshot.non_negotiables

    result = bisect_version_lineage(history, oracle)
    assert result.first_bad_version_id == "v4"
    assert result.last_good_version_id == "v3"
    assert result.causal_classification == BisectCausalClass.PROVEN_CAUSE
    assert len(result.changed_constraints) >= 1
