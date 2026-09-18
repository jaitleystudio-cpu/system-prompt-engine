"""K2 ProofCarryingPatch — proposed semantic mutation with proof bindings."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Iterable, Mapping

from spe_runtime.contract.protected import (
    ProtectedIntentContract,
    confirm_requirement,
    propose_requirement,
)
from spe_runtime.error_registry import ErrorCode, SpeTypedError
from spe_runtime.proof.types import DeltaAction, content_digest


@dataclass(frozen=True)
class SemanticDeltaStep:
    """One delta step applied only through propose_requirement / confirm_requirement."""

    action: DeltaAction
    semantic_key: str | None = None
    kind: str | None = None
    value: Any = None
    provenance: str | None = None
    source_ref: str | None = None
    statement: str | None = None
    requirement_id: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "action": self.action.value if isinstance(self.action, DeltaAction) else self.action,
            "semantic_key": self.semantic_key,
            "kind": self.kind,
            "value": self.value,
            "provenance": self.provenance,
            "source_ref": self.source_ref,
            "statement": self.statement,
            "requirement_id": self.requirement_id,
        }


@dataclass(frozen=True)
class ProofCarryingPatch:
    """Patch carries evidence references; cannot self-approve.

    ``verified=True`` on construction input is ignored and excluded from identity.
    """

    patch_id: str
    base_snapshot_id: str
    base_version: int
    lease_id: str
    semantic_delta: tuple[SemanticDeltaStep, ...]
    obligation_ids: tuple[str, ...]
    receipt_ids: tuple[str, ...] = ()

    def __post_init__(self) -> None:
        object.__setattr__(self, "semantic_delta", tuple(self.semantic_delta))
        object.__setattr__(self, "obligation_ids", tuple(self.obligation_ids))
        object.__setattr__(self, "receipt_ids", tuple(self.receipt_ids))


def _coerce_step(step: SemanticDeltaStep | Mapping[str, Any]) -> SemanticDeltaStep:
    if isinstance(step, SemanticDeltaStep):
        action = step.action
        if not isinstance(action, DeltaAction):
            action = DeltaAction(action)
        return SemanticDeltaStep(
            action=action,
            semantic_key=step.semantic_key,
            kind=step.kind,
            value=step.value,
            provenance=step.provenance,
            source_ref=step.source_ref,
            statement=step.statement,
            requirement_id=step.requirement_id,
        )
    action = step["action"]
    if not isinstance(action, DeltaAction):
        action = DeltaAction(action)
    return SemanticDeltaStep(
        action=action,
        semantic_key=step.get("semantic_key"),
        kind=step.get("kind"),
        value=step.get("value"),
        provenance=step.get("provenance"),
        source_ref=step.get("source_ref"),
        statement=step.get("statement"),
        requirement_id=step.get("requirement_id"),
    )


def make_patch(
    *,
    base_snapshot_id: str,
    base_version: int,
    lease_id: str,
    semantic_delta: Iterable[SemanticDeltaStep | Mapping[str, Any]],
    obligation_ids: Iterable[str],
    receipt_ids: Iterable[str] = (),
    verified: bool | None = None,  # intentionally ignored — cannot self-approve
    **_ignored: Any,
) -> ProofCarryingPatch:
    """Deterministic patch factory. ``verified`` is ignored for identity and validity."""
    del verified, _ignored
    steps = tuple(_coerce_step(s) for s in semantic_delta)
    obl_ids = tuple(obligation_ids)
    # receipt_ids may be attached later; exclude from identity so evidence bind is separate
    identity_payload = {
        "base_snapshot_id": base_snapshot_id,
        "base_version": int(base_version),
        "lease_id": lease_id,
        "semantic_delta": [s.to_dict() for s in steps],
        "obligation_ids": list(obl_ids),
    }
    patch_id = content_digest(identity_payload, prefix="patch-")
    return ProofCarryingPatch(
        patch_id=patch_id,
        base_snapshot_id=base_snapshot_id,
        base_version=int(base_version),
        lease_id=lease_id,
        semantic_delta=steps,
        obligation_ids=obl_ids,
        receipt_ids=tuple(receipt_ids),
    )


def apply_semantic_delta(
    contract: ProtectedIntentContract,
    delta: Iterable[SemanticDeltaStep],
) -> ProtectedIntentContract:
    """Apply delta exclusively through K0/K1 propose/confirm APIs."""
    current = contract
    for step in delta:
        action = step.action if isinstance(step.action, DeltaAction) else DeltaAction(step.action)
        if action is DeltaAction.ADD_REQUIREMENT:
            if not step.semantic_key or step.kind is None or step.provenance is None:
                raise SpeTypedError(
                    ErrorCode.K2_ATOMIC_COMMIT_REJECTED,
                    "ADD_REQUIREMENT requires semantic_key, kind, provenance",
                )
            current = propose_requirement(
                current,
                semantic_key=step.semantic_key,
                kind=step.kind,
                value=step.value,
                provenance=step.provenance,
                source_ref=step.source_ref,
                statement=step.statement,
            )
        elif action is DeltaAction.CONFIRM_REQUIREMENT:
            if not step.requirement_id:
                raise SpeTypedError(
                    ErrorCode.K2_ATOMIC_COMMIT_REJECTED,
                    "CONFIRM_REQUIREMENT requires requirement_id",
                )
            current = confirm_requirement(current, step.requirement_id)
        else:
            raise SpeTypedError(
                ErrorCode.K2_ATOMIC_COMMIT_REJECTED,
                f"unsupported delta action: {action}",
            )
    return current


def delta_actions(delta: Iterable[SemanticDeltaStep]) -> frozenset[DeltaAction]:
    out: set[DeltaAction] = set()
    for step in delta:
        action = step.action if isinstance(step.action, DeltaAction) else DeltaAction(step.action)
        out.add(action)
    return frozenset(out)


__all__ = [
    "SemanticDeltaStep",
    "ProofCarryingPatch",
    "make_patch",
    "apply_semantic_delta",
    "delta_actions",
]
