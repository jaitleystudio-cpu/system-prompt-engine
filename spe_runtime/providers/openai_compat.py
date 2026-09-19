"""OpenAI-compatible chat completions adapter (stdlib HTTP)."""

from __future__ import annotations

import hashlib
import json
import os
import time
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
from spe_runtime.providers.normalize import normalize_openai_chat
from spe_runtime.providers.privacy import build_safe_request
from spe_runtime.providers.transport import (
    ADAPTER_VERSION,
    http_json,
    map_transport_error,
)

DEFAULT_OPENAI_BASE = "https://api.openai.com/v1"
MAX_RETRIES = 2


def default_openai_capabilities(model_id: str) -> CapabilityManifest:
    return CapabilityManifest(
        provider_id="openai_compat",
        model_id=model_id,
        model_version=None,
        endpoint_class="openai_chat_completions",
        text_input=True,
        text_output=True,
        structured_output=True,  # via json mode / schema when requested — probed at call
        tool_calling=True,
        streaming=False,  # streaming not claimed until tested
        max_context=None,
        request_timeout_semantics="client_deadline_only",
        idempotency_support=False,
        usage_accounting=True,
        known_limitations=(
            "streaming not qualified in G4 until live-tested",
            "mutable model aliases are date/version scoped",
        ),
    )


class OpenAICompatAdapter:
    """Canonical OpenAI-compatible owner for G4."""

    provider_id = "openai_compat"

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
        self.base_url = (base_url or os.environ.get("OPENAI_BASE_URL") or DEFAULT_OPENAI_BASE).rstrip("/")
        self._api_key = api_key  # may be None for protocol fixtures
        self.timeout_s = timeout_s
        self.live = live
        self.policy = policy
        self.source_revision = source_revision
        self._retry_budget = MAX_RETRIES

    def capabilities(self, model_id: str) -> CapabilityManifest:
        return default_openai_capabilities(model_id)

    def require_capability(self, model_id: str, name: str) -> None:
        cap = self.capabilities(model_id)
        mapping = {
            "text_input": cap.text_input,
            "text_output": cap.text_output,
            "structured_output": cap.structured_output,
            "tool_calling": cap.tool_calling,
            "streaming": cap.streaming,
        }
        if name not in mapping:
            raise SpeTypedError(ErrorCode.G4_CAPABILITY_UNAVAILABLE, f"unknown capability {name}")
        if not mapping[name]:
            raise SpeTypedError(ErrorCode.G4_CAPABILITY_UNAVAILABLE, name)

    def complete(self, req: ProviderRequest) -> ProviderReceipt:
        if req.params.stream:
            raise SpeTypedError(ErrorCode.G4_CAPABILITY_UNAVAILABLE, "streaming")
        if self.live:
            assert_live_allowed(self.provider_id, policy=self.policy)
        safe = build_safe_request(req)
        body = self._build_body(safe)
        headers = {
            "Content-Type": "application/json",
            "User-Agent": f"spe-runtime/{ADAPTER_VERSION}",
        }
        key = self._api_key if self._api_key is not None else resolve_api_key("openai")
        if self.live:
            if not key:
                raise SpeTypedError(ErrorCode.G4_LIVE_BLOCKED_NO_CREDENTIAL, "missing key")
            headers["Authorization"] = f"Bearer {key}"
        elif key:
            headers["Authorization"] = f"Bearer {key}"

        url = f"{self.base_url}/chat/completions"
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
                if not isinstance(payload, dict):
                    raise SpeTypedError(
                        ErrorCode.G4_INVALID_PROVIDER_RESPONSE, "non-object JSON"
                    )
                if not payload:
                    raise SpeTypedError(
                        ErrorCode.G4_INVALID_PROVIDER_RESPONSE, "empty response"
                    )
                normalized = normalize_openai_chat(payload)
                assert_no_self_qualification(normalized)
                assert_no_authority_mint(normalized.tool_calls)
                return self._receipt(safe, tr, payload, normalized)
            except SpeTypedError as exc:
                if exc.code in {ErrorCode.G4_TIMEOUT, ErrorCode.G4_TRANSPORT_FAILURE} and attempt < self._retry_budget:
                    last_err = exc
                    continue
                raise
        raise SpeTypedError(
            ErrorCode.G4_RETRY_EXHAUSTED,
            f"retries exhausted: {last_err}",
        )

    def _build_body(self, req: ProviderRequest) -> dict[str, Any]:
        messages = [{"role": m.role, "content": m.content} for m in req.messages]
        body: dict[str, Any] = {
            "model": req.model_id,
            "messages": messages,
        }
        if req.params.temperature is not None:
            body["temperature"] = req.params.temperature
        if req.params.max_tokens is not None:
            body["max_tokens"] = req.params.max_tokens
        if req.params.top_p is not None:
            body["top_p"] = req.params.top_p
        if req.params.stop:
            body["stop"] = list(req.params.stop)
        if req.params.json_schema is not None:
            body["response_format"] = {
                "type": "json_schema",
                "json_schema": {
                    "name": "spe_structured",
                    "schema": req.params.json_schema,
                    "strict": True,
                },
            }
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
        req_id = req.request_id or str(uuid.uuid4())
        usage = payload.get("usage") if isinstance(payload.get("usage"), dict) else {}
        model_reported = payload.get("model")
        return ProviderReceipt(
            request_id=req_id,
            provider_id=self.provider_id,
            model_requested=req.model_id,
            model_reported=str(model_reported) if model_reported else None,
            endpoint=f"{self.base_url}/chat/completions",
            api_version="v1",
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


__all__ = ["OpenAICompatAdapter", "default_openai_capabilities"]
