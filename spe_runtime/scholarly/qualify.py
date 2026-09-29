"""Live source qualification. Callers must pass allow_network=True.

A failed public endpoint is recorded. This module does not edit the registry
and does not treat a temporary failure as a contract change by itself.
"""

from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Callable
from urllib.parse import urlsplit

from spe_runtime.scholarly.models import EvidencePackage
from spe_runtime.scholarly.pipeline import Transport, compile_evidence_package
from spe_runtime.scholarly.registry import load_registry
from spe_runtime.scholarly.transport import AllowlistTransport, HttpResponse

_IDENTITY_FIELDS = ("doi", "pmid", "pmcid", "arxiv_id")


@dataclass(frozen=True)
class SourceQualification:
    source_id: str
    source_status: str
    failure_class: str
    http_status: int | None
    host: str
    method: str
    query_fields: tuple[str, ...]
    content_type: str
    record_count: int
    latency_ms: int
    parse_result: str
    identity_fields: tuple[str, ...]
    rate_limit_notes: tuple[tuple[str, str], ...]
    error: str

    def to_dict(self) -> dict[str, object]:
        return {
            "source_id": self.source_id,
            "source_status": self.source_status,
            "failure_class": self.failure_class,
            "http_status": self.http_status,
            "host": self.host,
            "method": self.method,
            "query_fields": list(self.query_fields),
            "content_type": self.content_type,
            "record_count": self.record_count,
            "latency_ms": self.latency_ms,
            "parse_result": self.parse_result,
            "identity_fields": list(self.identity_fields),
            "rate_limit_notes": [list(note) for note in self.rate_limit_notes],
            "error": self.error,
        }


class RecordingTransport:
    """Times an inner transport. Used only by explicit live qualification."""

    def __init__(self, inner: Transport) -> None:
        self.inner = inner
        self.calls: list[dict[str, object]] = []

    def get(self, url: str, headers: dict[str, str]) -> HttpResponse:
        started = time.perf_counter()
        try:
            response = self.inner.get(url, headers)
        except Exception as exc:
            self.calls.append(
                {
                    "url": url,
                    "host": urlsplit(url).hostname or "",
                    "latency_ms": int((time.perf_counter() - started) * 1000),
                    "error": type(exc).__name__,
                    "code": getattr(exc, "code", ""),
                }
            )
            raise
        self.calls.append(
            {
                "url": url,
                "host": urlsplit(url).hostname or "",
                "status": response.status,
                "content_type": response.content_type,
                "latency_ms": int((time.perf_counter() - started) * 1000),
                "header_notes": response.header_notes,
                "final_url": response.final_url,
            }
        )
        return response


def classify_failure(
    *,
    http_status: int | None,
    parsed: bool,
    transport_code: str,
) -> tuple[str, str]:
    """Return source_status and failure_class. QUALIFIED is the only success."""
    if transport_code == "TRANSPORT_URL_ERROR":
        return "TEMPORARILY_UNAVAILABLE", "NETWORK_ENVIRONMENT_BLOCKED"
    if transport_code:
        return "TEMPORARILY_UNAVAILABLE", "TEMPORARY_FAILURE"
    if http_status == 429:
        return "TEMPORARILY_UNAVAILABLE", "RATE_LIMIT"
    if http_status in {401, 403, 404, 410}:
        return "TEMPORARILY_UNAVAILABLE", "CONTRACT_CHANGED"
    if http_status is None or http_status >= 500 or http_status != 200:
        return "TEMPORARILY_UNAVAILABLE", "TEMPORARY_FAILURE"
    if not parsed:
        return "TEMPORARILY_UNAVAILABLE", "PARSER_DEFECT"
    return "QUALIFIED", "NONE"


def qualify_source(
    source_id: str,
    query: str,
    *,
    as_of: str,
    allow_network: bool,
    transport: Transport | None = None,
    pause: Callable[[], None] | None = None,
) -> tuple[SourceQualification, EvidencePackage]:
    """Run one enabled search source.

    allow_network=True builds the registry allowlist client. The compiler then
    receives that client as its transport so redirects stay on the allowlist.
    allow_network=False never constructs that client.
    """
    if pause is not None:
        pause()
    if allow_network and transport is not None:
        raise ValueError("TRANSPORT_CONFLICT")
    if not allow_network and transport is None:
        raise ValueError("NETWORK_NOT_AUTHORIZED")
    client: Transport
    if allow_network:
        client = AllowlistTransport(load_registry())
    else:
        assert transport is not None
        client = transport
    recorder = RecordingTransport(client)
    package = compile_evidence_package(
        query,
        as_of=as_of,
        allow_network=False,
        transport=recorder,
        sources=(source_id,),
        max_per_source=2,
        enrich_identity=False,
    )
    return _summarize(source_id, package, recorder), package


def _summarize(
    source_id: str,
    package: EvidencePackage,
    recorder: RecordingTransport,
) -> SourceQualification:
    shapes = dict(package.outbound_shapes)
    calls = recorder.calls
    statuses = [int(call["status"]) for call in calls if "status" in call]
    http_status = next((code for code in statuses if code != 200), statuses[-1] if statuses else None)
    host = str(calls[0]["host"]) if calls else ""
    content_type = str(next((call.get("content_type", "") for call in calls if "status" in call), ""))
    latency = int(calls[-1]["latency_ms"]) if calls else 0
    notes: tuple[tuple[str, str], ...] = ()
    for call in calls:
        raw_notes = call.get("header_notes")
        if raw_notes:
            notes = tuple(raw_notes)  # type: ignore[arg-type]
    transport_code = ""
    for call in calls:
        if call.get("error"):
            transport_code = str(call.get("code") or call["error"])
    shape_gaps = [
        item
        for item in package.gap_unknown_map.items
        if item.subject == source_id and item.code in {"SOURCE_SHAPE_UNKNOWN", "SOURCE_UNAVAILABLE"}
    ]
    parsed = bool(statuses) and all(code == 200 for code in statuses) and not shape_gaps and not transport_code
    if any(reason.startswith("EGRESS_") for reason in package.refusal_reasons):
        status, failure = "TEMPORARILY_UNAVAILABLE", "NETWORK_ENVIRONMENT_BLOCKED"
    else:
        status, failure = classify_failure(
            http_status=http_status,
            parsed=parsed,
            transport_code=transport_code,
        )
    if status != "QUALIFIED" and package.refusal_reasons and not calls:
        failure = package.refusal_reasons[0]
    identities = {
        field
        for record in package.records
        for field in _IDENTITY_FIELDS
        if getattr(record.identity, field)
    }
    error = ""
    if failure != "NONE":
        details = [item.detail for item in package.gap_unknown_map.items if item.subject == source_id]
        error = details[0] if details else failure
    return SourceQualification(
        source_id=source_id,
        source_status=status,
        failure_class=failure,
        http_status=http_status,
        host=host,
        method="GET",
        query_fields=shapes.get(source_id, ()),
        content_type=content_type.split(";")[0],
        record_count=len(package.records),
        latency_ms=latency,
        parse_result="PARSED" if status == "QUALIFIED" else "NOT_PARSED",
        identity_fields=tuple(sorted(identities)),
        rate_limit_notes=notes,
        error=error,
    )
