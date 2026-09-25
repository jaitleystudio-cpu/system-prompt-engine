"""K3 TechniqueSelection — sole canonical writer: select_prompt_techniques."""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Any

from spe_runtime.contract.protected import ProtectedIntentContract
from spe_runtime.error_registry import ErrorCode, SpeTypedError
from spe_runtime.proof.types import content_digest
from spe_runtime.prompt.hints import PlanningHints
from spe_runtime.prompt.plan import CognitivePlan, CognitivePlanKind

STANDARD_MAX_TECHNIQUES = 3


class PromptTechnique(str, Enum):
    ZERO_SHOT = "ZERO_SHOT"
    FEW_SHOT = "FEW_SHOT"
    ROLE_PERSONA = "ROLE_PERSONA"
    CONTEXTUAL = "CONTEXTUAL"
    STEP_BACK = "STEP_BACK"
    DECOMPOSE_PLAN_SOLVE = "DECOMPOSE_PLAN_SOLVE"
    RETRIEVE_REASON = "RETRIEVE_REASON"
    CRITIQUE_REVISE = "CRITIQUE_REVISE"
    STRUCTURED_OUTPUT = "STRUCTURED_OUTPUT"


# Fixed priority for budget truncation (lower = keep first)
_TECHNIQUE_PRIORITY: dict[PromptTechnique, int] = {
    PromptTechnique.RETRIEVE_REASON: 0,
    PromptTechnique.STRUCTURED_OUTPUT: 1,
    PromptTechnique.DECOMPOSE_PLAN_SOLVE: 2,
    PromptTechnique.CRITIQUE_REVISE: 3,
    PromptTechnique.FEW_SHOT: 4,
    PromptTechnique.CONTEXTUAL: 5,
    PromptTechnique.ROLE_PERSONA: 6,
    PromptTechnique.STEP_BACK: 7,
    PromptTechnique.ZERO_SHOT: 8,
}


@dataclass(frozen=True, slots=True)
class TechniqueJustification:
    technique: PromptTechnique
    reason_code: str
    source_refs: tuple[str, ...]  # requirement ids and/or plan/hint refs


@dataclass(frozen=True, slots=True)
class TechniqueSelection:
    """Immutable justified technique set — never 'enable every trick'."""

    selection_id: str
    cognitive_plan_id: str
    techniques: tuple[PromptTechnique, ...]
    justifications: tuple[TechniqueJustification, ...]
    deferred_techniques: tuple[PromptTechnique, ...]
    budget_truncated: bool
    notes: tuple[str, ...]
    schema_version: str = "technique_selection.v1"

    def to_canonical_payload(self) -> dict[str, Any]:
        return {
            "schema_version": self.schema_version,
            "cognitive_plan_id": self.cognitive_plan_id,
            "techniques": [t.value for t in self.techniques],
            "justifications": [
                {
                    "technique": j.technique.value,
                    "reason_code": j.reason_code,
                    "source_refs": list(j.source_refs),
                }
                for j in self.justifications
            ],
            "deferred_techniques": [t.value for t in self.deferred_techniques],
            "budget_truncated": self.budget_truncated,
            "notes": list(self.notes),
        }


def _candidate_justifications(
    plan: CognitivePlan,
    hints: PlanningHints,
) -> list[TechniqueJustification]:
    out: list[TechniqueJustification] = []
    plan_ref = f"plan:{plan.plan_id}"

    if hints.needs_examples and hints.example_count > 0:
        out.append(
            TechniqueJustification(
                PromptTechnique.FEW_SHOT,
                "EXAMPLES_SUPPLIED",
                (plan_ref, "hint:needs_examples"),
            )
        )
    elif not hints.needs_examples:
        out.append(
            TechniqueJustification(
                PromptTechnique.ZERO_SHOT,
                "NO_EXAMPLES_REQUIRED",
                (plan_ref,),
            )
        )
    # else: needs_examples but none → note later, no FEW_SHOT

    if hints.has_context:
        out.append(
            TechniqueJustification(
                PromptTechnique.CONTEXTUAL,
                "CONTEXT_SUPPLIED",
                (plan_ref, "hint:has_context"),
            )
        )

    if hints.role_label:
        out.append(
            TechniqueJustification(
                PromptTechnique.ROLE_PERSONA,
                "ROLE_LABEL_SUPPLIED",
                (plan_ref, f"hint:role:{hints.role_label}"),
            )
        )

    if plan.plan_kind in (
        CognitivePlanKind.DECOMPOSE,
        CognitivePlanKind.PLAN_THEN_EXECUTE,
        CognitivePlanKind.RETRIEVE_THEN_REASON,
    ) or hints.complexity_class == "COMPLEX":
        out.append(
            TechniqueJustification(
                PromptTechnique.STEP_BACK,
                "PLAN_BENEFITS_FROM_PRINCIPLES_FIRST",
                (plan_ref, f"plan_kind:{plan.plan_kind.value}"),
            )
        )

    if plan.plan_kind in (
        CognitivePlanKind.DECOMPOSE,
        CognitivePlanKind.PLAN_THEN_EXECUTE,
    ):
        out.append(
            TechniqueJustification(
                PromptTechnique.DECOMPOSE_PLAN_SOLVE,
                "PLAN_REQUIRES_STAGED_SOLVE",
                (plan_ref, f"plan_kind:{plan.plan_kind.value}"),
            )
        )

    if plan.requires_evidence or plan.plan_kind is CognitivePlanKind.RETRIEVE_THEN_REASON:
        out.append(
            TechniqueJustification(
                PromptTechnique.RETRIEVE_REASON,
                "EVIDENCE_OR_RESEARCH_REQUIRED",
                (plan_ref, "plan:requires_evidence"),
            )
        )

    if plan.plan_kind is CognitivePlanKind.CRITIQUE_REVISE or hints.needs_revision:
        out.append(
            TechniqueJustification(
                PromptTechnique.CRITIQUE_REVISE,
                "REVISION_REQUIRED",
                (plan_ref, "hint:needs_revision"),
            )
        )

    if plan.requires_structured_output or hints.needs_structured_output:
        out.append(
            TechniqueJustification(
                PromptTechnique.STRUCTURED_OUTPUT,
                "STRUCTURED_OUTPUT_REQUIRED",
                (plan_ref, "hint:needs_structured_output"),
            )
        )

    return out


def _enforce_compatibility(
    justifications: list[TechniqueJustification],
) -> list[TechniqueJustification]:
    techs = {j.technique for j in justifications}
    if PromptTechnique.ZERO_SHOT in techs and PromptTechnique.FEW_SHOT in techs:
        raise SpeTypedError(
            ErrorCode.K3_TECHNIQUE_INCOMPATIBLE,
            "ZERO_SHOT and FEW_SHOT are mutually exclusive",
        )
    return justifications


def select_prompt_techniques(
    contract: ProtectedIntentContract,
    plan: CognitivePlan,
    hints: PlanningHints | None = None,
) -> TechniqueSelection:
    """ONE canonical TechniqueSelection writer (K3)."""
    if not isinstance(plan, CognitivePlan):
        raise SpeTypedError(
            ErrorCode.K3_STRATEGY_INVALID_INPUT,
            "plan must be a CognitivePlan",
        )
    if not isinstance(contract, ProtectedIntentContract):
        raise SpeTypedError(
            ErrorCode.K3_STRATEGY_INVALID_INPUT,
            "contract must be a ProtectedIntentContract",
        )
    h = hints if hints is not None else PlanningHints()
    if not isinstance(h, PlanningHints):
        raise SpeTypedError(
            ErrorCode.K3_STRATEGY_INVALID_INPUT,
            "hints must be PlanningHints or None",
        )

    notes: list[str] = []
    if h.needs_examples and h.example_count <= 0:
        notes.append("EXAMPLES_REQUIRED_BUT_MISSING")

    cands = _candidate_justifications(plan, h)
    # Deduplicate by technique (first justification wins — candidates are ordered)
    seen: set[PromptTechnique] = set()
    unique: list[TechniqueJustification] = []
    for j in cands:
        if j.technique in seen:
            continue
        seen.add(j.technique)
        unique.append(j)

    unique = _enforce_compatibility(unique)

    # Unjustified retrieval / few-shot / structured already gated by candidate builder.
    # Sort by priority for budget.
    unique.sort(key=lambda j: (_TECHNIQUE_PRIORITY[j.technique], j.technique.value))

    budget_truncated = len(unique) > STANDARD_MAX_TECHNIQUES
    kept = unique[:STANDARD_MAX_TECHNIQUES]
    deferred = tuple(j.technique for j in unique[STANDARD_MAX_TECHNIQUES:])
    if budget_truncated:
        notes.append(f"BUDGET_TRUNCATED_MAX_{STANDARD_MAX_TECHNIQUES}")

    techniques = tuple(j.technique for j in kept)
    # Every kept technique must have justification
    if len(techniques) != len(kept):
        raise SpeTypedError(
            ErrorCode.K3_STRATEGY_INVARIANT_VIOLATION,
            "technique without justification",
        )

    payload = {
        "cognitive_plan_id": plan.plan_id,
        "techniques": [t.value for t in techniques],
        "justifications": [
            {
                "technique": j.technique.value,
                "reason_code": j.reason_code,
                "source_refs": list(j.source_refs),
            }
            for j in kept
        ],
        "deferred_techniques": [t.value for t in deferred],
        "budget_truncated": budget_truncated,
        "notes": notes,
        "schema_version": "technique_selection.v1",
    }
    selection_id = content_digest(payload, prefix="tsel-", length=64)
    return TechniqueSelection(
        selection_id=selection_id,
        cognitive_plan_id=plan.plan_id,
        techniques=techniques,
        justifications=tuple(kept),
        deferred_techniques=deferred,
        budget_truncated=budget_truncated,
        notes=tuple(notes),
    )


__all__ = [
    "STANDARD_MAX_TECHNIQUES",
    "PromptTechnique",
    "TechniqueJustification",
    "TechniqueSelection",
    "select_prompt_techniques",
]
