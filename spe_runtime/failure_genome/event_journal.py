"""Failure Genome R2: deterministic, read-only public-source event journal.

Consumes caller-supplied public metadata, NEVER fetches external URLs, trusts
provider-controlled incident content, publishes pages, or processes user prompts.
The existing website/Worker owner must separately authorize any live ingress.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, replace
from datetime import datetime, timezone
from enum import Enum
from ipaddress import ip_address
from typing import Mapping
from urllib.parse import urlsplit


class EventKind(str, Enum):
    NOTICE = "NOTICE"
    UPDATE = "UPDATE"
    CORRECTION = "CORRECTION"
    RETRACTION = "RETRACTION"


class JournalDecision(str, Enum):
    ADDED = "ADDED"
    DUPLICATE = "DUPLICATE"
    HOLD = "HOLD"


@dataclass(frozen=True)
class SourceAuthority:
    source_id: str
    hostname: str
    allowed_path_prefix: str


@dataclass(frozen=True)
class SourceSnapshot:
    source_id: str
    event_id: str
    url: str
    content_sha256: str
    source_published_at: str
    observed_at: str
    event_kind: EventKind
    subject_model: str
    title: str  # untrusted, for internal review only
    predecessor_digest: str | None = None


@dataclass(frozen=True)
class JournalEntry:
    source_id: str
    event_id: str
    content_sha256: str
    observed_at: str
    source_published_at: str
    event_kind: EventKind
    chain_parent: str
    chain_digest: str
    predecessor_digest: str | None
    # No private prompts, raw provider bodies, secrets or verified causal claims.
    external_incident_confirmed: bool = False
    publication_authorized: bool = False


@dataclass(frozen=True)
class JournalResult:
    decision: JournalDecision
    reason_codes: tuple[str, ...]
    entry: JournalEntry | None = None


def _utc(value: object) -> datetime | None:
    if not isinstance(value, str):
        return None
    try:
        result = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    if result.tzinfo is None or result.utcoffset() is None:
        return None
    return result.astimezone(timezone.utc)


def _safe_path_prefix(path: str) -> bool:
    return path.startswith("/") and not any(x in path for x in ("..", "\\", "%", "#", "?"))


def _source_matches(snapshot: SourceSnapshot, authority: SourceAuthority) -> bool:
    if authority.source_id != snapshot.source_id or not _safe_path_prefix(authority.allowed_path_prefix):
        return False
    try:
        url = urlsplit(snapshot.url)
        if url.scheme != "https" or not url.hostname or url.username or url.password or url.fragment:
            return False
        if url.port not in (None, 443) or url.query:
            return False
        hostname = url.hostname.lower().rstrip(".")
        trusted = authority.hostname.lower().rstrip(".")
        if hostname != trusted or len(snapshot.url) > 2048:
            return False
        try:
            ip_address(hostname)
            return False
        except ValueError:
            pass
        if hostname in ("localhost",) or hostname.endswith(".localhost") or "." not in hostname:
            return False
        if any(ord(char) < 33 for char in snapshot.url):
            return False
        if any(ch in url.path for ch in ("\\", "%", "<", ">")) or "/../" in url.path or "/./" in url.path:
            return False
        prefix = authority.allowed_path_prefix.rstrip("/")
        return url.path == prefix or url.path.startswith(prefix + "/")
    except (ValueError, TypeError, AttributeError):
        return False


def _digest_ok(value: object) -> bool:
    return isinstance(value, str) and len(value) == 64 and all(c in "0123456789abcdef" for c in value)


def _canonical(value: dict[str, object]) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


class SourceEventJournal:
    """Append-only in-memory metadata journal for independently approved ingress.

    The host can persist it through its existing audited storage owner. This
    module itself neither fetches nor writes to disk. Its hash chain detects
    accidental/malicious local row editing, but is NOT signed remote evidence.
    """

    def __init__(self, authorities: Mapping[str, SourceAuthority], *, max_events: int = 4096):
        if not authorities or max_events < 1 or max_events > 100_000:
            raise ValueError("Explicit trusted source allowlist and bounded event budget required")
        self._authorities = dict(authorities)
        self._max_events = max_events
        self._entries: list[JournalEntry] = []
        self._subjects: dict[tuple[str, str], tuple[str, str, str, str]] = {}

    @property
    def entries(self) -> tuple[JournalEntry, ...]:
        return tuple(self._entries)

    def latest_entry(self, source_id: str, event_id: str) -> JournalEntry | None:
        """Read-only owner API; do not expose mutable revision bookkeeping."""
        return next((item for item in reversed(self._entries)
                     if item.source_id == source_id and item.event_id == event_id), None)

    def ingest(self, snapshot: SourceSnapshot) -> JournalResult:
        if not isinstance(snapshot, SourceSnapshot):
            return JournalResult(JournalDecision.HOLD, ("MALFORMED_SNAPSHOT",))
        authority = self._authorities.get(snapshot.source_id)
        if not isinstance(authority, SourceAuthority) or not _source_matches(snapshot, authority):
            return JournalResult(JournalDecision.HOLD, ("SOURCE_NOT_ALLOWLISTED",))
        if not isinstance(snapshot.event_kind, EventKind):
            return JournalResult(JournalDecision.HOLD, ("INVALID_EVENT_KIND",))
        if not isinstance(snapshot.event_id, str) or not 1 <= len(snapshot.event_id) <= 128 or not all(
            c.isascii() and (c.isalnum() or c in "-_.") for c in snapshot.event_id
        ):
            return JournalResult(JournalDecision.HOLD, ("INVALID_EVENT_ID",))
        if not isinstance(snapshot.subject_model, str) or not 1 <= len(snapshot.subject_model) <= 100:
            return JournalResult(JournalDecision.HOLD, ("MODEL_SUBJECT_MISSING",))
        # Text never enters the hash ledger or public output; bounded untrusted
        # title still must have no markup/control code for future host review.
        if not isinstance(snapshot.title, str) or not 1 <= len(snapshot.title) <= 240 or any(
            ord(ch) < 32 or ch in "<>" for ch in snapshot.title
        ):
            return JournalResult(JournalDecision.HOLD, ("INVALID_UNTRUSTED_TITLE",))
        if not _digest_ok(snapshot.content_sha256):
            return JournalResult(JournalDecision.HOLD, ("SOURCE_BODY_DIGEST_INVALID",))
        published = _utc(snapshot.source_published_at)
        observed = _utc(snapshot.observed_at)
        if published is None or observed is None or observed < published:
            return JournalResult(JournalDecision.HOLD, ("SOURCE_TIMESTAMPS_INVALID",))
        subject_key = (snapshot.source_id, snapshot.event_id)
        prior = self._subjects.get(subject_key)
        if prior is None:
            if snapshot.event_kind != EventKind.NOTICE or snapshot.predecessor_digest is not None:
                return JournalResult(JournalDecision.HOLD, ("FIRST_VERSION_MUST_BE_NOTICE",))
        else:
            previous_digest, previous_observed, last_kind, original_url = prior
            if snapshot.url != original_url:
                return JournalResult(JournalDecision.HOLD, ("SOURCE_URL_CHANGED",))
            if snapshot.content_sha256 == previous_digest:
                return JournalResult(JournalDecision.DUPLICATE, ("SAME_SOURCE_SNAPSHOT",))
            if last_kind == EventKind.RETRACTION.value:
                return JournalResult(JournalDecision.HOLD, ("RETRACTED_EVENT_TERMINAL",))
            if snapshot.event_kind == EventKind.NOTICE or snapshot.predecessor_digest != previous_digest:
                return JournalResult(JournalDecision.HOLD, ("REVISION_PREDECESSOR_MISMATCH",))
            if observed <= _utc(previous_observed):
                return JournalResult(JournalDecision.HOLD, ("NON_MONOTONIC_OBSERVATION",))
        if len(self._entries) >= self._max_events:
            return JournalResult(JournalDecision.HOLD, ("EVENT_BUDGET_EXCEEDED",))
        parent = self._entries[-1].chain_digest if self._entries else "0" * 64
        claims = {
            "source_id": snapshot.source_id,
            "event_id": snapshot.event_id,
            "content_sha256": snapshot.content_sha256,
            "source_published_at": snapshot.source_published_at,
            "observed_at": snapshot.observed_at,
            "event_kind": snapshot.event_kind.value,
            "predecessor_digest": snapshot.predecessor_digest,
            "chain_parent": parent,
        }
        chain_digest = hashlib.sha256(_canonical(claims)).hexdigest()
        record = JournalEntry(
            source_id=snapshot.source_id,
            event_id=snapshot.event_id,
            content_sha256=snapshot.content_sha256,
            observed_at=snapshot.observed_at,
            source_published_at=snapshot.source_published_at,
            event_kind=snapshot.event_kind,
            chain_parent=parent,
            chain_digest=chain_digest,
            predecessor_digest=snapshot.predecessor_digest,
        )
        self._entries.append(record)
        self._subjects[subject_key] = (
            snapshot.content_sha256, snapshot.observed_at, snapshot.event_kind.value, snapshot.url
        )
        return JournalResult(JournalDecision.ADDED, ("METADATA_ONLY_NOT_EVENT_VERIFICATION",), record)

    def verify_chain(self) -> bool:
        parent = "0" * 64
        for entry in self._entries:
            if entry.chain_parent != parent:
                return False
            data = {
                "source_id": entry.source_id,
                "event_id": entry.event_id,
                "content_sha256": entry.content_sha256,
                "source_published_at": entry.source_published_at,
                "observed_at": entry.observed_at,
                "event_kind": entry.event_kind.value,
                "predecessor_digest": entry.predecessor_digest,
                "chain_parent": parent,
            }
            if entry.chain_digest != hashlib.sha256(_canonical(data)).hexdigest():
                return False
            parent = entry.chain_digest
        return True
