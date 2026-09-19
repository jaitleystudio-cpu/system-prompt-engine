"""Provider registry / surface status (no live spend)."""

from __future__ import annotations

from spe_runtime.providers.anthropic_compat import AnthropicCompatAdapter
from spe_runtime.providers.credentials import credential_presence
from spe_runtime.providers.live_gate import load_policy_from_env
from spe_runtime.providers.models import ProviderStatus
from spe_runtime.providers.openai_compat import OpenAICompatAdapter


def openai_compat_adapter(**kwargs) -> OpenAICompatAdapter:
    return OpenAICompatAdapter(**kwargs)


def anthropic_compat_adapter(**kwargs) -> AnthropicCompatAdapter:
    return AnthropicCompatAdapter(**kwargs)


def list_provider_statuses() -> list[dict]:
    creds = credential_presence()
    policy = load_policy_from_env()
    rows = []

    def row(provider_id: str, adapter_path: str, has_cred: bool, endpoint_class: str) -> dict:
        if not has_cred:
            status = ProviderStatus.SUPPORTED_BUT_NO_CREDENTIAL.value
        elif not policy.allow_paid:
            status = ProviderStatus.BLOCKED_NO_CREDENTIAL.value  # budget blocked
            # More precise: has credential path but budget blocks — still not testable live
            status = "SUPPORTED_BUT_NO_BUDGET"
        else:
            status = ProviderStatus.SUPPORTED_AND_TESTABLE.value
        return {
            "provider": provider_id,
            "adapter_path": adapter_path,
            "canonical_owner": adapter_path,
            "transport": "stdlib_urllib",
            "endpoint_class": endpoint_class,
            "credential_present": bool(has_cred),
            "credential_source": "env",
            "status": status if has_cred or provider_id != "local_ollama" else (
                ProviderStatus.SUPPORTED_BUT_NO_CREDENTIAL.value
                if not has_cred
                else status
            ),
        }

    rows.append(
        row(
            "openai_compat",
            "spe_runtime.providers.openai_compat.OpenAICompatAdapter",
            creds.openai,
            "openai_chat_completions",
        )
    )
    rows.append(
        row(
            "anthropic_compat",
            "spe_runtime.providers.anthropic_compat.AnthropicCompatAdapter",
            creds.anthropic,
            "anthropic_messages",
        )
    )
    rows.append(
        {
            "provider": "local_ollama",
            "adapter_path": None,
            "canonical_owner": None,
            "transport": None,
            "endpoint_class": "ollama",
            "credential_present": creds.ollama,
            "credential_source": "OLLAMA_HOST",
            "status": (
                ProviderStatus.SUPPORTED_AND_TESTABLE.value
                if creds.ollama
                else ProviderStatus.NOT_IMPLEMENTED.value
            ),
            "note": "No local endpoint detected in G4 environment",
        }
    )
    return rows


__all__ = [
    "anthropic_compat_adapter",
    "list_provider_statuses",
    "openai_compat_adapter",
]
