"""Provider surfaces — versioned provider *profiles* (data registry).

Distinct from domain grounding profiles in ``spe_runtime.grounding.profiles``.
"""

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
    "FORBIDDEN_AUTHORITY_FLAGS",
    "ProviderProfile",
    "get_provider_profile",
    "list_provider_profile_ids",
    "list_provider_profiles",
    "load_provider_profile_registry",
    "provider_profile_digest",
    "provider_registry_digest",
    "validate_provider_profile",
]
