"""K7 scope containment — CLAIM SCOPE <= EVIDENCE SCOPE.

UNBOUND != ALL. Missing claim dimensions must not broaden coverage.
"""

from __future__ import annotations

from spe_runtime.qualification.models import ClaimScope


def scope_covers(evidence_scope: ClaimScope, claim_scope: ClaimScope) -> bool:
    """True iff evidence scope is sufficient to cover the claimed scope.

    Narrow evidence cannot qualify broader claims.
    Exact match per dimension. Revision: both must match exactly —
    claim.revision=None does NOT wildcard over evidence.revision=SHA
    (UNBOUND != ALL). Both-None is allowed as mutually unbound.
    """
    if evidence_scope.component != claim_scope.component:
        return False
    if evidence_scope.platform != claim_scope.platform:
        return False
    if evidence_scope.runtime != claim_scope.runtime:
        return False
    if evidence_scope.environment != claim_scope.environment:
        return False
    # Revision: exact equality including None—None. No omission broadening.
    if evidence_scope.revision != claim_scope.revision:
        return False
    return True


__all__ = ["scope_covers"]
