"""K3 CognitivePlan — sole canonical writer: build_cognitive_plan."""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Any

from spe_runtime.contract.protected import ContractValidity, ProtectedIntentContract
from spe_runtime.error_registry import ErrorCode, SpeTypedError
from spe_runtime.proof.types import content_digest
from spe_runtime.prompt.hints import PlanningHints, constrain_hints_to_contract
from spe_runtime.requirements.models import RequirementKind


class CognitivePlanKind(str, Enum):
    DIRECT = "DIRECT"
    DECOMPOSE = "DECOMPOSE"
    RETRIEVE_THEN_REASON = "RETRIEVE_THEN_REASON"
    COMPARE = "COMPARE"
    CRITIQUE_REVISE = "CRITIQUE_REVISE"
    PLAN_THEN_EXECUTE = "PLAN_THEN_EXECUTE"
    STRUCTURED_ANALYSIS = "STRUCTURED_ANALYSIS"


@dataclass(frozen=True, slots=True)
class CognitivePlan:
    """Immutable cognitive work structure — not a prompt, not authority."""

    plan_id: str
    plan_kind: CognitivePlanKind
    requirement_ids: tuple[str, ...]
    ordered_steps: tuple[str, ...]
    reason_codes: tuple[str, ...]
    complexity_class: str
    requires_evidence: bool
    requires_examples: bool
    requires_structured_output: bool
    schema_version: str = "cognitive_plan.v1"

    def to_canonical_payload(self) -> dict[str, Any]:
        return {
            "schema_version": self.schema_version,
            "plan_kind": self.plan_kind.value,
            "requirement_ids": list(self.requirement_ids),
            "ordered_steps": list(self.ordered_steps),
            "reason_codes": list(self.reason_codes),
            "complexity_class": self.complexity_class,
            "requires_evidence": self.requires_evidence,
            "requires_examples": self.requires_examples,
            "requires_structured_output": self.requires_structured_output,
        }


_STEPS: dict[CognitivePlanKind, tuple[str, ...]] = {
    CognitivePlanKind.DIRECT: ("understand", "produce"),
    CognitivePlanKind.DECOMPOSE: ("identify_subproblems", "solve_parts", "synthesize"),
    CognitivePlanKind.RETRIEVE_THEN_REASON: (
        "identify_evidence_needs",
        "gather_allowed_evidence",
        "synthesize",
    ),
    CognitivePlanKind.COMPARE: ("define_criteria", "compare_candidates", "report"),
    CognitivePlanKind.CRITIQUE_REVISE: ("draft", "critique", "revise_once"),
    CognitivePlanKind.PLAN_THEN_EXECUTE: ("plan_steps", "prepare_execution_notes", "produce"),
    CognitivePlanKind.STRUCTURED_ANALYSIS: ("map_schema", "fill_fields", "validate_shape"),
}


def _select_kind(hints: PlanningHints) -> tuple[CognitivePlanKind, tuple[str, ...]]:
    """Deterministic plan-kind selection from structured hints only."""
    # Priority order is fixed — first match wins.
    if hints.needs_retrieval:
        return CognitivePlanKind.RETRIEVE_THEN_REASON, ("HINT_NEEDS_RETRIEVAL",)
    if hints.needs_comparison:
        return CognitivePlanKind.COMPARE, ("HINT_NEEDS_COMPARISON",)
    if hints.needs_revision:
        return CognitivePlanKind.CRITIQUE_REVISE, ("HINT_NEEDS_REVISION",)
    if hints.needs_decomposition:
        return CognitivePlanKind.DECOMPOSE, ("HINT_NEEDS_DECOMPOSITION",)
    if hints.needs_execution_prep:
        return CognitivePlanKind.PLAN_THEN_EXECUTE, ("HINT_NEEDS_EXECUTION_PREP",)
    if hints.needs_structured_output and hints.complexity_class != "SIMPLE":
        return CognitivePlanKind.STRUCTURED_ANALYSIS, ("HINT_NEEDS_STRUCTURED_OUTPUT",)
    return CognitivePlanKind.DIRECT, ("HINT_DIRECT_DEFAULT",)


def build_cognitive_plan(
    contract: ProtectedIntentContract,
    hints: PlanningHints | None = None,
) -> CognitivePlan:
    """ONE canonical CognitivePlan writer (K3)."""
    if not isinstance(contract, ProtectedIntentContract):
        raise SpeTypedError(
            ErrorCode.K3_STRATEGY_INVALID_INPUT,
            "contract must be a ProtectedIntentContract",
        )
    if contract.validity is ContractValidity.CONFLICTED:
        raise SpeTypedError(
            ErrorCode.K3_STRATEGY_CONFLICTED_SOURCE,
            "cannot build CognitivePlan from CONFLICTED ProtectedIntentContract",
        )
    if contract.validity is ContractValidity.INCOMPLETE:
        raise SpeTypedError(
            ErrorCode.K3_STRATEGY_INVALID_INPUT,
            "cannot build CognitivePlan from INCOMPLETE ProtectedIntentContract",
        )

    h = hints if hints is not None else PlanningHints()
    if not isinstance(h, PlanningHints):
        raise SpeTypedError(
            ErrorCode.K3_STRATEGY_INVALID_INPUT,
            "hints must be PlanningHints or None",
        )
    h = constrain_hints_to_contract(contract, h)

    kind, reasons = _select_kind(h)
    req_ids = tuple(sorted(contract.graph.nodes.keys()))
    # Prefer MUST/MUST_NOT ids first in refs for readability (still deterministic)
    protected_ids = tuple(
        sorted(
            n.requirement_id
            for n in contract.graph.nodes.values()
            if n.kind in (RequirementKind.MUST, RequirementKind.MUST_NOT)
        )
    )
    payload_stub = {
        "plan_kind": kind.value,
        "requirement_ids": list(req_ids),
        "ordered_steps": list(_STEPS[kind]),
        "reason_codes": list(reasons),
        "complexity_class": h.complexity_class,
        "requires_evidence": h.needs_retrieval or kind is CognitivePlanKind.RETRIEVE_THEN_REASON,
        "requires_examples": h.needs_examples,
        "requires_structured_output": h.needs_structured_output
        or kind is CognitivePlanKind.STRUCTURED_ANALYSIS,
        "protected_requirement_ids": list(protected_ids),
        "schema_version": "cognitive_plan.v1",
    }
    plan_id = content_digest(payload_stub, prefix="cplan-", length=64)
    return CognitivePlan(
        plan_id=plan_id,
        plan_kind=kind,
        requirement_ids=req_ids,
        ordered_steps=_STEPS[kind],
        reason_codes=reasons,
        complexity_class=h.complexity_class,
        requires_evidence=payload_stub["requires_evidence"],
        requires_examples=payload_stub["requires_examples"],
        requires_structured_output=payload_stub["requires_structured_output"],
    )


__all__ = ["CognitivePlanKind", "CognitivePlan", "build_cognitive_plan"]
