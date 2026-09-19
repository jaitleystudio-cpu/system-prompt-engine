"""Stdlib HTTP transport with request capture / redaction (no paid SDKs)."""

from __future__ import annotations

import hashlib
import json
import socket
import ssl
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Any

from spe_runtime.error_registry import ErrorCode, SpeTypedError


ADAPTER_VERSION = "g4.providers.1"


@dataclass
class CapturedRequest:
    url: str
    method: str
    header_names: tuple[str, ...]
    body_digest: str
    body_byte_count: int
    redacted_body_preview: dict[str, Any]


@dataclass
class TransportResult:
    http_status: int | None
    body: bytes
    error_class: str | None
    started_at_ms: int
    completed_at_ms: int
    captured: CapturedRequest


def _digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _redact_obj(obj: Any, forbidden: tuple[str, ...]) -> Any:
    if isinstance(obj, dict):
        out = {}
        for k, v in obj.items():
            kl = str(k).lower()
            if kl in {"authorization", "api-key", "x-api-key"} or "secret" in kl or "token" in kl:
                out[k] = "<redacted>"
            else:
                out[k] = _redact_obj(v, forbidden)
        return out
    if isinstance(obj, list):
        return [_redact_obj(x, forbidden) for x in obj]
    if isinstance(obj, str):
        s = obj
        for f in forbidden:
            if f and f in s:
                s = s.replace(f, "<canary-redacted>")
        return s
    return obj


def assert_no_forbidden_egress(body_obj: Any, forbidden: tuple[str, ...]) -> None:
    blob = json.dumps(body_obj, ensure_ascii=False)
    for f in forbidden:
        if f and f in blob:
            raise SpeTypedError(
                ErrorCode.G4_PRIVACY_EGRESS_VIOLATION,
                "forbidden substring present in outbound provider body",
            )


def http_json(
    *,
    url: str,
    method: str,
    headers: dict[str, str],
    body: dict[str, Any],
    timeout_s: float,
    forbidden_egress: tuple[str, ...] = (),
) -> TransportResult:
    assert_no_forbidden_egress(body, forbidden_egress)
    raw = json.dumps(body, ensure_ascii=False).encode("utf-8")
    started = int(time.time() * 1000)
    # Strip secrets from captured headers
    header_names = tuple(sorted(headers.keys()))
    redacted_headers = {
        k: ("<redacted>" if k.lower() in {"authorization", "x-api-key", "api-key"} else v)
        for k, v in headers.items()
    }
    captured = CapturedRequest(
        url=url,
        method=method,
        header_names=header_names,
        body_digest=_digest(raw),
        body_byte_count=len(raw),
        redacted_body_preview=_redact_obj(body, forbidden_egress),
    )
    req = urllib.request.Request(url, data=raw, method=method)
    for k, v in headers.items():
        req.add_header(k, v)
    try:
        with urllib.request.urlopen(req, timeout=timeout_s) as resp:
            data = resp.read()
            status = getattr(resp, "status", None) or resp.getcode()
            ended = int(time.time() * 1000)
            return TransportResult(
                http_status=int(status),
                body=data,
                error_class=None,
                started_at_ms=started,
                completed_at_ms=ended,
                captured=captured,
            )
    except urllib.error.HTTPError as exc:
        data = exc.read() if exc.fp else b""
        ended = int(time.time() * 1000)
        return TransportResult(
            http_status=int(exc.code),
            body=data,
            error_class=_http_error_class(exc.code),
            started_at_ms=started,
            completed_at_ms=ended,
            captured=captured,
        )
    except TimeoutError as exc:
        ended = int(time.time() * 1000)
        raise SpeTypedError(ErrorCode.G4_TIMEOUT, f"provider timeout: {exc}") from exc
    except socket.timeout as exc:
        ended = int(time.time() * 1000)
        raise SpeTypedError(ErrorCode.G4_TIMEOUT, f"provider timeout: {exc}") from exc
    except (urllib.error.URLError, ssl.SSLError, ConnectionError, OSError) as exc:
        ended = int(time.time() * 1000)
        raise SpeTypedError(
            ErrorCode.G4_TRANSPORT_FAILURE, f"transport failure: {type(exc).__name__}"
        ) from exc


def _http_error_class(code: int) -> str:
    if code in (401, 403):
        return ErrorCode.G4_AUTHENTICATION_FAILURE.value
    if code == 429:
        return ErrorCode.G4_RATE_LIMITED.value
    if code == 404:
        return ErrorCode.G4_MODEL_UNAVAILABLE.value
    if 400 <= code < 500:
        return ErrorCode.G4_PROVIDER_REJECTED_REQUEST.value
    return ErrorCode.G4_TRANSPORT_FAILURE.value


def map_transport_error(tr: TransportResult) -> None:
    """Raise typed SPE error when transport indicates failure."""
    if tr.error_class is None and tr.http_status is not None and 200 <= tr.http_status < 300:
        return
    code_name = tr.error_class or ErrorCode.G4_UNKNOWN_PROVIDER_OUTCOME.value
    try:
        code = ErrorCode(code_name)
    except ValueError:
        code = ErrorCode.G4_UNKNOWN_PROVIDER_OUTCOME
    raise SpeTypedError(code, f"provider HTTP {tr.http_status}")


__all__ = [
    "ADAPTER_VERSION",
    "CapturedRequest",
    "TransportResult",
    "assert_no_forbidden_egress",
    "http_json",
    "map_transport_error",
]
