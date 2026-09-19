"""Authority package — AuthorityGrant (Sprint 3) + AuthorityEvent (G1R-2).

C07 never mints grants. Envelope authority_state mutations go through
apply_authority_event only.
"""

from spe_runtime.authority.apply import apply_authority_event
from spe_runtime.authority.consume import consume_grant
from spe_runtime.authority.event import AuthorityEvent
from spe_runtime.authority.event_validate import validate_authority_event
from spe_runtime.authority.models import AuthorityGrant
from spe_runtime.authority.validate import validate_grant_compatibility

__all__ = [
    "AuthorityGrant",
    "AuthorityEvent",
    "validate_grant_compatibility",
    "validate_authority_event",
    "apply_authority_event",
    "consume_grant",
]
