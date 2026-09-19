"""Anthropic Messages API adapter (stdlib HTTP)."""

from __future__ import annotations

import hashlib
import json
import os
import uuid
from typing import Any

from spe_runtime.error_registry import ErrorCode, SpeTypedError
from spe_runtime.providers.boundary import (
    assert_no_authority_mint,
    assert_no_self_qualification,
)
from spe_runtime.providers.credentials import resolve_api_key
from spe_runtime.providers.live_gate import LiveCallPolicy, assert_live_allowed
from spe_runtime.providers.models import (
    CapabilityManifest,
    NormalizedResult,
    ProviderReceipt,
    ProviderRequest,
)
from spe_runtime.providers.normalize import normalize_anthropic_message
from spe_runtime.providers.privacy import build_safe_request
from spe_runtime.providers.transport import (
    ADAPTER_VERSION,
    http_json,
    map_transport_error,
)

DEFAULT_ANTHROPIC_BASE = "https://api.anthropic.com/v1"
ANTHROPIC_VERSION = "2023-06-01"
MAX_RETRIES = 2


def default_anthropic_capabilities(model_id: str) -> CapabilityManifest:
    return CapabilityManifest(
        provider_id="anthropic_compat",
        model_id=model_id,
        model_version=None,
        endpoint_class="anthropic_messages",
        text_input=True,
        text_output=True,
        structured_output=False,  # not claimed until native JSON mode tested
        tool_calling=True,
        streaming=False,
        max_context=None,
        request_timeout_semantics="client_deadline_only",
        idempotency_support=False,
        usage_accounting=True,
        known_limitations=(
            "native structured output not claimed without live probe",
            "streaming not qualified until live-tested",
        ),
    )


class AnthropicCompatAdapter:
    provider_id = "anthropic_compat"

    def __init__(
        self,
        *,
        base_url: str | None = None,
        api_key: str | None = None,
        timeout_s: float = 30.0,
        live: bool = False,
        policy: LiveCallPolicy | None = None,
        source_revision: str | None = None,
    ) -> None:
        self.base_url = (
            base_url or os.environ.get("ANTHROPIC_BASE_URL") or DEFAULT_ANTHROPIC_BASE
        ).rstrip("/")
        self._api_key = api_key
        self.timeout_s = timeout_s
        self.live = live
        self.policy = policy
        self.source_revision = source_revision
        self._retry_budget = MAX_RETRIES

    def capabilities(self, model_id: str) -> CapabilityManifest:
        return default_anthropic_capabilities(model_id)

    def require_capability(self, model_id: str, name: str) -> None:
        cap = self.capabilities(model_id)
        mapping = {
            "text_input": cap.text_input,
            "text_output": cap.text_output,
            "structured_output": cap.structured_output,
            "tool_calling": cap.tool_calling,
            "streaming": cap.streaming,
        }
        if not mapping.get(name):
            raise SpeTypedError(ErrorCode.G4_CAPABILITY_UNAVAILABLE, name)

    def complete(self, req: ProviderRequest) -> ProviderReceipt:
        if req.params.stream:
            raise SpeTypedError(ErrorCode.G4_CAPABILITY_UNAVAILABLE, "streaming")
        if req.params.json_schema is not None:
            # Honest: not silently emulating structured mode
            raise SpeTypedError(
                ErrorCode.G4_CAPABILITY_UNAVAILABLE, "structured_output"
            )
        if self.live:
            assert_live_allowed(self.provider_id, policy=self.policy)
        safe = build_safe_request(req)
        body = self._build_body(safe)
        headers = {
            "Content-Type": "application/json",
            "anthropic-version": ANTHROPIC_VERSION,
            "User-Agent": f"spe-runtime/{ADAPTER_VERSION}",
        }
        key = self._api_key if self._api_key is not None else resolve_api_key("anthropic")
        if self.live and not key:
            raise SpeTypedError(ErrorCode.G4_LIVE_BLOCKED_NO_CREDENTIAL, "missing key")
        if key:
            headers["x-api-key"] = key

        url = f"{self.base_url}/messages"
        last_err: Exception | None = None
        for attempt in range(self._retry_budget + 1):
            try:
                tr = http_json(
                    url=url,
                    method="POST",
                    headers=headers,
                    body=body,
                    timeout_s=self.timeout_s,
                    forbidden_egress=safe.forbidden_egress_substrings,
                )
                if tr.error_class == ErrorCode.G4_RATE_LIMITED.value and attempt < self._retry_budget:
                    last_err = SpeTypedError(ErrorCode.G4_RATE_LIMITED, "rate limited")
                    continue
                map_transport_error(tr)
                payload = json.loads(tr.body.decode("utf-8"))
                if not isinstance(payload, dict) or not payload:
                    raise SpeTypedError(
                        ErrorCode.G4_INVALID_PROVIDER_RESPONSE, "invalid anthropic body"
                    )
                normalized = normalize_anthropic_message(payload)
                assert_no_self_qualification(normalized)
                assert_no_authority_mint(normalized.tool_calls)
                return self._receipt(safe, tr, payload, normalized)
            except SpeTypedError as exc:
                if exc.code in {ErrorCode.G4_TIMEOUT, ErrorCode.G4_TRANSPORT_FAILURE} and attempt < self._retry_budget:
                    last_err = exc
                    continue
                raise
        raise SpeTypedError(ErrorCode.G4_RETRY_EXHAUSTED, f"retries exhausted: {last_err}")

    def _build_body(self, req: ProviderRequest) -> dict[str, Any]:
        system_parts = [m.content for m in req.messages if m.role == "system"]
        msgs = [
            {"role": m.role, "content": m.content}
            for m in req.messages
            if m.role in {"user", "assistant"}
        ]
        body: dict[str, Any] = {
            "model": req.model_id,
            "messages": msgs,
            "max_tokens": req.params.max_tokens or 256,
        }
        if system_parts:
            body["system"] = "\n".join(system_parts)
        if req.params.temperature is not None:
            body["temperature"] = req.params.temperature
        if req.params.tools:
            body["tools"] = list(req.params.tools)
        return body

    def _receipt(
        self,
        req: ProviderRequest,
        tr: Any,
        payload: dict[str, Any],
        normalized: NormalizedResult,
    ) -> ProviderReceipt:
        usage = payload.get("usage") if isinstance(payload.get("usage"), dict) else {}
        return ProviderReceipt(
            request_id=req.request_id or str(uuid.uuid4()),
            provider_id=self.provider_id,
            model_requested=req.model_id,
            model_reported=str(payload.get("model") or "") or None,
            endpoint=f"{self.base_url}/messages",
            api_version=ANTHROPIC_VERSION,
            started_at_ms=tr.started_at_ms,
            completed_at_ms=tr.completed_at_ms,
            transport_ok=True,
            http_status=tr.http_status,
            error_class=None,
            normalized=normalized,
            request_digest=tr.captured.body_digest,
            response_digest=hashlib.sha256(tr.body).hexdigest(),
            usage=dict(usage),
            cost_estimate={},
            redaction_state="headers_and_canaries",
            adapter_version=ADAPTER_VERSION,
            source_revision=self.source_revision,
            live=self.live,
            protocol_fixture=not self.live,
        )


__all__ = ["AnthropicCompatAdapter", "default_anthropic_capabilities"]
