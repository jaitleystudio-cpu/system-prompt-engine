"""Authority package — AuthorityGrant (Sprint 3). C07 never mints grants."""

from spe_runtime.authority.consume import consume_grant
from spe_runtime.authority.models import AuthorityGrant
from spe_runtime.authority.validate import validate_grant_compatibility

__all__ = ["AuthorityGrant", "validate_grant_compatibility", "consume_grant"]
