"""K2 SemanticProofLease — bounded semantic mutation authorization.

NOT a G3 durable worker lease (no heartbeat, fencing, crash recovery).
NOT an AuthorityGrant — never grants external execution authority.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable

from spe_runtime.authority.models import AuthorityGrant
from spe_runtime.error_registry import ErrorCode, SpeTypedError
from spe_runtime.proof.obligation import ProofObligation
from spe_runtime.proof.snapshot import SemanticSnapshot
from spe_runtime.proof.types import DeltaAction, LeaseStatus, content_digest


@dataclass(frozen=True)
class SemanticProofLease:
    """Authorize one bounded proof-carrying semantic patch against a snapshot.

    SemanticProofLease != AuthorityGrant.
    No heartbeat, fencing token, worker id, or durable reclaim semantics.
    """

    lease_id: str
    base_snapshot_id: str
    base_version: int
    allowed_obligation_ids: tuple[str, ...]
    allowed_scope: frozenset[DeltaAction]
    status: LeaseStatus
    # Full obligation objects retained for commit-time proof-type checks
    obligations: tuple[ProofObligation, ...] = ()

    def __post_init__(self) -> None:
        object.__setattr__(self, "allowed_obligation_ids", tuple(self.allowed_obligation_ids))
        object.__setattr__(self, "allowed_scope", frozenset(self.allowed_scope))
        object.__setattr__(self, "obligations", tuple(self.obligations))
        if not isinstance(self.status, LeaseStatus):
            object.__setattr__(self, "status", LeaseStatus(self.status))


def assert_not_authority_grant(obj: object) -> None:
    """Hard separation: K2 lease/receipt/patch objects are never AuthorityGrant."""
    if isinstance(obj, AuthorityGrant):
        raise SpeTypedError(
            ErrorCode.K2_INVALID_SEMANTIC_LEASE,
            "AuthorityGrant is not a SemanticProofLease",
        )


def is_authority_grant(obj: object) -> bool:
    return isinstance(obj, AuthorityGrant)


def issue_semantic_lease(
    *,
    snapshot: SemanticSnapshot,
    obligations: Iterable[ProofObligation],
    allowed_scope: Iterable[DeltaAction | str],
) -> SemanticProofLease:
    """ONE canonical semantic lease creator.

    Patches cannot create their own lease. Deterministic lease_id from bindings.
    Does not mint AuthorityGrant.
    """
    obl_tuple = tuple(obligations)
    scope = frozenset(
        a if isinstance(a, DeltaAction) else DeltaAction(a) for a in allowed_scope
    )
    obl_ids = tuple(o.obligation_id for o in obl_tuple)
    payload = {
        "base_snapshot_id": snapshot.snapshot_id,
        "base_version": snapshot.version,
        "allowed_obligation_ids": list(obl_ids),
        "allowed_scope": sorted(a.value for a in scope),
    }
    lease_id = content_digest(payload, prefix="lease-")
    lease = SemanticProofLease(
        lease_id=lease_id,
        base_snapshot_id=snapshot.snapshot_id,
        base_version=snapshot.version,
        allowed_obligation_ids=obl_ids,
        allowed_scope=scope,
        status=LeaseStatus.ACTIVE,
        obligations=obl_tuple,
    )
    assert_not_authority_grant(lease)
    return lease


def consume_lease(lease: SemanticProofLease) -> SemanticProofLease:
    """Return a CONSUMED copy (copy-on-write)."""
    if lease.status is LeaseStatus.CONSUMED:
        return lease
    return SemanticProofLease(
        lease_id=lease.lease_id,
        base_snapshot_id=lease.base_snapshot_id,
        base_version=lease.base_version,
        allowed_obligation_ids=lease.allowed_obligation_ids,
        allowed_scope=lease.allowed_scope,
        status=LeaseStatus.CONSUMED,
        obligations=lease.obligations,
    )


__all__ = [
    "SemanticProofLease",
    "issue_semantic_lease",
    "consume_lease",
    "assert_not_authority_grant",
    "is_authority_grant",
]
