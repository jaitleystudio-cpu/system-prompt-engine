"""Credential presence — never log or persist secret values."""

from __future__ import annotations

import os
from dataclasses import dataclass


# Env var names only. Values never returned by public APIs in this module
# except resolve_api_key which is for transport use and must not be logged.
_OPENAI_KEYS = ("OPENAI_API_KEY", "SPE_OPENAI_API_KEY")
_ANTHROPIC_KEYS = ("ANTHROPIC_API_KEY", "SPE_ANTHROPIC_API_KEY")


@dataclass(frozen=True)
class CredentialPresence:
    openai: bool
    anthropic: bool
    ollama: bool
    any_live_capable: bool
    names_checked: tuple[str, ...]


def credential_presence() -> CredentialPresence:
    openai = any(bool(os.environ.get(k)) for k in _OPENAI_KEYS)
    anthropic = any(bool(os.environ.get(k)) for k in _ANTHROPIC_KEYS)
    ollama = bool(os.environ.get("OLLAMA_HOST"))
    names = _OPENAI_KEYS + _ANTHROPIC_KEYS + ("OLLAMA_HOST",)
    return CredentialPresence(
        openai=openai,
        anthropic=anthropic,
        ollama=ollama,
        any_live_capable=openai or anthropic or ollama,
        names_checked=names,
    )


def resolve_api_key(provider_id: str) -> str | None:
    """Return API key for transport only. Callers must not log/print/persist."""
    if provider_id in {"openai", "openai_compat"}:
        for k in _OPENAI_KEYS:
            v = os.environ.get(k)
            if v:
                return v
    if provider_id in {"anthropic", "anthropic_compat"}:
        for k in _ANTHROPIC_KEYS:
            v = os.environ.get(k)
            if v:
                return v
    return None


__all__ = ["CredentialPresence", "credential_presence", "resolve_api_key"]
