"""K3 TechniqueSelection — sole canonical writer: select_prompt_techniques.

Budget truncation law (G1R-7R):
  MUST-derived > SHOULD-derived > PREFERENCE-derived > HINT/PLAN-derived
then technique-family priority as tie-breaker.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Any

from spe_runtime.contract.protected import ProtectedIntentContract
from spe_runtime.error_registry import ErrorCode, SpeTypedError
from spe_runtime.proof.types import content_digest
from spe_runtime.prompt.hints import PlanningHints
from spe_runtime.prompt.plan import CognitivePlan, CognitivePlanKind
from spe_runtime.requirements.models import RequirementKind

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


class JustificationStrength(str, Enum):
    """Requirement-strength tier for budget truncation (lower rank = keep first)."""

    MUST = "MUST"
    SHOULD = "SHOULD"
    PREFERENCE = "PREFERENCE"
    HINT = "HINT"
    PLAN = "PLAN"


_STRENGTH_RANK: dict[JustificationStrength, int] = {
    JustificationStrength.MUST: 0,
    JustificationStrength.SHOULD: 1,
    JustificationStrength.PREFERENCE: 2,
    JustificationStrength.HINT: 3,
    JustificationStrength.PLAN: 4,
}

# Tie-breaker only after strength (lower = keep first)
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

# semantic_key prefixes / tokens that bind techniques to contract atoms
_KEY_HINTS: dict[PromptTechnique, tuple[str, ...]] = {
    PromptTechnique.RETRIEVE_REASON: (
        "evidence",
        "research",
        "citation",
        "cite",
        "source",
        "retrieval",
    ),
    PromptTechnique.STRUCTURED_OUTPUT: (
        "json",
        "schema",
        "structured",
        "format",
        "fields",
    ),
    PromptTechnique.CRITIQUE_REVISE: (
        "revise",
        "revision",
        "critique",
        "review",
        "improve",
        "repair",
    ),
    PromptTechnique.DECOMPOSE_PLAN_SOLVE: (
        "decompose",
        "subproblem",
        "stages",
        "steps",
    ),
    PromptTechnique.FEW_SHOT: ("example", "examples", "few_shot"),
    PromptTechnique.ROLE_PERSONA: ("role", "persona", "expertise"),
    PromptTechnique.CONTEXTUAL: ("context",),
    PromptTechnique.STEP_BACK: ("principles", "step_back"),
}


@dataclass(frozen=True, slots=True)
class TechniqueJustification:
    technique: PromptTechnique
    reason_code: str
    source_refs: tuple[str, ...]  # requirement ids and/or plan/hint refs
    strength: JustificationStrength = JustificationStrength.HINT

    def __post_init__(self) -> None:
        object.__setattr__(self, "technique", PromptTechnique(self.technique))
        object.__setattr__(
            self, "strength", JustificationStrength(self.strength)
        )
        object.__setattr__(self, "source_refs", tuple(self.source_refs))
        if not self.source_refs:
            raise ValueError("TechniqueJustification.source_refs must be non-empty")


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
                    "strength": j.strength.value,
                }
                for j in self.justifications
            ],
            "deferred_techniques": [t.value for t in self.deferred_techniques],
            "budget_truncated": self.budget_truncated,
            "notes": list(self.notes),
        }


def _kind_strength(kind: RequirementKind) -> JustificationStrength:
    if kind is RequirementKind.MUST or kind is RequirementKind.MUST_NOT:
        return JustificationStrength.MUST
    if kind is RequirementKind.SHOULD:
        return JustificationStrength.SHOULD
    return JustificationStrength.PREFERENCE


def _best_contract_strength(
    contract: ProtectedIntentContract,
    technique: PromptTechnique,
) -> tuple[JustificationStrength | None, tuple[str, ...]]:
    """Strongest matching requirement atoms for a technique, if any."""
    tokens = _KEY_HINTS.get(technique, ())
    if not tokens:
        return None, ()
    best: JustificationStrength | None = None
    refs: list[str] = []
    for atom in contract.graph.nodes.values():
        key = atom.semantic_key.lower()
        if any(tok in key for tok in tokens):
            strength = _kind_strength(atom.kind)
            refs.append(atom.requirement_id)
            if best is None or _STRENGTH_RANK[strength] < _STRENGTH_RANK[best]:
                best = strength
    return best, tuple(sorted(refs))


def _resolve_strength(
    contract: ProtectedIntentContract,
    technique: PromptTechnique,
    *,
    fallback: JustificationStrength,
) -> tuple[JustificationStrength, tuple[str, ...]]:
    best, refs = _best_contract_strength(contract, technique)
    if best is not None:
        return best, refs
    return fallback, ()


def _candidate_justifications(
    contract: ProtectedIntentContract,
    plan: CognitivePlan,
    hints: PlanningHints,
) -> list[TechniqueJustification]:
    out: list[TechniqueJustification] = []
    plan_ref = f"plan:{plan.plan_id}"

    if hints.needs_examples and hints.example_count > 0:
        strength, refs = _resolve_strength(
            contract, PromptTechnique.FEW_SHOT, fallback=JustificationStrength.HINT
        )
        out.append(
            TechniqueJustification(
                PromptTechnique.FEW_SHOT,
                "EXAMPLES_SUPPLIED",
                (plan_ref, "hint:needs_examples", *refs),
                strength=strength,
            )
        )
    elif not hints.needs_examples:
        out.append(
            TechniqueJustification(
                PromptTechnique.ZERO_SHOT,
                "NO_EXAMPLES_REQUIRED",
                (plan_ref,),
                strength=JustificationStrength.PLAN,
            )
        )

    if hints.has_context:
        strength, refs = _resolve_strength(
            contract, PromptTechnique.CONTEXTUAL, fallback=JustificationStrength.HINT
        )
        out.append(
            TechniqueJustification(
                PromptTechnique.CONTEXTUAL,
                "CONTEXT_SUPPLIED",
                (plan_ref, "hint:has_context", *refs),
                strength=strength,
            )
        )

    if hints.role_label:
        strength, refs = _resolve_strength(
            contract, PromptTechnique.ROLE_PERSONA, fallback=JustificationStrength.HINT
        )
        # role_label text is data — ref uses length+digest-safe marker, not raw injection
        role_ref = f"hint:role_len:{len(hints.role_label)}"
        out.append(
            TechniqueJustification(
                PromptTechnique.ROLE_PERSONA,
                "ROLE_LABEL_SUPPLIED",
                (plan_ref, role_ref, *refs),
                strength=strength,
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
                strength=JustificationStrength.PLAN,
            )
        )

    if plan.plan_kind in (
        CognitivePlanKind.DECOMPOSE,
        CognitivePlanKind.PLAN_THEN_EXECUTE,
    ):
        strength, refs = _resolve_strength(
            contract,
            PromptTechnique.DECOMPOSE_PLAN_SOLVE,
            fallback=JustificationStrength.PLAN,
        )
        out.append(
            TechniqueJustification(
                PromptTechnique.DECOMPOSE_PLAN_SOLVE,
                "PLAN_REQUIRES_STAGED_SOLVE",
                (plan_ref, f"plan_kind:{plan.plan_kind.value}", *refs),
                strength=strength,
            )
        )

    if plan.requires_evidence or plan.plan_kind is CognitivePlanKind.RETRIEVE_THEN_REASON:
        strength, refs = _resolve_strength(
            contract, PromptTechnique.RETRIEVE_REASON, fallback=JustificationStrength.HINT
        )
        out.append(
            TechniqueJustification(
                PromptTechnique.RETRIEVE_REASON,
                "EVIDENCE_OR_RESEARCH_REQUIRED",
                (plan_ref, "plan:requires_evidence", *refs),
                strength=strength,
            )
        )

    if plan.plan_kind is CognitivePlanKind.CRITIQUE_REVISE or hints.needs_revision:
        strength, refs = _resolve_strength(
            contract, PromptTechnique.CRITIQUE_REVISE, fallback=JustificationStrength.HINT
        )
        out.append(
            TechniqueJustification(
                PromptTechnique.CRITIQUE_REVISE,
                "REVISION_REQUIRED",
                (plan_ref, "hint:needs_revision", *refs),
                strength=strength,
            )
        )

    if plan.requires_structured_output or hints.needs_structured_output:
        strength, refs = _resolve_strength(
            contract, PromptTechnique.STRUCTURED_OUTPUT, fallback=JustificationStrength.HINT
        )
        out.append(
            TechniqueJustification(
                PromptTechnique.STRUCTURED_OUTPUT,
                "STRUCTURED_OUTPUT_REQUIRED",
                (plan_ref, "hint:needs_structured_output", *refs),
                strength=strength,
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
    from spe_runtime.prompt.hints import constrain_hints_to_contract

    h = constrain_hints_to_contract(contract, h)

    notes: list[str] = []
    if h.needs_examples and h.example_count <= 0:
        notes.append("EXAMPLES_REQUIRED_BUT_MISSING")

    cands = _candidate_justifications(contract, plan, h)
    seen: set[PromptTechnique] = set()
    unique: list[TechniqueJustification] = []
    for j in cands:
        if j.technique in seen:
            continue
        seen.add(j.technique)
        unique.append(j)

    unique = _enforce_compatibility(unique)

    # Strength-first budget law, then technique-family tie-breaker.
    unique.sort(
        key=lambda j: (
            _STRENGTH_RANK[j.strength],
            _TECHNIQUE_PRIORITY[j.technique],
            j.technique.value,
        )
    )

    budget_truncated = len(unique) > STANDARD_MAX_TECHNIQUES
    kept = unique[:STANDARD_MAX_TECHNIQUES]
    deferred = tuple(j.technique for j in unique[STANDARD_MAX_TECHNIQUES:])
    if budget_truncated:
        notes.append(f"BUDGET_TRUNCATED_MAX_{STANDARD_MAX_TECHNIQUES}")
        # Invariant: no MUST deferred while weaker kept
        kept_ranks = {_STRENGTH_RANK[j.strength] for j in kept}
        for j in unique[STANDARD_MAX_TECHNIQUES:]:
            if j.strength is JustificationStrength.MUST and any(
                r > _STRENGTH_RANK[JustificationStrength.MUST] for r in kept_ranks
            ):
                raise SpeTypedError(
                    ErrorCode.K3_STRATEGY_INVARIANT_VIOLATION,
                    "budget truncation deferred MUST-derived technique while keeping weaker technique",
                )

    techniques = tuple(j.technique for j in kept)
    for j in kept:
        if not j.source_refs:
            raise SpeTypedError(
                ErrorCode.K3_STRATEGY_INVARIANT_VIOLATION,
                "technique without justification refs",
            )

    payload = {
        "cognitive_plan_id": plan.plan_id,
        "techniques": [t.value for t in techniques],
        "justifications": [
            {
                "technique": j.technique.value,
                "reason_code": j.reason_code,
                "source_refs": list(j.source_refs),
                "strength": j.strength.value,
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
    "JustificationStrength",
    "TechniqueJustification",
    "TechniqueSelection",
    "select_prompt_techniques",
]
