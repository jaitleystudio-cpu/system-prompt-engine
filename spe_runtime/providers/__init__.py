"""G4 provider boundary — protocol adapters, not SPE semantics owners.

Adapters translate ProviderRequest ↔ provider wire formats.
They do NOT own ProtectedIntent, K2 proof, K4 authority, K6 identity,
K7 qualification, or Ring-1 mission truth.
"""

from spe_runtime.providers.boundary import (
    assert_no_authority_mint,
    assert_no_self_qualification,
)
from spe_runtime.providers.credentials import credential_presence, resolve_api_key
from spe_runtime.providers.live_gate import LiveCallPolicy, assert_live_allowed
from spe_runtime.providers.models import (
    CapabilityManifest,
    GenerationParams,
    NormalizedResult,
    ProviderMessage,
    ProviderReceipt,
    ProviderRequest,
    ProviderStatus,
    ToolCallRequest,
)
from spe_runtime.providers.registry import (
    list_provider_statuses,
    openai_compat_adapter,
    anthropic_compat_adapter,
)

__all__ = [
    "CapabilityManifest",
    "GenerationParams",
    "LiveCallPolicy",
    "NormalizedResult",
    "ProviderMessage",
    "ProviderReceipt",
    "ProviderRequest",
    "ProviderStatus",
    "ToolCallRequest",
    "assert_live_allowed",
    "assert_no_authority_mint",
    "assert_no_self_qualification",
    "anthropic_compat_adapter",
    "credential_presence",
    "list_provider_statuses",
    "openai_compat_adapter",
    "resolve_api_key",
]
