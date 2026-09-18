"""K3 PlanningHints — deterministic structured task signals (no NLP).

Trust boundary (G1R-7R):
  PlanningHints are NON-AUTHORITATIVE planning input.
  They must not invent USER_CONFIRMED / MUST / MUST_NOT.
  They cannot override ProtectedIntentContract.
  Untrusted context text must never become PlanningHints flags except
  has_context=True when context_blocks are literally supplied to the compiler.
"""

from __future__ import annotations

from dataclasses import dataclass

from spe_runtime.contract.protected import ProtectedIntentContract
from spe_runtime.requirements.models import RequirementKind


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


def constrain_hints_to_contract(
    contract: ProtectedIntentContract,
    hints: PlanningHints,
) -> PlanningHints:
    """Clamp hints so they cannot invent or upgrade protected semantics.

    Trust law:
      - Hints never mutate the contract.
      - Hints never mint USER_CONFIRMED / MUST / MUST_NOT.
      - role_label is opaque data (may justify ROLE_PERSONA at HINT strength
        unless a matching contract atom elevates strength).
      - needs_retrieval never implies network/egress permission.
      - needs_execution_prep never implies AuthorityGrant / tool call.
      - Untrusted context_blocks are NOT PlanningHints — only the compiler
        may set has_context=True when blocks are literally supplied.
      - Invalid complexity / negative example_count are normalized.
    """
    if not isinstance(hints, PlanningHints):
        raise TypeError("hints must be PlanningHints")
    # Read contract for side-effect-free boundary documentation (no mutation).
    _ = contract.validity
    _ = any(
        n.kind is RequirementKind.MUST_NOT and "network" in n.semantic_key.lower()
        for n in contract.graph.nodes.values()
    )
    example_count = hints.example_count if hints.example_count >= 0 else 0
    complexity = (
        hints.complexity_class
        if hints.complexity_class in ("SIMPLE", "STANDARD", "COMPLEX")
        else "STANDARD"
    )
    # role_label stays as supplied string data — never parsed into authority.
    role = hints.role_label if (hints.role_label is None or isinstance(hints.role_label, str)) else None
    return PlanningHints(
        needs_decomposition=bool(hints.needs_decomposition),
        needs_retrieval=bool(hints.needs_retrieval),
        needs_comparison=bool(hints.needs_comparison),
        needs_revision=bool(hints.needs_revision),
        needs_structured_output=bool(hints.needs_structured_output),
        needs_examples=bool(hints.needs_examples),
        needs_execution_prep=bool(hints.needs_execution_prep),
        has_context=bool(hints.has_context),
        role_label=role,
        example_count=int(example_count),
        complexity_class=complexity,
    )


__all__ = ["PlanningHints", "constrain_hints_to_contract"]
