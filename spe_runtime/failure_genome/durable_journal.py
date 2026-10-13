"""R11 durable custody adapter for the existing SPE Failure Genome journal.

Host-side POSIX file storage ONLY; private/offline SPE semantic runtime unchanged.
This is not an independently trusted audit ledger: a privileged actor could
rewrite the state and its unsiged SHA-256 chain. External owner-pinned
checkpoints are required for rollback resistance and source authenticity.

Guarantees within tested single-host scope: bounded metadata-only schema,
strict deterministic re-ingestion, fail-closed corruption, advisory flock
serialization, fsync + atomic replace, no symlink/hardlink state files, and
no credential, raw source content, prompt, user telemetry or publication.
"""
from __future__ import annotations

import fcntl
import hashlib
import json
import os
import stat
import tempfile
from contextlib import contextmanager
from dataclasses import dataclass
from pathlib import Path
from typing import Iterator, Mapping

from .event_journal import (
    EventKind, JournalDecision, SourceAuthority, SourceEventJournal, SourceSnapshot,
)

_FORMAT = "spe.failure_genome.metadata_journal.v1"
_MAX_BYTES = 8 * 1024 * 1024
_MAX_ENTRIES = 4096
_TITLE = "PUBLIC_STATUS_NOTICE_METADATA_ONLY"


class JournalCustodyError(RuntimeError):
    """Fail-closed: the caller must not poll, publish or overwrite this state."""


@dataclass(frozen=True)
class CustodyStatus:
    records: int
    head_sha256: str
    allowlist_sha256: str
    metadata_document_sha256: str
    source_content_independently_verified: bool = False
    rollback_resistant_checkpoint: bool = False
    publication_authorized: bool = False


def _json_bytes(data: object) -> bytes:
    return json.dumps(
        data, sort_keys=True, ensure_ascii=False,
        separators=(",", ":"), allow_nan=False,
    ).encode("utf-8")


def _sha(data: object) -> str:
    return hashlib.sha256(_json_bytes(data)).hexdigest()


def _allowlist_digest(authorities: Mapping[str, SourceAuthority]) -> str:
    if not authorities or len(authorities) > 100:
        raise JournalCustodyError("INVALID_SOURCE_ALLOWLIST")
    owners = []
    for key in sorted(authorities):
        a = authorities[key]
        if not isinstance(key, str) or not isinstance(a, SourceAuthority) or a.source_id != key:
            raise JournalCustodyError("INVALID_SOURCE_ALLOWLIST")
        owners.append({
            "source_id": a.source_id,
            "hostname": a.hostname,
            "allowed_path_prefix": a.allowed_path_prefix,
        })
    return _sha(owners)


def _safe_parent(path: Path) -> None:
    try:
        parent = path.parent.lstat()
    except OSError as exc:
        raise JournalCustodyError("STATE_DIRECTORY_UNAVAILABLE") from exc
    if not stat.S_ISDIR(parent.st_mode) or parent.st_mode & 0o022:
        raise JournalCustodyError("STATE_DIRECTORY_UNSAFE")
    if path.name in ("", ".", "..") or not path.is_absolute():
        raise JournalCustodyError("STATE_PATH_NOT_ABSOLUTE")


def _check_existing(path: Path) -> bool:
    try:
        item = path.lstat()
    except FileNotFoundError:
        return False
    except OSError as exc:
        raise JournalCustodyError("STATE_FILE_INACCESSIBLE") from exc
    if not stat.S_ISREG(item.st_mode) or item.st_nlink != 1 or item.st_mode & 0o077:
        raise JournalCustodyError("STATE_FILE_UNSAFE")
    return True


def _read_existing(path: Path) -> bytes | None:
    if not _check_existing(path):
        return None
    flags = os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0) | getattr(os, "O_CLOEXEC", 0)
    try:
        fd = os.open(path, flags)
        with os.fdopen(fd, "rb") as stream:
            if os.fstat(stream.fileno()).st_nlink != 1:
                raise JournalCustodyError("STATE_FILE_UNSAFE")
            body = stream.read(_MAX_BYTES + 1)
    except OSError as exc:
        raise JournalCustodyError("STATE_FILE_READ_FAILED") from exc
    if len(body) > _MAX_BYTES:
        raise JournalCustodyError("STATE_SIZE_LIMIT_EXCEEDED")
    return body


def _make_state(journal: SourceEventJournal, allowlist_sha: str) -> bytes:
    if not journal.verify_chain() or len(journal.entries) != len(journal.observations):
        raise JournalCustodyError("UNVERIFIED_LOCAL_CHAIN")
    observations = []
    for snapshot, entry in zip(journal.observations, journal.entries):
        if snapshot.title != _TITLE:
            raise JournalCustodyError("NON_METADATA_TITLE")
        observations.append({
            "source_id": snapshot.source_id,
            "event_id": snapshot.event_id,
            "url": snapshot.url,
            "content_sha256": snapshot.content_sha256,
            "source_published_at": snapshot.source_published_at,
            "observed_at": snapshot.observed_at,
            "event_kind": snapshot.event_kind.value,
            "subject_model": snapshot.subject_model,
            "predecessor_digest": snapshot.predecessor_digest,
            "chain_digest": entry.chain_digest,
        })
    if len(observations) > _MAX_ENTRIES:
        raise JournalCustodyError("STATE_EVENT_LIMIT_EXCEEDED")
    document = {
        "schema": _FORMAT,
        "allowlist_sha256": allowlist_sha,
        "count": len(observations),
        "head": journal.entries[-1].chain_digest if journal.entries else "0" * 64,
        "observations": observations,
    }
    document["document_sha256"] = _sha(document)
    blob = _json_bytes(document)
    if len(blob) > _MAX_BYTES:
        raise JournalCustodyError("STATE_SIZE_LIMIT_EXCEEDED")
    return blob


def metadata_document_sha256(journal: SourceEventJournal, allowlist_sha: str) -> str:
    """Digest of the *whole* normalized durable metadata document.

    The R2 chain digest alone does not include all source URL/model-scope
    fields. This digest must be pinned by the owner's R12 signed checkpoint.
    """
    data = json.loads(_make_state(journal, allowlist_sha).decode("utf-8"))
    return data["document_sha256"]


def _load_state(
    body: bytes | None,
    authorities: Mapping[str, SourceAuthority],
    max_events: int,
    expected_allowlist: str,
) -> SourceEventJournal:
    journal = SourceEventJournal(authorities, max_events=max_events)
    if body is None:
        return journal
    try:
        data = json.loads(body.decode("utf-8"),
                          parse_constant=lambda _: (_ for _ in ()).throw(ValueError("not finite")))
    except (ValueError, UnicodeError, TypeError) as exc:
        raise JournalCustodyError("STATE_JSON_INVALID") from exc
    if not isinstance(data, dict) or set(data) != {
        "schema", "allowlist_sha256", "count", "head",
        "observations", "document_sha256",
    }:
        raise JournalCustodyError("STATE_SCHEMA_INVALID")
    expected_doc = {k: v for k, v in data.items() if k != "document_sha256"}
    if data["document_sha256"] != _sha(expected_doc):
        raise JournalCustodyError("STATE_DIGEST_INVALID")
    if data["schema"] != _FORMAT or data["allowlist_sha256"] != expected_allowlist:
        raise JournalCustodyError("STATE_ALLOWLIST_OR_VERSION_CHANGED")
    if not isinstance(data["observations"], list) or len(data["observations"]) > max_events:
        raise JournalCustodyError("STATE_EVENT_LIMIT_EXCEEDED")
    if type(data["count"]) is not int or data["count"] != len(data["observations"]):
        raise JournalCustodyError("STATE_COUNT_CHANGED")
    fields = {
        "source_id", "event_id", "url", "content_sha256", "source_published_at",
        "observed_at", "event_kind", "subject_model", "predecessor_digest", "chain_digest",
    }
    for record in data["observations"]:
        if not isinstance(record, dict) or set(record) != fields:
            raise JournalCustodyError("STATE_EVENT_SCHEMA_INVALID")
        if record["event_kind"] not in tuple(x.value for x in EventKind):
            raise JournalCustodyError("STATE_EVENT_KIND_INVALID")
        if any(not isinstance(record[key], str) for key in (
            "source_id", "event_id", "url", "content_sha256",
            "source_published_at", "observed_at", "subject_model", "chain_digest",
        )):
            raise JournalCustodyError("STATE_EVENT_TYPE_INVALID")
        if record["predecessor_digest"] is not None and not isinstance(record["predecessor_digest"], str):
            raise JournalCustodyError("STATE_EVENT_TYPE_INVALID")
        source = SourceSnapshot(
            source_id=record["source_id"],
            event_id=record["event_id"],
            url=record["url"],
            content_sha256=record["content_sha256"],
            source_published_at=record["source_published_at"],
            observed_at=record["observed_at"],
            event_kind=EventKind(record["event_kind"]),
            subject_model=record["subject_model"],
            title=_TITLE,
            predecessor_digest=record["predecessor_digest"],
        )
        result = journal.ingest(source)
        if (
            result.decision is not JournalDecision.ADDED
            or result.entry.chain_digest != record["chain_digest"]
        ):
            raise JournalCustodyError("STATE_HISTORY_NOT_REPRODUCIBLE")
    head = journal.entries[-1].chain_digest if journal.entries else "0" * 64
    if not journal.verify_chain() or data["head"] != head:
        raise JournalCustodyError("STATE_CHAIN_HEAD_INVALID")
    return journal


def _atomic_write(path: Path, blob: bytes) -> None:
    _safe_parent(path)
    _check_existing(path)
    fd, tmp_name = tempfile.mkstemp(prefix=".spe-custody-", dir=path.parent)
    try:
        os.fchmod(fd, 0o600)
        with os.fdopen(fd, "wb") as stream:
            stream.write(blob)
            stream.flush()
            os.fsync(stream.fileno())
        # Forbid replacing a symlink or hard-linked file inserted by a race.
        _check_existing(path)
        os.replace(tmp_name, path)
        dirfd = os.open(path.parent, os.O_RDONLY | getattr(os, "O_DIRECTORY", 0))
        try:
            os.fsync(dirfd)
        finally:
            os.close(dirfd)
    finally:
        if os.path.lexists(tmp_name):
            os.unlink(tmp_name)


class DurableJournalStore:
    """POSIX storage session, exclusive lock across load/poll/commit.

    The path must belong to the separately approved host storage owner.
    Never choose a path from untrusted news, user prompts or source metadata.
    """

    def __init__(
        self,
        state_path: Path,
        authorities: Mapping[str, SourceAuthority],
        *,
        max_events: int = _MAX_ENTRIES,
    ):
        path = Path(state_path)
        if not path.is_absolute() or not 1 <= max_events <= _MAX_ENTRIES:
            raise JournalCustodyError("INVALID_STORE_CONFIGURATION")
        _safe_parent(path)
        self.path = path
        self.authorities = dict(authorities)
        self.max_events = max_events
        self.allowlist_sha256 = _allowlist_digest(self.authorities)

    @contextmanager
    def session(self) -> Iterator[SourceEventJournal]:
        """In one lock: verify state, ingest snapshots, fsync next state.

        A crash after a successful HTTPS fetch but before commit can lose that
        observation; next poll may rediscover it. No public side effects or
        notifications are performed before the durable commit.
        """
        _safe_parent(self.path)
        lock_path = self.path.with_name(self.path.name + ".lock")
        _check_existing(lock_path)
        flags = (os.O_CREAT | os.O_RDWR
                 | getattr(os, "O_NOFOLLOW", 0)
                 | getattr(os, "O_CLOEXEC", 0))
        try:
            fd = os.open(lock_path, flags, 0o600)
        except OSError as exc:
            raise JournalCustodyError("LOCK_FILE_UNAVAILABLE") from exc
        try:
            if not stat.S_ISREG(os.fstat(fd).st_mode) or os.fstat(fd).st_nlink != 1:
                raise JournalCustodyError("LOCK_FILE_UNSAFE")
            fcntl.flock(fd, fcntl.LOCK_EX)
            journal = _load_state(
                _read_existing(self.path),
                self.authorities,
                self.max_events,
                self.allowlist_sha256,
            )
            old_head = journal.entries[-1].chain_digest if journal.entries else "0" * 64
            old_len = len(journal.entries)
            yield journal
            if not journal.verify_chain():
                raise JournalCustodyError("STATE_CHAIN_TAMPERED_DURING_SESSION")
            if old_len != len(journal.entries):
                if old_len > len(journal.entries):
                    raise JournalCustodyError("STATE_TRUNCATED_DURING_SESSION")
                if old_len and journal.entries[old_len - 1].chain_digest != old_head:
                    raise JournalCustodyError("STATE_REWRITTEN_DURING_SESSION")
                _atomic_write(self.path, _make_state(journal, self.allowlist_sha256))
        finally:
            try:
                fcntl.flock(fd, fcntl.LOCK_UN)
            finally:
                os.close(fd)

    def audit(self) -> CustodyStatus:
        with self.session() as journal:
            return CustodyStatus(
                records=len(journal.entries),
                head_sha256=journal.entries[-1].chain_digest if journal.entries else "0" * 64,
                allowlist_sha256=self.allowlist_sha256,
                metadata_document_sha256=metadata_document_sha256(journal, self.allowlist_sha256),
            )
