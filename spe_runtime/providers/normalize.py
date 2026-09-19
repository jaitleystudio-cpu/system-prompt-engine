"""Normalize provider-specific payloads into SPE NormalizedResult.

Normalizer may strip wrappers. It MUST NOT fabricate required semantic fields.
"""

from __future__ import annotations

import json
from typing import Any

from spe_runtime.error_registry import ErrorCode, SpeTypedError
from spe_runtime.providers.models import NormalizedResult, ToolCallRequest


def normalize_openai_chat(payload: dict[str, Any]) -> NormalizedResult:
    choices = payload.get("choices")
    if not isinstance(choices, list) or not choices:
        raise SpeTypedError(
            ErrorCode.G4_INVALID_PROVIDER_RESPONSE, "openai: missing choices"
        )
    msg = choices[0].get("message") if isinstance(choices[0], dict) else None
    if not isinstance(msg, dict):
        raise SpeTypedError(
            ErrorCode.G4_INVALID_PROVIDER_RESPONSE, "openai: missing message"
        )
    content = msg.get("content")
    tool_calls_raw = msg.get("tool_calls") or []
    tools: list[ToolCallRequest] = []
    if isinstance(tool_calls_raw, list):
        for tc in tool_calls_raw:
            if not isinstance(tc, dict):
                continue
            fn = tc.get("function") if isinstance(tc.get("function"), dict) else {}
            tools.append(
                ToolCallRequest(
                    name=str(fn.get("name") or ""),
                    arguments_json=str(fn.get("arguments") or "{}"),
                    tool_call_id=str(tc.get("id") or ""),
                )
            )
    structured = None
    text = content if isinstance(content, str) else None
    if text:
        text_stripped = text.strip()
        if text_stripped.startswith("{") and text_stripped.endswith("}"):
            try:
                structured = json.loads(text_stripped)
            except json.JSONDecodeError:
                structured = None
    finish = None
    if isinstance(choices[0], dict):
        finish = choices[0].get("finish_reason")
    if text is None and not tools and structured is None:
        raise SpeTypedError(
            ErrorCode.G4_INVALID_PROVIDER_RESPONSE, "openai: empty message"
        )
    return NormalizedResult(
        text=text,
        structured=structured if isinstance(structured, dict) else None,
        tool_calls=tuple(tools),
        finish_reason=str(finish) if finish is not None else None,
        partial=False,
        raw_shape="tool_calls" if tools else ("structured" if structured else "text"),
    )


def normalize_anthropic_message(payload: dict[str, Any]) -> NormalizedResult:
    content = payload.get("content")
    if not isinstance(content, list):
        raise SpeTypedError(
            ErrorCode.G4_INVALID_PROVIDER_RESPONSE, "anthropic: missing content"
        )
    texts: list[str] = []
    tools: list[ToolCallRequest] = []
    for block in content:
        if not isinstance(block, dict):
            continue
        btype = block.get("type")
        if btype == "text":
            texts.append(str(block.get("text") or ""))
        elif btype == "tool_use":
            tools.append(
                ToolCallRequest(
                    name=str(block.get("name") or ""),
                    arguments_json=json.dumps(block.get("input") or {}),
                    tool_call_id=str(block.get("id") or ""),
                )
            )
    text = "\n".join(t for t in texts if t) or None
    structured = None
    if text:
        s = text.strip()
        if s.startswith("{") and s.endswith("}"):
            try:
                structured = json.loads(s)
            except json.JSONDecodeError:
                structured = None
    if text is None and not tools:
        raise SpeTypedError(
            ErrorCode.G4_INVALID_PROVIDER_RESPONSE, "anthropic: empty content"
        )
    return NormalizedResult(
        text=text,
        structured=structured if isinstance(structured, dict) else None,
        tool_calls=tuple(tools),
        finish_reason=str(payload.get("stop_reason") or "") or None,
        partial=False,
        raw_shape="content_blocks",
    )


def parse_structured_or_reject(
    result: NormalizedResult, required_keys: tuple[str, ...]
) -> dict[str, Any]:
    """Validate structured output. Never fabricate missing required keys."""
    if result.structured is None:
        raise SpeTypedError(
            ErrorCode.G4_INVALID_PROVIDER_RESPONSE, "structured output missing"
        )
    missing = [k for k in required_keys if k not in result.structured]
    if missing:
        raise SpeTypedError(
            ErrorCode.G4_NORMALIZER_FABRICATION,
            f"refusing to fabricate missing fields: {missing}",
        )
    return dict(result.structured)


__all__ = [
    "normalize_anthropic_message",
    "normalize_openai_chat",
    "parse_structured_or_reject",
]
