"""K7 scope containment — CLAIM SCOPE <= EVIDENCE SCOPE."""

from __future__ import annotations

from spe_runtime.qualification.models import ClaimScope


def scope_covers(evidence_scope: ClaimScope, claim_scope: ClaimScope) -> bool:
    """True iff evidence scope is sufficient to cover the claimed scope.

    Narrow evidence cannot qualify broader claims.
    Each claim dimension must equal the evidence dimension
    (or claim revision is None while evidence may carry a revision).
    """
    if evidence_scope.component != claim_scope.component:
        return False
    if evidence_scope.platform != claim_scope.platform:
        return False
    if evidence_scope.runtime != claim_scope.runtime:
        return False
    if evidence_scope.environment != claim_scope.environment:
        return False
    # Revision: if claim binds a revision, evidence must match exactly.
    if claim_scope.revision is not None and evidence_scope.revision != claim_scope.revision:
        return False
    return True


__all__ = ["scope_covers"]
