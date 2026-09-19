"""K3 PromptStrategy — sole canonical writer: build_prompt_strategy."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from spe_runtime.contract.protected import ProtectedIntentContract
from spe_runtime.error_registry import ErrorCode, SpeTypedError
from spe_runtime.proof.types import content_digest
from spe_runtime.prompt.hints import PlanningHints
from spe_runtime.prompt.plan import CognitivePlan, CognitivePlanKind
from spe_runtime.prompt.techniques import PromptTechnique, TechniqueSelection


@dataclass(frozen=True, slots=True)
class PromptStrategy:
    """Immutable prompt-construction policy derived from a CognitivePlan."""

    strategy_id: str
    cognitive_plan_id: str
    instruction_mode: str
    context_mode: str
    evidence_mode: str
    example_mode: str
    output_mode: str
    revision_mode: str
    selected_technique_ids: tuple[str, ...]
    technique_selection_id: str
    schema_version: str = "prompt_strategy.v1"

    def to_canonical_payload(self) -> dict[str, Any]:
        return {
            "schema_version": self.schema_version,
            "cognitive_plan_id": self.cognitive_plan_id,
            "instruction_mode": self.instruction_mode,
            "context_mode": self.context_mode,
            "evidence_mode": self.evidence_mode,
            "example_mode": self.example_mode,
            "output_mode": self.output_mode,
            "revision_mode": self.revision_mode,
            "selected_technique_ids": list(self.selected_technique_ids),
            "technique_selection_id": self.technique_selection_id,
        }


def _instruction_mode(plan: CognitivePlan) -> str:
    return {
        CognitivePlanKind.DIRECT: "direct_instruction",
        CognitivePlanKind.DECOMPOSE: "decompose_then_solve",
        CognitivePlanKind.RETRIEVE_THEN_REASON: "evidence_then_synthesize",
        CognitivePlanKind.COMPARE: "compare_then_report",
        CognitivePlanKind.CRITIQUE_REVISE: "draft_critique_revise_once",
        CognitivePlanKind.PLAN_THEN_EXECUTE: "plan_then_produce",
        CognitivePlanKind.STRUCTURED_ANALYSIS: "schema_constrained",
    }[plan.plan_kind]


def build_prompt_strategy(
    contract: ProtectedIntentContract,
    plan: CognitivePlan,
    technique_selection: TechniqueSelection,
    hints: PlanningHints | None = None,
) -> PromptStrategy:
    """ONE canonical PromptStrategy writer (K3).

    Consumes an already-decided CognitivePlan and TechniqueSelection.
    Does not re-decide the cognitive plan.
    """
    if not isinstance(contract, ProtectedIntentContract):
        raise SpeTypedError(
            ErrorCode.K3_STRATEGY_INVALID_INPUT,
            "contract must be a ProtectedIntentContract",
        )
    if not isinstance(plan, CognitivePlan):
        raise SpeTypedError(
            ErrorCode.K3_STRATEGY_INVALID_INPUT,
            "plan must be a CognitivePlan",
        )
    if not isinstance(technique_selection, TechniqueSelection):
        raise SpeTypedError(
            ErrorCode.K3_STRATEGY_INVALID_INPUT,
            "technique_selection must be a TechniqueSelection",
        )
    if technique_selection.cognitive_plan_id != plan.plan_id:
        raise SpeTypedError(
            ErrorCode.K3_STRATEGY_INVARIANT_VIOLATION,
            "technique_selection.cognitive_plan_id must match plan.plan_id",
        )

    h = hints if hints is not None else PlanningHints()
    techs = set(technique_selection.techniques)

    context_mode = "with_context" if PromptTechnique.CONTEXTUAL in techs or h.has_context else "no_context"
    evidence_mode = (
        "local_or_supplied_evidence_only"
        if PromptTechnique.RETRIEVE_REASON in techs
        else "no_retrieval"
    )
    # Retrieval need never implies network authorization — encoded in evidence_mode wording.
    example_mode = (
        "few_shot"
        if PromptTechnique.FEW_SHOT in techs
        else ("examples_required_missing" if "EXAMPLES_REQUIRED_BUT_MISSING" in technique_selection.notes else "zero_shot")
    )
    output_mode = (
        "structured"
        if PromptTechnique.STRUCTURED_OUTPUT in techs
        else "prose_or_unspecified"
    )
    revision_mode = (
        "single_critique_revise"
        if PromptTechnique.CRITIQUE_REVISE in techs
        else "none"
    )

    selected_ids = tuple(t.value for t in technique_selection.techniques)
    payload = {
        "cognitive_plan_id": plan.plan_id,
        "instruction_mode": _instruction_mode(plan),
        "context_mode": context_mode,
        "evidence_mode": evidence_mode,
        "example_mode": example_mode,
        "output_mode": output_mode,
        "revision_mode": revision_mode,
        "selected_technique_ids": list(selected_ids),
        "technique_selection_id": technique_selection.selection_id,
        "schema_version": "prompt_strategy.v1",
    }
    strategy_id = content_digest(payload, prefix="pstrategy-", length=64)
    return PromptStrategy(
        strategy_id=strategy_id,
        cognitive_plan_id=plan.plan_id,
        instruction_mode=payload["instruction_mode"],
        context_mode=context_mode,
        evidence_mode=evidence_mode,
        example_mode=example_mode,
        output_mode=output_mode,
        revision_mode=revision_mode,
        selected_technique_ids=selected_ids,
        technique_selection_id=technique_selection.selection_id,
    )


__all__ = ["PromptStrategy", "build_prompt_strategy"]
