"""Privacy / egress helpers for provider requests."""

from __future__ import annotations

from typing import Any

from spe_runtime.error_registry import ErrorCode, SpeTypedError
from spe_runtime.providers.models import ProviderMessage, ProviderRequest
from spe_runtime.providers.transport import assert_no_forbidden_egress


SYNTHETIC_CANARY_DEFAULT = "SPE_TEST_SECRET_7F3A9C1E_CANARY"


def project_messages_for_egress(
    messages: tuple[ProviderMessage, ...],
    *,
    forbidden_substrings: tuple[str, ...],
) -> tuple[ProviderMessage, ...]:
    """Drop or redact messages that would leak forbidden canaries."""
    out: list[ProviderMessage] = []
    for m in messages:
        content = m.content
        leak = False
        for f in forbidden_substrings:
            if f and f in content:
                leak = True
                break
        if leak:
            # Fail closed rather than silently send redacted mush as if complete
            raise SpeTypedError(
                ErrorCode.G4_PRIVACY_EGRESS_VIOLATION,
                "message content contains forbidden egress substring",
            )
        out.append(m)
    return tuple(out)


def build_safe_request(req: ProviderRequest) -> ProviderRequest:
    msgs = project_messages_for_egress(
        req.messages, forbidden_substrings=req.forbidden_egress_substrings
    )
    return ProviderRequest(
        provider_id=req.provider_id,
        model_id=req.model_id,
        messages=msgs,
        params=req.params,
        request_id=req.request_id,
        forbidden_egress_substrings=req.forbidden_egress_substrings,
        allow_live=req.allow_live,
    )


def audit_outbound_body(body: dict[str, Any], forbidden: tuple[str, ...]) -> None:
    assert_no_forbidden_egress(body, forbidden)


__all__ = [
    "SYNTHETIC_CANARY_DEFAULT",
    "audit_outbound_body",
    "build_safe_request",
    "project_messages_for_egress",
]
