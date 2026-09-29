"""Filesystem custody. Same durability rules the browser OPFS + IndexedDB pair uses.

Journal is the source of truth. Blob names include their SHA-256. A crash
before the journal line leaves orphan blobs that replay ignores. A torn final
journal line is ignored. Nothing is treated as stored until the journal fsyncs.
"""

from __future__ import annotations

import json
import os
import re
from pathlib import Path
from typing import Any

from spe_runtime.massive.errors import MassiveError

_SESSION_ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]{7,63}$")
_BLOB_REL = re.compile(r"^blobs/(?:chunks/\d{8}-[0-9a-f]{64}|tails/[0-9a-f]{64})\.utf8$")


def validate_session_id(session_id: str) -> str:
    if not isinstance(session_id, str) or not _SESSION_ID.fullmatch(session_id):
        raise MassiveError("INVALID_SESSION_ID", "session id is not a safe token")
    return session_id


class FileCustody:
    def __init__(self, root: str | Path) -> None:
        self.root = Path(root)

    def session_dir(self, session_id: str) -> Path:
        return self.root / "sessions" / validate_session_id(session_id)

    def exists(self, session_id: str) -> bool:
        return (self.session_dir(session_id) / "journal.jsonl").exists()

    def append_journal(self, session_id: str, record: dict[str, Any]) -> None:
        directory = self.session_dir(session_id)
        directory.mkdir(parents=True, exist_ok=True)
        path = directory / "journal.jsonl"
        line = json.dumps(record, sort_keys=True, separators=(",", ":")) + "\n"
        fd = os.open(path, os.O_APPEND | os.O_CREAT | os.O_WRONLY, 0o644)
        try:
            os.write(fd, line.encode("utf-8"))
            os.fsync(fd)
        finally:
            os.close(fd)

    def read_journal(self, session_id: str) -> list[dict[str, Any]]:
        path = self.session_dir(session_id) / "journal.jsonl"
        if not path.exists():
            raise MassiveError("SESSION_MISSING", "no journal for session")
        out: list[dict[str, Any]] = []
        with path.open("r", encoding="utf-8") as handle:
            for line in handle:
                stripped = line.strip()
                if not stripped:
                    continue
                try:
                    out.append(json.loads(stripped))
                except json.JSONDecodeError:
                    break
        return out

    def write_blob(self, session_id: str, rel: str, data: bytes) -> None:
        path = self._blob_path(session_id, rel)
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_name(path.name + ".tmp")
        with tmp.open("wb") as handle:
            handle.write(data)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(tmp, path)
        dirfd = os.open(path.parent, os.O_RDONLY)
        try:
            os.fsync(dirfd)
        finally:
            os.close(dirfd)

    def read_blob(self, session_id: str, rel: str) -> bytes | None:
        path = self._blob_path(session_id, rel)
        if not path.exists():
            return None
        return path.read_bytes()

    def write_json(self, session_id: str, name: str, payload: dict[str, Any]) -> None:
        if name not in {"ir.json", "index.json"}:
            raise MassiveError("BAD_PATH", "refusing to write an unknown custody file")
        directory = self.session_dir(session_id)
        directory.mkdir(parents=True, exist_ok=True)
        path = directory / name
        data = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
        tmp = path.with_name(path.name + ".tmp")
        with tmp.open("wb") as handle:
            handle.write(data)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(tmp, path)

    def read_json(self, session_id: str, name: str) -> dict[str, Any] | None:
        if name not in {"ir.json", "index.json"}:
            raise MassiveError("BAD_PATH", "refusing to read an unknown custody file")
        path = self.session_dir(session_id) / name
        if not path.exists():
            return None
        return json.loads(path.read_text(encoding="utf-8"))

    def wipe_blobs(self, session_id: str) -> None:
        blob_root = self.session_dir(session_id) / "blobs"
        if not blob_root.exists():
            return
        for path in sorted(blob_root.rglob("*"), reverse=True):
            if path.is_file() or path.is_symlink():
                path.unlink()
            elif path.is_dir():
                path.rmdir()
        if blob_root.exists():
            blob_root.rmdir()

    def blob_count(self, session_id: str) -> int:
        blob_root = self.session_dir(session_id) / "blobs"
        if not blob_root.exists():
            return 0
        return sum(1 for path in blob_root.rglob("*") if path.is_file())

    def _blob_path(self, session_id: str, rel: str) -> Path:
        if not _BLOB_REL.fullmatch(rel):
            raise MassiveError("BAD_PATH", "blob path is not in the custody layout")
        path = self.session_dir(session_id) / rel
        root = self.session_dir(session_id).resolve()
        resolved = path.resolve()
        if root != resolved and root not in resolved.parents:
            raise MassiveError("BAD_PATH", "blob path escapes the session")
        return path
