"""K0 ProtectedIntentContract — protected user meaning with provenance precedence."""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any

from spe_runtime.error_registry import ErrorCode, SpeTypedError
from spe_runtime.provenance.models import Provenance
from spe_runtime.provenance.rules import (
    coerce_provenance,
    is_protected,
    may_confirm,
    may_overwrite,
)
from spe_runtime.requirements.conflicts import (
    ConflictRecord,
    ConflictSeverity,
    ConflictType,
    apply_conflict_edges,
    detect_conflicts,
    make_conflict,
    unresolved_hard_conflicts,
)
from spe_runtime.requirements.graph import RequirementGraph
from spe_runtime.requirements.models import RequirementAtom, RequirementKind, coerce_kind


class ContractValidity(str, Enum):
    VALID = "VALID"
    CONFLICTED = "CONFLICTED"
    INCOMPLETE = "INCOMPLETE"


@dataclass(frozen=True)
class ProtectedIntentContract:
    """Deterministic protected user-intent state.

    Not a prompt, model output, execution grant, or authority object.
    USER_CONFIRMED ≠ EXECUTION_AUTHORIZED.
    """

    graph: RequirementGraph = field(default_factory=RequirementGraph)
    conflicts: tuple[ConflictRecord, ...] = ()

    def __post_init__(self) -> None:
        object.__setattr__(self, "conflicts", tuple(self.conflicts))

    @property
    def validity(self) -> ContractValidity:
        if not self.graph.nodes:
            return ContractValidity.INCOMPLETE
        if unresolved_hard_conflicts(self.conflicts):
            return ContractValidity.CONFLICTED
        return ContractValidity.VALID

    def get(self, requirement_id: str) -> RequirementAtom | None:
        return self.graph.get(requirement_id)

    def requirements_for(self, semantic_key: str) -> tuple[RequirementAtom, ...]:
        return self.graph.nodes_by_key(semantic_key)

    def protected_for(self, semantic_key: str) -> RequirementAtom | None:
        protected = [
            n for n in self.graph.nodes_by_key(semantic_key) if is_protected(n.provenance)
        ]
        if not protected:
            return None
        # Prefer CONFIRMED, then EXPLICIT, then SYSTEM_REQUIRED
        order = {
            Provenance.USER_CONFIRMED: 0,
            Provenance.USER_EXPLICIT: 1,
            Provenance.SYSTEM_REQUIRED: 2,
        }
        protected.sort(key=lambda n: order.get(n.provenance, 9))
        return protected[0]

    def _refresh(self, graph: RequirementGraph, extra: tuple[ConflictRecord, ...] = ()) -> ProtectedIntentContract:
        conflicts = detect_conflicts(graph, extra=extra)
        graph = apply_conflict_edges(graph, conflicts)
        return ProtectedIntentContract(graph=graph, conflicts=conflicts)

    def to_dict(self) -> dict[str, Any]:
        """Serialize contract state. Never includes proof / verification fields."""
        return {
            "validity": self.validity.value,
            "requirements": [n.to_dict() for n in self.graph.nodes.values()],
            "conflicts": [c.to_dict() for c in self.conflicts],
            "graph": self.graph.to_dict(),
        }


def propose_requirement(
    contract: ProtectedIntentContract,
    *,
    semantic_key: str,
    kind: RequirementKind | str,
    value: Any,
    provenance: Provenance | str,
    source_ref: str | None = None,
    statement: str | None = None,
    confidence: float | None = None,  # ignored — not a provenance upgrade path
    repetition: int | None = None,  # ignored
    category_handoff: str | None = None,  # ignored — XCAT not coupled
    tool_output: Any = None,  # ignored
    **_ignored: Any,
) -> ProtectedIntentContract:
    """Propose a requirement into the contract.

    Cannot mint USER_CONFIRMED (use confirm_requirement).
    UNKNOWN + MUST → K1_INVALID_REQUIREMENT.
    Lower provenance cannot overwrite protected; conflicting inference is recorded.
    confidence / repetition / handoff / tool_output never upgrade provenance.
    """
    del confidence, repetition, category_handoff, tool_output, _ignored

    prov = coerce_provenance(provenance)
    kind_e = coerce_kind(kind)

    # propose cannot mint USER_CONFIRMED
    if prov is Provenance.USER_CONFIRMED:
        raise SpeTypedError(
            ErrorCode.K0_INVALID_PROVENANCE_TRANSITION,
            "propose_requirement cannot mint USER_CONFIRMED; use confirm_requirement",
        )

    # UNKNOWN cannot become MUST
    if prov is Provenance.UNKNOWN and kind_e is RequirementKind.MUST:
        raise SpeTypedError(
            ErrorCode.K1_INVALID_REQUIREMENT,
            "UNKNOWN provenance cannot propose MUST requirement",
        )

    atom = RequirementAtom.create(
        semantic_key=semantic_key,
        kind=kind_e,
        value=value,
        provenance=prov,
        source_ref=source_ref,
        statement=statement,
    )

    # Same content already present — idempotent (update provenance only if allowed)
    existing_same = contract.graph.get(atom.requirement_id)
    if existing_same is not None:
        if existing_same.provenance is atom.provenance:
            return contract
        if not may_overwrite(existing_same.provenance, atom.provenance):
            if is_protected(existing_same.provenance) and not is_protected(atom.provenance):
                # protected wins; no overwrite
                return contract
            raise SpeTypedError(
                ErrorCode.K0_INVALID_PROVENANCE_TRANSITION,
                f"cannot transition {existing_same.provenance.value} → {atom.provenance.value}",
            )
        # allowed overwrite of provenance on same content
        graph = contract.graph.with_node(atom)
        return contract._refresh(graph, extra=contract.conflicts)

    # Look for protected peers on same semantic_key
    protected = contract.protected_for(semantic_key)
    extra: list[ConflictRecord] = list(contract.conflicts)

    if protected is not None and protected.value != value:
        if not may_overwrite(protected.provenance, prov):
            # INFERRED (or other lower) different value → record INFERENCE_CONFLICT, do not overwrite
            # Still store inferred separately (unbound coexistence) when it is a real atom
            graph = contract.graph.with_node(atom)
            conflict = make_conflict(
                left=protected,
                right=atom,
                conflict_type=ConflictType.INFERENCE_CONFLICT,
                severity=ConflictSeverity.HARD,
                summary=(
                    f"INFERENCE_CONFLICT: protected {protected.provenance.value}="
                    f"{protected.value!r} vs {prov.value}={value!r}"
                ),
            )
            extra.append(conflict)
            return contract._refresh(graph, extra=tuple(extra))

        # Incoming is not lower — but may still be illegal (e.g. proposing over CONFIRMED)
        if protected.provenance is Provenance.USER_CONFIRMED:
            raise SpeTypedError(
                ErrorCode.K0_INVALID_PROVENANCE_TRANSITION,
                "cannot overwrite USER_CONFIRMED via propose_requirement",
            )

    # Mutually exclusive MUST with existing MUST different value (both non-protected-lower case)
    for peer in contract.graph.nodes_by_key(semantic_key):
        if peer.requirement_id == atom.requirement_id:
            continue
        if peer.value == value and peer.kind is atom.kind:
            # equivalent content different id shouldn't happen given identity rule
            continue
        if not may_overwrite(peer.provenance, prov) and peer.value != value:
            graph = contract.graph.with_node(atom)
            conflict = make_conflict(
                left=peer,
                right=atom,
                conflict_type=ConflictType.INFERENCE_CONFLICT,
                severity=ConflictSeverity.HARD,
            )
            extra.append(conflict)
            return contract._refresh(graph, extra=tuple(extra))

    graph = contract.graph.with_node(atom)
    return contract._refresh(graph, extra=tuple(extra))


def confirm_requirement(
    contract: ProtectedIntentContract,
    requirement_id: str,
) -> ProtectedIntentContract:
    """Sole path that may produce USER_CONFIRMED provenance."""
    atom = contract.graph.get(requirement_id)
    if atom is None:
        raise SpeTypedError(
            ErrorCode.K1_INVALID_REQUIREMENT,
            f"unknown requirement_id: {requirement_id}",
        )
    if atom.provenance is Provenance.USER_CONFIRMED:
        return contract
    if not may_confirm(atom.provenance):
        raise SpeTypedError(
            ErrorCode.K0_INVALID_PROVENANCE_TRANSITION,
            f"cannot confirm provenance {atom.provenance.value}",
        )
    confirmed = atom.with_provenance(Provenance.USER_CONFIRMED)
    graph = contract.graph.with_node(confirmed)
    return contract._refresh(graph, extra=contract.conflicts)


__all__ = [
    "ContractValidity",
    "ProtectedIntentContract",
    "propose_requirement",
    "confirm_requirement",
]
