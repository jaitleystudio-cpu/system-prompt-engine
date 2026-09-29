"""HTTP transport. Network is opt-in and host-allowlisted.

Tests pass a fake transport. The stdlib client is used only when the caller
sets allow_network=True on the pipeline.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Mapping
from urllib.error import HTTPError, URLError
from urllib.request import HTTPRedirectHandler, Request, build_opener

from spe_runtime.scholarly.egress import assert_allowed
from spe_runtime.scholarly.errors import EgressDenied, ScholarlyError
from spe_runtime.scholarly.registry import SourceRegistry

_MAX_BYTES = 2_000_000
_TIMEOUT_SECONDS = 20.0


class TransportError(ScholarlyError):
    """The transport could not complete a request."""

    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


@dataclass(frozen=True)
class HttpResponse:
    status: int
    body: bytes
    final_url: str
    content_type: str


class _AllowlistRedirect(HTTPRedirectHandler):
    def __init__(self, registry: SourceRegistry) -> None:
        super().__init__()
        self._registry = registry

    def redirect_request(self, req, fp, code, msg, headers, newurl):  # type: ignore[no-untyped-def]
        assert_allowed(str(newurl), self._registry)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


class AllowlistTransport:
    """GET client that refuses hosts outside the scholarly registry."""

    def __init__(
        self,
        registry: SourceRegistry,
        *,
        opener: object | None = None,
        max_bytes: int = _MAX_BYTES,
        timeout: float = _TIMEOUT_SECONDS,
    ) -> None:
        self._registry = registry
        self._opener = opener
        self._max_bytes = max_bytes
        self._timeout = timeout

    def get(self, url: str, headers: Mapping[str, str]) -> HttpResponse:
        assert_allowed(url, self._registry)
        request = Request(url, headers=dict(headers), method="GET")
        opener = self._opener
        if opener is None:
            opener = build_opener(_AllowlistRedirect(self._registry))
        try:
            response = opener.open(request, timeout=self._timeout)  # type: ignore[attr-defined]
        except HTTPError as exc:
            raw = exc.read(self._max_bytes + 1)
            if len(raw) > self._max_bytes:
                raise TransportError("BODY_TOO_LARGE") from exc
            content_type = exc.headers.get("Content-Type", "") if exc.headers else ""
            return HttpResponse(
                status=int(exc.code),
                body=raw,
                final_url=url,
                content_type=content_type,
            )
        except URLError as exc:
            raise TransportError("TRANSPORT_URL_ERROR") from exc
        except EgressDenied:
            raise
        except ScholarlyError:
            raise
        except Exception as exc:
            raise TransportError("TRANSPORT_FAILED") from exc
        try:
            final_url = response.geturl()
            assert_allowed(str(final_url), self._registry)
            body = response.read(self._max_bytes + 1)
            content_type = response.headers.get("Content-Type", "")
            status = int(getattr(response, "status", 200))
        finally:
            response.close()
        if len(body) > self._max_bytes:
            raise TransportError("BODY_TOO_LARGE")
        return HttpResponse(
            status=status,
            body=body,
            final_url=str(final_url),
            content_type=str(content_type),
        )
