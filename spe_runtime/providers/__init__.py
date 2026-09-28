"""Provider surfaces — versioned profiles + thin Capability ABI adapter.

Distinct from domain grounding profiles in ``spe_runtime.grounding.profiles``.
"""

from spe_runtime.providers.adapter import (
    STATUS_BLOCKED,
    STATUS_SELECTED,
    STATUS_UNAVAILABLE,
    CapabilityNeed,
    ProfileSelection,
    RoutingPolicy,
    select_profile,
)
from spe_runtime.providers.profiles import (
    FORBIDDEN_AUTHORITY_FLAGS,
    ProviderProfile,
    get_provider_profile,
    list_provider_profile_ids,
    list_provider_profiles,
    load_provider_profile_registry,
    provider_profile_digest,
    provider_registry_digest,
    validate_provider_profile,
)

__all__ = [
    "STATUS_BLOCKED",
    "STATUS_SELECTED",
    "STATUS_UNAVAILABLE",
    "CapabilityNeed",
    "FORBIDDEN_AUTHORITY_FLAGS",
    "ProfileSelection",
    "ProviderProfile",
    "RoutingPolicy",
    "get_provider_profile",
    "list_provider_profile_ids",
    "list_provider_profiles",
    "load_provider_profile_registry",
    "provider_profile_digest",
    "provider_registry_digest",
    "select_profile",
    "validate_provider_profile",
]
