"""K2 SemanticSnapshot — deterministic immutable semantic state point."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from spe_runtime.contract.protected import ProtectedIntentContract
from spe_runtime.portability.canonical import canonical_dumps
from spe_runtime.proof.types import content_digest


def protected_intent_digest(contract: ProtectedIntentContract) -> str:
    return content_digest(contract.to_dict(), prefix="pid-", length=64)


def requirement_graph_digest(contract: ProtectedIntentContract) -> str:
    return content_digest(contract.graph.to_dict(), prefix="rg-", length=64)


@dataclass(frozen=True)
class SemanticSnapshot:
    """Canonical semantic state at one generation.

    Not an execution log, authority grant, prompt, or durable DB transaction.
    Identity is content-addressed — never uuid/time/random.
    """

    snapshot_id: str
    version: int
    parent_snapshot_id: str | None
    protected_intent: ProtectedIntentContract
    protected_intent_digest: str
    requirement_graph_digest: str
    created_from_patch_id: str | None = None

    def to_identity_payload(self) -> dict[str, Any]:
        return {
            "version": self.version,
            "parent_snapshot_id": self.parent_snapshot_id,
            "protected_intent_digest": self.protected_intent_digest,
            "created_from_patch_id": self.created_from_patch_id,
        }


def make_snapshot(
    contract: ProtectedIntentContract,
    *,
    version: int = 0,
    parent: SemanticSnapshot | str | None = None,
    created_from_patch_id: str | None = None,
) -> SemanticSnapshot:
    """Construct a frozen SemanticSnapshot with deterministic snapshot_id."""
    parent_id: str | None
    if parent is None:
        parent_id = None
    elif isinstance(parent, SemanticSnapshot):
        parent_id = parent.snapshot_id
    else:
        parent_id = parent

    pi_digest = protected_intent_digest(contract)
    rg_digest = requirement_graph_digest(contract)
    payload = {
        "version": int(version),
        "parent_snapshot_id": parent_id,
        "protected_intent_digest": pi_digest,
        "created_from_patch_id": created_from_patch_id,
    }
    # Force canonical path used (identity must not use uuid/time/random)
    _ = canonical_dumps(payload)
    snapshot_id = content_digest(payload, prefix="snap-")
    return SemanticSnapshot(
        snapshot_id=snapshot_id,
        version=int(version),
        parent_snapshot_id=parent_id,
        protected_intent=contract,
        protected_intent_digest=pi_digest,
        requirement_graph_digest=rg_digest,
        created_from_patch_id=created_from_patch_id,
    )


__all__ = [
    "SemanticSnapshot",
    "make_snapshot",
    "protected_intent_digest",
    "requirement_graph_digest",
]
