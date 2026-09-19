"""Live-call policy gate — fail closed without credential + budget approval."""

from __future__ import annotations

import os
from dataclasses import dataclass

from spe_runtime.error_registry import ErrorCode, SpeTypedError
from spe_runtime.providers.credentials import credential_presence


@dataclass(frozen=True)
class LiveCallPolicy:
    """Approved spend for G4. Default: ₹0 / $0 — no paid live calls."""

    approved_max_spend_usd: float = 0.0
    allow_paid: bool = False
    allow_protocol_fixture: bool = True
    max_live_requests: int = 0
    providers_permitted: tuple[str, ...] = ()


def load_policy_from_env() -> LiveCallPolicy:
    allow = os.environ.get("SPE_G4_ALLOW_PAID", "").strip().lower() in {"1", "true", "yes"}
    try:
        budget = float(os.environ.get("SPE_G4_BUDGET_USD", "0") or "0")
    except ValueError:
        budget = 0.0
    try:
        max_req = int(os.environ.get("SPE_G4_MAX_REQUESTS", "0") or "0")
    except ValueError:
        max_req = 0
    permitted = tuple(
        p.strip()
        for p in os.environ.get("SPE_G4_PROVIDERS", "").split(",")
        if p.strip()
    )
    return LiveCallPolicy(
        approved_max_spend_usd=budget,
        allow_paid=allow and budget > 0,
        allow_protocol_fixture=True,
        max_live_requests=max_req if allow else 0,
        providers_permitted=permitted,
    )


def assert_live_allowed(provider_id: str, *, policy: LiveCallPolicy | None = None) -> None:
    """Raise typed error if live paid/external call is not authorized."""
    pol = policy or load_policy_from_env()
    creds = credential_presence()
    if provider_id in {"openai", "openai_compat"} and not creds.openai:
        raise SpeTypedError(
            ErrorCode.G4_LIVE_BLOCKED_NO_CREDENTIAL,
            "openai credential absent",
        )
    if provider_id in {"anthropic", "anthropic_compat"} and not creds.anthropic:
        raise SpeTypedError(
            ErrorCode.G4_LIVE_BLOCKED_NO_CREDENTIAL,
            "anthropic credential absent",
        )
    if provider_id in {"openai", "openai_compat", "anthropic", "anthropic_compat"}:
        if not pol.allow_paid or pol.approved_max_spend_usd <= 0:
            raise SpeTypedError(
                ErrorCode.G4_LIVE_BLOCKED_BUDGET,
                "no approved paid G4 budget (ZERO_COST / SPE_G4_ALLOW_PAID)",
            )
        if pol.providers_permitted and provider_id not in pol.providers_permitted:
            raise SpeTypedError(
                ErrorCode.G4_LIVE_BLOCKED_BUDGET,
                f"provider {provider_id} not in permitted set",
            )


__all__ = ["LiveCallPolicy", "assert_live_allowed", "load_policy_from_env"]
