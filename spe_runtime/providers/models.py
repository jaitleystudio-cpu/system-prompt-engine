"""Provider domain models — execution evidence, not truth proofs."""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any


class ProviderStatus(str, Enum):
    NOT_IMPLEMENTED = "NOT_IMPLEMENTED"
    OUT_OF_SCOPE = "OUT_OF_SCOPE"
    SUPPORTED_BUT_NO_CREDENTIAL = "SUPPORTED_BUT_NO_CREDENTIAL"
    SUPPORTED_AND_TESTABLE = "SUPPORTED_AND_TESTABLE"
    PROTOCOL_ONLY = "PROTOCOL_ONLY"
    LIVE_PARTIAL = "LIVE_PARTIAL"
    LIVE_CONFORMANT_WITHIN_TESTED_SCOPE = "LIVE_CONFORMANT_WITHIN_TESTED_SCOPE"
    LIVE_NONCONFORMANT = "LIVE_NONCONFORMANT"
    BLOCKED_NO_CREDENTIAL = "BLOCKED_NO_CREDENTIAL"
    NOT_TESTED = "NOT_TESTED"


@dataclass(frozen=True)
class ProviderMessage:
    role: str  # system | user | assistant | tool | developer
    content: str


@dataclass(frozen=True)
class GenerationParams:
    temperature: float | None = 0.0
    max_tokens: int | None = 256
    top_p: float | None = None
    stop: tuple[str, ...] = ()
    stream: bool = False
    json_schema: dict[str, Any] | None = None
    tools: tuple[dict[str, Any], ...] = ()
    extra: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class ProviderRequest:
    provider_id: str
    model_id: str
    messages: tuple[ProviderMessage, ...]
    params: GenerationParams = field(default_factory=GenerationParams)
    request_id: str = ""
    # Fields that MUST NOT leave SPE (privacy canaries / secrets)
    forbidden_egress_substrings: tuple[str, ...] = ()
    allow_live: bool = False


@dataclass(frozen=True)
class ToolCallRequest:
    """Model-proposed tool call — NOT an AuthorityGrant."""

    name: str
    arguments_json: str
    tool_call_id: str = ""


@dataclass(frozen=True)
class NormalizedResult:
    text: str | None
    structured: dict[str, Any] | None
    tool_calls: tuple[ToolCallRequest, ...]
    finish_reason: str | None
    partial: bool = False
    raw_shape: str = "text"  # text | content_blocks | tool_calls | structured | stream


@dataclass(frozen=True)
class CapabilityManifest:
    provider_id: str
    model_id: str
    model_version: str | None
    endpoint_class: str
    text_input: bool
    text_output: bool
    structured_output: bool
    tool_calling: bool
    streaming: bool
    max_context: int | None
    request_timeout_semantics: str
    idempotency_support: bool
    usage_accounting: bool
    known_limitations: tuple[str, ...] = ()


@dataclass(frozen=True)
class ProviderReceipt:
    """Evidence of execution — NOT empirical truth / K7 qualification."""

    request_id: str
    provider_id: str
    model_requested: str
    model_reported: str | None
    endpoint: str
    api_version: str | None
    started_at_ms: int
    completed_at_ms: int
    transport_ok: bool
    http_status: int | None
    error_class: str | None
    normalized: NormalizedResult | None
    request_digest: str
    response_digest: str | None
    usage: dict[str, Any]
    cost_estimate: dict[str, Any]
    redaction_state: str
    adapter_version: str
    source_revision: str | None = None
    live: bool = False
    protocol_fixture: bool = False


__all__ = [
    "CapabilityManifest",
    "GenerationParams",
    "NormalizedResult",
    "ProviderMessage",
    "ProviderReceipt",
    "ProviderRequest",
    "ProviderStatus",
    "ToolCallRequest",
]
