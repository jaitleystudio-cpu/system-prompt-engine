"""Bounded deterministic prompt reconstruct loop.

Allowed mutation surface: execution wording, ordering of non-required explanatory
text, optional examples, formatting.

Forbidden mutation surface: ProtectedIntent, hard constraints, source facts,
evidence confidence, authority, safety policy.
"""

from __future__ import annotations

from dataclasses import dataclass, replace
from typing import Any, Callable, Mapping

# Fields the optimizer may rewrite.
ALLOWED_MUTATION_FIELDS = frozenset(
    {
        "execution_wording",
        "explanatory_order",
        "optional_examples",
        "formatting",
    }
)

# Fields that must remain immutable across reconstruct iterations.
FORBIDDEN_MUTATION_FIELDS = frozenset(
    {
        "protected_intent",
        "hard_constraints",
        "source_facts",
        "evidence_confidence",
        "authority",
        "safety_policy",
    }
)

DEFAULT_SUCCESS_THRESHOLD = 0.85


@dataclass(frozen=True)
class PromptCandidate:
    """Prompt artifact under bounded optimization.

    ``protected_intent`` and other forbidden fields are structurally present so
    the optimizer can refuse mutation attempts without external lookups.
    """

    protected_intent: str
    hard_constraints: tuple[str, ...] = ()
    source_facts: tuple[str, ...] = ()
    evidence_confidence: float | None = None
    authority: str | None = None
    safety_policy: str | None = None
    execution_wording: str = ""
    explanatory_order: tuple[str, ...] = ()
    optional_examples: tuple[str, ...] = ()
    formatting: str = ""

    def __post_init__(self) -> None:
        object.__setattr__(
            self, "hard_constraints", tuple(str(x) for x in self.hard_constraints)
        )
        object.__setattr__(
            self, "source_facts", tuple(str(x) for x in self.source_facts)
        )
        object.__setattr__(
            self, "explanatory_order", tuple(str(x) for x in self.explanatory_order)
        )
        object.__setattr__(
            self, "optional_examples", tuple(str(x) for x in self.optional_examples)
        )


@dataclass(frozen=True)
class OptimizationResult:
    final_candidate: PromptCandidate
    iterations: int
    stop_reason: str
    scores: tuple[float, ...] = ()

    def to_dict(self) -> dict[str, Any]:
        return {
            "final_candidate": {
                "protected_intent": self.final_candidate.protected_intent,
                "hard_constraints": list(self.final_candidate.hard_constraints),
                "source_facts": list(self.final_candidate.source_facts),
                "evidence_confidence": self.final_candidate.evidence_confidence,
                "authority": self.final_candidate.authority,
                "safety_policy": self.final_candidate.safety_policy,
                "execution_wording": self.final_candidate.execution_wording,
                "explanatory_order": list(self.final_candidate.explanatory_order),
                "optional_examples": list(self.final_candidate.optional_examples),
                "formatting": self.final_candidate.formatting,
            },
            "iterations": self.iterations,
            "stop_reason": self.stop_reason,
            "scores": list(self.scores),
        }


EvaluatorFn = Callable[[PromptCandidate], Mapping[str, Any] | float]


def _normalize_feedback(raw: Mapping[str, Any] | float) -> tuple[float, dict[str, Any]]:
    if isinstance(raw, (int, float)) and not isinstance(raw, bool):
        return float(raw), {}
    if not isinstance(raw, Mapping):
        raise TypeError("evaluator must return a float or mapping")
    score = float(raw.get("score", 0.0))
    proposed = raw.get("proposed_changes") or raw.get("proposal") or {}
    if not isinstance(proposed, Mapping):
        raise TypeError("proposed_changes must be a mapping")
    return score, dict(proposed)


def _apply_allowed_mutations(
    candidate: PromptCandidate,
    proposed: Mapping[str, Any],
) -> PromptCandidate | str:
    """Apply only allowed fields. Return stop-reason string if forbidden touched."""
    if not proposed:
        return candidate
    forbidden_hit = FORBIDDEN_MUTATION_FIELDS & set(proposed.keys())
    if forbidden_hit:
        return "PROTECTED_FIELD_MUTATION_REJECTED"
    unknown = set(proposed.keys()) - ALLOWED_MUTATION_FIELDS
    if unknown:
        # Treat unknown fields as forbidden to keep the mutation surface closed.
        return "PROTECTED_FIELD_MUTATION_REJECTED"

    changes: dict[str, Any] = {}
    if "execution_wording" in proposed:
        changes["execution_wording"] = str(proposed["execution_wording"])
    if "formatting" in proposed:
        changes["formatting"] = str(proposed["formatting"])
    if "explanatory_order" in proposed:
        changes["explanatory_order"] = tuple(
            str(x) for x in proposed["explanatory_order"]
        )
    if "optional_examples" in proposed:
        changes["optional_examples"] = tuple(
            str(x) for x in proposed["optional_examples"]
        )
    return replace(candidate, **changes)


def optimize_prompt(
    candidate: PromptCandidate,
    evaluator: EvaluatorFn,
    *,
    max_iterations: int = 3,
    success_threshold: float = DEFAULT_SUCCESS_THRESHOLD,
) -> OptimizationResult:
    """Bounded reconstruct -> test -> improve loop.

    Stop on first of: success threshold, max iterations, no measurable
    improvement, or protected-field mutation rejection.
    """
    if not isinstance(candidate, PromptCandidate):
        raise TypeError("candidate must be a PromptCandidate")
    if max_iterations < 1:
        raise ValueError("max_iterations must be >= 1")

    current = candidate
    scores: list[float] = []
    baseline_score, baseline_proposal = _normalize_feedback(evaluator(current))
    scores.append(baseline_score)

    if baseline_score >= success_threshold:
        return OptimizationResult(
            final_candidate=current,
            iterations=0,
            stop_reason="SUCCESS_THRESHOLD_MET",
            scores=tuple(scores),
        )

    # First reconstruct attempt uses the baseline evaluator proposal.
    pending_proposal: dict[str, Any] = dict(baseline_proposal)
    iterations = 0

    while iterations < max_iterations:
        iterations += 1
        if not pending_proposal:
            return OptimizationResult(
                final_candidate=current,
                iterations=iterations,
                stop_reason="NO_MEASURABLE_IMPROVEMENT",
                scores=tuple(scores),
            )

        applied = _apply_allowed_mutations(current, pending_proposal)
        if isinstance(applied, str):
            return OptimizationResult(
                final_candidate=current,
                iterations=iterations,
                stop_reason=applied,
                scores=tuple(scores),
            )

        if applied == current:
            return OptimizationResult(
                final_candidate=current,
                iterations=iterations,
                stop_reason="NO_MEASURABLE_IMPROVEMENT",
                scores=tuple(scores),
            )

        new_score, new_proposal = _normalize_feedback(evaluator(applied))
        scores.append(new_score)

        if new_score > baseline_score:
            current = applied
            baseline_score = new_score
            pending_proposal = dict(new_proposal)
            if baseline_score >= success_threshold:
                return OptimizationResult(
                    final_candidate=current,
                    iterations=iterations,
                    stop_reason="SUCCESS_THRESHOLD_MET",
                    scores=tuple(scores),
                )
            continue

        # No measurable improvement over the best score so far.
        return OptimizationResult(
            final_candidate=current,
            iterations=iterations,
            stop_reason="NO_MEASURABLE_IMPROVEMENT",
            scores=tuple(scores),
        )

    return OptimizationResult(
        final_candidate=current,
        iterations=iterations,
        stop_reason="MAX_ITERATIONS",
        scores=tuple(scores),
    )
