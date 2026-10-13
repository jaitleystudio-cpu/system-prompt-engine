"""Failure Genome R6 — bounded opt-in HTTPS feed observation.

An adapter attached to the existing R2 SourceEventJournal owner, NOT a second
semantic engine or public publisher. No network is performed unless both a
source's explicit enablement and the caller's allow_network grant are present.
The built-in HTTPS transport pins a publicly routable DNS answer to its TLS
connection, verifies the hostname certificate, forbids redirects, and limits
response bytes. Never sends private prompts, tokens, cookies or credentials.

All source content is UNTRUSTED. Digest observations are not independently
confirmed incidents, causal explanations, or validated repairs.
"""
from __future__ import annotations

import hashlib
import http.client
import ipaddress
import json
import re
import socket
import ssl
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Callable, Mapping
from urllib.parse import urlsplit

from .event_journal import (
    EventKind, JournalDecision, JournalEntry, SourceAuthority,
    SourceEventJournal, SourceSnapshot, _utc,
)

_ID = re.compile(r"^[A-Za-z0-9._-]{1,128}$")
_STATUS = frozenset({
    "investigating", "identified", "monitoring", "resolved", "postmortem",
    "scheduled", "in_progress", "verifying", "completed",
})
MAX_SOURCE_BYTES = 262144


@dataclass(frozen=True)
class TrustedStatusFeed:
    source_id: str
    hostname: str
    path: str = "/api/v2/incidents.json"
    model_scope: str = "PROVIDER_SERVICE_NOT_PINNED_MODEL"
    enabled: bool = False
    max_events_per_poll: int = 100

    @property
    def url(self) -> str:
        return "https://" + self.hostname + self.path


@dataclass(frozen=True)
class FeedResponse:
    status: int
    final_url: str
    content_type: str
    body: bytes


@dataclass(frozen=True)
class PollSummary:
    source_id: str
    status: str
    added: int = 0
    duplicates: int = 0
    held: int = 0
    reason_codes: tuple[str, ...] = ()
    observations: tuple[JournalEntry, ...] = ()
    external_incident_confirmed: bool = False
    publication_authorized: bool = False


FetchTransport = Callable[[str, int, float], FeedResponse]


def _global_ip(value: str) -> bool:
    try:
        return ipaddress.ip_address(value).is_global
    except ValueError:
        return False


def _safe_feed_config(config: TrustedStatusFeed) -> bool:
    if not isinstance(config, TrustedStatusFeed):
        return False
    host = config.hostname
    path = config.path
    if (
        not isinstance(host, str) or not isinstance(path, str)
        or not isinstance(config.source_id, str) or not _ID.fullmatch(config.source_id)
        or not isinstance(config.model_scope, str) or not 1 <= len(config.model_scope) <= 100
        or not isinstance(config.enabled, bool)
        or type(config.max_events_per_poll) is not int
        or not 1 <= config.max_events_per_poll <= 100
        or host != host.lower() or host.endswith(".") or "." not in host
        or len(host) > 253 or host in ("localhost",) or host.endswith((".localhost", ".local", ".internal"))
        or not all(re.fullmatch(r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?", label) for label in host.split("."))
        or _global_ip(host)
        or path != "/api/v2/incidents.json"
    ):
        return False
    return True


class _PinnedHTTPSConnection(http.client.HTTPSConnection):
    """TLS hostname verified against the configured DNS name, socket to PINNED IP."""

    def __init__(self, hostname: str, pinned_ip: str, timeout: float):
        super().__init__(hostname, port=443, timeout=timeout, context=ssl.create_default_context())
        self._pinned_ip = pinned_ip

    def connect(self) -> None:
        raw = socket.create_connection((self._pinned_ip, 443), timeout=self.timeout)
        try:
            self.sock = self._context.wrap_socket(raw, server_hostname=self.host)
        except BaseException:
            raw.close()
            raise


def _bounded_https_transport(url: str, byte_limit: int, timeout: float) -> FeedResponse:
    """Explicitly opted-in public HTTPS only. No redirects, proxies or credentials."""
    target = urlsplit(url)
    if (
        target.scheme != "https" or not target.hostname or
        target.port not in (None, 443) or target.username or target.password or
        target.query or target.fragment or target.path != "/api/v2/incidents.json"
    ):
        raise ValueError("UNSAFE_PUBLIC_FEED_ENDPOINT")
    if not 1 <= byte_limit <= MAX_SOURCE_BYTES or not 0 < timeout <= 10:
        raise ValueError("NETWORK_BUDGET_INVALID")
    answers = socket.getaddrinfo(target.hostname, 443, type=socket.SOCK_STREAM)
    ips = sorted({row[4][0] for row in answers})
    if not ips or not all(_global_ip(ip) for ip in ips):
        raise ValueError("NON_PUBLIC_DNS_RESPONSE")
    conn = _PinnedHTTPSConnection(target.hostname, ips[0], timeout)
    try:
        conn.request("GET", target.path, headers={
            "Host": target.hostname, "Accept": "application/json",
            "Accept-Encoding": "identity", "User-Agent": "SPE-Public-Event-Observer/0.1",
        })
        reply = conn.getresponse()
        size_header = reply.getheader("Content-Length")
        if size_header is not None and (not size_header.isdigit() or int(size_header) > byte_limit):
            raise ValueError("PUBLIC_FEED_TOO_LARGE")
        # A 3xx is not followed; original trusted domain is the only destination.
        if not 200 <= reply.status < 300:
            return FeedResponse(reply.status, url, reply.getheader("Content-Type") or "", b"")
        raw = reply.read(byte_limit + 1)
        if len(raw) > byte_limit:
            raise ValueError("PUBLIC_FEED_TOO_LARGE")
        return FeedResponse(reply.status, url, reply.getheader("Content-Type") or "", raw)
    finally:
        conn.close()


class PublicStatusFeedObserver:
    """In-memory, bounded, per-run observation owner. External scheduling is separate."""

    def __init__(
        self,
        feeds: tuple[TrustedStatusFeed, ...],
        *,
        max_requests: int = 5,
        max_bytes: int = MAX_SOURCE_BYTES,
        timeout_seconds: float = 5.0,
        transport: FetchTransport | None = None,
    ) -> None:
        if not feeds or any(not _safe_feed_config(f) for f in feeds):
            raise ValueError("INVALID_TRUSTED_FEED_ALLOWLIST")
        if len({f.source_id for f in feeds}) != len(feeds):
            raise ValueError("DUPLICATE_SOURCE_IDS")
        if type(max_requests) is not int or not 1 <= max_requests <= 100:
            raise ValueError("INVALID_REQUEST_BUDGET")
        if type(max_bytes) is not int or not 1024 <= max_bytes <= MAX_SOURCE_BYTES:
            raise ValueError("INVALID_BYTE_BUDGET")
        if not isinstance(timeout_seconds, (float, int)) or not 0 < timeout_seconds <= 10:
            raise ValueError("INVALID_TIMEOUT_BUDGET")
        self._feeds = {f.source_id: f for f in feeds}
        self._journal = SourceEventJournal({
            f.source_id: SourceAuthority(f.source_id, f.hostname, f.path)
            for f in feeds
        })
        self._max_requests = max_requests
        self._max_bytes = max_bytes
        self._timeout = float(timeout_seconds)
        self._transport = transport or _bounded_https_transport
        self._requests = 0

    @property
    def journal(self) -> SourceEventJournal:
        return self._journal

    @property
    def requests_used(self) -> int:
        return self._requests

    def poll(
        self, source_id: str, *,
        allow_network: bool = False,
        observed_at: str | None = None,
    ) -> PollSummary:
        feed = self._feeds.get(source_id)
        if feed is None:
            return PollSummary(str(source_id), "HOLD", reason_codes=("SOURCE_UNRECOGNIZED",))
        if not feed.enabled or allow_network is not True:
            return PollSummary(source_id, "HOLD", reason_codes=("NETWORK_NOT_AUTHORIZED",))
        if self._requests >= self._max_requests:
            return PollSummary(source_id, "HOLD", reason_codes=("REQUEST_BUDGET_EXCEEDED",))
        now = observed_at or datetime.now(timezone.utc).isoformat()
        if _utc(now) is None:
            return PollSummary(source_id, "HOLD", reason_codes=("OBSERVATION_TIME_UNBOUND",))
        self._requests += 1
        try:
            response = self._transport(feed.url, self._max_bytes, self._timeout)
        except Exception:
            # Never log remote bytes, DNS, exception text or private credentials.
            return PollSummary(source_id, "HOLD", reason_codes=("PUBLIC_SOURCE_FETCH_FAILED",))
        if not isinstance(response, FeedResponse) or (
            response.final_url != feed.url or response.status != 200
        ):
            return PollSummary(source_id, "HOLD", reason_codes=("REDIRECT_OR_HTTP_FAILURE",))
        if "application/json" not in response.content_type.lower():
            return PollSummary(source_id, "HOLD", reason_codes=("UNEXPECTED_SOURCE_CONTENT_TYPE",))
        if not isinstance(response.body, bytes) or len(response.body) > self._max_bytes:
            return PollSummary(source_id, "HOLD", reason_codes=("SOURCE_BODY_BUDGET_EXCEEDED",))
        try:
            payload = json.loads(response.body.decode("utf-8"))
        except (UnicodeDecodeError, ValueError):
            return PollSummary(source_id, "HOLD", reason_codes=("MALFORMED_PUBLIC_JSON",))
        if not isinstance(payload, dict) or not isinstance(payload.get("incidents"), list):
            return PollSummary(source_id, "HOLD", reason_codes=("UNSUPPORTED_STATUS_FEED_SCHEMA",))
        incidents = payload["incidents"]
        if len(incidents) > feed.max_events_per_poll:
            return PollSummary(source_id, "HOLD", reason_codes=("EVENT_PAGE_BUDGET_EXCEEDED",))
        if any(not isinstance(x, dict) for x in incidents):
            return PollSummary(source_id, "HOLD", reason_codes=("MALFORMED_INCIDENT_ENTRY",))

        added = duplicates = held = 0
        accepted: list[JournalEntry] = []
        # Stable presentation order independent from JSON array order.
        for item in sorted(incidents, key=lambda o: str(o.get("id", ""))):
            incident_id = item.get("id")
            title = item.get("name")
            status = item.get("status")
            pub_at = item.get("updated_at") or item.get("created_at")
            if (
                not isinstance(incident_id, str) or not _ID.fullmatch(incident_id)
                or not isinstance(title, str) or not title.strip() or len(title) > 240
                or not isinstance(status, str) or status not in _STATUS
                or _utc(pub_at) is None
            ):
                held += 1
                continue
            # Observe the public feed snapshot rather than invent an incident
            # deep-link the provider did not actually provide.
            body_digest = hashlib.sha256(json.dumps(
                item, sort_keys=True, separators=(",", ":"), ensure_ascii=False,
            ).encode("utf-8")).hexdigest()
            prior = self._journal._subjects.get((feed.source_id, incident_id))
            snapshot = SourceSnapshot(
                source_id=feed.source_id,
                event_id=incident_id,
                url=feed.url,
                content_sha256=body_digest,
                source_published_at=pub_at,
                observed_at=now,
                event_kind=EventKind.UPDATE if prior else EventKind.NOTICE,
                subject_model=feed.model_scope,
                title=title,
                predecessor_digest=prior[0] if prior else None,
            )
            decision = self._journal.ingest(snapshot)
            if decision.decision is JournalDecision.ADDED:
                added += 1
                accepted.append(decision.entry)
            elif decision.decision is JournalDecision.DUPLICATE:
                duplicates += 1
            else:
                held += 1
        return PollSummary(
            source_id=source_id,
            status="OBSERVED_METADATA_ONLY" if not held else "PARTIAL_HOLD",
            added=added,
            duplicates=duplicates,
            held=held,
            reason_codes=("NOT_AN_EXTERNAL_MODEL_FAILURE_CONFIRMATION",) if not held
                else ("UNTRUSTED_RECORDS_HELD", "NOT_AN_EXTERNAL_MODEL_FAILURE_CONFIRMATION"),
            observations=tuple(accepted),
        )
