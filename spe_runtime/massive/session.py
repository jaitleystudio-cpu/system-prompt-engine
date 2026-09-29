"""Million-word intake session.

Durable prefix, explicit refusal over the word cap, and halt on memory
pressure. The sealed document is a MassiveSourceIR. It is not a semantic pass.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from typing import Any, Callable

from spe_runtime.massive.chunking import next_chunk_end
from spe_runtime.massive.constants import (
    HARD_CHARS,
    IR_VERSION,
    MAX_RESIDENT_CHARS,
    PROTOCOL,
    TARGET_CHARS,
    WORD_CAP,
)
from spe_runtime.massive.custody import FileCustody
from spe_runtime.massive.errors import MassiveError
from spe_runtime.massive.evidence import attach_chunk_indexes, scan_explicit_evidence
from spe_runtime.massive.hashing import sha256_bytes, sha256_text
from spe_runtime.massive.ir import base_ir, build_source_map, freeze_ir, memory_block
from spe_runtime.massive.whitespace import count_word_starts

PressureHook = Callable[[int], bool]


@dataclass
class _Ram:
    pending: str
    inside_word: bool
    char_origin: int
    byte_origin: int
    word_origin: int
    next_index: int
    chunk_metas: list[dict[str, Any]]
    chunk_chars: int
    chunk_bytes: int
    committed_words: int
    tail_sha256: str
    accepted_sha256: str
    peak_pending_chars: int
    pressure_events: list[dict[str, Any]]
    spilled_chunks: int
    unhashed: str
    hasher_tokens: bytes


def _empty_tail() -> dict[str, Any]:
    digest = sha256_text("")
    return {
        "sha256": digest,
        "char_length": 0,
        "byte_length": 0,
        "start_inside_word": False,
        "rel": f"blobs/tails/{digest}.utf8",
    }


class MassiveSession:
    def __init__(
        self,
        custody: FileCustody,
        session_id: str,
        *,
        target_chars: int = TARGET_CHARS,
        hard_chars: int = HARD_CHARS,
        max_resident_chars: int = MAX_RESIDENT_CHARS,
        word_cap: int = WORD_CAP,
        pressure: PressureHook | None = None,
    ) -> None:
        if not (1 <= target_chars <= hard_chars <= max_resident_chars):
            raise MassiveError("BAD_CONFIG", "require 1 <= target <= hard <= max resident")
        if word_cap < 0:
            raise MassiveError("BAD_CONFIG", "word cap cannot be negative")
        self.custody = custody
        self.session_id = session_id
        self.target_chars = target_chars
        self.hard_chars = hard_chars
        self.max_resident_chars = max_resident_chars
        self.word_cap = word_cap
        self._pressure = pressure or (lambda resident: resident <= max_resident_chars)
        self.status = "INCOMPLETE"
        self.pending = ""
        self.inside_word = False
        self.char_origin = 0
        self.byte_origin = 0
        self.word_origin = 0
        self.next_index = 0
        self.chunk_metas: list[dict[str, Any]] = []
        self.chunk_chars = 0
        self.chunk_bytes = 0
        self.committed_words = 0
        self.tail_sha256 = sha256_text("")
        self.accepted_sha256 = sha256_text("")
        self.peak_pending_chars = 0
        self.pressure_events: list[dict[str, Any]] = []
        self.spilled_chunks = 0
        self._unhashed = ""
        self._hasher = hashlib.sha256()
        self._hasher_live = True
        self.count_inside = False
        self.attempted_word_count = 0
        self.attempted_char_count = 0
        self.attempted_sha256: str | None = sha256_text("")
        self.attempted_sha256_status = "KNOWN"
        self._content_sha_known = True
        self.rejected_any = False
        self._blobs_cleared = False
        self._terminal_ir: dict[str, Any] | None = None

    def append(self, text: str) -> dict[str, Any]:
        if not isinstance(text, str):
            raise MassiveError("INVALID_TEXT", "append requires a string")
        if self.status in {"READY_FOR_F3E", "REFUSED", "CUSTODY_MISMATCH"}:
            raise MassiveError("NOT_APPENDABLE", "session is terminal")
        if self.status == "MEMORY_PRESSURE_HALTED":
            self.rejected_any = True
            return self._ack(rejected_char_count=len(text))
        if self.status == "REFUSED_IN_PROGRESS":
            self._count_only(text)
            return self._ack(rejected_char_count=0)
        if self.status != "INCOMPLETE":
            raise MassiveError("NOT_APPENDABLE", "session cannot accept text")
        if text == "":
            return self._ack(rejected_char_count=0)

        offset = 0
        rejected = 0
        while offset < len(text):
            if self.status != "INCOMPLETE":
                rejected += len(text) - offset
                break
            room = self.max_resident_chars - len(self.pending)
            if room <= 0:
                if not self._drain(seal=False):
                    rejected += self._halt(len(text) - offset)
                    break
                continue
            take = min(room, len(text) - offset)
            snap = self._snapshot()
            piece = text[offset : offset + take]
            self.pending += piece
            self._unhashed += piece
            self._note_pending()
            if not self._pressure_ok():
                self._restore(snap)
                rejected += self._halt(len(text) - offset)
                break
            try:
                decision = self._persist(seal=False)
            except MassiveError:
                self._restore(snap)
                raise
            if decision == "OVER":
                self._enter_refuse(text[offset + take :])
                break
            if decision == "HALT":
                self._restore(snap)
                rejected += self._halt(len(text) - offset)
                break
            offset += take
        return self._ack(rejected_char_count=rejected)

    def seal(self) -> dict[str, Any]:
        if self._terminal_ir is not None:
            return self._terminal_ir
        if self.status == "INCOMPLETE":
            decision = self._persist(seal=True)
            if decision == "OVER":
                self._enter_refuse("")
            elif decision == "OK":
                return self._seal_ready()
            elif decision == "HALT":
                self._halt(0)
        if self.status == "REFUSED_IN_PROGRESS":
            return self._seal_refused()
        if self.status == "MEMORY_PRESSURE_HALTED":
            return self._seal_halted()
        if self.status == "CUSTODY_MISMATCH":
            return self._seal_mismatch()
        raise MassiveError("NOT_SEALABLE", "session cannot be sealed from " + self.status)

    def status_view(self) -> dict[str, Any]:
        return self._ack(rejected_char_count=0)

    def _drain(self, *, seal: bool) -> bool:
        """Cut at least one chunk when the buffer can be cut. True if it cut."""
        end = next_chunk_end(
            self.pending,
            target=self.target_chars,
            hard=self.hard_chars,
            seal=False,
            start_inside_word=self.inside_word,
        )
        if end is None and not seal:
            return False
        decision = self._persist(seal=seal)
        return decision == "OK" and end is not None

    def _persist(self, *, seal: bool) -> str:
        """Journal the current pending buffer. Returns OK, OVER, or HALT."""
        snap = self._snapshot()
        journaled = False
        try:
            new_chunks: list[tuple[dict[str, Any], bytes]] = []
            while True:
                end = next_chunk_end(
                    self.pending,
                    target=self.target_chars,
                    hard=self.hard_chars,
                    seal=seal,
                    start_inside_word=self.inside_word,
                )
                if end is None:
                    break
                if end <= 0 or end > len(self.pending):
                    raise MassiveError("CHUNK_STALL", "chunker made no progress")
                preview = self.pending[:end]
                words, _ends = count_word_starts(preview, self.inside_word)
                if self.committed_words + words > self.word_cap:
                    self._restore(snap)
                    return "OVER"
                new_chunks.append(self._take(end))
            pending_words, _ = count_word_starts(self.pending, self.inside_word)
            if self.committed_words + pending_words > self.word_cap:
                self._restore(snap)
                return "OVER"
            if seal and self.pending:
                raise MassiveError("CHUNK_STALL", "seal left uncommitted text")
            if not self._pressure_ok():
                self._restore(snap)
                return "HALT"
            self._journal_commit(new_chunks)
            journaled = True
        except MassiveError:
            if not journaled:
                self._restore(snap)
            raise
        except OSError as exc:
            if not journaled:
                self._restore(snap)
            raise MassiveError("PERSIST_FAILED", "custody write failed") from exc
        return "OK"

    def _take(self, end: int) -> tuple[dict[str, Any], bytes]:
        text = self.pending[:end]
        begins = self.inside_word
        words, ends = count_word_starts(text, begins)
        raw = text.encode("utf-8")
        digest = sha256_bytes(raw)
        meta = {
            "index": self.next_index,
            "char_start": self.char_origin,
            "char_end": self.char_origin + len(text),
            "byte_start": self.byte_origin,
            "byte_end": self.byte_origin + len(raw),
            "word_start": self.word_origin,
            "word_end": self.word_origin + words,
            "sha256": digest,
            "begins_inside_word": begins,
            "ends_inside_word": ends,
            "split_inside_word": bool(begins or ends),
            "rel": f"blobs/chunks/{self.next_index:08d}-{digest}.utf8",
        }
        self.pending = self.pending[end:]
        self.inside_word = ends
        self.char_origin = int(meta["char_end"])
        self.byte_origin = int(meta["byte_end"])
        self.word_origin = int(meta["word_end"])
        self.next_index += 1
        self.committed_words += words
        self.chunk_chars += len(text)
        self.chunk_bytes += len(raw)
        self.spilled_chunks += 1
        self.pressure_events.append(
            {
                "action": "SPILL",
                "chunk_index": meta["index"],
                "pending_chars_after": len(self.pending),
            }
        )
        return meta, raw

    def _journal_commit(self, new_chunks: list[tuple[dict[str, Any], bytes]]) -> None:
        tail_raw = self.pending.encode("utf-8")
        tail_sha = sha256_bytes(tail_raw)
        tail = {
            "sha256": tail_sha,
            "char_length": len(self.pending),
            "byte_length": len(tail_raw),
            "start_inside_word": self.inside_word,
            "rel": f"blobs/tails/{tail_sha}.utf8",
        }
        hasher = self._hasher.copy()
        if self._unhashed:
            hasher.update(self._unhashed.encode("utf-8"))
        for meta, raw in new_chunks:
            self.custody.write_blob(self.session_id, str(meta["rel"]), raw)
        self.custody.write_blob(self.session_id, str(tail["rel"]), tail_raw)
        accepted = hasher.hexdigest()
        record = {
            "kind": "COMMIT",
            "chunks": [meta for meta, _raw in new_chunks],
            "tail": tail,
            "committed_words": self.committed_words,
            "chunk_chars": self.chunk_chars,
            "chunk_bytes": self.chunk_bytes,
            "accepted_sha256": accepted,
            "silent_truncation": False,
        }
        try:
            self.custody.append_journal(self.session_id, record)
        except OSError as exc:
            raise MassiveError("PERSIST_FAILED", "journal append failed") from exc
        self._hasher = hasher
        self._unhashed = ""
        self.chunk_metas.extend(record["chunks"])
        self.tail_sha256 = tail_sha
        self.accepted_sha256 = accepted
        self.attempted_word_count = self.committed_words + count_word_starts(
            self.pending, self.inside_word
        )[0]
        self.attempted_char_count = self.chunk_chars + len(self.pending)
        self.attempted_sha256 = accepted
        self.attempted_sha256_status = "KNOWN"
        self._write_index()

    def _enter_refuse(self, unconsumed: str) -> None:
        extra_text = self.pending + self._unhashed_overlap_guard(unconsumed)
        # pending still holds every char not yet cut into a journaled chunk,
        # including chars already in a previous tail. Word/char totals must use
        # the logical document: journaled chunks + pending + unconsumed.
        pending_words, inside_after = count_word_starts(self.pending, self.inside_word)
        rest_words, count_inside = count_word_starts(unconsumed, inside_after)
        self.count_inside = count_inside
        attempted_words = self.committed_words + pending_words + rest_words
        attempted_chars = self.chunk_chars + len(self.pending) + len(unconsumed)
        hasher = self._hasher.copy()
        if self._unhashed:
            hasher.update(self._unhashed.encode("utf-8"))
        if unconsumed:
            hasher.update(unconsumed.encode("utf-8"))
        content_sha = hasher.hexdigest() if self._hasher_live else None
        content_status = "KNOWN" if self._hasher_live else "UNKNOWN"
        self.custody.append_journal(
            self.session_id,
            {
                "kind": "REFUSE",
                "code": "WORD_BUDGET_EXCEEDED",
                "attempted_word_count": attempted_words,
                "attempted_char_count": attempted_chars,
                "attempted_sha256": content_sha,
                "attempted_sha256_status": content_status,
                "count_inside": count_inside,
                "silent_truncation": False,
                "stored_body": False,
            },
        )
        self.custody.wipe_blobs(self.session_id)
        self.custody.append_journal(
            self.session_id,
            {"kind": "BLOBS_CLEARED", "silent_truncation": False},
        )
        self.status = "REFUSED_IN_PROGRESS"
        self.chunk_metas = []
        self.pending = ""
        self._unhashed = ""
        self.inside_word = False
        self.count_inside = count_inside
        self.chunk_chars = 0
        self.chunk_bytes = 0
        self.committed_words = 0
        self.next_index = 0
        self.char_origin = 0
        self.byte_origin = 0
        self.word_origin = 0
        self.tail_sha256 = sha256_text("")
        self.accepted_sha256 = sha256_text("")
        self.attempted_word_count = attempted_words
        self.attempted_char_count = attempted_chars
        self.attempted_sha256 = content_sha
        self.attempted_sha256_status = content_status
        self._hasher = hasher
        self._hasher_live = content_status == "KNOWN"
        self._blobs_cleared = True
        self.rejected_any = True
        self._write_index()
        # `extra_text` is intentionally discarded after it has been counted.
        del extra_text

    def _unhashed_overlap_guard(self, unconsumed: str) -> str:
        return unconsumed

    def _count_only(self, text: str) -> None:
        words, self.count_inside = count_word_starts(text, self.count_inside)
        self.attempted_word_count += words
        self.attempted_char_count += len(text)
        if self._hasher_live and self.attempted_sha256_status == "KNOWN":
            self._hasher.update(text.encode("utf-8"))
            self.attempted_sha256 = self._hasher.hexdigest()
            sha_status = "KNOWN"
        else:
            self.attempted_sha256 = None
            self.attempted_sha256_status = "UNKNOWN"
            sha_status = "UNKNOWN"
            self._hasher_live = False
        self.custody.append_journal(
            self.session_id,
            {
                "kind": "COUNT",
                "attempted_word_count": self.attempted_word_count,
                "attempted_char_count": self.attempted_char_count,
                "attempted_sha256": self.attempted_sha256,
                "attempted_sha256_status": sha_status,
                "count_inside": self.count_inside,
                "added_chars": len(text),
                "silent_truncation": False,
            },
        )
        self._write_index()

    def _halt(self, rejected_chars: int) -> int:
        self._restore_pending_only_if_needed()
        self.custody.append_journal(
            self.session_id,
            {
                "kind": "HALT",
                "code": "MEMORY_PRESSURE",
                "rejected_char_count": rejected_chars,
                "silent_truncation": False,
                "durable_char_end": self.chunk_chars + len(self.pending),
            },
        )
        self.status = "MEMORY_PRESSURE_HALTED"
        self.rejected_any = True
        self.pressure_events.append(
            {
                "action": "HALT",
                "pending_chars": len(self.pending),
                "rejected_char_count": rejected_chars,
            }
        )
        self._write_index()
        return rejected_chars

    def _restore_pending_only_if_needed(self) -> None:
        """Halt must keep the last journaled tail, not an uncommitted buffer.

        Callers restore a snapshot before calling _halt when the failed slice
        is still in RAM. This hook is a no-op then. If pending diverges from
        the journaled tail, reload it.
        """
        if self._unhashed:
            # Drop only the unhashed suffix. The prefix of pending is the tail.
            if not self.pending.endswith(self._unhashed):
                raise MassiveError("CUSTODY_MISMATCH", "pending diverged from the durable tail")
            self.pending = self.pending[: len(self.pending) - len(self._unhashed)]
            self._unhashed = ""

    def _seal_ready(self) -> dict[str, Any]:
        if self.pending:
            raise MassiveError("CHUNK_STALL", "ready seal requires an empty tail")
        if self._unhashed:
            raise MassiveError("CHUNK_STALL", "unhashed text remained at seal")
        rebuilt = hashlib.sha256()
        word_inside = False
        words = 0
        chars = 0
        payloads: list[tuple[int, str]] = []
        for meta in self.chunk_metas:
            blob = self.custody.read_blob(self.session_id, str(meta["rel"]))
            if blob is None or sha256_bytes(blob) != meta["sha256"]:
                self.status = "CUSTODY_MISMATCH"
                return self._seal_mismatch()
            rebuilt.update(blob)
            text = blob.decode("utf-8")
            payloads.append((int(meta["index"]), text))
            started, word_inside = count_word_starts(text, word_inside)
            words += started
            chars += len(text)
        if rebuilt.hexdigest() != self.accepted_sha256 or words != self.committed_words or chars != self.chunk_chars:
            self.status = "CUSTODY_MISMATCH"
            return self._seal_mismatch()
        if words > self.word_cap:
            self._enter_refuse("")
            return self._seal_refused()
        evidence = scan_explicit_evidence(payloads)
        spans = [_public_span(meta) for meta in self.chunk_metas]
        attach_chunk_indexes(evidence["explicit_evidence"], spans)  # type: ignore[arg-type]
        source_map = build_source_map(
            spans,
            char_length=chars,
            byte_length=self.chunk_bytes,
            word_count=words,
            source_sha256=self.accepted_sha256,
        )
        if source_map["coverage"] != "COMPLETE":
            self.status = "CUSTODY_MISMATCH"
            return self._seal_mismatch()
        ir = base_ir(
            session_id=self.session_id,
            status="READY_FOR_F3E",
            word_cap=self.word_cap,
            attempted_word_count=words,
            attempted_char_count=chars,
            attempted_sha256=self.accepted_sha256,
            memory=self._memory(),
        )
        ir.update(
            {
                "attempted_sha256_status": "KNOWN",
                "loss_disclosed": False,
                "loss_kind": None,
                "word_count": words,
                "char_count": chars,
                "byte_count": self.chunk_bytes,
                "source_sha256": self.accepted_sha256,
                "chain_sha256": source_map["chain_sha256"],
                "stored_body": True,
                "accepted_lossless": True,
                "intake_complete": True,
                "source_complete": True,
                "prefix_only": False,
                "reconstructable": True,
                "source_map": source_map,
                "explicit_evidence": evidence["explicit_evidence"],
                "evidence_status": evidence["evidence_status"],
                "evidence_scan_status": evidence["evidence_scan_status"],
                "evidence_lines_skipped": evidence["evidence_lines_skipped"],
                "chunk_count": len(spans),
                "refusal": None,
            }
        )
        return self._finalize(ir)

    def _seal_refused(self) -> dict[str, Any]:
        if self.custody.blob_count(self.session_id) != 0:
            ir = self._incomplete_refusal("CUSTODY_CLEANUP_INCOMPLETE")
            return self._finalize(ir)
        ir = base_ir(
            session_id=self.session_id,
            status="REFUSED",
            word_cap=self.word_cap,
            attempted_word_count=self.attempted_word_count,
            attempted_char_count=self.attempted_char_count,
            attempted_sha256=self.attempted_sha256 or "",
            memory=self._memory(),
        )
        ir.update(
            {
                "attempted_sha256": self.attempted_sha256,
                "attempted_sha256_status": self.attempted_sha256_status,
                "loss_disclosed": True,
                "loss_kind": "REFUSED_OVER_BUDGET_BODY_DISCARDED",
                "word_count": 0,
                "char_count": 0,
                "byte_count": 0,
                "source_sha256": None,
                "chain_sha256": None,
                "stored_body": False,
                "accepted_lossless": False,
                "intake_complete": True,
                "source_complete": False,
                "prefix_only": False,
                "reconstructable": False,
                "source_map": build_source_map(
                    [],
                    char_length=0,
                    byte_length=0,
                    word_count=0,
                    source_sha256=None,
                    coverage_override="REFUSED",
                ),
                "explicit_evidence": [],
                "evidence_status": "NOT_SCANNED",
                "evidence_scan_status": "NOT_SCANNED",
                "evidence_lines_skipped": 0,
                "chunk_count": 0,
                "refusal": {
                    "code": "WORD_BUDGET_EXCEEDED",
                    "stored_body": False,
                    "recoverable": False,
                    "silent_truncation": False,
                },
            }
        )
        return self._finalize(ir)

    def _incomplete_refusal(self, code: str) -> dict[str, Any]:
        ir = base_ir(
            session_id=self.session_id,
            status="REFUSED_IN_PROGRESS",
            word_cap=self.word_cap,
            attempted_word_count=self.attempted_word_count,
            attempted_char_count=self.attempted_char_count,
            attempted_sha256=self.attempted_sha256 or "",
            memory=self._memory(),
        )
        ir.update(
            {
                "attempted_sha256": self.attempted_sha256,
                "attempted_sha256_status": self.attempted_sha256_status,
                "loss_disclosed": True,
                "loss_kind": code,
                "word_count": 0,
                "char_count": 0,
                "byte_count": 0,
                "source_sha256": None,
                "chain_sha256": None,
                "stored_body": True,
                "accepted_lossless": False,
                "intake_complete": False,
                "source_complete": False,
                "prefix_only": False,
                "reconstructable": False,
                "source_map": build_source_map(
                    [],
                    char_length=0,
                    byte_length=0,
                    word_count=0,
                    source_sha256=None,
                    coverage_override="REFUSED",
                ),
                "explicit_evidence": [],
                "evidence_status": "NOT_SCANNED",
                "evidence_scan_status": "NOT_SCANNED",
                "evidence_lines_skipped": 0,
                "chunk_count": 0,
                "refusal": {
                    "code": code,
                    "stored_body": True,
                    "recoverable": False,
                    "silent_truncation": False,
                },
            }
        )
        return ir

    def _seal_halted(self) -> dict[str, Any]:
        verified = self._verify_prefix()
        if not verified:
            self.status = "CUSTODY_MISMATCH"
            return self._seal_mismatch()
        spans = [_public_span(meta) for meta in self.chunk_metas]
        source_map = build_source_map(
            spans,
            char_length=self.chunk_chars,
            byte_length=self.chunk_bytes,
            word_count=self.committed_words,
            source_sha256=None,
            coverage_override="PARTIAL",
        )
        ir = base_ir(
            session_id=self.session_id,
            status="MEMORY_PRESSURE_HALTED",
            word_cap=self.word_cap,
            attempted_word_count=self.committed_words,
            attempted_char_count=self.chunk_chars + len(self.pending),
            attempted_sha256=self.accepted_sha256,
            memory=self._memory(),
        )
        ir.update(
            {
                "attempted_sha256_status": "KNOWN",
                "loss_disclosed": True,
                "loss_kind": "ENGINE_HALTED_UNACCEPTED_TEXT",
                "word_count": self.committed_words,
                "char_count": self.chunk_chars,
                "byte_count": self.chunk_bytes,
                "source_sha256": None,
                "chain_sha256": source_map["chain_sha256"],
                "stored_body": bool(self.chunk_metas) or bool(self.pending),
                "accepted_lossless": True,
                "intake_complete": False,
                "source_complete": False,
                "prefix_only": True,
                "reconstructable": False,
                "source_map": source_map,
                "explicit_evidence": [],
                "evidence_status": "NOT_SCANNED",
                "evidence_scan_status": "NOT_SCANNED",
                "evidence_lines_skipped": 0,
                "chunk_count": len(spans),
                "refusal": {
                    "code": "MEMORY_PRESSURE",
                    "stored_body": bool(self.chunk_metas),
                    "recoverable": True,
                    "silent_truncation": False,
                },
            }
        )
        return self._finalize(ir)

    def _seal_mismatch(self) -> dict[str, Any]:
        self.status = "CUSTODY_MISMATCH"
        ir = base_ir(
            session_id=self.session_id,
            status="CUSTODY_MISMATCH",
            word_cap=self.word_cap,
            attempted_word_count=self.attempted_word_count,
            attempted_char_count=self.attempted_char_count,
            attempted_sha256=self.attempted_sha256 or "",
            memory=self._memory(),
        )
        ir.update(
            {
                "attempted_sha256": self.attempted_sha256,
                "attempted_sha256_status": "UNKNOWN",
                "loss_disclosed": True,
                "loss_kind": "CUSTODY_MISMATCH",
                "word_count": 0,
                "char_count": 0,
                "byte_count": 0,
                "source_sha256": None,
                "chain_sha256": None,
                "stored_body": self.custody.blob_count(self.session_id) > 0,
                "accepted_lossless": False,
                "intake_complete": False,
                "source_complete": False,
                "prefix_only": False,
                "reconstructable": False,
                "source_map": build_source_map(
                    [],
                    char_length=0,
                    byte_length=0,
                    word_count=0,
                    source_sha256=None,
                    coverage_override="MISMATCH",
                ),
                "explicit_evidence": [],
                "evidence_status": "NOT_SCANNED",
                "evidence_scan_status": "NOT_SCANNED",
                "evidence_lines_skipped": 0,
                "chunk_count": 0,
                "refusal": {
                    "code": "CUSTODY_MISMATCH",
                    "stored_body": self.custody.blob_count(self.session_id) > 0,
                    "recoverable": False,
                    "silent_truncation": False,
                },
            }
        )
        return self._finalize(ir)

    def _verify_prefix(self) -> bool:
        rebuilt = hashlib.sha256()
        for meta in self.chunk_metas:
            blob = self.custody.read_blob(self.session_id, str(meta["rel"]))
            if blob is None or sha256_bytes(blob) != meta["sha256"]:
                return False
            rebuilt.update(blob)
        tail_rel = f"blobs/tails/{self.tail_sha256}.utf8"
        tail = self.custody.read_blob(self.session_id, tail_rel)
        if tail is None:
            return self.tail_sha256 == sha256_text("") and self.pending == ""
        if sha256_bytes(tail) != self.tail_sha256:
            return False
        rebuilt.update(tail)
        return rebuilt.hexdigest() == self.accepted_sha256 and tail.decode("utf-8") == self.pending

    def _finalize(self, ir: dict[str, Any]) -> dict[str, Any]:
        frozen = freeze_ir(ir)
        encoded = json.dumps(frozen, sort_keys=True, separators=(",", ":")).encode("utf-8")
        self.custody.write_json(self.session_id, "ir.json", frozen)
        self.custody.append_journal(
            self.session_id,
            {
                "kind": "SEAL",
                "terminal_status": frozen["status"],
                "ir_sha256": sha256_bytes(encoded),
                "silent_truncation": False,
            },
        )
        self.status = str(frozen["status"])
        self._terminal_ir = frozen
        self._write_index()
        return frozen

    def _memory(self) -> dict[str, Any]:
        return memory_block(
            max_resident_chars=self.max_resident_chars,
            peak_pending_chars=self.peak_pending_chars,
            pressure_events=list(self.pressure_events),
            spilled_chunks=self.spilled_chunks,
        )

    def _write_index(self) -> None:
        """IndexedDB-shaped metadata. Bodies stay in blobs, never in this index."""
        self.custody.write_json(
            self.session_id,
            "index.json",
            {
                "session_id": self.session_id,
                "status": self.status,
                "silent_truncation": False,
                "semantic_judgment": "NOT_A_PASS",
                "chunk_count": len(self.chunk_metas),
                "chunks": self.chunk_metas,
                "tail_sha256": self.tail_sha256,
                "attempted_word_count": self.attempted_word_count,
                "attempted_char_count": self.attempted_char_count,
                "attempted_sha256_status": self.attempted_sha256_status,
                "stored_body": self.status not in {"REFUSED", "REFUSED_IN_PROGRESS"},
                "evidence": (self._terminal_ir or {}).get("explicit_evidence", []),
            },
        )

    def _pressure_ok(self) -> bool:
        try:
            return bool(self._pressure(len(self.pending)))
        except Exception as exc:
            raise MassiveError("PRESSURE_HOOK_FAILED", "pressure hook failed closed") from exc

    def _note_pending(self) -> None:
        self.peak_pending_chars = max(self.peak_pending_chars, len(self.pending))

    def _ack(self, *, rejected_char_count: int) -> dict[str, Any]:
        stored = self.status in {"INCOMPLETE", "MEMORY_PRESSURE_HALTED", "READY_FOR_F3E"} and (
            bool(self.chunk_metas) or bool(self.pending) or self.chunk_chars == 0 and self.status == "INCOMPLETE"
        )
        if self.status in {"REFUSED", "REFUSED_IN_PROGRESS"}:
            stored = False
        return {
            "protocol": PROTOCOL,
            "session_id": self.session_id,
            "status": self.status,
            "silent_truncation": False,
            "stored_body": stored and self.status != "INCOMPLETE" or bool(self.chunk_metas) or bool(self.pending),
            "durable_char_end": self.chunk_chars + len(self.pending),
            "rejected_char_count": rejected_char_count,
            "attempted_word_count": self.attempted_word_count
            if self.status != "INCOMPLETE"
            else self.committed_words + count_word_starts(self.pending, self.inside_word)[0],
            "semantic_judgment": "NOT_A_PASS",
            "semantic_engine": "NOT_INTEGRATED",
            "waits_for": "F3E_FREEZE",
        }

    def _snapshot(self) -> _Ram:
        snap = _Ram(
            pending=self.pending,
            inside_word=self.inside_word,
            char_origin=self.char_origin,
            byte_origin=self.byte_origin,
            word_origin=self.word_origin,
            next_index=self.next_index,
            chunk_metas=list(self.chunk_metas),
            chunk_chars=self.chunk_chars,
            chunk_bytes=self.chunk_bytes,
            committed_words=self.committed_words,
            tail_sha256=self.tail_sha256,
            accepted_sha256=self.accepted_sha256,
            peak_pending_chars=self.peak_pending_chars,
            pressure_events=list(self.pressure_events),
            spilled_chunks=self.spilled_chunks,
            unhashed=self._unhashed,
            hasher_tokens=b"",
        )
        snap.hasher = self._hasher.copy()  # type: ignore[attr-defined]
        snap.count_inside = self.count_inside  # type: ignore[attr-defined]
        return snap

    def _restore(self, snap: _Ram) -> None:
        self.pending = snap.pending
        self.inside_word = snap.inside_word
        self.char_origin = snap.char_origin
        self.byte_origin = snap.byte_origin
        self.word_origin = snap.word_origin
        self.next_index = snap.next_index
        self.chunk_metas = list(snap.chunk_metas)
        self.chunk_chars = snap.chunk_chars
        self.chunk_bytes = snap.chunk_bytes
        self.committed_words = snap.committed_words
        self.tail_sha256 = snap.tail_sha256
        self.accepted_sha256 = snap.accepted_sha256
        self.peak_pending_chars = max(self.peak_pending_chars, snap.peak_pending_chars)
        self.pressure_events = list(snap.pressure_events)
        self.spilled_chunks = snap.spilled_chunks
        self._unhashed = snap.unhashed
        self._hasher = snap.hasher.copy()  # type: ignore[attr-defined]
        self.count_inside = snap.count_inside  # type: ignore[attr-defined]


def open_session(
    root: str,
    session_id: str,
    *,
    target_chars: int = TARGET_CHARS,
    hard_chars: int = HARD_CHARS,
    max_resident_chars: int = MAX_RESIDENT_CHARS,
    word_cap: int = WORD_CAP,
    pressure: PressureHook | None = None,
) -> MassiveSession:
    custody = FileCustody(root)
    if custody.exists(session_id):
        raise MassiveError("SESSION_EXISTS", "session already has a journal")
    session = MassiveSession(
        custody,
        session_id,
        target_chars=target_chars,
        hard_chars=hard_chars,
        max_resident_chars=max_resident_chars,
        word_cap=word_cap,
        pressure=pressure,
    )
    custody.append_journal(
        session_id,
        {
            "kind": "OPEN",
            "session_id": session_id,
            "ir_version": IR_VERSION,
            "word_cap": word_cap,
            "target_chars": target_chars,
            "hard_chars": hard_chars,
            "max_resident_chars": max_resident_chars,
            "silent_truncation": False,
        },
    )
    session._journal_commit([])
    return session


def resume_session(
    root: str,
    session_id: str,
    *,
    target_chars: int | None = None,
    hard_chars: int | None = None,
    max_resident_chars: int | None = None,
    word_cap: int | None = None,
    pressure: PressureHook | None = None,
) -> MassiveSession:
    custody = FileCustody(root)
    records = custody.read_journal(session_id)
    folded = fold_journal(records)
    if target_chars is None:
        target_chars = int(folded["target_chars"])
    if hard_chars is None:
        hard_chars = int(folded["hard_chars"])
    if max_resident_chars is None:
        max_resident_chars = int(folded["max_resident_chars"])
    if word_cap is None:
        word_cap = int(folded["word_cap"])
    if (
        target_chars != folded["target_chars"]
        or hard_chars != folded["hard_chars"]
        or max_resident_chars != folded["max_resident_chars"]
        or word_cap != folded["word_cap"]
    ):
        raise MassiveError("CONFIG_MISMATCH", "resume config does not match OPEN")
    session = MassiveSession(
        custody,
        session_id,
        target_chars=target_chars,
        hard_chars=hard_chars,
        max_resident_chars=max_resident_chars,
        word_cap=word_cap,
        pressure=pressure,
    )
    session.status = str(folded["status"])
    session.chunk_metas = list(folded["chunks"])
    session.chunk_chars = int(folded["chunk_chars"])
    session.chunk_bytes = int(folded["chunk_bytes"])
    session.committed_words = int(folded["committed_words"])
    session.tail_sha256 = str(folded["tail"]["sha256"])
    session.accepted_sha256 = str(folded["accepted_sha256"])
    session.attempted_word_count = int(folded["attempted_word_count"])
    session.attempted_char_count = int(folded["attempted_char_count"])
    session.attempted_sha256 = folded["attempted_sha256"]
    session.attempted_sha256_status = str(folded["attempted_sha256_status"])
    session._hasher_live = False
    session._content_sha_known = session.attempted_sha256_status == "KNOWN"
    session._blobs_cleared = bool(folded["blobs_cleared"])
    session.count_inside = bool(folded.get("count_inside", False))
    session.next_index = len(session.chunk_metas)
    session.char_origin = session.chunk_chars
    session.byte_origin = session.chunk_bytes
    session.word_origin = session.committed_words
    session.inside_word = bool(folded["tail"]["start_inside_word"])
    if session.status == "REFUSED_IN_PROGRESS" and not session._blobs_cleared:
        custody.wipe_blobs(session_id)
        custody.append_journal(session_id, {"kind": "BLOBS_CLEARED", "silent_truncation": False})
        session._blobs_cleared = True
    if folded["terminal_ir_sha"]:
        ir = custody.read_json(session_id, "ir.json")
        if ir is None:
            session.status = "CUSTODY_MISMATCH"
        else:
            encoded = json.dumps(ir, sort_keys=True, separators=(",", ":")).encode("utf-8")
            if sha256_bytes(encoded) != folded["terminal_ir_sha"]:
                session.status = "CUSTODY_MISMATCH"
            else:
                session._terminal_ir = ir
                session.status = str(ir["status"])
    elif session.status in {"INCOMPLETE", "MEMORY_PRESSURE_HALTED"}:
        tail_blob = custody.read_blob(session_id, str(folded["tail"]["rel"]))
        session.pending = "" if tail_blob is None else tail_blob.decode("utf-8")
        session._hasher = hashlib.sha256()
        prefix_ok = True
        for meta in session.chunk_metas:
            blob = custody.read_blob(session_id, str(meta["rel"]))
            if blob is None or sha256_bytes(blob) != meta["sha256"]:
                prefix_ok = False
                break
            session._hasher.update(blob)
        if tail_blob is not None:
            if sha256_bytes(tail_blob) != session.tail_sha256:
                prefix_ok = False
            else:
                session._hasher.update(tail_blob)
        elif session.tail_sha256 != sha256_text(""):
            prefix_ok = False
        if not prefix_ok or session._hasher.hexdigest() != session.accepted_sha256:
            session.status = "CUSTODY_MISMATCH"
        else:
            session._hasher_live = True
    return session


def fold_journal(records: list[dict[str, Any]]) -> dict[str, Any]:
    if not records or records[0].get("kind") != "OPEN":
        raise MassiveError("SESSION_MISSING", "journal has no OPEN record")
    opened = records[0]
    state: dict[str, Any] = {
        "target_chars": opened["target_chars"],
        "hard_chars": opened["hard_chars"],
        "max_resident_chars": opened["max_resident_chars"],
        "word_cap": opened["word_cap"],
        "status": "INCOMPLETE",
        "chunks": [],
        "tail": _empty_tail(),
        "committed_words": 0,
        "chunk_chars": 0,
        "chunk_bytes": 0,
        "accepted_sha256": sha256_text(""),
        "attempted_word_count": 0,
        "attempted_char_count": 0,
        "attempted_sha256": sha256_text(""),
        "attempted_sha256_status": "KNOWN",
        "blobs_cleared": False,
        "count_inside": False,
        "terminal_ir_sha": None,
    }
    for record in records[1:]:
        kind = record.get("kind")
        status = state["status"]
        if kind == "COMMIT":
            if status != "INCOMPLETE":
                state["status"] = "CUSTODY_MISMATCH"
                continue
            state["chunks"] = list(state["chunks"]) + list(record["chunks"])
            state["tail"] = record["tail"]
            state["committed_words"] = record["committed_words"]
            state["chunk_chars"] = record["chunk_chars"]
            state["chunk_bytes"] = record["chunk_bytes"]
            state["accepted_sha256"] = record["accepted_sha256"]
            state["attempted_sha256"] = record["accepted_sha256"]
            state["attempted_word_count"] = record["committed_words"]
            state["attempted_char_count"] = record["chunk_chars"] + int(record["tail"]["char_length"])
        elif kind == "REFUSE":
            state["status"] = "REFUSED_IN_PROGRESS"
            state["chunks"] = []
            state["tail"] = _empty_tail()
            state["committed_words"] = 0
            state["chunk_chars"] = 0
            state["chunk_bytes"] = 0
            state["accepted_sha256"] = sha256_text("")
            state["attempted_word_count"] = record["attempted_word_count"]
            state["attempted_char_count"] = record["attempted_char_count"]
            state["attempted_sha256"] = record.get("attempted_sha256")
            state["attempted_sha256_status"] = record.get("attempted_sha256_status", "UNKNOWN")
            state["count_inside"] = bool(record.get("count_inside", False))
            state["blobs_cleared"] = False
        elif kind == "BLOBS_CLEARED":
            if state["status"] != "REFUSED_IN_PROGRESS":
                state["status"] = "CUSTODY_MISMATCH"
            else:
                state["blobs_cleared"] = True
        elif kind == "COUNT":
            if state["status"] != "REFUSED_IN_PROGRESS":
                state["status"] = "CUSTODY_MISMATCH"
            else:
                state["attempted_word_count"] = record["attempted_word_count"]
                state["attempted_char_count"] = record["attempted_char_count"]
                state["attempted_sha256"] = record.get("attempted_sha256")
                state["attempted_sha256_status"] = record.get("attempted_sha256_status", "UNKNOWN")
                state["count_inside"] = bool(record.get("count_inside", False))
        elif kind == "HALT":
            if state["status"] != "INCOMPLETE":
                state["status"] = "CUSTODY_MISMATCH"
            else:
                state["status"] = "MEMORY_PRESSURE_HALTED"
        elif kind == "SEAL":
            state["status"] = record["terminal_status"]
            state["terminal_ir_sha"] = record["ir_sha256"]
        else:
            state["status"] = "CUSTODY_MISMATCH"
    return state


def _public_span(meta: dict[str, Any]) -> dict[str, Any]:
    return {
        "index": meta["index"],
        "char_start": meta["char_start"],
        "char_end": meta["char_end"],
        "byte_start": meta["byte_start"],
        "byte_end": meta["byte_end"],
        "word_start": meta["word_start"],
        "word_end": meta["word_end"],
        "sha256": meta["sha256"],
        "begins_inside_word": meta["begins_inside_word"],
        "ends_inside_word": meta["ends_inside_word"],
        "split_inside_word": meta["split_inside_word"],
    }

