"""K3 PlanningHints — deterministic structured task signals (no NLP)."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class PlanningHints:
    """Optional deterministic task metadata for K3 planning.

    Never invents user intent. Callers supply only facts already known from
    structured K0/K1 state or explicit product encoding of a request.
    """

    needs_decomposition: bool = False
    needs_retrieval: bool = False
    needs_comparison: bool = False
    needs_revision: bool = False
    needs_structured_output: bool = False
    needs_examples: bool = False
    needs_execution_prep: bool = False
    has_context: bool = False
    role_label: str | None = None
    example_count: int = 0
    complexity_class: str = "STANDARD"  # SIMPLE | STANDARD | COMPLEX


__all__ = ["PlanningHints"]
