"""Immutable grant consumption — C07 never mutates a grant in place."""

from __future__ import annotations

from spe_runtime.authority.models import AuthorityGrant
from spe_runtime.xcat.reasons import ReasonCode


def consume_grant(grant: AuthorityGrant) -> tuple[bool, AuthorityGrant | None, tuple[str, ...]]:
    """Return a new grant with uses_consumed+1, or refuse if ineligible.

    Does not mutate the input grant. Does not mint/broaden capability/target/expiry.
    """
    if str(grant.revocation_state).upper() == "REVOKED":
        return False, None, (ReasonCode.AUTHORITY_REVOKED.value,)
    if int(grant.uses_consumed) >= int(grant.use_limit):
        return False, None, (ReasonCode.AUTHORITY_CONSUMED.value,)

    nxt = AuthorityGrant(
        grant_id=grant.grant_id,
        principal=grant.principal,
        capability=grant.capability,
        target=grant.target,
        argument_constraints=dict(grant.argument_constraints),
        purpose=grant.purpose,
        issued_at=grant.issued_at,
        expires_at=grant.expires_at,
        use_limit=grant.use_limit,
        uses_consumed=int(grant.uses_consumed) + 1,
        revocation_state=grant.revocation_state,
    )
    return True, nxt, ()
